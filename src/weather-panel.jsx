import React,{useEffect,useRef,useState} from 'react';
import {PixelButton,RetroPanel} from './native-components.jsx';

export function WeatherPanel({store,committed,preview,onPreview,onConfirm,onCancel}){
  const [status,setStatus]=useState('');
  const reader=useRef(null);
  useEffect(()=>()=>reader.current?.abort(),[]);
  const {weather}=window.IsleSkyConfig;

  function receiveEnvironment(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){
      setStatus('请选择不超过 1 MiB 的 JPEG、PNG 或 WebP。');
      return;
    }
    if(reader.current)return;
    const task=new FileReader();
    reader.current=task;
    task.onload=()=>{
      const capture=store.addEnvironmentPhoto(task.result,file.name.slice(0,80));
      reader.current=null;
      if(!capture){setStatus('照片未保存，请检查本地存储。');return;}
      onPreview(capture.weatherSuggestion,'simulated',capture.captureId);
      setStatus('环境原图已收藏。晚霞是手动模拟建议，等待确认。');
    };
    task.onerror=()=>{reader.current=null;setStatus('无法读取照片。');};
    task.readAsDataURL(file);
  }

  const selected=preview?.weatherId||committed.weatherId;
  return <RetroPanel w={430} h={530} tone="dark" className="weather-controls" aria-label="天气控制">
    <h2>Living Sky</h2>
    <div className="weather-presets">{weather.map(preset=><button key={preset.id} aria-pressed={selected===preset.id}
      onClick={()=>onPreview(preset.id,'manual')}>{preset.name}</button>)}</div>
    <button onClick={()=>onPreview('stardust-clear','default')}>恢复默认</button>
    <label>环境照片 · 模拟晚霞建议
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={receiveEnvironment}/>
    </label>
    <p role="status">{status||(preview?'预览中 · 确认后记录':'选择一种天气进行预览')}</p>
    <div className="weather-actions">
      <PixelButton disabled={!preview} onClick={()=>{if(!onConfirm())setStatus('应用失败，请检查本地存储。');}}>确认天气</PixelButton>
      <PixelButton onClick={onCancel}>取消</PixelButton>
    </div>
  </RetroPanel>;
}
