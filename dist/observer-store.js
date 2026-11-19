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
  const names={apple:'苹果','apple-large':'巨型苹果','apple-house':'苹果屋',leaf:'叶子','leaf-boat':'叶子船',stone:'石头',chair:'椅子',cat:'猫咪'};
  const eventNames={OBJECT_IMPORTED:'从发现口袋导入',OBJECT_PLACED:'物件到来',OBJECT_SCALED:'物件放大',OBJECT_TRANSFORMED:'物件演变',RESIDENT_INSPECTED:'居民发现物件',RESIDENT_INTERACTED:'居民互动',ISLAND_EXPANDED:'岛屿扩张',USE_PROPOSED:'居民提出用途',USE_CONFIRMED:'用户确认用途',OBJECT_RELOCATED:'物件迁移',WEATHER_APPLIED:'天空气候变化',WINDOW_LIT:'苹果屋亮起窗灯'};
  const weatherIds=new Set(['stardust-clear','cosmic-rain','cosmic-dusk']);
  const defaultWeather={weatherId:'stardust-clear',source:'default',activeSince:null,transitionState:'settled'};
  const initial=()=>({layouts:[],weather:defaultWeather,activeIsland:'story',events:[],entries:{},worlds:{},discoveries});
  const physical={
      Digit1:'TOGGLE_LAYOUT_BOOK',Numpad1:'TOGGLE_LAYOUT_BOOK',Digit2:'TOGGLE_COLLECTION',Numpad2:'TOGGLE_COLLECTION',
      Digit3:'TOGGLE_MEMORIES',Numpad3:'TOGGLE_MEMORIES',ArrowLeft:'ISLAND_PREVIOUS',ArrowRight:'ISLAND_NEXT',
      Enter:'CONFIRM_SELECTION',NumpadEnter:'CONFIRM_SELECTION',BracketLeft:'ISLAND_PREVIOUS',BracketRight:'ISLAND_NEXT',
  };
  function keyboardAction(input){
    if(input.repeat||input.editable||input.modified||input.composing)return null;
    const {key,code}=input;
    if(key==='Escape')return 'close';
    if(key==='AudioVolumeUp'||key==='AudioVolumeDown'||key==='AudioVolumeMute')return null;
    if(Object.hasOwn(physical,code))return physical[code];
    if(key==='1'||key==='2'||key==='3')return physical['Digit'+key];
    if(key==='ArrowLeft'||key==='ArrowRight'||key==='Enter')return physical[key];
    if(code==='KeyQ'||key?.toLowerCase()==='q'||key==='[')return 'ISLAND_PREVIOUS';
    if(code==='KeyE'||key?.toLowerCase()==='e'||key===']')return 'ISLAND_NEXT';
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
    const persist=(next,requireDurable=false)=>{
      try {
        if(requireDurable&&!storage)return false;
        storage?.setItem(key,JSON.stringify(next));
      } catch {
        diskError=true;
        if(requireDurable)return false;
      }
      state=next;
      listeners.forEach(listener=>listener());
      return true;
    };
    const stamp=()=>new Date().toISOString();
    const unique=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++serial);
    function gameEvent(islandId,eventType,payload={},eventId=unique()){
      const {objectId,residentId,title=eventNames[eventType],description='',fromState,toState,fromAt,toAt}=payload;
      return {eventId,islandId,objectId,residentId,eventType,timestamp:stamp(),title,description,fromState,toState,...(fromAt&&{fromAt,toAt})};
    }
    function commit({events=[],entry,world,islandId,archive,requireDurable=false}){
      const seen=new Set(state.events.map(event=>event.eventId));
      const fresh=events.filter(event=>{
        if(seen.has(event.eventId))return false;
        seen.add(event.eventId);return true;
      });
      const entries={...state.entries};
      if(entry)entries[entry.objectId]={...entries[entry.objectId],...entry};
      if(archive)for(const id of archive)if(entries[id])entries[id]={...entries[id],status:'已重置'};
      return persist({...state,entries,events:[...state.events,...fresh],worlds:world?{...state.worlds,[islandId]:world}:state.worlds},requireDurable);
    }
    function ingest(record){
      if(!record?.objectId||!record.displayName||(!record.originalPhoto&&!record.importedSprite))return false;
      const entry={createdAt:stamp(),importStatus:'available',userNote:'',originalPhoto:null,...record};
      persist({...state,discoveries:[entry,...state.discoveries.filter(x=>x.objectId!==entry.objectId)]});
      return true;
    }
    function receiveBatch(records){
      const knownCaptures=new Set(state.discoveries.map(item=>item.captureId||item.objectId));
      const knownObjects=new Set(state.discoveries.map(item=>item.objectId));
      const accepted=[];
      for(const record of records){
        const captureId=record?.captureId||record?.objectId;
        if(typeof captureId!=='string'||!captureId.trim()||!record.displayName||
           (!record.originalPhoto&&!record.importedSprite))continue;
        const objectId=record.objectId||'capture:'+captureId;
        if(knownCaptures.has(captureId)||knownObjects.has(objectId))continue;
        knownCaptures.add(captureId);
        knownObjects.add(objectId);
        accepted.push({createdAt:stamp(),importStatus:'available',userNote:'',originalPhoto:null,...record,objectId,captureId});
      }
      if(accepted.length)persist({...state,discoveries:[...accepted,...state.discoveries]});
      return accepted;
    }
    function mergeNetworkCaptures(records){
      const discoveries=[...state.discoveries];
      const added=[];
      let updated=0;
      for(const record of records){
        const objectId='capture:'+record.captureId;
        const index=discoveries.findIndex(item=>(item.captureId||item.objectId)===record.captureId||item.objectId===objectId);
        const old=discoveries[index];
        if(old){
          if(old.captureId!==record.captureId||old.batchId!==record.batchId||old.sourceDeviceId!==record.sourceDeviceId){
            throw new Error('采集 ID 已属于另一个来源或批次。');
          }
          if(record.captureRevision<=old.captureRevision)continue;
          discoveries[index]={...old,...record,originalPhoto:old.originalPhoto};
          updated++;
        }else{
          const entry={...record,objectId,userNote:record.captureNote};
          discoveries.push(entry);
          added.push(entry);
        }
      }
      if((added.length||updated)&&!persist({...state,discoveries},true))return null;
      return {added:added.length,updated};
    }
    function addEnvironmentPhoto(originalPhoto,displayName){
      const captureId='environment:'+unique();
      const entry={objectId:'capture:'+captureId,captureId,type:'environment',originalPhoto,displayName,
        createdAt:stamp(),weatherSuggestion:'cosmic-dusk',userNote:'本机演示：手动模拟晚霞建议。'};
      return persist({...state,discoveries:[entry,...state.discoveries]},true)?entry:null;
    }
    function applyWeather(weatherId,source,captureId){
      if(!weatherIds.has(weatherId)||!['manual','default','simulated'].includes(source))return false;
      if(source==='simulated'&&!state.discoveries.some(item=>
        item.captureId===captureId&&item.type==='environment'&&item.weatherSuggestion===weatherId))return false;
      if(state.weather.weatherId===weatherId&&state.weather.source===source&&state.weather.captureId===captureId)return true;
      const weather={weatherId,source,activeSince:stamp(),transitionState:'settled',...(captureId&&{captureId})};
      const displayNames={'stardust-clear':'星尘晴','cosmic-rain':'星雨','cosmic-dusk':'宇宙晚霞'};
      const event=gameEvent('story','WEATHER_APPLIED',{
        objectId:captureId?'capture:'+captureId:undefined, title:'天空变为'+displayNames[weatherId],
        description:source==='simulated'?'用户确认模拟环境建议。':'用户确认手动天气。',
        fromState:state.weather.weatherId,toState:weatherId,
      });
      return persist({...state,weather,events:[...state.events,event]},true);
    }
    function saveLayout({islandId,name,objects,expanded,skyStateId,thumbnail}){
      if(islandId!=='story'||state.activeIsland!==islandId||state.layouts.length>=12||
         skyStateId!==state.weather.weatherId||!Array.isArray(objects)||typeof thumbnail!=='string'||
         !/^data:image\/(png|webp);base64,/.test(thumbnail)||thumbnail.length>200000)return null;
      const world=state.worlds[islandId];
      const current=world?.objects||[];
      const byId=new Map(current.map(object=>[object.collectionId,object]));
      if(objects.length!==current.length||new Set(objects.map(item=>item.objectInstanceId)).size!==objects.length||
         !!expanded!==!!world?.expanded)return null;
      const items=[];
      for(const item of objects){
        const previous=byId.get(item.objectInstanceId);
        const entry=state.entries[item.objectInstanceId];
        if(!previous||entry?.status!=='在岛上'||entry.islandId!==islandId||previous.type!==item.objectFormId||
           previous.at.x!==item.position?.x||previous.at.y!==item.position?.y||item.orientation!==0||
           !Array.isArray(item.footprint)||!item.footprint.length||
           !item.footprint.every(cell=>Number.isInteger(cell.x)&&Number.isInteger(cell.y)))return null;
        items.push({objectInstanceId:item.objectInstanceId,objectFormId:item.objectFormId,
          position:{...item.position},orientation:0,footprint:item.footprint.map(({x,y})=>({x,y})),floating:!!previous.floating});
      }
      const layout={layoutId:unique(),schemaVersion:1,timestamp:stamp(),islandId,
        name:name?.trim().slice(0,30)||'Story Land 布置 '+(state.layouts.length+1),
        expanded:!!expanded,skyStateId,objects:items,thumbnail};
      return persist({...state,layouts:[layout,...state.layouts]},true)?layout:null;
    }
    function restoreLayout(layoutId,world){
      const islandId=state.activeIsland;
      const layout=state.layouts.find(item=>item.layoutId===layoutId&&item.islandId===islandId);
      if(!layout||world.objects.length!==layout.objects.length)return false;
      const entries={...state.entries};
      for(const object of world.objects){
        const entry=entries[object.collectionId];
        const saved=layout.objects.find(item=>item.objectInstanceId===object.collectionId);
        if(!entry||entry.status!=='在岛上'||entry.islandId!==islandId||!saved||
           saved.objectFormId!==object.type||saved.position.x!==object.at.x||saved.position.y!==object.at.y)return false;
        entries[object.collectionId]={...entry,at:{...object.at}};
      }
      return persist({...state,entries,worlds:{...state.worlds,[islandId]:world}},true);
    }
    function deleteLayout(layoutId){
      const layouts=state.layouts.filter(layout=>layout.layoutId!==layoutId);
      return layouts.length!==state.layouts.length&&persist({...state,layouts},true);
    }
    return {
      subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
      getSnapshot:()=>state, diskError:()=>diskError, unique, gameEvent, commit, ingest,
      receiveBatch, mergeNetworkCaptures, addEnvironmentPhoto, applyWeather, saveLayout, restoreLayout, deleteLayout,
      receive(record){return receiveBatch([record]).length===1;},
      selectIsland(id){if(islands.some(i=>i.id===id)&&state.activeIsland!==id)persist({...state,activeIsland:id});},
      nextIsland(direction){const channels=['red','di','story','my'];const current=channels.indexOf(state.activeIsland);this.selectIsland(channels[(current+direction+channels.length)%channels.length]);},
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
