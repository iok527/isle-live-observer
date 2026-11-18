const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,names}=require('../dist/observer-store.js');
const {World}=require('../dist/world.js');
const map=require('../dist/assets/terrain-map.json');
const chunk=require('../dist/assets/expansion-chunk.json');
const config=require('../dist/assets/objects.json');
const source=fs.readFileSync('dist/observer-bridge.js','utf8');

function setup(disk){
  const store=createStore(disk);
  const sandbox={IsleObserver:{store,names}};
  vm.runInNewContext(source,sandbox);
  return {store,bridge:sandbox.IsleGameBridge,world:new World(map,chunk,config)};
}

test('Batch capture IDs are idempotent within a batch and across refresh',()=>{
  let save;
  const disk={getItem:()=>save,setItem:(_key,value)=>{save=value;}};
  const {store}=setup(disk);
  const apple={captureId:'apple-photo',displayName:'苹果',originalPhoto:'apple-source-sample.png'};
  const leaf={captureId:'leaf-photo',displayName:'叶子',originalPhoto:'sample-leaf.jpg'};
  assert.deepEqual(store.receiveBatch([apple,{...apple,objectId:'duplicate'},leaf,{}]).map(x=>x.captureId),['apple-photo','leaf-photo']);
  const reloaded=setup(disk).store;
  assert.equal(reloaded.receiveBatch([{...apple,objectId:'retry'}]).length,0);
  assert.equal(reloaded.getSnapshot().discoveries.filter(x=>x.captureId).length,2);
});

test('A resident arrival gates evolution, rejects illegal changes and persists successful confirmation',()=>{
  let save;
  const disk={getItem:()=>save,setItem:(_key,value)=>{save=value;}};
  const {store,bridge,world}=setup(disk);
  const [capture]=store.receiveBatch([{captureId:'apple',type:'apple',displayName:'苹果',originalPhoto:'apple-source-sample.png'}]);
  const {object,error}=world.place({x:22,y:13},'apple');
  assert.equal(error,'');
  bridge.placed(world,object,capture);
  const id=object.collectionId;
  const eventTypes=()=>store.getSnapshot().events.map(e=>e.eventType);
  const notice={kind:'noticed',objectId:object.id,resident:'tantan'};
  bridge.resident(world,notice);
  assert.ok(bridge.confirmEvolution(world,id).error);
  assert.equal(object.type,'apple');
  bridge.resident(world,{...notice,kind:'reaction'});
  bridge.resident(world,{...notice,kind:'reaction'});
  assert.equal(eventTypes().filter(e=>e==='USE_PROPOSED').length,1);
  assert.equal(object.type,'apple');

  world.residents[0].at={x:23,y:13};
  assert.ok(bridge.confirmEvolution(world,id).error);
  assert.equal(eventTypes().includes('USE_CONFIRMED'),false);
  assert.equal(store.getSnapshot().entries[id].proposal.toState,'apple-large');

  const reloaded=setup(disk);
  reloaded.bridge.restore(reloaded.world);
  assert.equal(reloaded.store.getSnapshot().entries[id].proposal.toState,'apple-large');
  assert.equal(reloaded.bridge.confirmEvolution(reloaded.world,id).error,'');
  assert.equal(reloaded.world.objects[0].type,'apple-large');
  assert.equal(reloaded.world.queue.includes(object.id),true);
  assert.ok(reloaded.bridge.confirmEvolution(reloaded.world,id).error);
  const state=setup(disk).store.getSnapshot();
  assert.equal(state.entries[id].proposal,null);
  assert.equal(state.worlds.story.objects[0].type,'apple-large');
  assert.deepEqual(state.events.slice(-2).map(e=>e.eventType),['USE_CONFIRMED','OBJECT_SCALED']);
});
