const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createStore}=require('../dist/observer-store.js');

const base='http://observer.test/';
const record=(id,status='processing',revision=0)=>({
  captureId:id,captureTimestamp:'2026-11-19T08:00:00+08:00',revision,
  localFileRef:'/photo/'+id,objectLabel:id,status,
});
const batch=(...captures)=>({protocolVersion:1,batchId:'batch-1',sourceDeviceId:'device-1',captures});
function setup(){
  let disk,failWrite=false;
  const store=createStore({getItem:()=>disk,setItem:(_key,value)=>{
    if(failWrite)throw new Error('quota');
    disk=value;
  }});
  return {store,fail:()=>{failWrite=true;}};
}
async function sync(store,payload,{failPhoto,abortAt,photos=[],phases=[]}={}){
  const {receiveCaptureBatch}=await import('../src/capture-adapter.mjs');
  const controller=new AbortController();
  return receiveCaptureBatch({
    store,base,url:'/batch',signal:controller.signal,
    onPhase:phase=>{phases.push(phase);if(phase===abortAt)controller.abort();},
    fetcher:async url=>{
      if(String(url).endsWith('/batch'))return Response.json(payload);
      photos.push(url);
      if(failPhoto)throw new Error('connection lost');
      return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}});
    },
    decode:async()=>'data:image/png;base64,AQI=',
  });
}

test('Network batch preserves photos and user notes across asynchronous corrections and replay',async()=>{
  const {store}=setup(),photos=[],phases=[];
  const apple=record('apple'),leaf=record('leaf');
  assert.deepEqual(await sync(store,batch(apple,leaf,apple),{photos,phases}),{added:2,updated:0});
  assert.equal(photos.length,2);
  assert.deepEqual(phases,['Detect','Transfer','Decode','Arrive']);
  const old=store.getSnapshot().discoveries.find(x=>x.captureId==='apple');
  store.ingest({...old,userNote:'我的备注'});
  assert.deepEqual(await sync(store,batch({...apple,revision:1,status:'failed',errorCode:'AI_OFFLINE'},leaf),{photos}),{added:0,updated:1});
  assert.equal(store.getSnapshot().discoveries.find(x=>x.captureId==='apple').originalPhoto,old.originalPhoto);
  await sync(store,batch({...apple,revision:2,status:'ready',objectCategory:'apple',supportedEvolutionIds:['apple-large','unreviewed']},
    {...leaf,revision:2,status:'ready',objectCategory:'unknown'}),{photos});
  const items=store.getSnapshot().discoveries.filter(x=>x.batchId);
  assert.equal(items.length,2);
  assert.equal(items[0].userNote,'我的备注');
  assert.deepEqual(items[0].supportedEvolutionIds,['apple-large']);
  assert.equal(items[0].importedSprite,'apple.png');
  assert.equal(items[1].importStatus,'unsupported');
  assert.equal(items[1].originalPhoto,old.originalPhoto);
  assert.equal(items[1].importedSprite,null);
  assert.deepEqual(await sync(store,batch(apple,leaf),{photos}),{added:0,updated:0});
  assert.equal(photos.length,2);
});

test('Failed downloads, invalid manifests, cancellation and storage failure leave the batch uncommitted',async()=>{
  const {store,fail}=setup();
  const payload=batch(record('one'),record('two'));
  const prior=store.getSnapshot();
  await assert.rejects(sync(store,payload,{failPhoto:true}),/connection lost/);
  await assert.rejects(sync(store,payload,{abortAt:'Decode'}),{name:'AbortError'});
  await assert.rejects(sync(store,batch({...record('bad'),localFileRef:'blob:http://observer.test/temporary'})),/HTTP/);
  await assert.rejects(sync(store,{...payload,protocolVersion:2}),/版本/);
  fail();
  await assert.rejects(sync(store,payload),/无法保存/);
  assert.equal(store.getSnapshot(),prior);
});
