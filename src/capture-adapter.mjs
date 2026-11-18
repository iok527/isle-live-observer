import {captureAssets} from './capture-assets.mjs';

const MiB=1024*1024;
const idPattern=/^[A-Za-z0-9._:-]{1,96}$/;
const imageTypes=new Set(['image/jpeg','image/png','image/webp']);
const statuses=new Set(['processing','ready','failed','unsupported']);
const timestampPattern=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const invalid=message=>new Error(message);
const identifier=value=>typeof value==='string'&&idPattern.test(value);
const optionalText=(value,length)=>value===undefined||(typeof value==='string'&&value.length<=length);

function httpUrl(value,base){
  if(typeof value!=='string'||!value.trim())throw invalid('缺少有效的网络地址。');
  const url=new URL(value,base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password){
    throw invalid('只接受 HTTP(S) 采集和图片地址。');
  }
  return url;
}

export function validateBatch(payload,base){
  if(payload?.protocolVersion!==1||!identifier(payload.batchId)||!identifier(payload.sourceDeviceId)||
     !Array.isArray(payload.captures)||payload.captures.length<1||payload.captures.length>8){
    throw invalid('采集批次格式、协议版本或件数不符合 V1。');
  }
  const captures=new Map();
  for(const record of payload.captures){
    if(!identifier(record?.captureId)||!Number.isSafeInteger(record.revision)||record.revision<0||
       typeof record.captureTimestamp!=='string'||!timestampPattern.test(record.captureTimestamp)||
       !Number.isFinite(Date.parse(record.captureTimestamp))||!statuses.has(record.status)||
       !optionalText(record.objectLabel,100)||!optionalText(record.objectCategory,64)||
       !optionalText(record.spriteAssetId,96)||!optionalText(record.note,1000)||!optionalText(record.errorCode,96)||
       (record.supportedEvolutionIds!==undefined&&(!Array.isArray(record.supportedEvolutionIds)||
        record.supportedEvolutionIds.length>16||!record.supportedEvolutionIds.every(identifier)))||
       (record.originalImageUrl===undefined)===(record.localFileRef===undefined)){
      throw invalid('采集项包含无效字段。请检查 ID、时间戳、版本和图像引用。');
    }
    const imageUrl=httpUrl(record.originalImageUrl??record.localFileRef,base).href;
    if(!captures.has(record.captureId)||captures.get(record.captureId).revision<record.revision){
      captures.set(record.captureId,{...record,imageUrl});
    }
  }
  return {...payload,captures:[...captures.values()]};
}

async function fetchBytes(url,limit,signal,fetcher){
  const response=await fetcher(url,{signal,cache:'no-store',credentials:'omit',redirect:'error'});
  if(!response.ok)throw invalid(`服务器未能返回数据（HTTP ${response.status}）。`);
  if(Number(response.headers.get('Content-Length'))>limit)throw invalid('采集文件超过大小上限。');
  const reader=response.body.getReader();
  const chunks=[];
  let size=0;
  try {
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>limit)throw invalid('采集文件超过大小上限。');
      chunks.push(value);
    }
  }catch(error){
    await reader.cancel().catch(()=>{});
    throw error;
  }finally{
    reader.releaseLock();
  }
  const type=response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  return new Blob(chunks,{type});
}

async function decodePhoto(blob,signal){
  if(!imageTypes.has(blob.type))throw invalid('原图须为 JPEG、PNG 或 WebP。');
  const photo=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    const abort=()=>reader.abort();
    signal.addEventListener('abort',abort,{once:true});
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(invalid('无法读取照片。'));
    reader.onabort=()=>reject(new DOMException('Cancelled','AbortError'));
    reader.onloadend=()=>signal.removeEventListener('abort',abort);
    reader.readAsDataURL(blob);
  });
  const image=new Image();
  image.src=photo;
  try {await image.decode();}catch {throw invalid('原图无法解码，请采集服务重新提供图片。');}
  return photo;
}

function match(record){
  const category=record.objectCategory?.trim().toLowerCase();
  const asset=Object.hasOwn(captureAssets,category)?captureAssets[category]:undefined;
  const matched=record.status==='ready'&&asset&&(!record.spriteAssetId||record.spriteAssetId===asset.spriteAssetId);
  return {
    type:matched?category:'unmatched',
    spriteAssetId:matched?asset.spriteAssetId:null,
    importedSprite:matched?asset.importedSprite:null,
    importStatus:matched?'available':record.status==='ready'?'unsupported':record.status,
    supportedEvolutionIds:matched?asset.evolutions.filter(id=>!record.supportedEvolutionIds||record.supportedEvolutionIds.includes(id)):[],
  };
}

export async function receiveCaptureBatch({url,base,store,signal,onPhase,fetcher=fetch,decode=decodePhoto}){
  const endpoint=httpUrl(url,base);
  onPhase('Detect');
  const manifest=await fetchBytes(endpoint,64*1024,signal,fetcher);
  const batch=validateBatch(JSON.parse(await manifest.text()),endpoint);
  const known=new Map(store.getSnapshot().discoveries.map(item=>[item.captureId||item.objectId,item]));
  const updates=[];
  let bytes=0;
  onPhase('Transfer');
  for(const record of batch.captures){
    const old=known.get(record.captureId);
    if(old&&(old.batchId!==batch.batchId||old.sourceDeviceId!==batch.sourceDeviceId)){
      throw invalid('采集 ID 已属于另一个来源或批次。');
    }
    if(old&&record.revision<=old.captureRevision)continue;
    const photo=old?.originalPhoto?null:await fetchBytes(record.imageUrl,Math.min(2.5*MiB,3*MiB-bytes),signal,fetcher);
    bytes+=photo?.size||0;
    updates.push({record,old,photo});
  }
  onPhase('Decode');
  const entries=[];
  for(const {record,old,photo} of updates){
    signal.throwIfAborted();
    entries.push({
      captureId:record.captureId,batchId:batch.batchId,sourceDeviceId:batch.sourceDeviceId,
      captureRevision:record.revision,createdAt:record.captureTimestamp,
      displayName:record.objectLabel?.trim()||old?.displayName||'待识别采集',
      originalPhoto:photo?await decode(photo,signal):old.originalPhoto,
      captureNote:record.note||'',captureError:record.errorCode||null,
      ...match(record),
    });
  }
  signal.throwIfAborted();
  const result=store.mergeNetworkCaptures(entries);
  if(result===null)throw invalid('无法保存该批次，本地存储空间可能不足。');
  onPhase('Arrive');
  return result;
}
