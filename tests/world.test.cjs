const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {World,key,boundary}=require('../dist/world.js');
const map=require('../dist/assets/terrain-map.json');
const chunk=require('../dist/assets/expansion-chunk.json');
const config=require('../dist/assets/objects.json');
function make(seed=17){
  return new World(map,chunk,config,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
}
function simulate(w,done,limit=2000){
  for(let t=0;t<limit;t++){
    if(done())return;
    const old=w.residents.map(p=>p.at);
    w.update(.075);
    for(const [i,p] of w.residents.entries()){
      assert(w.canWalk(p.at));
      if(p.next)assert(w.canWalk(p.next));
      assert(Math.abs(p.at.x-old[i].x)+Math.abs(p.at.y-old[i].y)<=1);
    }
  }
  assert.fail('simulation did not reach requested condition');
}
const at=(x,y)=>({x,y});
function place(w,type,x,y){
  const result=w.place(at(x,y),type);
  assert.equal(result.error,'');
  return result.object;
}
test('Empty startup, resident target/idle cycles, legal cardinal paths and pause',()=>{
  const w=make();
  assert.equal(w.objects.length,0);
  const recent=w.residents.map(()=>new Set());
  const phases=w.residents.map(()=>new Set());
  w.paused=true;
  const frozen=JSON.stringify(w.residents);
  w.update(.3);
  assert.equal(JSON.stringify(w.residents),frozen);
  w.paused=false;
  simulate(w,()=>{
    w.residents.forEach((p,i)=>{recent[i].add(key(p.at.x,p.at.y));phases[i].add(p.state);});
    return recent.every(set=>set.size>=9)&&phases.every(set=>['IDLE','CHOOSE_TARGET','WALK'].every(s=>set.has(s)));
  });
});
test('Object placement validates terrain, occupancy and active resident steps',()=>{
  const w=make();
  assert.match(w.place(at(7,10),'apple').error,/可放置/);
  assert.match(w.place(at(0,0),'stone').error,/可放置/);
  const a=place(w,'apple',22,13);
  assert.deepEqual(a.at,at(22,13));
  assert.equal(a.id,'obj-01');
  assert(!w.canWalk(a.at));
  assert.match(w.place(a.at,'chair').error,/重叠/);
  const p=w.residents[1];
  w.command(p,at(22,15));w.tickPerson(p,.05);
  assert.match(w.place(p.next,'apple').error,/居民/);
  assert(w.remove(a.id));
  assert(w.canWalk(a.at));
});
test('Auto and manual exploration reach the object, show three unique reactions, and return to wander',()=>{
  const w=make();
  const o=place(w,'apple',22,13);
  assert.equal(w.queue[0],o.id);
  simulate(w,()=>w.events.some(e=>e.kind==='explored'));
  const first=w.events.filter(e=>e.kind==='reaction');
  assert.deepEqual(first.map(r=>r.resident),['tantan','zaozhao','manman']);
  assert.equal(new Set(first.map(r=>r.text)).size,3);
  assert(w.explore(o.id));
  simulate(w,()=>w.events.filter(e=>e.kind==='explored').length===2);
  assert.equal(w.events.filter(e=>e.kind==='reaction').length,6);
  simulate(w,()=>w.residents.every(p=>p.activity==='wander'||p.state==='IDLE'));
});
test('V7 evolution remains available, protects footprint, and clears previous interaction',()=>{
  const w=make(),o=place(w,'apple',22,13);
  assert.equal(w.evolve(o.id).error,'');
  assert.equal(w.cellsOf(o).length,2);
  assert.equal(w.evolve(o.id).error,'');
  assert.equal(w.cellsOf(o).length,6);
  assert(w.cellsOf(o).every(p=>!w.canWalk(p)));
  assert(w.canWalk(at(22,14)));
  assert(w.canWalk(at(22,11)));
  const w2=make(),apple=place(w2,'apple',18,11);
  assert.equal(w2.evolve(apple.id).error,'');
  assert.match(w2.evolve(apple.id).error,/可放置/);
  assert.equal(apple.type,'apple-large');
});
test('Water leaf receives an accessible shoreline interaction and leaves water blocked to walking',()=>{
  const w=make();
  const o=place(w,'leaf',10,10);
  assert.equal(o.floating,true);
  assert(!w.canWalk(o.at));
  assert(w.doors(o).some(p=>w.canWalk(p)));
  assert.match(w.place(o.at,'leaf').error,/重叠/);
  simulate(w,()=>w.events.some(e=>e.kind==='reaction'&&e.objectId===o.id));
});
test('Real expansion preserves placement and residents, updates coastline and accepts a second object',()=>{
  const w=make(),o=place(w,'stone',22,13);
  const old=new Map(w.cells);
  const marker=e=>e.x===29&&e.y===14&&e.dir==='E';
  const starts=w.residents.map(p=>p.at);
  assert(boundary(w.cells).some(marker));
  assert(w.expand());
  assert(!w.expand());
  assert.equal(w.cells.size,492);
  assert(!boundary(w.cells).some(marker));
  for(const [id,cell] of old)assert.equal(w.cells.get(id),cell);
  assert.deepEqual(starts,w.residents.map(p=>p.at));
  assert.deepEqual(o.at,at(22,13));
  const visited=new Set();
  simulate(w,()=>{
    for(const p of w.residents)if(p.at.x>=30 && p.activity==='visit')visited.add(p.id);
    return visited.size===3;
  });
  const second=place(w,'chair',36,12);
  assert.equal(second.id,'obj-02');
  assert(!w.canWalk(second.at));
  const oldPath=w.residents.flatMap(p=>p.path);
  assert(oldPath.every(p=>w.canWalk(p)));
});
test('Fresh world resets placements, chunk, debug data and spawn positions',()=>{
  const w=make();place(w,'apple',22,13);w.expand();
  const reset=make();
  assert.equal(reset.cells.size,405);
  assert.deepEqual(reset.objects,[]);
  assert.deepEqual(reset.residents.map(p=>p.at),map.spawns.map(p=>at(p.x,p.y)));
  assert.equal(reset.expanded,false);
  assert.deepEqual(reset.masks().interactionPoints,[]);
});
if(process.argv.includes('--write-evidence')){
  const w=make();
  const initial={boundary:boundary(w.cells),masks:w.masks()};
  w.expand();
  const expanded={boundary:boundary(w.cells),masks:w.masks()};
  const write=(id,data)=>fs.writeFileSync('dist/assets/'+id+'.json',JSON.stringify(data,null,2)+'\n');
  write('island-boundary',{before:initial.boundary,after:expanded.boundary,interface:map.interface});
  write('terrain-masks',{initial:initial.masks,expanded:expanded.masks});
}
