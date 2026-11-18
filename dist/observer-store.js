(function () {
  'use strict';
  const key='isle-live.observer.v8';
  const islands=[
    {id:'my',name:'My Land',label:'我的岛屿',image:'island-my.png'},
    {id:'story',name:'Story Land',label:'故事岛',playable:true},
    {id:'red',name:'Red Land',label:'发现岛',image:'island-red.webp'},
    {id:'di',name:'D&I Land',label:'设计岛',image:'island-di.png'},
  ];
  const discoveries=[
    {objectId:'sample-apple',type:'apple',displayName:'苹果',originalPhoto:'apple-source-sample.png',userNote:'半边果皮更红，果梗有一点弯。',importedSprite:'apple.png'},
    {objectId:'sample-leaf',type:'leaf',displayName:'叶子',originalPhoto:'sample-leaf.jpg',userNote:'叶脉很清楚。想看看它在水上会怎样。',importedSprite:'leaf.png'},
    {objectId:'sample-stone',type:'stone',displayName:'石头',originalPhoto:'sample-stone.jpg',userNote:'散步时捡到的浅纹小石头。',importedSprite:'stone.png'},
    {objectId:'sample-cat',type:'cat',displayName:'猫咪',originalPhoto:null,userNote:'测试一只猫咪的像素转译。',importedSprite:'cat.png'},
  ].map(item=>({...item,createdAt:'2026-11-16T00:00:00Z',importStatus:'available',demo:true}));
  const names={apple:'苹果','apple-large':'巨型苹果','apple-house':'苹果屋',leaf:'叶子',stone:'石头',chair:'椅子',cat:'猫咪'};
  const eventNames={OBJECT_IMPORTED:'从发现口袋导入',OBJECT_PLACED:'物件到来',OBJECT_SCALED:'物件放大',OBJECT_TRANSFORMED:'物件演变',RESIDENT_INSPECTED:'居民发现物件',RESIDENT_INTERACTED:'居民互动',ISLAND_EXPANDED:'岛屿扩张'};
  const initial=()=>({activeIsland:'story',events:[],entries:{},worlds:{},discoveries});
  function keyboardAction(input){
    if(input.repeat||input.editable||input.modified||input.composing)return null;
    const {key,code}=input;
    if(key==='Escape')return 'close';
    if(key==='1'||key==='2'||key==='3')return {'1':'world','2':'collection','3':'memories'}[key];
    if(code==='KeyQ'||key?.toLowerCase()==='q')return 'previous';
    if(code==='KeyE'||key?.toLowerCase()==='e')return 'next';
    if(code==='KeyT'||key?.toLowerCase()==='t')return 'transfer';
    return null;
  }
  function createStore(storage){
    let state=initial(), diskError=false, serial=0;
    const listeners=new Set();
    try {
      const raw=storage?.getItem(key);
      if(raw){
        const saved=JSON.parse(raw);
        if(saved?.events && saved.entries && saved.worlds)state={...initial(),...saved};
      }
    } catch {diskError=true;}
    const persist=next=>{
      try {storage?.setItem(key,JSON.stringify(next));} catch {diskError=true;}
      state=next;
      listeners.forEach(listener=>listener());
    };
    const stamp=()=>new Date().toISOString();
    const unique=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++serial);
    function gameEvent(islandId,eventType,payload={},eventId=unique()){
      const {objectId,residentId,title=eventNames[eventType],description='',fromState,toState}=payload;
      return {eventId,islandId,objectId,residentId,eventType,timestamp:stamp(),title,description,fromState,toState};
    }
    function commit({events=[],entry,world,islandId,archive}){
      const seen=new Set(state.events.map(event=>event.eventId));
      const fresh=events.filter(event=>{
        if(seen.has(event.eventId))return false;
        seen.add(event.eventId);return true;
      });
      const entries={...state.entries};
      if(entry)entries[entry.objectId]={...entries[entry.objectId],...entry};
      if(archive)for(const id of archive)if(entries[id])entries[id]={...entries[id],status:'已重置'};
      persist({...state,entries,events:[...state.events,...fresh],worlds:world?{...state.worlds,[islandId]:world}:state.worlds});
    }
    function ingest(record){
      if(!record?.objectId||!record.displayName||(!record.originalPhoto&&!record.importedSprite))return false;
      const entry={createdAt:stamp(),importStatus:'available',userNote:'',originalPhoto:null,...record};
      persist({...state,discoveries:[entry,...state.discoveries.filter(x=>x.objectId!==entry.objectId)]});
      return true;
    }
    return {
      subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
      getSnapshot:()=>state, diskError:()=>diskError, unique, gameEvent, commit, ingest,
      receive(record){
        if(!record?.objectId||state.discoveries.some(item=>item.objectId===record.objectId))return false;
        return ingest(record);
      },
      selectIsland(id){if(islands.some(i=>i.id===id)&&state.activeIsland!==id)persist({...state,activeIsland:id});},
      nextIsland(direction){const current=islands.findIndex(i=>i.id===state.activeIsland);this.selectIsland(islands[(current+direction+islands.length)%islands.length].id);},
    };
  }
  const api={createStore,islands,names,eventNames,keyboardAction};
  if(typeof module!=='undefined')module.exports=api;
  else {
    let storage;
    try {storage=localStorage;} catch {}
    globalThis.IsleObserver={...api,store:createStore(storage)};
  }
})();
