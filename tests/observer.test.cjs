const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createStore,keyboardAction}=require('../dist/observer-store.js');

const storage=()=>{
  const state=new Map();
  return {getItem:k=>state.get(k),setItem:(k,v)=>state.set(k,v)};
};
test('Repeated event IDs are deduplicated and catalogue and map hydrate together',()=>{
  const disk=storage(), store=createStore(disk);
  const event=store.gameEvent('story','OBJECT_PLACED',{objectId:'apple-1',toState:'apple'},'place-1');
  store.commit({islandId:'story',events:[event,event],entry:{objectId:'apple-1',form:'apple'},world:{expanded:true}});
  store.commit({events:[event]});
  const reloaded=createStore(disk).getSnapshot();
  assert.equal(reloaded.events.length,1);
  assert.equal(reloaded.entries['apple-1'].form,'apple');
  assert.equal(reloaded.worlds.story.expanded,true);
});
test('Island switching and reset do not merge or erase island history',()=>{
  const store=createStore(storage());
  const story=store.gameEvent('story','OBJECT_PLACED',{objectId:'a'});
  const red=store.gameEvent('red','ISLAND_EXPANDED');
  store.commit({events:[story],entry:{objectId:'a',status:'在岛上'}});
  store.commit({events:[red],world:{expanded:true},islandId:'red'});
  store.nextIsland(1);
  assert.equal(store.getSnapshot().activeIsland,'red');
  store.commit({archive:['a'],world:{expanded:false},islandId:'story'});
  const state=store.getSnapshot();
  assert.equal(state.entries.a.status,'已重置');
  assert.equal(state.worlds.red.expanded,true);
  assert.deepEqual(state.events.map(e=>e.islandId),['story','red']);
});
test('Hardware and keyboard mapping share guards for repeat, editable and modifiers',()=>{
  for(const [key,code,action] of [['1','Digit1','world'],['2','Digit2','collection'],['3','Digit3','memories'],['q','KeyQ','previous'],['e','KeyE','next'],['Escape','Escape','close']]){
    assert.equal(keyboardAction({key,code}),action);
    for(const guard of ['repeat','editable','modified'])assert.equal(keyboardAction({key,code,[guard]:true}),null);
  }
});
test('Discovery ingestion upserts capture ID without impersonating seeded history',()=>{
  const store=createStore(storage());
  assert.equal(store.getSnapshot().events.length,0);
  assert.equal(store.ingest({objectId:'capture-01'}),false);
  const record={objectId:'capture-01',displayName:'新苹果',type:'apple',importedSprite:'apple.png'};
  assert.equal(store.ingest(record),true);
  store.ingest({...record,userNote:'更新过的备注'});
  assert.equal(store.getSnapshot().discoveries.filter(d=>d.objectId==='capture-01').length,1);
  assert.equal(store.getSnapshot().discoveries[0].userNote,'更新过的备注');
});
test('Device transfer deduplicates capture IDs and preserves photo-only records',()=>{
  const store=createStore(storage());
  const capture={objectId:'sunset-01',displayName:'晚霞',type:'environment',originalPhoto:'sunset.jpg'};
  assert.equal(store.receive(capture),true);
  assert.equal(store.receive(capture),false);
  assert.equal(store.getSnapshot().discoveries.filter(r=>r.objectId===capture.objectId).length,1);
  assert.equal(store.getSnapshot().events.length,0);
  assert.equal(keyboardAction({key:'t',code:'KeyT'}),'transfer');
  assert.equal(keyboardAction({key:'t',code:'KeyT',composing:true}),null);
});

test('Weather confirmation durably writes one event and preserves environment photo provenance',()=>{
  const disk=storage(),store=createStore(disk);
  assert.equal(store.getSnapshot().weather.weatherId,'stardust-clear');
  assert.equal(store.applyWeather('cosmic-dusk','simulated','missing'),false);
  const capture=store.addEnvironmentPhoto('data:image/png;base64,AA==','日落');
  assert.equal(capture.type,'environment');
  assert.equal(store.getSnapshot().events.length,0);
  assert.equal(store.applyWeather('cosmic-dusk','simulated',capture.captureId),true);
  assert.equal(store.applyWeather('cosmic-dusk','simulated',capture.captureId),true);
  const recovered=createStore(disk).getSnapshot();
  assert.equal(recovered.weather.weatherId,'cosmic-dusk');
  assert.equal(recovered.weather.captureId,capture.captureId);
  assert.equal(recovered.events.length,1);
  assert.equal(recovered.events[0].eventType,'WEATHER_APPLIED');
  assert.deepEqual(recovered.worlds,{});
  assert.equal(recovered.discoveries.find(x=>x.captureId===capture.captureId).originalPhoto,capture.originalPhoto);
});

test('Layout snapshots persist validated identities independently of the world and originals',()=>{
  const disk=storage(),store=createStore(disk);
  const planet=store.getSnapshot().weather.weatherId;
  const id='island-object-1';
  store.commit({islandId:'story',entry:{objectId:id,islandId:'story',status:'在岛上',sourceId:'sample-apple'},
    world:{objects:[{collectionId:id,type:'apple',at:{x:22,y:13}}],expanded:false}});
  const item={objectInstanceId:id,objectFormId:'apple',position:{x:22,y:13},orientation:0,footprint:[{x:22,y:13}]};
  const draft={islandId:'story',objects:[item],expanded:false,skyStateId:planet,thumbnail:'data:image/png;base64,AA=='};
  assert.equal(store.saveLayout({...draft,objects:[{...item,objectInstanceId:'missing'}]}),null);
  const first=store.saveLayout({...draft,name:'上午'});
  const second=store.saveLayout(draft);
  assert.notEqual(first.layoutId,second.layoutId);
  item.position.x=10;
  const recovered=createStore(disk);
  assert.equal(recovered.getSnapshot().layouts[1].objects[0].position.x,22);
  assert.equal(recovered.deleteLayout(first.layoutId),true);
  assert.equal(recovered.getSnapshot().layouts.length,1);
  assert.deepEqual(recovered.getSnapshot().worlds,store.getSnapshot().worlds);
  assert.deepEqual(recovered.getSnapshot().discoveries,store.getSnapshot().discoveries);
});
