import React,{useState} from 'react';
import {PixelButton,TransmissionOverlay} from './native-components.jsx';

function matches(layout,world,sky){
  if(layout.skyStateId!==sky||layout.expanded!==!!world?.expanded)return false;
  const objects=world?.objects||[];
  return layout.objects.length===objects.length&&layout.objects.every(item=>objects.some(object=>
    item.objectInstanceId===object.collectionId&&item.objectFormId===object.type&&
    item.position.x===object.at.x&&item.position.y===object.at.y));
}

export function LayoutBook({data,store,bridge,island,onDirty,names,skyNames,lights,onLights,onClose}){
  const [name,setName]=useState('');
  const [selection,setSelection]=useState(null);
  const [deleting,setDeleting]=useState(false);
  const [status,setStatus]=useState('');
  const layouts=data.layouts.filter(layout=>layout.islandId===island.id);
  const current=layouts.find(layout=>matches(layout,data.worlds[island.id],data.weather.weatherId));
  const selected=layouts.find(layout=>layout.layoutId===selection)||layouts[0];

  function save(){
    const request={};
    bridge.command('layout-snapshot',request);
    const saved=request.snapshot&&store.saveLayout({...request.snapshot,name});
    if(!saved){
      setStatus(layouts.length>=12?'布置簿最多保存 12 页。请先删除一页。':'暂时无法保存。请结束放置或改造，再检查存储空间。');
      return;
    }
    setName('');onDirty(false);setSelection(saved.layoutId);setDeleting(false);
    setStatus('已保存 '+saved.name);
  }

  function restore(){
    const request={layoutId:selected.layoutId};
    bridge.command('layout-restore',request);
    setStatus(request.error||'已恢复 '+selected.name+' 的物件位置。');
  }

  function remove(){
    if(!store.deleteLayout(selected.layoutId)){
      setStatus('删除失败，请稍后重试。');
      return;
    }
    setDeleting(false);setSelection(null);setStatus('已删除这页快照。');
  }

  return <TransmissionOverlay title="岛屿布置簿" onClose={onClose}>
    <div className="observer-layout-book">
      <div className="layout-book-controls">
        <input aria-label="布局名称" maxLength={30} value={name} disabled={!island.playable} onChange={event=>{setName(event.target.value);onDirty(!!event.target.value.trim());}} placeholder="留空使用默认名称"/>
        <PixelButton tone="dark" disabled={!island.playable} onClick={save}>保存当前布局</PixelButton>
        <label><input type="checkbox" disabled={!island.playable} checked={lights} onChange={event=>onLights(event.target.checked)}/> 显示窗灯</label>
      </div>
      <p role="status">{status||(island.playable?'保存并回看 '+island.name+' 的布置。':island.name+' 暂无可编辑的布局。')}</p>
      {selected&&<div className="layout-book-grid">
        <nav aria-label="已保存布局">{layouts.map(layout=><button key={layout.layoutId} aria-pressed={layout.layoutId===selected.layoutId}
          onClick={()=>{setSelection(layout.layoutId);setDeleting(false);}}>
          {layout.name}<small>{layout.layoutId===current?.layoutId?'当前布局':'历史快照'}</small></button>)}</nav>
        <section aria-label="布局预览" className="layout-book-preview">
          <img src={selected.thumbnail} alt={selected.name+'布局缩略图'}/>
          <div>
            <h3>{selected.name}</h3>
            <time dateTime={selected.timestamp}>{new Date(selected.timestamp).toLocaleString('zh-CN')}</time>
            <p>天空 · {skyNames[selected.skyStateId]||selected.skyStateId}</p>
            <ul>{selected.objects.map(item=><li key={item.objectInstanceId}>{names[item.objectFormId]||item.objectFormId} · ({item.position.x}, {item.position.y})</li>)}</ul>
            <button onClick={restore}>恢复物件位置</button>
            {deleting?<div className="layout-delete"><span>删除「{selected.name}」这页？</span><button onClick={remove}>确认删除</button><button onClick={()=>setDeleting(false)}>取消</button></div>:
              <button onClick={()=>setDeleting(true)}>删除快照</button>}
          </div>
        </section>
      </div>}
    </div>
  </TransmissionOverlay>;
}
