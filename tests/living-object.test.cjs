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

test('Land leaf relocation validates both water tiles and rolls back failed storage',()=>{
  let save,fail=false;
  const disk={getItem:()=>save,setItem:(_key,value)=>{
    if(fail)throw new Error('storage full');
    save=value;
  }};
  const {store,bridge,world}=setup(disk);
  const [capture]=store.receiveBatch([{captureId:'leaf-photo',type:'leaf',displayName:'叶子',originalPhoto:'sample-leaf.jpg'}]);
  const from={x:19,y:16},to={x:8,y:12};
  const {object}=world.place(from,'leaf');
  bridge.placed(world,object,capture);
  const id=object.collectionId;
  bridge.resident(world,{kind:'reaction',objectId:object.id,resident:'zaozhao'});
  assert.equal(store.getSnapshot().entries[id].proposal.requiresLocation,true);

  assert.ok(bridge.confirmEvolution(world,id).error);
  assert.equal(bridge.confirmEvolution(world,id,{x:9,y:12}).code,'footprint');
  assert.equal(bridge.confirmEvolution(world,id,{x:7,y:11}).code,'entrance');
  assert.equal(bridge.confirmEvolution(world,id,from).code,'terrain');

  const collision=world.place({x:9,y:12},'leaf').object;
  assert.ok(collision);
  assert.equal(bridge.confirmEvolution(world,id,to).code,'occupied');
  world.remove(collision.id);

  const priorSave=save;
  const priorState=store.getSnapshot();
  const revision=world.revision;
  fail=true;
  assert.match(bridge.confirmEvolution(world,id,to).error,/无法保存/);
  assert.equal(save,priorSave);
  assert.equal(store.getSnapshot(),priorState);
  assert.equal(world.revision,revision);
  assert.deepEqual(object.at,from);
  assert.equal(object.type,'leaf');
  assert.equal(world.canWalk(from),false);
  assert.equal(world.objects.length,1);

  const reloaded=setup(disk);
  reloaded.bridge.restore(reloaded.world);
  assert.equal(reloaded.world.objects[0].type,'leaf');
  fail=false;
  const moved=bridge.confirmEvolution(world,id,to);
  assert.equal(moved.object,object);
  assert.equal(object.collectionId,id);
  assert.equal(object.type,'leaf-boat');
  assert.deepEqual(object.at,to);
  assert.equal(world.canWalk(from),true);
  assert.equal(world.canWalk(to),false);
  assert.equal(world.objects.length,1);
  assert.ok(bridge.confirmEvolution(world,id,to).error);
  const final=setup(disk).store.getSnapshot();
  assert.equal(final.entries[id].sourceId,capture.objectId);
  assert.deepEqual(final.events.slice(-3).map(e=>e.eventType),['USE_CONFIRMED','OBJECT_TRANSFORMED','OBJECT_RELOCATED']);
  const relocation=final.events.at(-1);
  assert.deepEqual(relocation.fromAt,from);
  assert.deepEqual(relocation.toAt,to);
  assert.equal(final.discoveries.find(d=>d.objectId===capture.objectId).originalPhoto,'sample-leaf.jpg');
});
