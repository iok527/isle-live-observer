const stages=new Set(['/capture-fixture/processing','/capture-fixture/ready','/capture-fixture/failed']);
export function captureFixture(pathname,request,response){
  if(process.env.CAPTURE_FIXTURE!=='1'||!stages.has(pathname))return false;
  const status=pathname.split('/').at(-1);
  const captures=[
    {category:'apple',label:'苹果',photo:'apple-source-sample.png'},
    {category:'leaf',label:'叶子',photo:'sample-leaf.jpg'},
  ].map(({category,label,photo})=>({
    captureId:'lan-fixture:'+category,
    captureTimestamp:'2026-11-19T08:00:00+08:00',
    revision:status==='processing'?0:status==='failed'?1:2,
    localFileRef:'/assets/'+photo,
    objectLabel:label,
    objectCategory:status==='ready'?category:undefined,
    status,
    errorCode:status==='failed'?'AI_UNAVAILABLE':undefined,
    note:'Explorer LAN fixture',
  }));
  response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(request.method==='HEAD'?undefined:JSON.stringify({
    protocolVersion:1,batchId:'lan-fixture-01',sourceDeviceId:'fixture-explorer',captures,
  }));
  return true;
}
