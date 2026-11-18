import React,{useEffect,useRef,useState} from 'react';
import {PixelButton,TransmissionOverlay} from './native-components.jsx';
import {receiveCaptureBatch} from './capture-adapter.mjs';

const phases={
  Idle:'输入 Explorer 或中间服务提供的批次地址。',
  Detect:'正在获取并检查批次清单…',
  Transfer:'正在接收原始照片…',
  Decode:'正在验证图片并匹配本地素材…',
  Arrive:'已同步到 Discovery Pocket。',
  Failed:'接收失败，可重试同一批次。',
  Cancelled:'已取消本次接收。',
};

export function CapturePanel({store,onClose}){
  const [url,setUrl]=useState('');
  const [phase,setPhase]=useState('Idle');
  const [message,setMessage]=useState('');
  const request=useRef(null);
  const busy=['Detect','Transfer','Decode'].includes(phase);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function sync(){
    if(request.current||!url.trim())return;
    const controller=new AbortController();
    request.current=controller;
    setMessage('');
    setPhase('Detect');
    const timeout=setTimeout(()=>controller.abort(new Error('接收超时，请检查网络后重试。')),20000);
    try{
      const result=await receiveCaptureBatch({
        url,base:location.href,store,signal:controller.signal,onPhase:setPhase,
      });
      setMessage(`新增 ${result.added} 件，更新 ${result.updated} 件。`);
    }catch(error){
      const cancelled=controller.signal.aborted&&controller.signal.reason?.name==='AbortError';
      setPhase(cancelled?'Cancelled':'Failed');
      if(!cancelled)setMessage(controller.signal.reason?.message||error.message||'无法连接采集服务。');
    }finally{
      clearTimeout(timeout);
      request.current=null;
    }
  }
  return <TransmissionOverlay title="Explorer 网络接收" onClose={onClose}>
    <div className="capture-network">
      <label>批次 URL<input value={url} onChange={event=>setUrl(event.target.value)}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} placeholder="/capture/batch.json"/></label>
      <output aria-live="polite"><strong>{phase.toUpperCase()}</strong> · {phases[phase]} {message}</output>
      <div className="capture-network-actions">
        <PixelButton tone="dark" disabled={busy||!url.trim()} onClick={sync}>
          {phase==='Idle'?'接收批次':'重试 / 刷新 AI 状态'}
        </PixelButton>
        <PixelButton onClick={()=>busy?request.current?.abort():onClose()}>{busy?'取消接收':'返回口袋'}</PixelButton>
      </div>
    </div>
  </TransmissionOverlay>;
}
