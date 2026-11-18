import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {CRTShell,PixelFrame,RetroPanel,PixelButton,PixelIcon,ModeKey,ObjectSlot,ObjectCard,PhotoFrame,ArchiveTabs,TimelineItem,StatusIndicator,SignalIndicator,ResidentInfo,TransmissionOverlay,IslandGlyph} from './native-components.jsx';
import {CapturePanel} from './capture-panel.jsx';
const captureStatus={processing:'等待 AI 处理',failed:'AI 处理失败 · 已保留原图',unsupported:'目前不支持此物件 · 已保留原图',available:'可登岛'};
const {store,islands,names,keyboardAction}=window.IsleObserver,bridge=window.IsleGameBridge;
const modes={world:'WORLD',collection:'COLLECTION',memories:'MEMORIES'},residentNames={tantan:'探探',zaozhao:'造造',manman:'慢慢'};
const A=file=>file?(/^(data:|blob:|https?:)/.test(file)?file:'assets/'+file):null;
const demoBatch=[
 {captureId:'demo-v103-apple',type:'apple',displayName:'苹果',originalPhoto:'apple-source-sample.png',importedSprite:'apple.png',userNote:'半边果皮更红，果梗有一点弯。',demo:true},
 {captureId:'demo-v103-leaf',type:'leaf',displayName:'叶子',originalPhoto:'sample-leaf.jpg',importedSprite:'leaf.png',userNote:'叶脉很清楚。',demo:true},
];
const stages=[['apple','普通苹果'],['apple-large','巨型苹果'],['apple-house','苹果屋']];
const extras=[{objectId:'visual-flower',type:'flower',displayName:'花朵',importedSprite:'crystal-flower.png'},{objectId:'visual-cup',type:'cup',displayName:'杯子',glyph:'cup'},{objectId:'sample-chair',type:'chair',displayName:'椅子',importedSprite:'chair.png'},{objectId:'visual-crystal',type:'crystal',displayName:'晶石',importedSprite:'crystal-flower.png'},{objectId:'visual-cloud',type:'cloud',displayName:'白纹石',importedSprite:'stone-rest.png',importStatus:'processing'}].map(i=>({originalPhoto:null,userNote:'视觉演示素材；暂无真实采集原图。',demo:true,importStatus:'available',...i}));
const samples=[['01','苹果的到来','一颗苹果，从现实来到小岛。','今天，岛上迎来了一颗\n来自现实世界的苹果。\n\n探探好奇地绕着它转了三圈，\n觉得它很像一间圆圆的房子。','apple.png','event-1.png','apple'],['02','慢慢的发现','陌生的果实引起了居民的好奇。','慢慢在苹果旁停了下来，\n认真地看了一会儿。\n\n她说，果皮上的亮光，\n很像一扇还没有打开的窗。','zaozhao-front.png','event-1.png','apple'],['04','苹果变大了','尺度变化，带来了新的想象。','今天，苹果比昨天大了很多。\n造造又绕着它走了一圈。\n\n“如果这里有一扇门，\n我们是不是就能进去？”','apple-large.png','event-4.png','apple-large'],['06','苹果屋完成','一颗苹果变成了温暖的居所。','一颗苹果，变成了一间房子。\n窗户里亮起温暖的光。\n\n居民们围在门前，\n开始想象这里的第一场聚会。','apple-house.png','event-6.png','apple-house']].map(([day,title,description,story,icon,image,toState])=>({eventId:'demo-day-'+day,day,title,description,story,icon,image,toState,demo:true}));
function readPrefs(){try{return {crt:'low',effectDebug:false,keyDebug:false,...JSON.parse(localStorage.getItem('isle.observer.v10.preferences')||'{}')};}catch{return {crt:'low',effectDebug:false,keyDebug:false};}}
function Button({children,...props}){return <PixelButton {...props}>{children}</PixelButton>;}
function CupGlyph(){return <svg className="cup-glyph" viewBox="0 0 90 90" shapeRendering="crispEdges" aria-label="杯子图示"><path d="M15 15H61V25H79V58H61V71H53V76H24V70H15ZM61 35V49H69V35Z" fill="#eee8fb" stroke="#49336b" strokeWidth="4"/><path d="M20 22H54V29H20Z" fill="#6d4a99"/><path d="M19 44H28V51H37V43H46V39H56V48H49V54H39V59H29V55H19Z" fill="#f5be81"/></svg>;}
function Sprite({item,type,alt=''}){if(!type&&item?.batchId&&!item.importedSprite)return <span>{captureStatus[item.importStatus]}</span>;return item?.glyph==='cup'?<CupGlyph/>:<img className="sprite" draggable="false" src={A(type?type+'.png':item?.importedSprite)} alt={alt}/>;}
function GameViewport({visible}){const host=useRef(null);useLayoutEffect(()=>{const lab=document.getElementById('legacy-lab');host.current.append(lab);window.dispatchEvent(new Event('resize'));},[]);return createPortal(<div className="game-surface" ref={host} style={{opacity:visible?1:0,pointerEvents:visible?'auto':'none'}} aria-hidden={!visible}/>,document.getElementById('game-portal')); }
function Header({mode,children}){return <header className="archive-header"><div className="archive-wordmark"><PixelIcon name="folder"/><div><h1><em>isle live</em> / {mode==='collection'?'COLLECTION':'MEMORIES'}</h1><p>{mode==='collection'?'OBJECT ARCHIVE':'ISLAND EVENT ARCHIVE'}</p></div></div>{children}</header>;}
function Boot({navigate}){return <section className="boot-page" aria-label="Observer Terminal 启动界面"><div className="boot-cosmos"/><div className="native-stars" aria-hidden="true">{[[20,28],[76,22],[88,14],[16,21],[81,11],[90,27],[13,13]].map(([x,y],i)=><i key={i} style={{left:x+'%',top:y+'%',width:i%3?12:22,height:i%3?12:22}}/>)}</div><h1 className="boot-logo">isle live</h1><h2 className="boot-subtitle">OBSERVER TERMINAL</h2><IslandGlyph/><p className="boot-hint">PRESS A KEY TO ENTER</p><div className="mode-keys"><ModeKey n="1" title="ISLAND OBSERVE" icon="eye" onClick={()=>navigate('world')}/><ModeKey n="2" title="COLLECTION" icon="collection" onClick={()=>navigate('collection')}/><ModeKey n="3" title="MEMORIES" icon="memory" onClick={()=>navigate('memories')}/></div></section>;}
function WorldHUD({island,time,info,closeResident,tools,action}){return <section className="world-hud" aria-label="World 实时岛屿监视器"><div className="hud-top"><StatusIndicator live>{island.playable?'LIVE':'PREVIEW'} <span>// ISLAND : {island.name.toUpperCase()}</span></StatusIndicator><StatusIndicator>{island.playable?'SIGNAL STABLE · 3 RESIDENTS':'COMING SOON'}</StatusIndicator></div><div className="viewfinder"><i/><i/><i/><i/><span className="center-mark"/></div><div className="camera-id">CAM 01<br/>{time}</div><SignalIndicator/><ResidentInfo info={info} onClose={closeResident}/>{tools&&island.playable&&<div className="game-tools">{[['暂停 / 恢复','pause'],['放置物件','place'],['交互 / 演变','interact'],['扩张','expand'],['Debug','debug'],['重置','reset']].map(([label,id])=><Button w={180} h={60} tone="dark" key={id} onClick={()=>action(id)}>{label}</Button>)}</div>}{!island.playable&&<div className="island-preview"><img src={A(island.image)} alt={island.name+'视觉预览'}/><div><strong>{island.name}</strong><p>VISUAL PREVIEW · 尚未接入可玩地图</p></div></div>}</section>;}
function PhotoPair({item,view='compare',form}){return <div className={'photo-pair '+view}>{view!=='sprite'&&<div><PhotoFrame src={A(item.originalPhoto)} alt={item.displayName+'现实原图'}/><small>ORIGINAL / {item.demo?'示例照片':'现实原图'}</small></div>}{view!=='original'&&<div><div className="sprite-preview"><Sprite item={item} type={form} alt={item.displayName+'像素转译'}/></div><small>PIXEL TRANSLATION</small></div>}</div>;}
function Collection({extraHeight,data,begin,openDetail,browse,setBrowse,selected,setSelected,filter,setFilter,toast,openCapture}){const [page,setPage]=useState(0),[phase,setPhase]=useState(1);const all=[...data.discoveries,...extras.filter(e=>!data.discoveries.some(d=>d.objectId===e.objectId))];const seedOrder=['sample-apple','sample-leaf','sample-stone','visual-flower','visual-cup','sample-chair','visual-crystal','sample-cat','visual-cloud'];all.sort((a,b)=>(seedOrder.includes(a.objectId)?seedOrder.indexOf(a.objectId):99)-(seedOrder.includes(b.objectId)?seedOrder.indexOf(b.objectId):99));const instances=id=>Object.values(data.entries).filter(o=>o.sourceId===id&&o.status==='在岛上');const status=i=>i.importStatus==='processing'?'处理中':instances(i.objectId).length?'已放置':'待导入';const pocket=all.filter(i=>i.captureId&&!instances(i.objectId).length);
 const list=browse==='pocket'?pocket:all.filter(i=>filter==='全部'||status(i)===filter);
 const item=(browse==='pocket'?list:all).find(i=>i.objectId===selected)||(browse==='pocket'?list:all)[0];
 if(!item&&browse!=='pocket')return null;const inWorld=item?instances(item.objectId):[];const photos=all.filter(i=>i.originalPhoto);const pages=Math.max(1,Math.ceil(list.length/9));const shown=list.slice(Math.min(page,pages-1)*9,(Math.min(page,pages-1)+1)*9);const chosenStage=!item?[]:item.type==='apple'?stages:[[item.type,item.displayName],[item.type,'更多用途'],[item.type,'等待发现']];return <section className="collection-page" aria-label="Collection 物件图鉴"><Header mode="collection"><div className="collection-view has-pocket"><ArchiveTabs label="收藏浏览模式" items={[[ 'objects','OBJECTS'],['photos','PHOTOS'],['pocket','Discovery Pocket']]} value={browse} onChange={setBrowse}/></div>{browse!=='pocket'&&<ArchiveTabs className="status-tabs" label="物件筛选" items={['全部','待导入','已放置','处理中'].map(x=>[x,x])} value={filter} onChange={id=>{setFilter(id);setPage(0);}}/>}</Header>{browse==='pocket'?<RetroPanel w={1610} h={720+extraHeight} className="photo-archive discovery-pocket">
 <h2>DISCOVERY POCKET <span>{pocket.length} 件待登岛</span></h2><button className="capture-network-launch" onClick={openCapture}>Explorer 网络接收</button>
 <div className="photo-grid">{pocket.map(capture=><button key={capture.objectId} onClick={()=>openDetail(capture,'compare')}>
 <PhotoFrame src={A(capture.originalPhoto)} alt=""/><strong>{capture.displayName}</strong><small>{capture.batchId?captureStatus[capture.importStatus]:'查看采集并逐件放入'}</small>
 </button>)}</div>
 {!pocket.length&&<p>待登岛口袋为空。按 T 接收一批演示照片。</p>}
 </RetroPanel>:browse==='photos'?<RetroPanel w={1610} h={720+extraHeight} className="photo-archive"><h2>PHOTO ARCHIVE <span>现实发现的原始影像</span></h2><div className="photo-grid">{photos.map(i=><button key={i.objectId} onClick={()=>openDetail(i,'original')}><PhotoFrame src={A(i.originalPhoto)} alt={i.displayName}/><strong>{i.displayName}</strong><small>{i.demo?'示例采集':new Date(i.createdAt).toLocaleDateString()}</small></button>)}</div><p>照片保留原始颜色。AI 转译不会替代现实的发现。</p></RetroPanel>:<><RetroPanel w={652} h={720+extraHeight} className="object-grid-panel"><div className="object-grid">{shown.map(i=><ObjectSlot key={i.objectId} item={i} selected={i.objectId===item.objectId} onClick={()=>{setSelected(i.objectId);setPhase(1);}}/>)}{Array.from({length:9-shown.length},(_,i)=><span className="empty-slot" key={'empty'+i}><FrameEdgeStub/></span>)}</div><div className="pagination"><button aria-label="上一页" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>◀</button><span>{Math.min(page,pages-1)+1} / {pages}</span><button aria-label="下一页" onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1}>▶</button></div></RetroPanel><RetroPanel w={956} h={720+extraHeight} className="object-detail-panel"><div className="object-hero"><div className="detail-sprite"><Sprite item={item} alt={item.displayName}/></div><div className="object-facts"><h2>{item.displayName} <span>{item.type.toUpperCase()}</span></h2><p>类型　物件</p><p>来源　{item.demo?'示例采集':'现实采集'}</p><p>状态　{status(item)}{inWorld.length?' (Story Land)':''}</p></div><button className="detail-photo" aria-label="查看原始照片" onClick={()=>openDetail(item,'original')}><PhotoFrame src={A(item.originalPhoto)} alt={item.displayName+'原始照片'}/></button></div><div className="evolution"><h3>演变方向　({phase+1}/3)</h3><div className="evolution-sequence">{chosenStage.map(([type,label],i)=><React.Fragment key={i}><button className={'evolution-stage stage-'+i} aria-label={'查看'+label} aria-pressed={phase===i} onClick={()=>{setPhase(i);toast(label+(item.type==='apple'?' · 预设演变形态':' · 方向示意'));}}><Sprite item={item} type={item.type==='apple'?type:null} alt={label}/></button>{i<2&&<PixelIcon name="arrow"/>}</React.Fragment>)}</div></div><div className="detail-actions"><Button onClick={()=>openDetail(item)}><PixelIcon name="play"/>查看详情</Button><Button tone="dark" w={420} onClick={()=>begin(item)}>再次放入岛屿 <span>⊕</span></Button></div></RetroPanel></>}</section>;}
function FrameEdgeStub(){return <div className="empty-slot-edge"/>;}
function Memories({extraHeight,data,island,openItem}){const [source,setSource]=useState('sample'),[selected,setSelected]=useState(null),[page,setPage]=useState(0);const actual=data.events.filter(e=>e.islandId===island.id).slice().reverse().map(e=>({...e,icon:(e.residentId?e.residentId+'-front':e.toState&&names[e.toState]?e.toState:'apple')+'.png',story:e.description||'这件发现又留下了新的故事。'}));const list=source==='sample'?samples:actual;const item=list.find(i=>i.eventId===selected)||list[0];const pageItems=list.slice(page*4,page*4+4);return <section className="memories-page" aria-label="Memories 岛屿回忆"><Header mode="memories"><ArchiveTabs className="memory-source" label="回忆来源" items={[[ 'sample','示例故事'],['actual','真实事件 '+actual.length]]} value={source} onChange={v=>{setSource(v);setSelected(null);setPage(0);}}/></Header><RetroPanel w={527} h={714+extraHeight} className="timeline-panel"><nav className="timeline" aria-label="事件时间轴">{pageItems.map(e=><TimelineItem key={e.eventId} item={e} selected={item?.eventId===e.eventId} onClick={()=>setSelected(e.eventId)}/>)}</nav>{list.length>4&&<div className="timeline-pages"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>◀</button><span>{page+1}/{Math.ceil(list.length/4)}</span><button disabled={(page+1)*4>=list.length} onClick={()=>setPage(p=>p+1)}>▶</button></div>}{!list.length&&<p className="empty-message">这座岛还没有真实记录。<br/>放入一件物品，故事就会开始。</p>}</RetroPanel><RetroPanel w={1092} h={716+extraHeight} className="memory-panel">{item?<><PhotoFrame stacked className="memory-photo" src={item.demo?A(item.image):A(item.icon)} alt={item.title+'静态记忆影像'}><figcaption>{item.demo?'示例静态影像':'物件图示 · 事件未记录截图'}</figcaption></PhotoFrame><article className="memory-story"><h2>{item.title}</h2><p className="memory-meta">{item.demo?'DAY '+item.day:new Date(item.timestamp).toLocaleTimeString('zh-CN')} · {item.demo?'MY LAND':island.name.toUpperCase()}</p><div className="story-divider"/><p className="story-text">{item.story}</p><div className="resident-portraits">{['tantan','zaozhao','manman'].map(id=><img key={id} src={A(id+'-front.png')} alt={residentNames[id]}/>)}</div></article><div className="still-archive"><button aria-label="上一条回忆" onClick={()=>{const i=list.indexOf(item);if(i>0)setSelected(list[i-1].eventId);}} disabled={list.indexOf(item)===0}>◀</button><span>STILL FRAME / 静态影像</span><div className="frame-index">{list.map((e,i)=><button key={e.eventId} aria-label={'选择记忆 '+(i+1)} aria-pressed={e.eventId===item.eventId} onClick={()=>{setPage(Math.floor(i/4));setSelected(e.eventId);}}/>)}</div><button aria-label="查看回忆关联物件" onClick={()=>openItem(item)}><PixelIcon name="full"/></button></div></>:<div className="empty-memory">MEMORY SIGNAL WAITING<br/><span>尚无事件影像</span></div>}</RetroPanel></section>;}
function ObjectDetail({item,initialView='compare',entries,begin,onClose,openMemory}){const [view,setView]=useState(initialView),[note,setNote]=useState(item.userNote||'');const instances=Object.values(entries).filter(e=>e.sourceId===item.objectId&&e.status==='在岛上');return <TransmissionOverlay title={item.displayName+' / OBJECT ARCHIVE'} onClose={onClose}><div className="modal-detail"><div><ArchiveTabs label="物件图像查看方式" items={[[ 'original','ORIGINAL'],['sprite','SPRITE'],['compare','COMPARE']]} value={view} onChange={setView}/><PhotoPair item={item} view={view}/></div><aside><h3>{item.displayName}</h3><p className="caption">{item.demo?'DEMO CAPTURE / 示例素材':'REAL-WORLD CAPTURE'}</p><label>采集备注<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>{item.batchId&&<p>{captureStatus[item.importStatus]}{item.captureError?' · '+item.captureError:''}</p>}<p>特征：{item.type==='apple'?'圆润 · 果梗 · 暖红色':item.type==='leaf'?'轻薄 · 清晰叶脉':'等待更多发现'}</p><p>{instances.length} 个已放置实例</p><div className="instance-list">{instances.map(i=><button key={i.objectId} onClick={()=>openMemory(i)}>{names[i.form]||item.displayName} · {i.at?.x}, {i.at?.y} ↗</button>)}</div><Button onClick={()=>{store.ingest({...item,userNote:note});onClose();}}>保存备注</Button><Button tone="dark" disabled={item.batchId&&item.importStatus!=='available'} onClick={()=>begin({...item,userNote:note})}>{instances.length?'复制放置新实例':'放入岛屿'} →</Button></aside></div></TransmissionOverlay>;}
function App(){const data=useSyncExternalStore(store.subscribe,store.getSnapshot),[mode,setMode]=useState(globalThis.IsleArtCalibration?'world':'boot'),[prefs,setPrefs]=useState(readPrefs),[menu,setMenu]=useState(false),[tools,setTools]=useState(false),[selected,setSelected]=useState('sample-apple'),[browse,setBrowse]=useState('objects'),[filter,setFilter]=useState('全部'),[detail,setDetail]=useState(null),[draft,setDraft]=useState(null),[banner,setBanner]=useState(''),[lastKey,setLastKey]=useState(null),[resident,setResident]=useState(null),[time,setTime]=useState(new Date().toLocaleTimeString('en-GB'));
 const [captureOpen,setCaptureOpen]=useState(false);
 const [designHeight,setDesignHeight]=useState(930);
 const [proposalId,setProposalId]=useState(null),[proposalError,setProposalError]=useState('');
 const proposalEntry=data.entries[proposalId];
 const extraHeight=designHeight-930;
 const current=useRef(null),timer=useRef(null),layer=useRef(null);const island=islands.find(i=>i.id===data.activeIsland)||islands[1];const displayMode=draft?.step==='placing'?'world':mode;current.current={mode,draft,detail,menu,island,proposalId,captureOpen};
 function flash(s){setBanner(s);clearTimeout(timer.current);timer.current=setTimeout(()=>setBanner(''),2800);}
 function cancelDraft(){const d=current.current.draft;if(d?.step==='placing')bridge.command('cancel',d.id);setDraft(null);flash(d?.relocationId?'已取消选址，原叶子保留在陆地':'已取消，未生成成功投放记录');}
 function navigate(next){setCaptureOpen(false);if(current.current.draft)cancelDraft();setDetail(null);setProposalId(null);setMenu(false);setMode(next);}
 function rotate(direction){setProposalId(null);if(current.current.draft?.step==='placing'){flash('请先确认或取消当前放置');return;}store.nextIsland(direction);flash(islands.find(i=>i.id===store.getSnapshot().activeIsland).name);}
 function close(){if(current.current.captureOpen){setCaptureOpen(false);return true;}if(current.current.proposalId){setProposalId(null);return true;}if(current.current.draft){cancelDraft();return true;}if(current.current.detail){setDetail(null);return true;}if(current.current.menu){setMenu(false);return true;}return current.current.mode==='world'&&bridge.command('close');}
 function begin(item){if(!item.importedSprite||!['apple','leaf','stone','chair','cat'].includes(item.type)||item.importStatus==='processing'){flash('该示例尚未配置可投放的游戏素材与占地');return;}setDetail(null);setDraft({id:store.unique(),item,type:item.type,step:'preview',at:null,error:''});}
 function receive(payload){
   const captures=Array.isArray(payload)?payload:Array.isArray(payload?.captures)?payload.captures:[payload];
   const accepted=store.receiveBatch(captures);
   if(!accepted.length){flash('没有新的采集照片，重复采集已跳过');return false;}
   if(!current.current.draft&&!current.current.proposalId){
     setDetail(null);
     setBrowse('pocket');
     setMode('collection');
   }
   flash(`收到 ${accepted.length} 件采集，已存入 Discovery Pocket`);
   return true;
 }
 function simulate(){receive(demoBatch);}
 function confirmProposal(){
   if(proposalEntry?.proposal?.requiresLocation){
     const draftId=store.unique();
     const type=proposalEntry.proposal.toState;
     if(!bridge.requestPlacement({type,draftId,relocationId:proposalId,displayName:names[type]})){
       setProposalError('岛屿还没有准备好，或原提议已不可用。');
       return;
     }
     setDraft({id:draftId,item:{displayName:names[type]},type,relocationId:proposalId,step:'placing',at:null,error:''});
     setProposalId(null);
     return;
   }
   const request={objectId:proposalId};
   bridge.command('evolve',request);
   if(!request.result||request.result.error){
     setProposalError(request.result?.error||'岛屿还没有准备好。');
     return;
   }
   setProposalId(null);
   flash(request.result.pending?'造造会走到苹果旁开始改造':'用途已确认，居民会前往新形态互动');
 }
 function place(){const d=current.current.draft;if(!current.current.island.playable){setDraft({...d,step:'failed',error:'此岛屿尚未接入游戏；请使用 Q/E 选择 Story Land 后继续。'});return;}if(!bridge.requestPlacement({...d.item,type:d.type,draftId:d.id})){setDraft({...d,step:'failed',error:'游戏尚未准备好，或无法接受此形态。'});return;}setDraft({...d,step:'placing',at:null,error:''});}
 function gameAction(id){document.getElementById(id)?.click();}
 useEffect(()=>{if(globalThis.IsleArtCalibration)return;try{localStorage.setItem('isle.observer.v10.preferences',JSON.stringify(prefs));}catch{}},[prefs]);
 useEffect(()=>{const interval=setInterval(()=>setTime(new Date().toLocaleTimeString('en-GB')),1000);const obs=new MutationObserver(()=>{const p=document.getElementById('person');const next=p.hidden?null:{name:document.getElementById('person-name').textContent,state:document.getElementById('person-state').textContent,goal:document.getElementById('person-goal').textContent};setResident(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);});obs.observe(document.getElementById('person'),{subtree:true,characterData:true,childList:true,attributes:true,attributeFilter:['hidden']});return()=>{clearInterval(interval);obs.disconnect();};},[]);
 useEffect(()=>{function dispatch(input){const action=keyboardAction(input);if(!action)return false;if(action==='close'&&!close())return false;if(action==='previous'||action==='next')rotate(action==='next'?1:-1);else if(action==='transfer')simulate();else if(action!=='close')navigate(action);setLastKey({...input,action});return true;}function keyboard(e){const editable=e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');if(dispatch({key:e.key,code:e.code,repeat:e.repeat,editable:!!editable,modified:e.ctrlKey||e.metaKey||e.altKey||e.shiftKey,composing:e.isComposing||e.keyCode===229})){e.preventDefault();e.stopImmediatePropagation();}}
 function change(event){
   const status=event.detail;
   if(current.current.draft?.id!==status.draftId)return;
   if(status.completed){
     setDraft(null);
     setMode('world');
     flash(current.current.draft.relocationId?'叶子船已入水，居民会到岸边观察':'物件到来，图鉴与回忆已同步');
     return;
   }
   setDraft(draft=>{
     if(!draft||draft.id!==status.draftId)return draft;
     const error=status.error||'';
     if(draft.at?.x===status.at?.x&&draft.at?.y===status.at?.y&&draft.error===error)return draft;
     return {...draft,at:status.at,error};
   });
 }
 const transfer=e=>receive(e.detail);
 const observe=e=>{if(current.current.mode==='world'&&!current.current.draft)flash(e.detail);};window.addEventListener('keydown',keyboard,true);window.addEventListener('isle:placement-state',change);window.addEventListener('isle:observation',observe);window.addEventListener('isle:explorer-transfer',transfer);window.isleObserverInput={dispatch,receiveTransfer:receive,receiveDiscovery:store.ingest};return()=>{window.removeEventListener('keydown',keyboard,true);window.removeEventListener('isle:placement-state',change);window.removeEventListener('isle:observation',observe);window.removeEventListener('isle:explorer-transfer',transfer);delete window.isleObserverInput;};},[]);
 useEffect(()=>{document.body.dataset.mode=displayMode;document.body.dataset.import=String(draft?.step==='placing');const game=document.getElementById('legacy-lab');const blocked=captureOpen||!!detail||!!proposalId||!!(draft&&draft.step!=='placing');game.inert=displayMode!=='world'||!island.playable||blocked;for(const selector of ['.mode-layer','.boot-page','.terminal-utility']){const node=document.querySelector(selector);if(node)node.inert=blocked;}},[displayMode,island,detail,proposalId,captureOpen,draft?.step]);
 useLayoutEffect(()=>{
   const design=layer.current;
   const viewport=design.parentElement;
   const fit=()=>{
     const {width,height}=viewport.getBoundingClientRect();
     if(!width)return;
     const scale=width/1662;
     const logicalHeight=Math.round(height/scale);
     design.style.transform=`scale(${scale})`;
     setDesignHeight(logicalHeight);
   };
   const observer=new ResizeObserver(fit);
   observer.observe(viewport);
   fit();
   return()=>observer.disconnect();
 },[]);
 const importVisible=draft&&draft.step!=='placing';return <main className="terminal-viewport"><div className="terminal-design" data-mode={displayMode} ref={layer} style={{height:designHeight,'--tablet-extra':extraHeight+'px'}}><CRTShell height={designHeight} level={prefs.crt} debug={prefs.effectDebug}><GameViewport visible={displayMode==='world'&&island.playable}/>{displayMode==='boot'&&<Boot navigate={navigate}/>}<div className={'mode-layer '+displayMode} key={displayMode}>{displayMode==='world'&&<WorldHUD {...{island,time,info:resident,tools}} closeResident={()=>{document.getElementById('close-person').click();}} action={gameAction}/>}{displayMode==='collection'&&<Collection extraHeight={extraHeight} {...{data,begin,browse,setBrowse,selected,setSelected,filter,setFilter,toast:flash}} openCapture={()=>setCaptureOpen(true)} openDetail={(item,view='compare')=>setDetail({item,view})}/>}{displayMode==='memories'&&<Memories extraHeight={extraHeight} data={data} island={island} openItem={e=>{const source=data.entries[e.objectId]?.sourceId||'sample-apple',item=data.discoveries.find(i=>i.objectId===source);if(item)setDetail({item,view:'compare'});}}/>}</div>
 <div className="terminal-utility"><button aria-label="终端控制菜单" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>≡</button>{menu&&<RetroPanel w={450} h={695} tone="dark" className="utility-menu"><h3>OBSERVER / V10.6 PREVIEW</h3>{Object.entries(modes).map(([id,label],i)=><button key={id} onClick={()=>navigate(id)}>{i+1} · {label}</button>)}<div className="knob"><button aria-label="上一座岛" onClick={()=>rotate(-1)}>◀</button><span>{island.name}</span><button aria-label="下一座岛" onClick={()=>rotate(1)}>▶</button></div><div className="crt-control">CRT EFFECTS<ArchiveTabs label="CRT 强度" items={[[ 'off','OFF'],['low','LOW'],['medium','MEDIUM']]} value={prefs.crt} onChange={v=>setPrefs(p=>({...p,crt:v}))}/></div><button onClick={()=>setPrefs(p=>({...p,effectDebug:!p.effectDebug}))}>CRT Debug · {prefs.effectDebug?'ON':'OFF'}</button><button onClick={()=>setPrefs(p=>({...p,keyDebug:!p.keyDebug}))}>Keyboard Debug · {prefs.keyDebug?'ON':'OFF'}</button><button onClick={()=>{setTools(v=>!v);setMenu(false);}}>游戏测试工具 · {tools?'ON':'OFF'}</button><button onClick={()=>{setMenu(false);simulate();}}>模拟 Explorer 传输 · T</button><p>1 / 2 / 3 模式选择<br/>Q / E 旋钮模拟</p></RetroPanel>}</div>
 {captureOpen&&<CapturePanel store={store} onClose={()=>setCaptureOpen(false)}/>}
 {detail&&<ObjectDetail item={data.discoveries.find(item=>item.objectId===detail.item.objectId)||detail.item} initialView={detail.view} entries={data.entries} begin={begin} onClose={()=>setDetail(null)} openMemory={instance=>{store.selectIsland(instance.islandId);setDetail(null);setMode('world');bridge.command('inspect',instance.objectId);}}/>}
 {importVisible&&<TransmissionOverlay title={draft.item.displayName+' · 登岛预览'} onClose={cancelDraft}>
 <div className="import-sheet"><PhotoPair item={draft.item}/><aside>
 <p className="caption">{draft.item.demo?'示例采集':'EXPLORER'}</p>
 <h3>{draft.item.displayName}</h3><p>{draft.item.userNote}</p>
 <p>目标岛屿：{island.name}<br/><small>旋钮 Q/E 可更换岛屿。</small></p>
 {draft.error&&<p role="alert" className="import-error">{draft.error}</p>}
 <Button tone="dark" onClick={place}>进入 World 选择位置 →</Button><Button onClick={cancelDraft}>取消导入</Button>
 </aside></div></TransmissionOverlay>}
 {displayMode==='world'&&!draft&&island.playable&&<div className="living-proposals">
 {Object.values(data.entries).filter(entry=>entry.status==='在岛上'&&entry.islandId===island.id&&entry.proposal).map(entry=>
   <Button key={entry.objectId} tone="dark" onClick={()=>{setProposalError('');setProposalId(entry.objectId);}}>
     {residentNames[entry.proposal.residentId]}提议：{names[entry.proposal.toState]}
   </Button>)}
 </div>}
 {proposalId&&proposalEntry?.proposal&&<TransmissionOverlay title="居民提议 · 确认用途" onClose={()=>setProposalId(null)}>
 <div className="living-proposal-dialog">
 <h3>{residentNames[proposalEntry.proposal.residentId]}的用途提议</h3>
 <p>{proposalEntry.proposal.description}</p>
 <div className="living-forms"><img src={A(proposalEntry.form+'.png')} alt={names[proposalEntry.form]}/><span>→</span><img src={A(proposalEntry.proposal.toState+'.png')} alt={names[proposalEntry.proposal.toState]}/></div>
 {proposalError&&<p role="alert">{proposalError}</p>}
 <div className="living-proposal-actions"><Button onClick={()=>setProposalId(null)}>暂不改变</Button><Button tone="dark" onClick={confirmProposal}>{proposalEntry.proposal.requiresLocation?'选择水岸位置':'确认用途并演变'}</Button></div>
 </div></TransmissionOverlay>}

 {draft?.step==='placing'&&<div className="placement-controls" data-placement={draft.error?'invalid':draft.at?'valid':'selecting'}><div><strong>{draft.item.displayName} / {draft.relocationId?'水域选址':'PLACING'}</strong><p role="status">{draft.error||(draft.at?`位置 ${draft.at.x}, ${draft.at.y} · 可确认`:draft.relocationId?'请选择相邻两格水面，靠近居民可到达的岸边':'轻触或拖动预览，选择落点')}</p></div><Button tone="dark" disabled={!draft.at||!!draft.error} onClick={()=>bridge.command('confirm',draft.id)}>{draft.relocationId?'确认入水':'确认投放'}</Button><Button onClick={cancelDraft}>取消</Button></div>}
 {prefs.keyDebug&&<output className="keyboard-debug">{lastKey?`KEY ${lastKey.key} / ${lastKey.code} → ${lastKey.action}`:'等待键盘输入'} · {displayMode.toUpperCase()}</output>}{banner&&<div className="terminal-toast" role="status">{banner}</div>}
 </CRTShell></div></main>;}
createRoot(document.getElementById('observer-v10-root')).render(<App/>);
