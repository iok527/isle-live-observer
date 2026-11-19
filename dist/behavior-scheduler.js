(function(){
  'use strict';
  const residents={
    tantan:{weights:{discovery:3},preferences:['curious','inspect']},
    zaozhao:{weights:{research:3},preferences:['think','inspect']},
    manman:{weights:{facility:3},preferences:['rest','use','inspect']},
  };
  const interactions={
    apple:{capabilities:['inspect','curious','think'],build:{resident:'zaozhao',next:'apple-large'}},
    leaf:{capabilities:['inspect','curious','think']},
    stone:{capabilities:['inspect','curious','think']},
    'apple-large':{capabilities:['inspect','curious','think']},
    'apple-house':{capabilities:['inspect','rest','think']},
    'leaf-boat':{capabilities:['inspect','use','think']},
  };
  class BehaviorScheduler {
    constructor(){this.cooldowns=new Map();}
    key(person,object){return [person.id,object.id,object.type].join(':');}
    ready(person,object,clock){return (this.cooldowns.get(this.key(person,object))??0)<=clock;}
    completed(person,object,clock){
      for(const [key,until] of this.cooldowns)if(until<=clock)this.cooldowns.delete(key);
      this.cooldowns.set(this.key(person,object),clock+4);
    }
    order(people,role){
      const weight=person=>residents[person.id]?.weights[role]??1;
      return [...people].sort((a,b)=>weight(b)-weight(a));
    }
    action(person,object){
      const capabilities=interactions[object.type]?.capabilities||['inspect'];
      return residents[person.id]?.preferences.find(action=>capabilities.includes(action))||'inspect';
    }
  }
  const api={BehaviorScheduler,interactions};
  if(typeof module!=='undefined')module.exports=api;
  else globalThis.IsleBehavior=api;
})();
