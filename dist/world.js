/* Orthogonal, data-driven world. Phaser handles the view, never occupancy. */
(function () {
  const sides = [[0,-1,'N'],[1,0,'E'],[0,1,'S'],[-1,0,'W']];
  const key = (x, y) => x + ',' + y;
  const equal = (a,b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const offset = (origin, coords) => coords.map(([x,y]) => ({x:origin.x+x, y:origin.y+y}));
  function boundary(cells) {
    return [...cells.values()].flatMap(cell => sides
      .filter(([dx,dy]) => !cells.has(key(cell.x+dx,cell.y+dy)))
      .map(([, , dir]) => ({x:cell.x,y:cell.y,dir})));
  }
  function shortest(start, goal, walkable) {
    if (!walkable(goal) || !walkable(start)) return null;
    const queue = [start], trail = new Map([[key(start.x,start.y),null]]);
    for (let i=0;i<queue.length;i++) {
      const p=queue[i];
      if (equal(p,goal)) {
        const route = [];
        for (let current=p; !equal(current,start); current=trail.get(key(current.x,current.y))) route.push(current);
        return route.reverse();
      }
      for (const [dx,dy] of sides) {
        const n={x:p.x+dx,y:p.y+dy}, id=key(n.x,n.y);
        if (!trail.has(id) && walkable(n)) {trail.set(id,p);queue.push(n);}
      }
    }
    return null;
  }
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const clockParams=[[.21,.40,1.15],[.25,.65,1.45],[.30,.90,1.85]];
  class World {
    constructor(map, chunk, config, random=Math.random) {
      this.map=map;
      this.chunk=chunk;
      this.types=new Map(config.types.map(item=>[item.id,item]));
      this.evolution=config.evolution;
      this.cells=new Map(map.cells.map(p=>[key(p.x,p.y),p]));
      this.objects=[];
      this.residents=map.spawns.map(({id,name,x,y},i)=>({id,name,at:{x,y},goal:null,path:[],next:null,
        progress:0,facing:'front',state:'IDLE',wait:i*.32,pace:clockParams[i],activity:null,bubble:null}));
      this.queue=[];
      this.job=null;
      this.visiting=false;
      this.expanded=false;
      this.paused=false;
      this.sequence=0;
      this.revision=0;
      this.clock=0;
      this.events=[];
      this.random=random;
    }
    type(object) {return this.types.get(object.type);}
    cellsOf(object) {return offset(object.at,this.type(object).footprint);}
    doors(object) {return offset(object.at,this.type(object).interactionPoints);}
    blocked(except) {
      return new Set(this.objects.filter(o=>o!==except && !o.floating)
        .flatMap(o=>this.cellsOf(o).map(p=>key(p.x,p.y))));
    }
    canWalk(p, blocked=this.blocked()) {
      const id=key(p.x,p.y);
      return this.cells.get(id)?.walkable === true && !blocked.has(id);
    }
    route(start,goal,blocked=this.blocked()) {
      return shortest(start,goal,p=>this.canWalk(p,blocked));
    }
    reachable(start, blocked) {
      if(!this.canWalk(start,blocked))return new Set();
      const queue=[start], reached=new Set([key(start.x,start.y)]);
      for(let i=0;i<queue.length;i++){
        const {x,y}=queue[i];
        for(const [dx,dy] of sides){
          const n={x:x+dx,y:y+dy}, id=key(n.x,n.y);
          if(!reached.has(id)&&this.canWalk(n,blocked)){reached.add(id);queue.push(n);}
        }
      }
      return reached;
    }
    checkPlacement(at,type,replace=null) {
      const candidate={at,type};
      const spec=this.type(candidate);
      if(!spec)return {error:'物件类型不可用。'};
      const space=this.cellsOf(candidate);
      const floating=spec.allowWater && space.every(p=>this.cells.get(key(p.x,p.y))?.material==='water');
      const occupied=new Set(this.objects.filter(o=>o!==replace)
        .flatMap(o=>this.cellsOf(o).map(p=>key(p.x,p.y))));
      for(const p of space){
        const id=key(p.x,p.y), cell=this.cells.get(id);
        if(!cell || (!floating&&!cell.placeable))return {error:'这里不在可放置区域。'};
        if(occupied.has(id))return {error:'物件占地重叠，请换一个位置。'};
        if(this.residents.some(person=>equal(person.at,p)||equal(person.next,p)))return {error:'居民正在这里经过，请等一下。'};
      }
      const before=this.blocked(replace), proposed=new Set(before);
      if(!floating)for(const p of space)proposed.add(key(p.x,p.y));
      const starts=this.residents.map(person=>person.next||person.at);
      const initiallyConnected=this.reachable(starts[0],before);
      const after=this.reachable(starts[0],proposed);
      if(starts.some(p=>!after.has(key(p.x,p.y))) || after.size+space.length<initiallyConnected.size){
        return {error:'这个位置会切断通行，请留出通道。'};
      }
      const accessible=object=>this.doors(object).filter(p=>after.has(key(p.x,p.y)));
      const doors=accessible(candidate);
      if(!doors.length)return {error:floating?'请把叶子放在居民能靠近的水岸边。':'请为物件留出可到达的互动点。'};
      if(spec.id==='apple-house'&&!after.has(key(at.x,at.y+1)))return {error:'需要保留苹果屋正门通道。'};
      if(this.objects.some(o=>o!==replace && (!accessible(o).length || (o.type==='apple-house'&&!after.has(key(o.at.x,o.at.y+1)))))){
        return {error:'会挡住已有物件的入口或互动点。'};
      }
      return {error:'',floating,doors};
    }
    place(at,type) {
      const check=this.checkPlacement(at,type);
      if(check.error)return check;
      const object={id:'obj-'+String(++this.sequence).padStart(2,'0'),type,at:{...at},floating:!!check.floating};
      this.objects.push(object);
      this.recompute();
      this.explore(object.id);
      return {object,error:''};
    }
    evolve(id) {
      const object=this.objects.find(o=>o.id===id);
      const type=object&&this.evolution[object.type];
      if(!type)return {error:'该物件没有下一阶段。'};
      const check=this.checkPlacement(object.at,type,object);
      if(check.error)return check;
      this.stopExploration(id);
      object.type=type;
      object.floating=!!check.floating;
      this.recompute();
      this.explore(object.id);
      return {object,error:''};
    }
    remove(id) {
      const index=this.objects.findIndex(o=>o.id===id);
      if(index===-1)return false;
      this.stopExploration(id);
      this.objects.splice(index,1);
      this.recompute();
      return true;
    }
    expand() {
      if(this.expanded)return false;
      for(const cell of this.chunk.cells) {
        const id=key(cell.x,cell.y);
        if(!this.cells.has(id))this.cells.set(id,cell);
      }
      this.expanded=true;
      this.visiting=true;
      this.recompute();
      return true;
    }
    command(person, goal, activity='wander') {
      const path=this.route(person.next||person.at,goal);
      if(path===null)return false;
      person.goal={x:goal.x,y:goal.y};
      person.path=path;
      person.activity=activity;
      person.state='WALK';
      return true;
    }
    recompute() {
      this.revision++;
      for(const person of this.residents){
        if(person.state==='WALK' && person.goal && !this.command(person,person.goal,person.activity)) {
          this.idle(person,0);
        }
      }
    }
    idle(person,wait) {
      person.state='IDLE';
      person.goal=null;
      person.path=[];
      person.activity=null;
      person.bubble=null;
      person.wait=wait??(person.pace[1]+this.random()*(person.pace[2]-person.pace[1]));
    }
    stopExploration(id) {
      this.queue=this.queue.filter(item=>item!==id);
      if(this.job?.id===id) {
        const person=this.job.person;
        if(person)this.idle(person,0);
        this.job=null;
      }
    }
    explore(id) {
      if(!this.objects.some(o=>o.id===id))return false;
      if(this.job?.id===id||this.queue.includes(id))return true;
      this.queue.push(id);
      return true;
    }
    claimed(person,cell) {
      return this.residents.some(other=>other!==person &&
        (equal(other.at,cell)||equal(other.next,cell)||equal(other.goal,cell)));
    }
    wander(person) {
      const blocked=this.blocked();
      const options=[...this.cells.values()].filter(p=>this.canWalk(p,blocked)&&
        distance(p,person.at)>=3&&distance(p,person.at)<=10&&!this.claimed(person,p));
      while(options.length){
        const idx=Math.floor(this.random()*options.length);
        if(this.command(person,options.splice(idx,1)[0]))return;
      }
      this.idle(person,.45);
    }
    updateJobs() {
      const crossing=this.residents.some(p=>p.activity==='visit');
      if(!this.job&&!this.visiting&&!crossing&&this.queue.length)this.job={id:this.queue.shift(),index:0,person:null,retryUntil:0,missed:0};
      const job=this.job;
      if(job){
        const object=this.objects.find(o=>o.id===job.id);
        if(!object){this.job=null;return;}
        if(job.person)return;
        const person=this.residents[job.index];
        if(!person){this.events.push({kind:'explored',objectId:object.id,missed:job.missed});this.job=null;return;}
        const options=this.doors(object).filter(p=>!this.claimed(person,p));
        options.sort((a,b)=>distance(person.at,a)-distance(person.at,b));
        if(options.some(p=>this.command(person,p,'inspect'))){
          job.person=person;
          this.events.push({kind:'noticed',objectId:object.id,resident:person.id});
          return;
        }
        if(!job.retryUntil)job.retryUntil=this.clock+4;
        if(this.clock>=job.retryUntil){job.index++;job.retryUntil=0;job.missed++;}
      }else if(this.visiting){
        this.visiting=false;
        const at=this.chunk.arrival;
        this.residents.forEach((p,i)=>{
          const nearby=[...this.cells.values()].filter(cell=>cell.chunk===this.chunk.id&&
            this.canWalk(cell)&&!this.claimed(p,cell)).sort((a,b)=>
            distance({x:at.x+i-1,y:at.y},a)-distance({x:at.x+i-1,y:at.y},b));
          nearby.some(cell=>this.command(p,cell,'visit'));
        });
      }
    }
    tickPerson(person, dt) {
      if(person.next || person.state==='WALK'){
        let remaining=dt/person.pace[0];
        while(remaining>0){
          if(!person.next){
            person.next=person.path.shift()||null;
            if(!person.next)break;
            const dx=person.next.x-person.at.x,dy=person.next.y-person.at.y;
            person.facing=dx>0?'right':dx<0?'left':dy<0?'back':'front';
          }
          const travel=Math.min(remaining,1-person.progress);
          person.progress+=travel;remaining-=travel;
          if(person.progress<1)break;
          person.at=person.next;person.next=null;person.progress=0;
        }
        if(person.next||person.path.length)return;
        if(person.state==='WALK'&&person.activity==='inspect'&&this.job?.person===person&&equal(person.at,person.goal)){
          const object=this.objects.find(o=>o.id===this.job.id);
          const index=this.residents.indexOf(person);
          person.state='INTERACT';
          person.wait=1.9+index*.22;
          person.bubble=this.type(object).reactions[index];
          this.events.push({kind:'reaction',objectId:object.id,resident:person.id,text:person.bubble});
        }else {
          const arrived=person.activity==='visit'&&equal(person.at,person.goal);
          if(arrived)this.events.push({kind:'arrived',resident:person.id,at:{...person.at}});
          this.idle(person,arrived?1.65:undefined);
        }
      }else if(person.state==='INTERACT'){
        person.wait-=dt;
        if(person.wait>0)return;
        if(this.job?.person===person){this.job.index++;this.job.person=null;this.job.retryUntil=0;}
        this.idle(person);
      }else if(person.state==='IDLE'){
        person.wait-=dt;
        if(person.wait<=0)person.state='CHOOSE_TARGET';
      }else this.wander(person);
    }
    update(seconds) {
      if(this.paused)return;
      const dt=Math.min(Math.max(0,seconds),.18);
      this.clock+=dt;
      this.updateJobs();
      for(const person of this.residents)this.tickPerson(person,dt);
      if(this.job?.person && this.job.person.state==='IDLE'){
        this.job.person=null;
        this.job.retryUntil=0;
      }
    }
    masks() {
      const blocked=this.blocked();
      const result={walkable:[],placeable:[],blocked:[],interactionPoints:[]};
      const occupied=new Set(this.objects.flatMap(o=>this.cellsOf(o).map(p=>key(p.x,p.y))));
      result.interactionPoints=this.objects.flatMap(o=>this.doors(o).filter(p=>this.canWalk(p,blocked)).map(p=>[p.x,p.y]));
      for(const cell of this.cells.values()) {
        const id=key(cell.x,cell.y), coord=[cell.x,cell.y];
        if(this.canWalk(cell,blocked))result.walkable.push(coord);
        else result.blocked.push(coord);
        if(cell.placeable&&!occupied.has(id))result.placeable.push(coord);
      }
      return result;
    }
  }
  globalThis.IsleWorld={key,equal,boundary,shortest,World};
  if(typeof module!=='undefined')module.exports=globalThis.IsleWorld;
})();
