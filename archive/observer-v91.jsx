import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';

const {store,islands,names,keyboardAction}=window.IsleObserver;
const bridge=window.IsleGameBridge;
const residents={tantan:'探探',zaozhao:'造造',manman:'慢慢'};
const modes={world:['01','World','岛屿观察'],collection:['02','Collection','物件图鉴'],memories:['03','Memories','岛屿回忆']};
const types={apple:['像素苹果',[['apple','原尺寸'],['apple-large','放大'],['apple-house','苹果屋']],'圆润 · 暖红色 · 弯果梗','放大后可探索，进一步演变为带门窗的苹果屋。'],leaf:['像素叶子',[['leaf','原尺寸']],'轻薄 · 有叶脉','放在可达的水岸可漂浮。'],stone:['像素石头',[['stone','原尺寸']],'坚硬 · 有浅纹','可作为居民歇脚的地点。']};
const stories=[
  ['01','苹果来到岛上','它带着一圈暖红色，落在故事岛的广场。','event-1.png','apple',null],
  ['02','探探发现了苹果','探探绕着这颗陌生的果实走了一圈，想知道弯弯的果梗有什么用。','event-1.png','apple','tantan'],
  ['04','苹果变大了','果实长到两格宽。造造说，也许这里可以有一扇门。','event-4.png','apple-large','zaozhao','apple'],
  ['06','苹果变成了房子','探探发现了窗户，慢慢已经在门边停了下来。','event-6.png','apple-house','manman','apple-large'],
].map(([day,title,description,image,toState,residentId,fromState])=>({eventId:'sample-day-'+day,day,title,description,image,toState,residentId,fromState,demo:true}));
const asset=file=>file&&(/^(https?:|data:image\/|blob:)/.test(file)?file:'assets/'+file);
const date=value=>value?new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(value)):'未提供';
const islandName=id=>islands.find(i=>i.id===id)?.name||'';
const stages=item=>types[item.type]?.[1]||[[item.type,'原尺寸']];
const variantSprite=(item,type)=>type===item.type?item.importedSprite:type+'.png';
const filters=['全部','待导入','已放置','处理中'];
function Pic({file,alt,photo=false}){return file?<img draggable="false" className={photo?'photo':'sprite'} src={asset(file)} alt={alt}/>:<span className="placeholder">{photo?'暂无原始照片':'暂无转译素材'}</span>;}
function Btn({children,className='',...props}){return <button type="button" className={className} {...props}>{children}</button>;}
function Tabs({options,value,onChange,label}){return <div className="tabs" aria-label={label}>{options.map(([key,title])=><Btn key={key} aria-pressed={key===value} onClick={()=>onChange(key)}>{title}</Btn>)}</div>;}
function PhotoPair({item,view='compare',sprite=item.importedSprite}){
  return <div className={'pair '+view}>
    {view!=='sprite'&&<figure><div className="media"><Pic file={item.originalPhoto} alt={item.displayName+'原始照片'} photo/></div><figcaption>01 · 现实原图</figcaption></figure>}
    {view!=='original'&&<figure><div className="media pixels"><Pic file={sprite} alt={item.displayName+'像素形态'}/></div><figcaption>02 · 像素转译</figcaption></figure>}
  </div>;
}
function Collection({data,island,browse,setBrowse,filter,setFilter,selected,setSelected,view,setView,begin,inspect,memory,blocked}){
  const placed=id=>Object.values(data.entries).filter(e=>e.sourceId===id&&e.status==='在岛上');
  const status=item=>item.importStatus==='processing'?'处理中':placed(item.objectId).length?'已放置':item.importedSprite?'待导入':item.type==='environment'?'环境影像':'待转译';
  const record=data.discoveries.find(i=>i.objectId===selected);
  const instance=record?placed(record.objectId):[];
  const eligible=data.discoveries.filter(i=>browse==='photos'?i.originalPhoto:(i.importedSprite||i.importStatus==='processing')&&i.type!=='environment').filter(i=>browse==='photos'||filter==='全部'||status(i)===filter);
  return <div className="mode-pane collection" data-screen="collection" inert={blocked}>
    <header className="page-head"><div><p className="mono caption">REAL WORLD / ISLAND OBJECTS</p><h1>物件图鉴</h1></div>{record?<Btn onClick={()=>setSelected(null)}>← 返回收藏</Btn>:<Tabs options={[[ 'photos','PHOTOS · 现实影像'],['objects','OBJECTS · 岛屿物件']]} value={browse} onChange={setBrowse} label="收藏视图"/>}</header>
    {record?<div className="object-detail">
      <div className="detail-image">
        <Tabs options={[['original','ORIGINAL'],['sprite','SPRITE'],['compare','COMPARE']]} value={view} onChange={setView} label="图像视图"/>
        <PhotoPair item={record} view={view} sprite={instance[0]?.form?variantSprite(record,instance[0].form):record.importedSprite}/>
      </div>
      <aside className="archive-sheet">
        <p className="mono caption">{record.demo?'EXAMPLE CAPTURE':'CAPTURE RECORD'}</p>
        <h2>{record.displayName}</h2><p className="status-word">{status(record)}</p>
        <p className="note">「{record.userNote||'暂无备注'}」</p>
        <p className="muted">拍摄 · {date(record.createdAt)}<br/>识别主体 · {record.subject||record.displayName}</p>
        <details><summary>特征与演变候选</summary><p>{record.features||types[record.type]?.[2]||'暂无特征'}</p><p>{record.affordance||types[record.type]?.[3]||'暂无演变候选'}</p></details>
        <details><summary>岛上实例与互动 · {instance.length}</summary>{instance.length?instance.map(o=><div className="instance" key={o.objectId}><span>{islandName(o.islandId)} · {names[o.form]||record.displayName}</span><Btn onClick={()=>inspect(o)}>观察实例</Btn><Btn onClick={()=>memory(o)}>查看互动</Btn></div>):<p>还没有放置实例。</p>}</details>
        <Btn className="primary" disabled={!record.importedSprite||record.importStatus==='processing'||record.type==='environment'} onClick={()=>begin(record)}>{instance.length?'新建岛屿实例':'放入岛屿'}</Btn>
        <p className="mono caption">当前岛屿 / {island.name}</p>
      </aside>
    </div>:<>
      {browse==='objects'&&<Tabs options={filters.map(f=>[f,f])} value={filter} onChange={setFilter} label="物件状态"/>}
      <div className={'archive-gallery '+browse}>{eligible.map((item,i)=><Btn className="archive-item" key={item.objectId} onClick={()=>{setSelected(item.objectId);setView(browse==='photos'?'original':'compare');}}>
        <div className={'media '+(browse==='objects'?'pixels':'')}><Pic file={browse==='photos'?item.originalPhoto:item.importedSprite} alt={item.displayName} photo={browse==='photos'}/></div>
        <div className="archive-label"><strong>{item.displayName}</strong><small className="mono">{browse==='photos'?date(item.createdAt).slice(0,10):status(item)}</small></div>
        {browse==='photos'&&<span className="photo-index mono">FRAME {String(i+1).padStart(2,'0')}</span>}
      </Btn>)}</div>
      {!eligible.length&&<p className="empty">这个分类里暂时没有档案。</p>}
    </>}
  </div>;
}
function Memories({data,island,selected,setSelected,openItem,focused,clearFocus,blocked}){
  const actual=data.events.filter(e=>e.islandId===island.id&&(!focused||e.objectId===focused)).slice().reverse();
  const [archive,setArchive]=useState('live');
  const list=!focused&&island.id==='story'&&(archive==='sample'||!actual.length)?stories:actual;
  const entry=list.find(x=>x.eventId===selected)||list[0];
  const linked=entry?.demo?'sample-apple':data.entries[entry?.objectId]?.sourceId;
  const sprite=entry?.toState&&names[entry.toState]?entry.toState+'.png':null;
  return <div className="mode-pane memories" data-screen="memories" inert={blocked}>
    <header className="page-head"><div><p className="mono caption">ISLAND MEMORY / STILL ARCHIVE</p><h1>岛屿回忆</h1></div>{focused?<Btn onClick={clearFocus}>查看整座岛的回忆</Btn>:<div className="memory-context"><span className="context mono">{island.name}</span>{island.id==='story'&&actual.length>0&&<Tabs options={[[ 'live','观测记录'],['sample','示例故事']]} value={archive} onChange={id=>{setArchive(id);setSelected(null);}} label="回忆来源"/>}</div>}</header>
    {entry?<div className="memory-body">
      <nav className="filmstrip" aria-label="事件时间轴">{list.map((e,index)=><Btn key={e.eventId} aria-pressed={entry.eventId===e.eventId} onClick={()=>setSelected(e.eventId)}><span className="mono">{e.demo?'DAY '+e.day:'FRAME '+String(list.length-index).padStart(2,'0')}</span><strong>{e.title}</strong></Btn>)}</nav>
      <section className="memory-note" aria-live="polite">
        <figure className="memory-print"><div className={'media '+(!entry.image?'pixels':'')}><Pic file={entry.image||sprite} alt={entry.title} photo={!!entry.image}/>{!entry.image&&!sprite&&<span className="no-shot">此事件未记录影像</span>}</div><figcaption className="mono">{entry.demo?'示例静态影像':'事件档案 · '+(sprite?'物件图示':'无截图')}</figcaption></figure>
        <article><p className="mono caption">{entry.demo?'DAY '+entry.day+' / 示例故事':date(entry.timestamp)}</p><h2>{entry.title}</h2><p>{entry.description}</p>
          {entry.residentId&&<div className="resident-chip"><Pic file={entry.residentId+'-front.png'} alt=""/><span>{residents[entry.residentId]}</span></div>}
          {entry.fromState&&names[entry.fromState]&&<p className="muted">{names[entry.fromState]} → {names[entry.toState]}</p>}
          {linked&&<Btn onClick={()=>openItem(linked)}>查看对应物件 ↗</Btn>}
        </article>
      </section>
    </div>:<p className="empty">{island.name} 暂无{focused?'物件互动':'观测记录'}。</p>}
  </div>;
}
function App(){
  const data=useSyncExternalStore(store.subscribe,store.getSnapshot);
  const [mode,setMode]=useState('world'),[browse,setBrowse]=useState('photos'),[filter,setFilter]=useState('全部'),[selected,setSelected]=useState(null),[view,setView]=useState('compare');
  const [event,setEvent]=useState(null),[focused,setFocused]=useState(null);
  const [draft,setDraft]=useState(null),[banner,setBanner]=useState(''),[menu,setMenu]=useState(false),[keyDebug,setKeyDebug]=useState(false),[last,setLast]=useState(null);
  const state=useRef(null), noticeTimer=useRef(null);
  const activeIslandId=data.activeIsland;
  const island=islands.find(i=>i.id===activeIslandId)||islands[1];
  const displayMode=draft?.step==='placing'?'world':mode;
  state.current={mode,draft,menu,island};
  function flash(text){setBanner(text);clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setBanner(''),2400);}
  function navigate(next){
    const current=state.current;
    if((current.draft?.step==='placing'?'world':current.mode)===next)return;
    if(current.draft?.step==='placing')bridge.command('cancel',current.draft.id);
    setDraft(null);setMenu(false);setMode(next);
  }
  function cancel(){
    const current=state.current;
    if(current.draft){
      if(current.draft.step==='placing')bridge.command('cancel',current.draft.id);
      setDraft(null);flash('已取消投放');return true;
    }
    if(current.menu){setMenu(false);return true;}
    return current.mode==='world'&&bridge.command('close');
  }
  function rotate(direction){
    const current=state.current;
    if(current.draft?.step==='placing'){bridge.command('cancel',current.draft.id);setDraft(d=>({...d,step:'editing',at:null,error:''}));}
    store.nextIsland(direction);
    const next=store.getSnapshot().activeIsland;
    setEvent(null);setFocused(null);flash(islandName(next));
  }
  function makeDraft(item,step){return {id:store.unique(),item,type:item.type,step,at:null,error:''};}
  function receive(record){
    if(!store.receive(record))return false;
    if(!state.current.draft){setMenu(false);setDraft(makeDraft(record,'receiving'));}
    else flash('新采集已存入现实影像');
    return true;
  }
  function simulate(){
    const sample=store.getSnapshot().discoveries.find(i=>i.objectId==='sample-apple');
    if(!sample)return false;
    const record={...sample,objectId:'explorer-demo-apple-v91',createdAt:new Date().toISOString()};
    if(!receive(record)){flash('本次模拟传输已接收，可在图鉴中查看');return false;}
    return true;
  }
  function begin(item){setDraft(makeDraft(item,'preview'));}
  function place(){
    const d=state.current.draft;
    if(!state.current.island.playable){setDraft({...d,step:'failed',error:'当前岛屿仅供预览，请用旋钮切换到 Story Land。'});return;}
    if(!bridge.requestPlacement({...d.item,type:d.type,draftId:d.id})){setDraft({...d,step:'failed',error:'岛屿正在加载，或此形态暂不能放置。'});return;}
    setDraft({...d,step:'placing',at:null,error:''});
  }
  function openItem(id){setSelected(id);setView('compare');navigate('collection');}
  function objectMemory(o){store.selectIsland(o.islandId);setFocused(o.objectId);setEvent(null);navigate('memories');}
  function inspect(o){navigate('world');store.selectIsland(o.islandId);bridge.command('inspect',o.objectId);}
  useEffect(()=>{
    function dispatch(input){
      const action=keyboardAction(input);
      if(!action)return false;
      if(action==='close'&&!cancel())return false;
      if(action==='previous'||action==='next')rotate(action==='next'?1:-1);
      else if(action==='transfer')simulate();
      else if(action!=='close')navigate(action);
      setLast({key:input.key,code:input.code,action});
      return true;
    }
    const keyboard=e=>{
      const editable=e.target instanceof Element&&!!e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
      if(dispatch({key:e.key,code:e.code,repeat:e.repeat,editable,modified:e.ctrlKey||e.metaKey||e.altKey||e.shiftKey,composing:e.isComposing||e.keyCode===229})){e.preventDefault();e.stopImmediatePropagation();}
    };
    const change=e=>{
      const signal=e.detail;
      if(signal.draftId!==state.current.draft?.id)return;
      if(signal.completed){setDraft(null);setMode('world');flash('物件已来到岛上');}
      else setDraft(d=>d?.id===signal.draftId&&(d.at?.x!==signal.at.x||d.at?.y!==signal.at.y||d.error!==signal.error)?{...d,at:signal.at,error:signal.error}:d);
    };
    const transfer=e=>receive(e.detail);
    const observe=e=>{if(state.current.mode==='world'&&state.current.island.playable&&!state.current.draft)flash(e.detail);};
    window.addEventListener('keydown',keyboard,true);
    window.addEventListener('isle:placement-state',change);
    window.addEventListener('isle:explorer-transfer',transfer);
    window.addEventListener('isle:observation',observe);
    window.isleObserverInput={dispatch,receiveDiscovery:store.ingest,receiveTransfer:receive};
    return ()=>{window.removeEventListener('keydown',keyboard,true);window.removeEventListener('isle:placement-state',change);window.removeEventListener('isle:explorer-transfer',transfer);window.removeEventListener('isle:observation',observe);delete window.isleObserverInput;clearTimeout(noticeTimer.current);};
  },[]);
  useEffect(()=>{
    document.body.dataset.mode=displayMode;
    document.body.dataset.preview=String(!island.playable);
    document.body.dataset.tools=String(menu);
    document.body.dataset.import=String(draft?.step==='placing');
    const world=document.querySelector('.viewport');
    world.inert=displayMode!=='world'||!island.playable||(!['receiving','placing'].includes(draft?.step)&&!!draft);
    document.querySelector('.toolbar').inert=displayMode!=='world'||!island.playable||!menu;
  },[displayMode,island,menu,draft?.step]);
  const preview=draft&&['preview','editing','failed'].includes(draft.step);
  const onPlacement=draft?.step==='placing';
  return <>
    {displayMode==='world'&&<div className="world-ui" data-screen="world">
      {!island.playable&&<div className="island-preview"><img src={asset(island.image)} alt=""/><div><p className="mono caption">PREVIEW · COMING SOON</p><h1>{island.name}</h1><p>当前岛屿尚未接入游玩。</p></div></div>}
      <div className="reticle" aria-hidden="true"/>
      <span className="hud live mono"><i/>{island.playable?'LIVE · CAM 02':'PREVIEW'}</span>
      <span className="hud signal mono">{island.name.toUpperCase()}<span>{island.playable?' / SIGNAL STABLE':''}</span></span>
    </div>}
    {displayMode==='collection'&&<Collection {...{data,island,browse,setBrowse,filter,setFilter,selected,setSelected,view,setView,begin,inspect,memory:objectMemory,blocked:!!preview}}/>}
    {displayMode==='memories'&&<Memories data={data} island={island} selected={event} setSelected={setEvent} openItem={openItem} focused={focused} blocked={!!preview} clearFocus={()=>{setFocused(null);setEvent(null);}}/>}
    {!onPlacement&&!preview&&<div className="utility">
      <Btn aria-label="终端菜单" aria-expanded={menu} onClick={()=>setMenu(x=>!x)}>⋯</Btn>
      {menu&&<div className="utility-panel">
        {Object.entries(modes).map(([id,[k,name,label]])=><Btn key={id} aria-pressed={mode===id} onClick={()=>navigate(id)}><kbd>{k.slice(-1)}</kbd> {name} · {label}</Btn>)}
        <div className="utility-row"><Btn onClick={()=>rotate(-1)} aria-label="上一座岛">←</Btn><span>{island.name}</span><Btn onClick={()=>rotate(1)} aria-label="下一座岛">→</Btn></div>
        <Btn aria-pressed={keyDebug} onClick={()=>setKeyDebug(q=>!q)}>Keyboard Debug</Btn>
        <Btn onClick={simulate}>模拟采集器传输</Btn>
        <Btn onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>flash('无法退出全屏'));else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>flash('此设备无法进入浏览器全屏'));else flash('此设备无法进入浏览器全屏');}}>切换浏览器全屏</Btn>
      </div>}
    </div>}
    {keyDebug&&<output className="key-debug mono">KEY {last?.key??'—'} / {last?.code??'—'} · {last?.action??'等待'} · MODE {modes[displayMode][0]}</output>}
    {banner&&<div className="toast" role="status">{banner}</div>}
    {draft?.step==='receiving'&&<section className="incoming" aria-label="收到新采集"><div><p className="mono caption">EXPLORER / RECEIVED</p><strong>收到新采集 · {draft.item.displayName}</strong></div><Btn className="primary" onClick={()=>setDraft({...draft,step:'preview'})}>查看接收预览</Btn><Btn aria-label="取消接收预览" onClick={cancel}>×</Btn></section>}
    {preview&&<section className="modal" aria-modal="true" role="dialog" aria-labelledby="import-title">
      <header className="page-head"><div><p className="mono caption">IMPORT / {draft.step==='editing'?'EDITING':'PREVIEW'}</p><h1 id="import-title">{draft.item.displayName} · 导入预览</h1></div><Btn onClick={cancel}>取消导入</Btn></header>
      <div className="edit-sheet">
        <PhotoPair item={draft.item} sprite={draft.item.importedSprite?variantSprite(draft.item,draft.type):null}/>
        <aside className="archive-sheet"><h2>放入 {island.name}</h2>
          <p>{draft.item.userNote||'暂无采集备注'}</p>
          {draft.item.importedSprite?<><p className="mono caption">选择形态</p><Tabs options={stages(draft.item)} value={draft.type} onChange={type=>setDraft({...draft,step:'editing',type,error:''})} label="投放形态"/></>:<p>这条记录目前只保留现实影像。</p>}
          {draft.error&&<p role="alert" className="error">{draft.error}</p>}
          <Btn className="primary" disabled={!draft.item.importedSprite||!draft.type||draft.item.type==='environment'} onClick={place}>去岛上选位置 →</Btn>
        </aside>
      </div>
    </section>}
    {onPlacement&&<section className="placement" aria-label="岛上布置"><p className="mono caption">IMPORT / PLACING</p><h2>{names[draft.type]||draft.item.displayName}</h2>
      {stages(draft.item).length>1&&<Tabs options={stages(draft.item)} value={draft.type} onChange={type=>{if(bridge.command('size',{draftId:draft.id,type}))setDraft(d=>({...d,type}));}} label="放置尺寸或形态"/>}
      <p className={draft.error?'error':'muted'} aria-live="polite">{draft.error||(draft.at?'落点 '+draft.at.x+', '+draft.at.y+' · 可以投放':'轻触地图选择落点')}</p>
      <div className="utility-row"><Btn onClick={cancel}>取消</Btn><Btn className="primary" disabled={!draft.at||!!draft.error} onClick={()=>bridge.command('confirm',draft.id)}>确认投放</Btn></div>
    </section>}
  </>;
}
createRoot(document.getElementById('observer-root')).render(<App/>);
