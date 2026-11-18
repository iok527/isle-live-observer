(function(){
  'use strict';
  const {store,names}=IsleObserver;
  const islandId='story';
  const appleUses={
    apple:'把苹果放大，做成大家都能围坐的果实小站。',
    'apple-large':'在大苹果上开一扇门，做成下雨时也能歇脚的苹果屋。',
  };
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
    world.objects=saved.objects.map(object=>({...object,at:{...object.at}}));
    world.sequence=saved.sequence;
    for(const spawn of saved.residents||[]){
      const resident=world.residents.find(p=>p.id===spawn.id);
      if(resident&&world.canWalk(spawn))resident.at={x:spawn.x,y:spawn.y};
    }
    const {events}=store.getSnapshot();
    for(const object of world.objects){
      if(object.collectionId&&!events.some(e=>e.eventType==='RESIDENT_INTERACTED'&&e.objectId===object.collectionId&&e.toState===object.type)){
        world.explore(object.id);
      }
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
  function confirmEvolution(world,id){
    const state=store.getSnapshot();
    const entry=state.entries[id];
    const object=world.objects.find(o=>collectionId(o)===id);
    const proposal=entry?.proposal;
    if(state.activeIsland!==islandId||entry?.status!=='在岛上'||!object||
       !proposal||proposal.fromState!==object.type||proposal.toState!==world.evolution[object.type]){
      return {error:'请先等待居民提出当前形态的用途。'};
    }
    const result=world.evolve(object.id);
    if(result.error)return result;
    const {fromState,toState,residentId,description}=proposal;
    const confirmed=store.gameEvent(islandId,'USE_CONFIRMED',{objectId:id,residentId,fromState,toState,description},id+'/confirm/'+fromState);
    const type=toState==='apple-large'?'OBJECT_SCALED':'OBJECT_TRANSFORMED';
    const evolved=store.gameEvent(islandId,type,{objectId:id,fromState,toState,description:names[fromState]+' → '+names[toState]},id+'/'+toState);
    commit(world,{entry:{objectId:id,form:toState,proposal:null},events:[confirmed,evolved]});
    return result;
  }
  function resident(world,event){
    const object=world.objects.find(o=>o.id===event.objectId);
    const person=world.residents.find(p=>p.id===event.resident);
    const objectId=collectionId(object);
    if(!objectId||!person)return;
    const observed=event.kind==='noticed';
    const fromState=object.type;
    const toState=world.evolution[fromState];
    const residentId=person.id;
    const eventType=observed?'RESIDENT_INSPECTED':'RESIDENT_INTERACTED';
    const events=[store.gameEvent(islandId,eventType,{
      objectId,residentId,toState:fromState,
      title:person.name+(observed?'发现了':'互动了：')+names[fromState],
      description:event.text||'沿可行走路径靠近物件。',
    },objectId+'/'+eventType+'/'+fromState+'/'+residentId)];
    const entry=store.getSnapshot().entries[objectId];
    if(!observed&&entry&&!entry.proposal&&toState&&appleUses[fromState]){
      const proposal={residentId,fromState,toState,description:appleUses[fromState]};
      events.push(store.gameEvent(islandId,'USE_PROPOSED',{objectId,...proposal,title:person.name+'提议制作'+names[toState]},objectId+'/proposal/'+fromState));
      commit(world,{entry:{objectId,proposal},events});
      return;
    }
    store.commit({islandId,events});
  }
  globalThis.IsleGameBridge={
    restore,placed,confirmEvolution,resident,
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
