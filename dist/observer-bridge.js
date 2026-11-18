(function(){
  'use strict';
  const {store,names}=IsleObserver;
  const islandId='story';
  const profile=()=>store.getSnapshot().worlds[islandId];
  const snapshot=world=>({
    expanded:world.expanded,sequence:world.sequence,objects:world.objects.map(o=>({...o,at:{...o.at}})),
    residents:world.residents.map(p=>({id:p.id,x:p.at.x,y:p.at.y})),
  });
  const commit=(world,options)=>store.commit({islandId,world:snapshot(world),...options});
  function restore(world){
    const saved=profile();
    if(!saved)return;
    if(saved.expanded){
      world.expand();
      world.visiting=false;
    }
    world.objects=saved.objects;
    world.sequence=saved.sequence;
    for(const spawn of saved.residents||[]){
      const resident=world.residents.find(p=>p.id===spawn.id);
      if(resident&&world.canWalk(spawn))resident.at={x:spawn.x,y:spawn.y};
    }
  }
  const collectionId=o=>o?.collectionId;
  function placed(world,object,discovery){
    object.collectionId=store.unique();
    const objectId=collectionId(object);
    const source=discovery||store.getSnapshot().discoveries.find(item=>item.type===object.type);
    const name=names[object.type]||discovery?.displayName||object.type;
    const events=[];
    if(discovery)events.push(store.gameEvent(islandId,'OBJECT_IMPORTED',{objectId,title:name+'从采集档案导入',description:'保留了采集来源与备注。',toState:object.type},objectId+'/import'));
    events.push(store.gameEvent(islandId,'OBJECT_PLACED',{objectId,title:name+'来到岛上',description:'放置于 ('+object.at.x+', '+object.at.y+')。',toState:object.type},objectId+'/place'));
    commit(world,{events,entry:{objectId,sourceId:source?.objectId,islandId,name,form:object.type,status:'在岛上',at:object.at}});
  }
  function evolved(world,object,fromState){
    const objectId=collectionId(object);
    const toState=object.type;
    const type=toState==='apple-large'?'OBJECT_SCALED':'OBJECT_TRANSFORMED';
    commit(world,{entry:{objectId,form:toState},events:[store.gameEvent(islandId,type,{objectId,fromState,toState,description:names[fromState]+' → '+names[toState]},objectId+'/'+toState)]});
  }
  function resident(world,event){
    const object=world.objects.find(o=>o.id===event.objectId);
    const person=world.residents.find(p=>p.id===event.resident);
    if(!collectionId(object)||!person)return;
    const observed=event.kind==='noticed';
    const eventType=observed?'RESIDENT_INSPECTED':'RESIDENT_INTERACTED';
    store.commit({islandId,events:[store.gameEvent(islandId,eventType,{
      objectId:collectionId(object),residentId:person.id,toState:object.type,
      title:person.name+(observed?'发现了':'探索了')+names[object.type],
      description:event.text||'沿可行走路径靠近物件。',
    })]});
  }
  globalThis.IsleGameBridge={
    restore,placed,evolved,resident,
    expanded(world){commit(world,{events:[store.gameEvent(islandId,'ISLAND_EXPANDED',{description:world.cells.size+' 格场地已连通。',fromState:'base',toState:'expanded'})]});},
    removed(world,object){commit(world,{entry:{objectId:collectionId(object),status:'已收回'}});},
    reset(world){commit(world,{archive:(profile()?.objects||[]).map(collectionId).filter(Boolean)});},
    active:()=>store.getSnapshot().activeIsland===islandId,
    command(action,detail){
      return window.dispatchEvent(new CustomEvent('isle:observer-'+action,{detail,cancelable:true}))===false;
    },
    signal(detail){window.dispatchEvent(new CustomEvent('isle:placement-state',{detail}));},
    requestPlacement(discovery){return window.dispatchEvent(new CustomEvent('isle:placement',{detail:discovery,cancelable:true}))===false;},
  };
})();
