(function(){
  'use strict';
  const actions={
    inspect:{ms:180,frames:4,label:'观察'},
    think:{ms:220,frames:4,label:'思考'},
    build:{ms:120,frames:4,label:'改造'},
  };
  const directions=['front','back','left','right'];
  const interaction={resident:'zaozhao',type:'apple',next:'apple-large'};
  const fx={key:'apple-growth',ms:100,frames:8};
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const facing=(from,to)=>{
    const dx=to.x-from.x,dy=to.y-from.y;
    return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'front':'back');
  };

  class ResidentActions {
    static preload(scene){
      for(const name of Object.keys(actions)){
        for(const prefix of ['zaozhao','intent']){
          const key=prefix+'-'+name;
          scene.load.spritesheet(key,'assets/actions/'+key+'.png',{frameWidth:48,frameHeight:48});
        }
      }
      scene.load.spritesheet(fx.key,'assets/actions/'+fx.key+'.png',{frameWidth:64,frameHeight:64});
    }

    constructor(scene,bridge,center){
      this.scene=scene;
      this.bridge=bridge;
      this.center=center;
      this.actor=scene.personSprites.get(interaction.resident);
      this.body=this.actor.list[1];
      this.actionBody=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,40/48).setVisible(false);
      this.intent=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,40/48).setVisible(false);
      this.actor.add([this.actionBody,this.intent]);
      this.effect=scene.add.image(0,0,'__DEFAULT').setOrigin(.5,44/64).setVisible(false);
      this.target=scene.add.graphics();
      this.hud=document.createElement('output');
      this.hud.className='resident-action-caption';
      this.hud.setAttribute('aria-live','polite');
      document.getElementById('stage').append(this.hud);
      this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    }

    get world(){return this.scene.world;}
    get resident(){return this.world.residents.find(p=>p.id===interaction.resident);}
    get now(){return this.world.clock*1000;}

    reaction(event){
      if(event.kind!=='reaction'||event.resident!==interaction.resident||this.pending)return;
      const object=this.world.objects.find(o=>o.id===event.objectId&&o.type===interaction.type);
      if(!object)return;
      this.presentation={object,phase:'inspect',start:this.now};
    }

    request(objectId){
      if(this.pending)return {error:'造造正在改造，稍等片刻。'};
      const target=this.bridge.evolutionTarget(this.world,objectId);
      if(target?.object.type!==interaction.type||target.proposal.toState!==interaction.next||
         target.proposal.residentId!==interaction.resident)return null;
      if(this.world.paused)return {error:'请先恢复居民活动。'};
      const {object}=target;
      const footprint=this.world.cellsOf({at:object.at,type:interaction.next});
      const resident=this.resident;
      const available=this.world.doors(object)
        .filter(p=>!footprint.some(cell=>distance(p,cell)===0)&&!this.world.claimed(resident,p))
        .sort((a,b)=>distance(resident.at,a)-distance(resident.at,b));
      const from=resident.next||resident.at;
      const goal=available.find(p=>this.world.route(from,p)!==null);
      if(!goal)return {error:'造造暂时无法到达苹果边，请稍后重试。'};
      this.world.stopExploration(object.id);
      if(!this.world.command(resident,goal,'build'))return {error:'造造暂时无法到达苹果边，请稍后重试。'};
      this.presentation=null;
      this.pending={world:this.world,object,objectId,goal};
      return {pending:true};
    }

    cancel(){
      if(!this.pending)return false;
      const {world,object}=this.pending;
      this.pending=null;
      this.presentation=null;
      if(world===this.world){
        if(this.resident.activity==='build')world.idle(this.resident,0);
        world.explore(object.id);
      }
      return true;
    }

    update(){
      const resident=this.resident;
      if(this.pending){
        const job=this.pending;
        if(job.world!==this.world||!this.world.objects.includes(job.object)||job.object.type!==interaction.type){
          this.cancel();
        }else if(!resident.next&&distance(resident.at,job.goal)===0){
          if(!this.presentation)this.presentation={object:job.object,phase:'build',start:this.now};
          if(this.now-this.presentation.start>=actions.build.ms*actions.build.frames){
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
        if(resident.state!=='INTERACT'||!this.world.objects.includes(pose.object)){
          this.presentation=null;
        }else if(pose.phase==='inspect'&&this.now-pose.start>=actions.inspect.ms*actions.inspect.frames){
          const proposal=this.bridge.evolutionTarget(this.world,pose.object.collectionId);
          this.presentation=proposal?{...pose,phase:'think',start:this.now}:null;
        }
      }
      this.renderPose(resident);
      this.renderEffect();
    }

    renderPose(resident){
      const pose=this.presentation;
      this.actionBody.setVisible(false);
      this.intent.setVisible(false);
      this.body.setVisible(true);
      this.target.clear();
      if(!pose){
        this.setCaption(this.pending?'approach':'',this.pending?'造造正走向苹果':'');
        return;
      }
      const action=actions[pose.phase];
      const direction=facing(resident.at,pose.object.at);
      const index=this.reducedMotion.matches?1:Math.floor((this.now-pose.start)/action.ms)%action.frames;
      const key='zaozhao-'+pose.phase, intentKey='intent-'+pose.phase;
      if(this.scene.textures.exists(key)){
        this.actionBody.setTexture(key,directions.indexOf(direction)*4+index).setVisible(true);
        this.body.setVisible(false);
      }else{
        this.body.setTexture('zaozhao-'+direction).setY(0);
      }
      if(this.scene.textures.exists(intentKey))this.intent.setTexture(intentKey,index).setVisible(true);
      const x=this.center(pose.object.at.x),y=this.center(pose.object.at.y);
      this.target.setDepth(y+.4).lineStyle(1,0xf8e990,.65).strokeEllipse(x,y-5,21,16);
      this.setCaption(pose.phase,'造造 · '+action.label+'苹果');
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
    }
  }
  globalThis.IsleResidentActions=ResidentActions;
})();
