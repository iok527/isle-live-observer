(function () {
  'use strict';
  const {World,key,equal,boundary}=IsleWorld;
  const {gridWidth,gridHeight}=IsleTerrain;
  const T=16;
  const bridge=globalThis.IsleGameBridge;
  const calibration=globalThis.IsleArtCalibration;
  const center = n=>n*T+T/2;
  const get = id=>document.getElementById(id);
  const people = ['tantan','zaozhao','manman'];
  const faces = ['front','back','left','right'];
  const sprites=['terrain-atlas','apple','apple-large','apple-house','chair','leaf','leaf-boat','stone','cat'];
  const colors=[0xffd391,0xb4ffdc,0xfface2];
  const states={IDLE:'待机',CHOOSE_TARGET:'寻找目标',WALK:'行走',INTERACT:'互动'};
  function put(node,value){if(node.textContent!==value)node.textContent=value;}
  function fitObjectSprite(image,spec){
    image.setTexture(spec.sprite).setOrigin(...spec.anchor);
    const [maxWidth,maxHeight]=spec.drawSize;
    return image.setScale(Math.min(maxWidth/image.width,maxHeight/image.height));
  }
  class Lab extends Phaser.Scene {
    preload() {
      IsleResidentActions.preload(this);
      IsleLivingSky.preloadWeather(this,IsleSkyConfig);
      for(const id of ['terrain-map','expansion-chunk','objects'])this.load.json(id,'assets/'+id+'.json');
      if(calibration)for(const {sprite} of calibration.candidates)this.load.image(sprite,'assets/'+sprite+'.png');
      for(const id of sprites.concat(people.flatMap(p=>faces.map(f=>p+'-'+f))))this.load.image(id,'assets/'+id+'.png');
      this.load.on('loaderror',f=>this.notice('无法加载 '+f.key,true));
    }
    create() {
      this.config=this.cache.json.get('objects');
      if(calibration)this.config={...this.config,types:[...this.config.types,...calibration.candidates]};
      this.world=this.newWorld();
      bridge.restore(this.world);
      calibration?.seed(this.world);
      this.hover=null;
      this.placing=null;
      this.debug=false;
      this.activePanel=null;
      this.inspectId=null;
      this.selectedObject=null;
      this.eventTrace=[];
      const layer=(depth)=>this.add.graphics().setDepth(depth);
      this.terrain=this.textures.createCanvas('composited-terrain',gridWidth,gridHeight);
      this.add.image(0,0,'composited-terrain').setOrigin(0).setDepth(-80);
      this.water=layer(-6);
      this.debugStatic=layer(800);
      this.routes=layer(801);
      this.target=layer(900);
      this.tracking=layer(890);
      this.ghost=this.add.image(0,0,'apple').setDepth(901).setAlpha(.65).setVisible(false);
      this.entitySprites=new Map();
      this.personSprites=new Map();
      this.thoughts=new Map();
      get('bubbles').replaceChildren();
      for(const p of this.world.residents){
        const body=this.add.image(0,0,p.id+'-front').setOrigin(.5,1);
        const shadow=this.add.ellipse(0,0,13,5,0x34254d,.36);
        this.personSprites.set(p.id,this.add.container(center(p.at.x),center(p.at.y),[shadow,body]));
        const note=document.createElement('div');note.className='thought';note.hidden=true;
        get('bubbles').append(note);
        this.thoughts.set(p.id,note);
      }
      this.actions=new IsleResidentActions(this,bridge,center);
      this.sky=IsleLivingSky.createWeather(this,IsleSkyConfig,{
        startId:IsleObserver.store.getSnapshot().weather.weatherId,
      });
      this.overview=false;
      this.drawTerrain();
      this.refreshEntities();
      this.bind();
      this.syncUI();
      this.notice('居民正在自主闲逛。点居民可查看状态。');
      globalThis.isleLab={snapshot:()=>JSON.parse(JSON.stringify(this.snapshot()))};
      calibration?.attach(this,T);
      get('game').dataset.ready='true';
    }
    newWorld(){return new World(this.cache.json.get('terrain-map'),this.cache.json.get('expansion-chunk'),this.config);}
    snapshot(){
      return {
        paused:this.world.paused,expanded:this.world.expanded,totalCells:this.world.cells.size,
        revision:this.world.revision,boundary:boundary(this.world.cells),masks:this.world.masks(),
        objects:this.world.objects.map(o=>({...o,anchor:this.world.type(o).anchor,footprint:this.world.cellsOf(o),
          collision:o.floating?[]:this.world.cellsOf(o),interactionPoints:this.world.doors(o).filter(p=>this.world.canWalk(p))})),
        residents:this.world.residents.map(p=>({id:p.id,state:p.state,at:p.at,next:p.next,goal:p.goal,path:p.path,bubble:p.bubble,activity:p.activity})),
        events:this.eventTrace,
      };
    }
    drawTerrain(){
      IsleTerrain.draw(this.terrain.getContext(),this.world,this.textures.get('terrain-atlas').getSourceImage());
      this.terrain.refresh();
    }
    notice(message,error=false){
      put(get('status'),message);get('status').dataset.error=String(error);
    }
    syncUI(){
      const set=(id,attr,val)=>get(id).setAttribute(attr,String(val));
      set('pause','aria-pressed',this.world.paused);
      set('debug','aria-pressed',this.debug);
      set('place','aria-expanded',this.activePanel==='catalog'||!!this.placing);
      set('interact','aria-expanded',this.activePanel==='interaction');
      put(get('pause'),this.world.paused?'恢复':'暂停');
      put(get('counter'),this.world.expanded?'02 CHUNKS':'01 CHUNK');
      get('expand').disabled=this.world.expanded;
      get('legend').hidden=!this.debug;
      put(get('tile-count'),this.world.cells.size+' 格');
      if(!this.debug)delete get('game').dataset.debugState;
      get('cancel').hidden=!this.placing;
      get('confirm').hidden=!(this.placing&&this.hover&&this.touchPlacement);
      get('panel').hidden=!this.activePanel;
    }
    refreshEntities(){
      for(const [id,img] of this.entitySprites)if(!this.world.objects.some(o=>o.id===id)){img.destroy();this.entitySprites.delete(id);}
      for(const o of this.world.objects){
        const spec=this.world.type(o);
        let img=this.entitySprites.get(o.id);
        if(!img){img=this.add.image(0,0,spec.sprite);this.entitySprites.set(o.id,img);}
        const x=center(o.at.x),y=center(o.at.y);
        fitObjectSprite(img,spec).setPosition(x,y).setDepth(y);
      }
    }
    closePanel(){this.activePanel=null;this.selectedObject=null;this.syncUI();}
    cancel(){
      this.placing=null;this.pendingDiscovery=null;this.hover=null;this.touchPlacement=false;
      this.notice('已取消放置。');this.syncUI();
    }
    showPanel(mode,id=null){
      if(this.placing)this.cancel();
      this.activePanel=mode;this.selectedObject=id;this.inspectId=null;
      const box=get('panel-items'),detail=get('panel-detail');
      box.replaceChildren();detail.replaceChildren();detail.hidden=true;
      const catalog=mode==='catalog';
      put(get('panel-title'),catalog?'选择物件':'选择探索对象');
      if(catalog){
        for(const id of this.config.catalog){
          const spec=this.world.types.get(id);
          box.append(this.option(spec.name,spec.sprite,()=>{
            this.closePanel();this.placing=id;this.hover=null;this.touchPlacement=false;
            this.notice(id==='leaf'?'叶子 · 可放在合法地面或可达的水岸。':'移动预览，点击合法位置放置 '+spec.name+'。');
            this.syncUI();
          }));
        }
      }else{
        if(!this.world.objects.length){
          const p=document.createElement('p');p.textContent='岛上还没有物件。先放置一个。';box.append(p);
        }
        for(const object of this.world.objects){
          const spec=this.world.type(object);
          const button=this.option(spec.name+' · '+object.id,spec.sprite,()=>this.showPanel('interaction',object.id));
          button.setAttribute('aria-pressed',String(id===object.id));box.append(button);
        }
        const o=this.world.objects.find(object=>object.id===id);
        if(o){
          detail.hidden=false;
          detail.append(this.option('开始探索',null,()=>{
            this.world.explore(o.id);this.closePanel();
            this.notice('探索已排入队列。居民会按偏好依次查看。');
          }));
          const to=this.config.evolution[o.type];
          if(to&&this.world.types.get(to).placementSurface!=='water-only')detail.append(this.option(to==='apple-large'?'确认放大苹果':'确认演变苹果屋',null,()=>{
            const result=this.actions.request(o.collectionId)||this.confirmEvolution(o.collectionId);
            if(result.error)this.notice(result.error,true);
          }));
          detail.append(this.option('收回物件',null,()=>{
            if(this.world.remove(o.id))bridge.removed(this.world,o);this.refreshEntities();this.showPanel('interaction');
            this.notice('物件已收回，占地已释放。');
          }));
        }
      }
      this.syncUI();
    }
    confirmEvolution(objectId,at){
      const result=bridge.confirmEvolution(this.world,objectId,at);
      if(!result.error){
        this.refreshEntities();
        this.closePanel();
        this.notice('物件已更新，居民正在重新规划路线。');
      }
      return result;
    }
    option(label,sprite,action){
      const button=document.createElement('button');button.type='button';
      if(sprite){const img=document.createElement('img');img.alt='';img.src='assets/'+sprite+'.png';button.append(img);}
      const title=document.createElement('span');title.textContent=label;button.append(title);
      button.onclick=action;
      return button;
    }
    toggleDebug(){this.debug=!this.debug;this.syncUI();}
    drop(p){
      const {draftId,relocationId}=this.pendingDiscovery||{};
      const result=relocationId?this.confirmEvolution(relocationId,p):this.world.place(p,this.placing);
      if(result.error){
        this.notice(result.error,true);
        if(draftId)bridge.signal({draftId,at:p,error:result.error});
        return;
      }
      const {object}=result;
      if(!relocationId)bridge.placed(this.world,object,this.pendingDiscovery);
      this.pendingDiscovery=null;
      this.refreshEntities();
      this.placing=null;this.touchPlacement=false;this.hover=null;
      const name=this.world.type(object).name;
      this.notice(name+(relocationId?'已迁入':'已放置在')+' ('+p.x+', '+p.y+')。'+(this.world.paused?'恢复行走后开始探索。':'居民会主动探索。'));
      this.syncUI();
      if(draftId)bridge.signal({draftId,completed:true,objectId:object.collectionId,at:p});
    }
    pointerCell(p){
      const point=p.positionToCamera(this.cameras.main);
      return {x:Math.floor(point.x/T),y:Math.floor(point.y/T)};
    }
    bind(){
      const watch=(id,fn)=>{get(id).onclick=fn;};
      watch('pause',()=>{
        this.world.paused=!this.world.paused;
        this.notice(this.world.paused?'居民已暂停。仍可放置物件和扩张。':'居民已恢复活动。');this.syncUI();
      });
      watch('place',()=>this.activePanel==='catalog'?this.closePanel():this.showPanel('catalog'));
      watch('interact',()=>this.activePanel==='interaction'?this.closePanel():this.showPanel('interaction'));
      watch('expand',()=>{
        if(!this.world.expand())return;
        bridge.expanded(this.world);
        this.drawTerrain();this.syncUI();
        this.notice('新区已接通，可以放置物件。居民会走进新区。');
      });
      watch('debug',()=>this.toggleDebug());
      watch('reset',()=>{
        this.actions.cancel();
        this.world=this.newWorld();
        bridge.reset(this.world);
        this.placing=null;this.pendingDiscovery=null;this.hover=null;this.touchPlacement=false;
        this.inspectId=null;this.debug=false;this.eventTrace=[];
        this.closePanel();this.drawTerrain();this.refreshEntities();
        this.notice('岛屿已重置，既有图鉴和回忆仍可查看。');
      });
      window.addEventListener('isle:placement',event=>{
        const discovery=event.detail;
        const target=discovery.relocationId&&bridge.evolutionTarget(this.world,discovery.relocationId);
        if(!bridge.active()||!this.world.types.has(discovery.type)||
           (discovery.relocationId&&(!target?.needsLocation||target.proposal.toState!==discovery.type))||
           (!discovery.relocationId&&this.world.types.get(discovery.type).placementSurface==='water-only'))return;
        event.preventDefault();
        this.closePanel();this.inspectId=null;this.hover=null;this.touchPlacement=false;
        this.pendingDiscovery=discovery;this.placing=discovery.type;
        this.notice('为'+discovery.displayName+'选择岛上的放置位置。');this.syncUI();
      });
      window.addEventListener('isle:observer-cancel',event=>{
        if(this.pendingDiscovery?.draftId!==event.detail)return;
        this.cancel();event.preventDefault();
      });
      window.addEventListener('isle:observer-confirm',event=>{
        if(this.pendingDiscovery?.draftId!==event.detail||!this.hover)return;
        this.drop(this.hover);event.preventDefault();
      });
      window.addEventListener('isle:observer-size',event=>{
        const {draftId,type}=event.detail;
        if(this.pendingDiscovery?.draftId!==draftId||this.pendingDiscovery.relocationId||!this.world.types.has(type)||this.world.types.get(type).placementSurface==='water-only')return;
        this.pendingDiscovery.type=type;this.placing=type;
        this.targetKey=null;event.preventDefault();
        if(this.hover)this.drawTarget();
      });
      window.addEventListener('isle:observer-weather',event=>{
        if(this.sky?.setWeather(event.detail))event.preventDefault();
      });
      window.addEventListener('isle:observer-overview',event=>{
        this.overview=!!event.detail;
        this.cameras.main.setZoom(this.overview ? .82 : 1).centerOn(gridWidth/2,gridHeight/2);
        event.preventDefault();
      });
      window.addEventListener('isle:observer-evolve',event=>{
        const {objectId}=event.detail;
        event.detail.result=this.actions.request(objectId)||this.confirmEvolution(objectId);
        event.preventDefault();
      });
      window.addEventListener('isle:observer-inspect',event=>{
        const object=this.world.objects.find(o=>o.collectionId===event.detail);
        if(!object)return;
        this.showPanel('interaction',object.id);event.preventDefault();
      });
      watch('cancel',()=>this.cancel());
      watch('confirm',()=>{if(this.placing&&this.hover)this.drop(this.hover);});
      watch('close-panel',()=>this.closePanel());
      watch('close-person',()=>{this.inspectId=null;});
      this.input.keyboard?.on('keydown-D',e=>{
        if(!e.repeat&&!e.isComposing&&!e.target?.closest?.('input,textarea,select,[contenteditable]')&&document.body.dataset.mode==='world')this.toggleDebug();
      });
      window.addEventListener('isle:observer-close',event=>{
        if(this.placing)this.cancel();else if(this.actions.cancel())this.notice('已取消改造，苹果保持原状。');else if(this.activePanel)this.closePanel();else if(this.inspectId)this.inspectId=null;else return;
        event.preventDefault();
      });
      this.input.on('pointermove',p=>{
        if(this.pendingDiscovery?.draftId){
          if(p.isDown){
            const at=this.pointerCell(p);
            if(!equal(this.hover,at)){this.hover=at;this.targetKey=null;this.drawTarget();}
          }
          return;
        }
        if(p.wasTouch||p.event?.pointerType==='touch')return;
        this.hover=this.pointerCell(p);
        put(get('coord'),'X '+this.hover.x+' · Y '+this.hover.y);
      });
      this.input.on('gameout',()=>{if(!this.touchPlacement&&!this.pendingDiscovery?.draftId)this.hover=null;put(get('coord'),'');});
      this.input.on('pointerdown',p=>{
        const at=this.pointerCell(p);
        if(this.placing){
          if(this.pendingDiscovery?.draftId){
            this.hover=at;this.targetKey=null;this.drawTarget();return;
          }
          if(p.wasTouch||p.event?.pointerType==='touch'){
            const same=this.touchPlacement&&equal(this.hover,at);
            this.hover=at;this.touchPlacement=true;
            put(get('coord'),'X '+at.x+' · Y '+at.y);
            if(same)this.drop(at);
            else {
              const check=this.world.checkPlacement(at,this.placing);
              this.notice(check.error||'再次点同一格或点击确认放置。',!!check.error);
              this.syncUI();
            }
          }else this.drop(at);
          return;
        }
        if(this.placementProbe?.(at))return;
        const point=p.positionToCamera(this.cameras.main);
        const residents=this.world.residents.filter(person=>{
          const s=this.personSprites.get(person.id);return Math.abs(point.x-s.x)<12&&point.y>=s.y-22&&point.y<=s.y+6;
        });
        if(residents.length){
          residents.sort((a,b)=>this.personSprites.get(b.id).y-this.personSprites.get(a.id).y);
          this.closePanel();this.inspectId=residents[0].id;return;
        }
        const objects=this.world.objects.filter(o=>this.entitySprites.get(o.id).getBounds().contains(point.x,point.y));
        if(objects.length){
          objects.sort((a,b)=>b.at.y-a.at.y);
          this.showPanel('interaction',objects[0].id);
        }else{this.inspectId=null;if(this.activePanel)this.closePanel();}
      });
    }
    update(time,delta){
      if(!this.world)return;
      this.sky?.update(time);
      const weather=this.sky?.status();
      if(weather){
        const dataset=get('game').dataset;
        if(dataset.weather!==weather.weatherId)dataset.weather=weather.weatherId;
        if(dataset.weatherTransition!==weather.transitionState)dataset.weatherTransition=weather.transitionState;
        if(Number(dataset.weatherLayers)!==weather.layerCount)dataset.weatherLayers=weather.layerCount;
      }
      this.world.update(delta/1000);
      for(const event of this.world.events.splice(0)){
        this.eventTrace.push(event);
        if(event.kind==='reaction')bridge.resident(this.world,event);
        this.actions.reaction(event);
        if(this.eventTrace.length>60)this.eventTrace.shift();
        if(!this.placing && event.kind==='noticed'){
          const p=this.world.residents.find(person=>person.id===event.resident);
          const o=this.world.objects.find(object=>object.id===event.objectId);
          if(o){
            const note=p.name+'注意到'+this.world.type(o).name+'，正在靠近。';
            this.notice(note);
            window.dispatchEvent(new CustomEvent('isle:observation',{detail:note}));
          }
        }else if(!this.placing && event.kind==='explored')this.notice(event.missed?'部分居民暂时无法靠近，已继续闲逛。':'探索完成，居民继续闲逛。');
      }
      for(const [index,p] of this.world.residents.entries()){
        const actor=this.personSprites.get(p.id), img=actor.list[1];
        const x=center(p.at.x+(p.next?(p.next.x-p.at.x)*p.progress:0));
        const y=center(p.at.y+(p.next?(p.next.y-p.at.y)*p.progress:0));
        if(img.texture.key!==p.id+'-'+p.facing)img.setTexture(p.id+'-'+p.facing);
        const h=p.state==='INTERACT' && index===2?15:17;
        img.setDisplaySize(h*img.width/img.height,h);
        const phase=this.world.clock*5+index;
        img.y=p.next?-Math.round(Math.sin(p.progress*Math.PI)*2):-(Math.sin(phase)>.76?1:0);
        actor.setPosition(Math.round(x),Math.round(y)).setDepth(y+.2+index*.002);
        const thought=this.thoughts.get(p.id);
        thought.hidden=!p.bubble;
        if(p.bubble){
          const camera=this.cameras.main;
          const zoom=camera.zoom;
          const sx=gridWidth/2+(x-camera.scrollX-gridWidth/2)*zoom;
          const sy=gridHeight/2+(y-18-camera.scrollY-gridHeight/2)*zoom;
          put(thought,p.bubble);thought.style.left=(sx/gridWidth*100)+'%';thought.style.top=(sy/gridHeight*100)+'%';
        }
      }
      this.actions.update();
      for(const o of this.world.objects)if(o.floating){
        const img=this.entitySprites.get(o.id);
        img.x=center(o.at.x)+Math.round(Math.sin(time/660)*2);
        img.y=center(o.at.y)+Math.round(Math.sin(time/490)*2);
      }
      this.showResident();
      this.drawWater(time);
      this.drawDebug();
      this.drawTarget();
    }
    showResident(){
      const panel=get('person');
      this.tracking.clear();
      if(!this.inspectId){panel.hidden=true;return;}
      const p=this.world.residents.find(person=>person.id===this.inspectId);
      panel.hidden=false;
      const actor=this.personSprites.get(p.id);
      this.tracking.lineStyle(1,0xa4dfc7,.96);
      for(const dx of [-1,1])for(const dy of [-1,1]){
        const x=actor.x+dx*10,y=actor.y-8+dy*11;
        this.tracking.lineBetween(x,y,x-dx*6,y);
        this.tracking.lineBetween(x,y,x,y-dy*6);
      }
      put(get('person-name'),p.name);
      put(get('person-state'),this.world.paused?'已暂停 · '+states[p.state]:states[p.state]);
      put(get('person-goal'),p.goal?'目标 '+p.goal.x+', '+p.goal.y:'暂未设置目标');
    }
    drawWater(time){
      this.water.clear();
      for(const [i,x,y] of [[0,84,170],[1,129,177],[2,81,203],[3,105,223],[4,135,213],[5,126,189]]){
        const phase=(time/1300+i*.18)%1;
        this.water.fillStyle(0xc3e6f0,Math.sin(Math.PI*phase)*.72);
        this.water.fillRect(x+Math.floor(phase*6),y,3+i%3,1);
      }
    }
    drawDebug(){
      const mark=this.world.revision+':'+this.debug;
      if(this.mark!==mark){
        this.mark=mark;
        this.debugStatic.clear();
        if(this.debug)this.drawGrid(this.debugStatic);
      }
      this.routes.clear();
      if(!this.debug)return;
      const state=JSON.stringify({
        cells:this.world.cells.size, objects:this.world.objects,
        residents:this.world.residents.map(p=>({id:p.id,at:p.at,next:p.next,state:p.state,goal:p.goal,activity:p.activity})),
        lastEvent:this.eventTrace.at(-1), exits:this.eventTrace.filter(e=>e.kind==='arrived'),
        reactions:this.eventTrace.filter(e=>e.kind==='reaction'),
      });
      if(get('game').dataset.debugState!==state)get('game').dataset.debugState=state;
      for(const [i,p] of this.world.residents.entries()){
        const actor=this.personSprites.get(p.id);
        let x=actor.x,y=actor.y;
        this.routes.lineStyle(1.5,colors[i],.93);
        for(const n of (p.next?[p.next,...p.path]:p.path)){
          const a=center(n.x),b=center(n.y);
          this.routes.lineBetween(x,y+i-1,a,b+i-1);x=a;y=b;
        }
        this.routes.strokeCircle(actor.x,actor.y,3);
        if(p.goal)this.routes.strokeCircle(center(p.goal.x),center(p.goal.y),3);
      }
    }
    drawGrid(g){
      const blocked=this.world.blocked();
      for(const cell of this.world.cells.values()){
        const c=!this.world.canWalk(cell,blocked)?0xfb94a9:cell.placeable?0xc6a4fb:0x9ed5ac;
        g.fillStyle(c,.20).fillRect(cell.x*T+1,cell.y*T+1,T-2,T-2);
        g.lineStyle(1,c,.56).strokeRect(cell.x*T,cell.y*T,T,T);
      }
      for(const o of this.world.objects){
        g.lineStyle(1,0xff7eaa,.95);
        for(const p of this.world.cellsOf(o))g.strokeRect(p.x*T+1,p.y*T+1,T-2,T-2);
        g.fillStyle(0xffda7d,.95);
        for(const p of this.world.doors(o))if(this.world.canWalk(p,blocked))g.fillRect(center(p.x)-2,center(p.y)-2,5,5);
      }
      const x=(this.world.map.interface.oldEdge[0]+1)*T;
      g.lineStyle(1,0x86eaff,.91);
      for(let y=8;y<20;y++)g.lineBetween(x,y*T+2,x,y*T+12);
      if(this.world.expanded){
        const edges={N:[0,0,16,0],E:[16,0,16,16],S:[0,16,16,16],W:[0,0,0,16]};
        for(const e of boundary(this.world.cells)){
          if(this.world.cells.get(key(e.x,e.y)).chunk!==this.world.chunk.id)continue;
          const [x1,y1,x2,y2]=edges[e.dir];
          g.lineBetween(e.x*T+x1,e.y*T+y1,e.x*T+x2,e.y*T+y2);
        }
      }
    }
    drawTarget(){
      const g=this.target;
      if(!this.placing||!this.hover){
        this.targetKey=null;g.clear();this.ghost.setVisible(false);return;
      }
      const obj={type:this.placing,at:this.hover};
      const near=this.world.cellsOf(obj);
      const signature=this.world.residents.map(p=>[p.at.x,p.at.y,p.next?.x,p.next?.y].join(',')).join(';');
      const cache=[obj.type,obj.at.x,obj.at.y,this.world.revision,signature].join(':');
      if(cache===this.targetKey)return;
      this.targetKey=cache;
      const relocating=this.pendingDiscovery?.relocationId;
      const target=relocating&&bridge.evolutionTarget(this.world,relocating);
      const check=relocating&&!target?{error:'原物件或用途提议已不可用。'}:
        this.world.checkPlacement(obj.at,obj.type,target?.object);
      if(this.pendingDiscovery?.draftId)bridge.signal({draftId:this.pendingDiscovery.draftId,at:obj.at,error:check.error});
      const spec=this.world.type(obj);
      const c=check.error?0xf3b8ce:0xa4dfc7;
      g.clear();g.fillStyle(c,.22);g.lineStyle(1,c,.78);
      for(const p of near){g.fillRect(p.x*T+1,p.y*T+1,T-2,T-2);g.strokeRect(p.x*T,p.y*T,T,T);}
      fitObjectSprite(this.ghost,spec)
        .setPosition(center(obj.at.x),center(obj.at.y)).setTint(c).setVisible(true);
    }
  }
  new Phaser.Game({
    type:Phaser.CANVAS,parent:'game',width:gridWidth,height:gridHeight,transparent:true,
    pixelArt:true,roundPixels:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Lab,
  });
})();
