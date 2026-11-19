(function(){
  'use strict';
  const actions={
    inspect:{ms:180,frames:4,label:'观察'},
    think:{ms:220,frames:4,label:'思考'},
    build:{ms:120,frames:4,label:'改造'},
    curious:{ms:220,frames:4,label:'好奇打量',intent:'think',color:0xf8e990},
    rest:{ms:240,frames:4,label:'在门前休息',color:0xe8b2d5},
    use:{ms:200,frames:4,label:'在岸边观察',color:0xa4dfc7},
  };
  const directions=['front','back','left','right'];
  const {interactions}=IsleBehavior;
  const fx={key:'apple-growth',ms:100,frames:8};
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const facing=(from,to)=>{
    const dx=to.x-from.x,dy=to.y-from.y;
    return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'front':'back');
  };

  class ResidentActions {
    static preload(scene){
      for(const name of ['inspect','think','build']){
        for(const prefix of ['zaozhao','intent']){
          const key=prefix+'-'+name;
          scene.load.spritesheet(key,'assets/actions/'+key+'.png',{frameWidth:48,frameHeight:48});
        }
      }
      for(const resident of ['tantan','manman']){
        scene.load.spritesheet(resident+'-inspect','assets/actions/'+resident+'-inspect.png',{frameWidth:48,frameHeight:48});
      }
      scene.load.spritesheet(fx.key,'assets/actions/'+fx.key+'.png',{frameWidth:64,frameHeight:64});
    }

    constructor(scene,bridge,center){
      this.scene=scene;
      this.bridge=bridge;
      this.center=center;
      this.actors=new Map();
      for(const [id,actor] of scene.personSprites){
        const body=actor.list[1];
        const actionBody=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,40/48).setVisible(false);
        const intent=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,40/48).setVisible(false);
        actor.add([actionBody,intent]);
        this.actors.set(id,{actor,body,actionBody,intent});
      }
      this.effect=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,44/64).setVisible(false);
      this.target=scene.add.graphics();
      this.hud=document.createElement('output');
      this.hud.className='resident-action-caption';
      this.hud.setAttribute('aria-live','polite');
      document.getElementById('stage').append(this.hud);
      this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    }

    get world(){return this.scene.world;}
    get resident(){return this.world.residents.find(p=>p.id===(this.pending?.residentId||this.presentation?.residentId));}
    get now(){return this.world.clock*1000;}

    reaction(event){
      if(event.kind!=='reaction'||this.pending)return;
      const object=this.world.objects.find(o=>o.id===event.objectId);
      if(!object)return;
      this.presentation={world:this.world,object,residentId:event.resident,phase:'inspect',next:event.action,start:this.now};
    }

    request(objectId){
      if(this.pending)return {error:'造造正在改造，稍等片刻。'};
      const target=this.bridge.evolutionTarget(this.world,objectId);
      const build=interactions[target?.object.type]?.build;
      if(!build||target.proposal.toState!==build.next||target.proposal.residentId!==build.resident)return null;
      if(this.world.paused)return {error:'请先恢复居民活动。'};
      const {object}=target;
      const footprint=this.world.cellsOf({at:object.at,type:build.next});
      const resident=this.world.residents.find(p=>p.id===build.resident);
      const available=this.world.doors(object)
        .filter(p=>!footprint.some(cell=>distance(p,cell)===0)&&!this.world.claimed(resident,p))
        .sort((a,b)=>distance(resident.at,a)-distance(resident.at,b));
      const from=resident.next||resident.at;
      const goal=available.find(p=>this.world.route(from,p)!==null);
      if(!goal)return {error:'造造暂时无法到达苹果边，请稍后重试。'};
      this.world.stopExploration(object.id);
      this.world.pauseExploration();
      if(!this.world.command(resident,goal,'build')){
        this.world.scheduler.suspended=false;
        return {error:'造造暂时无法到达苹果边，请稍后重试。'};
      }
      this.presentation=null;
      this.pending={world:this.world,object,objectId,goal,residentId:resident.id,fromType:object.type};
      return {pending:true};
    }

    cancel(){
      if(!this.pending)return false;
      const {world,object}=this.pending;
      const resident=this.resident;
      world.scheduler.suspended=false;
      this.pending=null;
      this.presentation=null;
      if(world===this.world){
        if(resident.activity==='build')world.idle(resident,0);
        world.explore(object.id);
      }
      return true;
    }

    update(){
      const resident=this.resident;
      if(this.pending){
        const job=this.pending;
        if(job.world!==this.world||!this.world.objects.includes(job.object)||job.object.type!==job.fromType){
          this.cancel();
        }else if(!resident.next&&distance(resident.at,job.goal)===0){
          if(!this.presentation)this.presentation={world:this.world,object:job.object,residentId:job.residentId,phase:'build',start:this.now};
          if(this.now-this.presentation.start>=actions.build.ms*actions.build.frames){
            this.world.scheduler.suspended=false;
            this.pending=null;
            this.presentation=null;
            const result=this.scene.confirmEvolution(job.objectId);
            if(result.error)this.world.explore(job.object.id);
            else this.reveal={world:this.world,object:result.object,start:this.now};
            window.dispatchEvent(new CustomEvent('isle:observation',{detail:result.error||'造造完成了改造 · 巨型苹果'}));
          }
        }else if(resident.activity!=='build'){
          this.cancel();
          window.dispatchEvent(new CustomEvent('isle:observation',{detail:'造造的路线中断，苹果保持原状。'}));
        }
      }else if(this.presentation){
        const pose=this.presentation;
        if(pose.world!==this.world||resident?.state!=='INTERACT'||!this.world.objects.includes(pose.object)){
          this.presentation=null;
        }else if(pose.phase==='inspect'&&this.now-pose.start>=actions.inspect.ms*actions.inspect.frames){
          if(pose.next&&pose.next!=='inspect')this.presentation={...pose,phase:pose.next,start:this.now};
        }
      }
      this.renderPose(this.resident);
      this.renderEffect();
    }

    renderPose(resident){
      const pose=this.presentation;
      for(const {actionBody,intent,body} of this.actors.values()){
        actionBody.setVisible(false);
        intent.setVisible(false);
        body.setVisible(true);
      }
      this.target.clear();
      if(!pose||!resident){
        this.setCaption(this.pending?'approach':'',this.pending?'造造正走向苹果':'');
        return;
      }
      const action=actions[pose.phase];
      const {actionBody,intent,body}=this.actors.get(resident.id);
      const direction=facing(resident.at,pose.object.at);
      const index=this.reducedMotion.matches?1:Math.floor((this.now-pose.start)/action.ms)%action.frames;
      const key=resident.id+'-'+pose.phase, intentKey='intent-'+(action.intent||pose.phase);
      if(this.scene.textures.exists(key)){
        actionBody.setTexture(key,directions.indexOf(direction)*4+index).setVisible(true);
        body.setVisible(false);
      }else{
        body.setTexture(resident.id+'-'+direction).setY(0);
      }
      if(this.scene.textures.exists(intentKey))intent.setTexture(intentKey,index).setVisible(true);
      const x=this.center(pose.object.at.x),y=this.center(pose.object.at.y);
      this.target.setDepth(y+.4).lineStyle(1,action.color||0xf8e990,.75).strokeEllipse(x,y-5,21,16);
      if(pose.phase==='rest'||pose.phase==='use'){
        this.target.lineBetween(this.center(resident.at.x),this.center(resident.at.y)-5,x,y-5);
      }
      this.hud.dataset.resident=resident.id;
      this.hud.dataset.object=pose.object.type;
      this.setCaption(pose.phase,resident.name+' · '+action.label+' · '+this.world.type(pose.object).name);
    }

    renderEffect(){
      const reveal=this.reveal;
      const index=reveal?Math.floor((this.now-reveal.start)/fx.ms):fx.frames;
      if(!reveal||reveal.world!==this.world||index>=fx.frames||!this.world.objects.includes(reveal.object)){
        this.effect.setVisible(false);
        this.reveal=null;
        return;
      }
      const x=this.center(reveal.object.at.x),y=this.center(reveal.object.at.y);
      if(this.scene.textures.exists(fx.key)){
        this.effect.setTexture(fx.key,this.reducedMotion.matches?4:index).setPosition(x,y).setDepth(y+.8).setVisible(true);
      }else{
        this.target.setDepth(y+.8).lineStyle(1,0xa4dfc7,.9).strokeEllipse(x,y-6,32,25);
      }
      if(!this.presentation)this.setCaption('reveal','造造完成改造 · 巨型苹果');
    }

    setCaption(phase,text){
      if(this.hud.dataset.phase!==phase)this.hud.dataset.phase=phase;
      if(this.hud.textContent!==text)this.hud.textContent=text;
      this.hud.hidden=!text;
      if(!this.presentation){delete this.hud.dataset.resident;delete this.hud.dataset.object;}
    }
  }
  globalThis.IsleResidentActions=ResidentActions;
})();
