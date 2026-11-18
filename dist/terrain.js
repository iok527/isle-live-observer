/* The plate draws only scenery beyond the island. Every island pixel comes from a cell or its boundary. */
(function () {
  const {key,boundary}=IsleWorld;
  const T=16;
  const gridWidth=688, gridHeight=432;
  const hash=(x,y,n=0)=>((Math.imul(x+71,1693547)^Math.imul(y+29,637223)^Math.imul(n+7,912733))>>>0)%9973;
  const noise=(x,y,n,m)=>hash(x,y,n)%m;
  function draw(ctx, world, atlas) {
    ctx.clearRect(0,0,gridWidth,gridHeight);
    ctx.imageSmoothingEnabled=false;
    const edges=boundary(world.cells);
    const px=(x,y,w,h,color)=>{
      ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
    };
    const rock=['#342958','#494076','#60508b','#7760a0','#9475b2','#ae8ec6','#c6a5d2'];
    const south=edges.filter(e=>e.dir==='S').sort((a,b)=>a.y-b.y);
    for(const {x,y} of south){
      const left=x*T, top=(y+1)*T;
      const baseDepth=18+Math.round((1-Math.min(Math.abs(x-19)/25,1))*28)+noise(x,y,1,9);
      for(let off=0;off<16;off++){
        const depth=baseDepth-((off<3||off>13)?3:0);
        for(let i=0;i<depth;i++){
          const joint=(off+(i>13?4:i>23?-2:0)+noise(x,y,8,5))%15;
          const bands=i<8?5:i<17?4:i<28?3:i<36?2:1;
          const shade=joint<2?Math.max(0,bands-2):joint<4?Math.min(6,bands+1):bands;
          const index=(i===depth-1)?0:((i+noise(x,y,51,5))%13===2?Math.max(shade-1,0):shade);
          px(left+off,top+i,1,1,rock[index]);
        }
      }
      for(let j=0;j<9;j++){
        const n=noise(x,y,j+24,14), z=noise(x,y,j+70,Math.max(1,baseDepth-6));
        px(left+n,top+2+z,1+(j%3),1,rock[j%2===0?4:2]);
      }
      if (noise(x,y,15,6)===1) {
        const c=['#7864b9','#a7a0e2','#eeb5df'];
        for(let j=0;j<4;j++)px(left+3+j,top+13+(j>1?j-1:0),1,j===1?5:3,c[j%3]);
      }
    }
    for(const cell of world.cells.values()){
      const {x,y,tile,material}=cell;
      const ox=x*T,oy=y*T;
      const tx=tile%8*T,ty=Math.floor(tile/8)*T;
      ctx.drawImage(atlas,tx,ty,T,T,ox,oy,T,T);
      const nearby=[[0,-1],[1,0],[0,1],[-1,0]];
      const blend={lavender:'#b9acd7',moss:'#a9bebc',paving:'#c5b7e2'};
      if(material!=='water')for(const [i,[dx,dy]] of nearby.entries()){
        const adjacent=world.cells.get(key(x+dx,y+dy));
        if (!adjacent||adjacent.material===material||adjacent.material==='water')continue;
        for(let a=1;a<15;a++){
          if(noise(x,y,i*19+a+42,5)>2)continue;
          const b=noise(x,y,i*19+a+71,4);
          const u=dx>0?15-b:dx<0?b:a,v=dy>0?15-b:dy<0?b:a;
          px(ox+u,oy+v,1,1,blend[adjacent.material]);
        }
      }
      if (material==='moss' && noise(x,y,2,4)===0) {
        const a=ox+4+noise(x,y,4,7),b=oy+5+noise(x,y,5,7);
        px(a,b,3,1,'#e3d9df');px(a+1,b-1,1,3,'#ddbed8');px(a+1,b,1,1,'#f5dec8');
      }
      if(material==='paving' && noise(x,y,3,4)!==0){
        const p='#d6c6ee',q='#b8a9d6';
        if(world.cells.get(key(x+1,y))?.material==='paving') {
          const a=oy+4+(y%3)*3;
          px(ox+14,a,4,1,q);px(ox+14,a+1,4,1,p);
        }
      }
    }
    // Low plant clusters decorate local terrain without defining occupancy.
    for(const {x,y,material,placeable} of world.cells.values()){
      if(placeable || material==='water' || material==='paving')continue;
      const ring=edges.some(e=>e.x===x&&e.y===y);
      if(!(ring&&noise(x,y,61,3)!==0) && !(material==='moss'&&noise(x,y,62,3)===0))continue;
      const bx=x*T+4+noise(x,y,63,8),by=y*T+5+noise(x,y,64,7);
      const stalk='#738f8f',leaf='#a7cbb4',fine='#cbe1bb', petals=['#eebadd','#c9b5e9','#f3d6aa'];
      for(let i=0;i<3;i++){
        const dx=i*3-3,dy=i%2?3:0;
        px(bx+dx,by+dy-4,1,5,stalk);
        px(bx+dx-2,by+dy-2,2,1,leaf);
        px(bx+dx+1,by+dy-3,2,1,fine);
        if(noise(x,y,65+i,4)===0){
          const c=petals[noise(x,y,69+i,3)];
          px(bx+dx-1,by+dy-5,3,1,c);
          px(bx+dx,by+dy-6,1,3,'#f4e2d9');
        }
      }
    }
    // Paint well-defined rims shared by adjacent cells. An internal edge is never rendered as a wall.
    for(const {x,y,dir} of edges){
      const lx=x*T,ly=y*T, wet=world.cells.get(key(x,y)).material==='water';
      const border=wet?'#7098c8':'#8280ad', light=wet?'#b0e2ec':'#d1c5e4';
      if(dir==='N'){px(lx,ly,T,2,border);px(lx+1,ly+2,T-2,1,light);}
      if(dir==='S'){px(lx,ly+T-2,T,2,border);px(lx+1,ly+T-3,T-2,1,light);}
      if(dir==='W'){px(lx,ly,2,T,border);px(lx+2,ly+1,1,T-2,light);}
      if(dir==='E'){px(lx+T-2,ly,2,T,border);px(lx+T-3,ly+1,1,T-2,light);}
      if(!wet)for(let i=0;i<3;i++){
        const p=1+noise(x,y,dir.charCodeAt(0)+i,13);
        const c=i%2?'#acc6b3':'#e2c8db';
        if(dir==='N'||dir==='S')px(lx+p,ly+(dir==='N'?3:13),2,1,c);
        else px(lx+(dir==='W'?3:13),ly+p,1,2,c);
      }
    }
    // A spillway exists only where this south-facing bay edge is exposed.
    if(edges.some(e=>e.x===3&&e.y===14&&e.dir==='S')){
      const x=3*T+3,y=15*T;
      px(x+1,y,8,29,'#78a8dd');px(x,y,3,25,'#b0d8ed');px(x+3,y+2,2,30,'#a1c5ea');
      px(x+7,y+4,2,35,'#617cbf');px(x+4,y+5,1,37,'#c3e1ec');
      px(x+2,y+32,1,9,'#8598d5');px(x+1,y+39,2,3,'#b5c8e7');px(x+7,y+43,2,1,'#b5c8e7');
      px(x-1,y-1,11,2,'#c2e1f3');
    }
    for(const {x,y,material} of world.cells.values()){
      if(material!=='water')continue;
      for(const [dx,dy,dir] of [[0,-1,'N'],[1,0,'E'],[0,1,'S'],[-1,0,'W']]){
        const next=world.cells.get(key(x+dx,y+dy));
        if(!next||next.material==='water')continue;
        const lx=x*T,ly=y*T, foam='#a3c9e3',deep='#3d619a';
        if(dir==='N'||dir==='S'){
          const a=ly+(dir==='N'?0:15);
          px(lx,a,T,1,foam);px(lx+1,a+(dir==='N'?1:-1),T-2,1,deep);
          px(lx+4+noise(x,y,11,5),a+(dir==='N'?3:-3),4,1,foam);
        }else{
          const a=lx+(dir==='W'?0:15);
          px(a,ly,1,T,foam);px(a+(dir==='W'?1:-1),ly+1,1,T-2,deep);
          px(a+(dir==='W'?3:-3),ly+6,1,4,foam);
        }
      }
    }
  }
  globalThis.IsleTerrain={draw,gridWidth,gridHeight};
})();
