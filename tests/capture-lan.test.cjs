const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const {test}=require('node:test');

const token='local-test-token-123456';
const routes='/api/capture/v1';
const image=fs.readFileSync('dist/assets/sample-leaf.jpg');
const identity={batchId:'batch-test',sourceDeviceId:'explorer-test'};
const upload={...identity,captureTimestamp:'2026-11-19T08:00:00+08:00',
  imageContentType:'image/jpeg',imageBase64:image.toString('base64')};

function call(handler,method,route,body,authorized=true){
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
  Object.assign(req,{method,socket:{destroyed:false},headers:{'content-type':'application/json',
    authorization:authorized?'Bearer '+token:''}});
  return new Promise(resolve=>{
    const res={writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;},
      end(data){resolve({status:this.status,headers:this.headers,body:Buffer.isBuffer(data)?data:data&&JSON.parse(data)});}};
    assert.equal(handler(routes+route,req,res),true);
  });
}

test('LAN upload, Dock, AI revision, immutable originals, restart and deletion',async t=>{
  const {createCaptureLanRoute}=await import('../scripts/capture-lan.mjs');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'observer-capture-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const open=()=>createCaptureLanRoute({directory,token});
  let handler=open();
  const request=(...args)=>call(handler,...args);
  assert.equal((await request('PUT','/captures/leaf',upload,false)).status,401);
  assert.equal((await request('PUT','/captures/leaf',upload)).status,201);
  assert.equal((await request('PUT','/captures/leaf',upload)).body.duplicate,true);
  assert.equal((await request('PUT','/captures/leaf',{...upload,batchId:'wrong-batch'})).status,409);
  assert.equal((await request('PUT','/captures/invalid',{...upload,imageBase64:'YQ=='})).status,422);
  assert.equal((await request('GET','/media/leaf')).status,404);
  const dock={...identity,eventType:'EXPLORER_DOCKED',captureIds:['leaf']};
  assert.equal((await request('POST','/dock',{...dock,captureIds:['leaf','missing']})).status,409);
  assert.equal((await request('POST','/dock',dock)).status,201);
  assert.equal((await request('POST','/dock',dock)).body.duplicate,true);
  assert.equal((await request('GET','/batches')).body.batches.length,1);
  const patch={...identity,revision:1,status:'ready',objectCategory:'leaf'};
  assert.equal((await request('PATCH','/captures/leaf',patch)).body.updated,true);
  assert.equal((await request('PATCH','/captures/leaf',patch)).body.updated,false);

  handler=open();
  const batch=await request('GET','/batches/batch-test');
  assert.equal(batch.body.captures[0].objectCategory,'leaf');
  assert.equal(batch.body.captures[0].localFileRef,routes+'/media/leaf');
  const photo=await request('GET','/media/leaf');
  assert.equal(photo.headers['Content-Type'],'image/jpeg');
  assert.deepEqual(photo.body,image);
  assert.equal((await request('GET','/media/../secret')).status,404);
  assert.equal((await request('DELETE','/batches/batch-test')).status,200);
  assert.equal((await request('GET','/media/leaf')).status,404);
  assert.equal((await request('GET','/batches/batch-test')).status,410);
  assert.equal((await request('PUT','/captures/leaf',upload)).status,410);
  assert.equal((await request('PUT','/captures/leaf',{...upload,batchId:'new-batch'})).status,410);
});
