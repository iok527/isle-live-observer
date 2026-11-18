import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {validateBatch} from '../src/capture-adapter.mjs';

const MiB=1024*1024;
const idPattern=/^[A-Za-z0-9._:-]{1,96}$/;
const photoTypes=new Set(['image/jpeg','image/png']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const problem=(status,code)=>Object.assign(new Error(code),{status,code});
const validId=value=>typeof value==='string'&&idPattern.test(value);

function send(req,res,status,body){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:JSON.stringify(body));
}

async function readBody(req,limit){
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw problem(415,'JSON_REQUIRED');
  if(Number(req.headers['content-length'])>limit)throw problem(413,'BODY_TOO_LARGE');
  let length=0;
  const chunks=[];
  for await(const chunk of req.iterator({destroyOnReturn:false})){
    length+=chunk.length;
    if(length>limit){req.resume();throw problem(413,'BODY_TOO_LARGE');}
    chunks.push(chunk);
  }
  try{
    const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();
    return result;
  }catch{throw problem(400,'INVALID_JSON');}
}

function imageDimensions(bytes,type){
  if(type==='image/png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.toString('ascii',12,16)==='IHDR'){
    return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  }
  if(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){
    let offset=2;
    while(offset+4<=bytes.length&&bytes[offset]===255){
      const marker=bytes[offset+1];
      if(marker===255){offset++;continue;}
      if(marker===218||marker===217)break;
      const length=bytes.readUInt16BE(offset+2);
      if(length<2||offset+2+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){
        return [bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];
      }
      offset+=2+length;
    }
  }
  throw problem(422,'INVALID_IMAGE_HEADER');
}

function photoFrom({imageBase64,imageContentType}){
  if(!photoTypes.has(imageContentType))throw problem(415,'JPEG_OR_PNG_REQUIRED');
  if(typeof imageBase64!=='string'||imageBase64.length>4*Math.ceil(2.5*MiB/3)){
    throw problem(413,'IMAGE_TOO_LARGE');
  }
  const bytes=Buffer.from(imageBase64,'base64');
  if(!bytes.length||bytes.toString('base64')!==imageBase64)throw problem(422,'INVALID_BASE64');
  if(bytes.length>2.5*MiB)throw problem(413,'IMAGE_TOO_LARGE');
  const [width,height]=imageDimensions(bytes,imageContentType);
  if(!width||!height||width>4096||height>4096||width*height>12_000_000)throw problem(422,'IMAGE_DIMENSIONS');
  return {imageBase64,imageContentType,width,height,size:bytes.length,digest:sha(bytes)};
}

function readRecord(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function atomicWrite(file,value){
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{
    fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});
    fs.renameSync(temporary,file);
  }finally{fs.rmSync(temporary,{force:true});}
}

export function createCaptureLanRoute({directory,token}){
  if(typeof token!=='string'||token.length<16)throw new Error('Set CAPTURE_UPLOAD_TOKEN to a private token of at least 16 characters.');
  const root=path.resolve(directory);
  const captureDir=path.join(root,'captures'),batchDir=path.join(root,'batches');
  fs.mkdirSync(captureDir,{recursive:true,mode:0o700});
  fs.mkdirSync(batchDir,{recursive:true,mode:0o700});
  const captureFile=id=>path.join(captureDir,sha(id)+'.json');
  const batchFile=id=>path.join(batchDir,sha(id)+'.json');
  const mediaUrl=id=>'/api/capture/v1/media/'+encodeURIComponent(id);
  const batchUrl=id=>'/api/capture/v1/batches/'+encodeURIComponent(id);
  const tokenHash=Buffer.from(sha('Bearer '+token),'hex');
  function authenticate(req){
    const provided=Buffer.from(sha(req.headers.authorization||''),'hex');
    if(!timingSafeEqual(provided,tokenHash))throw problem(401,'UPLOAD_TOKEN_REQUIRED');
  }
  function batchCaptures(id){
    return fs.readdirSync(captureDir).filter(name=>/^[0-9a-f]{64}\.json$/.test(name))
      .map(name=>readRecord(path.join(captureDir,name))).filter(item=>item?.batchId===id&&!item.deleted);
  }
  function meta(body,captureId,batchId,sourceDeviceId){
    const {captureTimestamp,revision,status,objectLabel,objectCategory,spriteAssetId,note,errorCode,supportedEvolutionIds}=body;
    const capture={captureId,captureTimestamp,revision,status,objectLabel,objectCategory,spriteAssetId,note,errorCode,supportedEvolutionIds,localFileRef:mediaUrl(captureId)};
    try{
      validateBatch({protocolVersion:1,batchId,sourceDeviceId,captures:[capture]},'http://observer.invalid');
    }catch{throw problem(422,'INVALID_CAPTURE_METADATA');}
    return capture;
  }
  function docked(id){
    const batch=readRecord(batchFile(id));
    if(!batch)throw problem(404,'BATCH_NOT_DOCKED');
    if(batch.deleted)throw problem(410,'BATCH_DELETED');
    return batch;
  }

  async function handle(route,req,res){
    const method=req.method;
    const [,kind,id='']=route.match(/^\/api\/capture\/v1\/(health|captures|dock|batches|media)(?:\/([^/]+))?$/)||[];
    if(!kind||(id&&!validId(id)))throw problem(404,'ROUTE_NOT_FOUND');
    if(method==='GET'||method==='HEAD'){
      if(kind==='health'&&!id)return send(req,res,200,{protocolVersion:1,status:'ready'});
      if(kind==='batches'&&!id){
        const batches=fs.readdirSync(batchDir).filter(name=>/^[0-9a-f]{64}\.json$/.test(name))
          .map(name=>readRecord(path.join(batchDir,name))).filter(batch=>batch&&!batch.deleted)
          .sort((a,b)=>b.dockedAt.localeCompare(a.dockedAt));
        return send(req,res,200,{batches:batches.map(({batchId,sourceDeviceId,dockedAt,captureIds})=>({
          batchId,sourceDeviceId,dockedAt,count:captureIds.length,batchUrl:batchUrl(batchId),
        }))});
      }
      if(kind==='batches'&&id){
        const batch=docked(id);
        const captures=batch.captureIds.map(captureId=>readRecord(captureFile(captureId))?.capture);
        if(captures.some(capture=>!capture))throw problem(409,'BATCH_INCOMPLETE');
        return send(req,res,200,{protocolVersion:1,batchId:id,sourceDeviceId:batch.sourceDeviceId,captures});
      }
      if(kind==='media'&&id){
        const record=readRecord(captureFile(id));
        if(!record||record.deleted)throw problem(404,'IMAGE_NOT_FOUND');
        docked(record.batchId);
        const bytes=Buffer.from(record.photo.imageBase64,'base64');
        res.writeHead(200,{'Content-Type':record.photo.imageContentType,'Content-Length':bytes.length,
          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(method==='HEAD'?undefined:bytes);
      }
      throw problem(405,'METHOD_NOT_ALLOWED');
    }
    authenticate(req);
    if(kind==='captures'&&id&&method==='PUT'){
      const body=await readBody(req,Math.ceil(3.5*MiB));
      const {batchId,sourceDeviceId}=body;
      const capture=meta({...body,status:body.status??'processing',revision:body.revision??0},id,batchId,sourceDeviceId);
      const photo=photoFrom(body);
      const existing=readRecord(captureFile(id));
      if(existing){
        if(existing.deleted)throw problem(410,'CAPTURE_DELETED');
        if(existing.batchId!==batchId||existing.sourceDeviceId!==sourceDeviceId||existing.photo.digest!==photo.digest){
          throw problem(409,'CAPTURE_ID_CONFLICT');
        }
        return send(req,res,200,{captureId:id,batchId,duplicate:true,mediaUrl:mediaUrl(id)});
      }
      if(readRecord(batchFile(batchId)))throw problem(409,'BATCH_ALREADY_CLOSED');
      const captures=batchCaptures(batchId);
      if(captures.some(record=>record.sourceDeviceId!==sourceDeviceId))throw problem(409,'BATCH_SOURCE_CONFLICT');
      if(captures.length>=8||captures.reduce((sum,item)=>sum+item.photo.size,photo.size)>3*MiB){
        throw problem(413,'BATCH_LIMIT');
      }
      atomicWrite(captureFile(id),{batchId,sourceDeviceId,capture,photo});
      return send(req,res,201,{captureId:id,batchId,duplicate:false,mediaUrl:mediaUrl(id)});
    }
    if(kind==='captures'&&id&&method==='PATCH'){
      const body=await readBody(req,64*1024);
      const record=readRecord(captureFile(id));
      if(!record)throw problem(404,'CAPTURE_NOT_FOUND');
      if(record.deleted)throw problem(410,'CAPTURE_DELETED');
      if(body.batchId!==record.batchId||body.sourceDeviceId!==record.sourceDeviceId)throw problem(409,'CAPTURE_ID_CONFLICT');
      if(readRecord(batchFile(record.batchId))?.deleted)throw problem(410,'BATCH_DELETED');
      const capture=meta({...record.capture,...body,captureTimestamp:record.capture.captureTimestamp},id,record.batchId,record.sourceDeviceId);
      if(capture.revision<=record.capture.revision)return send(req,res,200,{captureId:id,revision:record.capture.revision,updated:false});
      atomicWrite(captureFile(id),{...record,capture});
      return send(req,res,200,{captureId:id,revision:capture.revision,updated:true});
    }
    if(kind==='dock'&&!id&&method==='POST'){
      const {eventType,batchId,sourceDeviceId,captureIds}=await readBody(req,64*1024);
      if(eventType!=='EXPLORER_DOCKED'||!validId(batchId)||!validId(sourceDeviceId)||
         !Array.isArray(captureIds)||!captureIds.length||captureIds.length>8||!captureIds.every(validId)||
         new Set(captureIds).size!==captureIds.length)throw problem(422,'INVALID_DOCK_EVENT');
      const prior=readRecord(batchFile(batchId));
      if(prior?.deleted)throw problem(410,'BATCH_DELETED');
      if(prior&&(prior.sourceDeviceId!==sourceDeviceId||prior.captureIds.join(',')!==captureIds.join(','))){
        throw problem(409,'DOCK_CONFLICT');
      }
      if(!prior){
        const stored=batchCaptures(batchId);
        if(stored.length!==captureIds.length||!captureIds.every(id=>stored.some(record=>
          record.capture.captureId===id&&record.sourceDeviceId===sourceDeviceId)))throw problem(409,'BATCH_INCOMPLETE');
        atomicWrite(batchFile(batchId),{batchId,sourceDeviceId,captureIds,dockedAt:new Date().toISOString()});
      }
      return send(req,res,prior?200:201,{batchId,batchUrl:batchUrl(batchId),duplicate:!!prior});
    }
    if(kind==='batches'&&id&&method==='DELETE'){
      const batch=readRecord(batchFile(id));
      const captures=batchCaptures(id);
      if(!batch&&!captures.length)throw problem(404,'BATCH_NOT_FOUND');
      atomicWrite(batchFile(id),{batchId:id,deleted:true});
      for(const {capture} of captures)atomicWrite(captureFile(capture.captureId),{deleted:true});
      return send(req,res,200,{batchId:id,deleted:true});
    }
    throw problem(405,'METHOD_NOT_ALLOWED');
  }

  return (pathname,req,res)=>{
    if(!pathname.startsWith('/api/capture/v1/'))return false;
    handle(pathname,req,res).catch(error=>{
      if(!req.socket.destroyed&&!res.headersSent)send(req,res,error.status||500,{errorCode:error.code&&error.status?error.code:'STORAGE_ERROR'});
    });
    return true;
  };
}
