/* Adapted from the supplied surreal-weather-v2 Phaser example. */
(function(){
'use strict';
// Phaser 3 adapter for the primary, unrotated world camera.
// Call update(time) from the host scene update. HUD should use its own camera/DOM.
function preloadWeather(scene, manifest, root = '.') {
  for (const preset of manifest.weather) {
    for (const [role, layer] of Object.entries(preset.layers)) {
      const key = weatherKey(preset, role);
      const url = root.replace(/\/$/, '') + '/' + layer.file;
      if (layer.frame) {
        scene.load.spritesheet(key, url, {frameWidth: layer.frame[0], frameHeight: layer.frame[1]});
      } else {
        scene.load.image(key, url);
      }
    }
  }
}
const weatherKey = (preset, role) => 'living-sky:' + preset.id + ':' + role;

function createWeather(scene, manifest, {
  camera = scene.cameras.main,
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  depths = {sky:-100,celestial:-99,clouds:-98,lighting:600,fx:601},
  startId = manifest.weather[0].id
} = {}) {
  const presets = new Map(manifest.weather
    .filter(p => Object.keys(p.layers).every(role => scene.textures.exists(weatherKey(p,role))))
    .map(p => [p.id,p]));
  if(!presets.size)return null;
  if(!presets.has(startId))startId=presets.keys().next().value;
  let current, incoming, started, pending, surface, observer;
  let coverage=null;
  function measure(){
    const canvas=scene.game.canvas.getBoundingClientRect();
    const frame=surface.getBoundingClientRect();
    if(!canvas.width||!canvas.height)return;
    const scale=canvas.width/camera.width;
    const size=Math.max(frame.width/camera.width,frame.height/camera.height)/scale;
    coverage={
      width:camera.width*size,height:camera.height*size,
      x:(frame.x+frame.width/2-canvas.x)/scale,
      y:(frame.y+frame.height/2-canvas.y)/scale,
    };
  }
  function mountBackplate(set){
    if(!surface||!set||set.backplate)return;
    const layer=document.createElement('div');
    layer.className='sky-backplate';
    layer.style.opacity='0';
    layer.setAttribute('aria-hidden','true');
    layer.style.backgroundImage=`url("${set.preset.layers.sky.file}")`;
    surface.insertBefore(layer,surface.querySelector('#legacy-lab'));
    set.backplate=layer;
  }
  function attachSurface(){
    if(surface)return;
    surface=scene.game.canvas.closest('.game-surface');
    if(!surface)return;
    mountBackplate(current);
    mountBackplate(incoming);
    observer=new ResizeObserver(measure);
    observer.observe(surface);
    observer.observe(scene.game.canvas);
    measure();
  }
  function make(id) {
    const preset = presets.get(id);
    if (!preset) throw new RangeError('Unknown weather: ' + id);
    const nodes = {};
    for (const role of Object.keys(preset.layers)) {
      const key = weatherKey(preset, role);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      nodes[role] = (role === 'fx'
        ? scene.add.tileSprite(0,0,camera.width,camera.height,key,0)
        : scene.add.image(0,0,key)).setOrigin(0).setScrollFactor(0).setDepth(depths[role]);
    }
    const set={preset,nodes};
    mountBackplate(set);
    return set;
  }
  const discard=set=>{if(set){set.backplate?.remove();Object.values(set.nodes).forEach(node=>node.destroy());}};
  current = make(startId);
  function render(set,time,opacity,fxOpacity,skyOpacity=opacity) {
    const {nodes,preset} = set;
    const {width,height,zoom,scrollX,scrollY} = camera;
    const {originX,originY} = camera;
    const pivotX = width * originX;
    const pivotY = height * originY;
    const pad = 14;
    const position = (node,x,y) => node.setPosition(pivotX+(x-pivotX)/zoom,pivotY+(y-pivotY)/zoom);
    for (const role of ['sky','celestial','clouds','lighting']) {
      if(role==='sky'&&coverage){
        const node=nodes.sky, area=coverage;
        position(node,area.x-area.width/2,area.y-area.height/2);
        node.setDisplaySize(area.width/zoom,area.height/zoom).setAlpha(skyOpacity);
        continue;
      }
      const node = nodes[role];
      const factor = preset.layers[role].parallax;
      const drift = role === 'clouds' && !reducedMotion
        ? Math.sin(time/1000*preset.speed/12)*8 : 0;
      const shiftX = Math.round(Math.max(-pad,Math.min(pad,scrollX*factor+drift)));
      const shiftY = Math.round(Math.max(-pad,Math.min(pad,scrollY*factor)));
      const overscan = factor ? pad : 0;
      position(node,shiftX-overscan,shiftY-overscan);
      node.setDisplaySize((width+2*overscan)/zoom,(height+2*overscan)/zoom);
      node.setAlpha(role === 'sky' ? skyOpacity : opacity);
    }
    if(set.backplate)set.backplate.style.opacity=String(skyOpacity);
    const layer = preset.layers.fx;
    const frame = reducedMotion ? 0 : Math.floor(time/layer.frameMs)%layer.frames;
    const fx = nodes.fx;
    if (fx.width !== width || fx.height !== height) fx.setSize(width,height);
    position(fx,0,0);
    fx.setScale(1/zoom).setFrame(frame).setAlpha(layer.opacity*fxOpacity);
  }
  function setWeather(id) {
    if (!presets.has(id)) return false;
    if (incoming) {
      pending = id;
      return true;
    }
    if (id === current.preset.id) return true;
    incoming = make(id);
    Object.values(incoming.nodes).forEach(node => node.setAlpha(0));
    started = undefined;
    return true;
  }
  function update(time) {
    if (!current) return;
    attachSurface();
    if (!incoming) {
      render(current,time,1,1);
      return;
    }
    started ??= time;
    const duration = reducedMotion ? 0 : manifest.transition.durationMs;
    const elapsed = time-started;
    const progress = duration ? Math.min(1,elapsed/duration) : 1;
    const fade = Math.max(0,Math.min(1,elapsed/manifest.transition.fxFadeMs));
    const eased = .5-.5*Math.cos(progress*Math.PI);
    render(current,time,1-eased,duration ? 1-fade : 0,1);
    render(incoming,time,eased,duration ? fade : 1);
    if (progress === 1) {
      discard(current);
      current = incoming;
      incoming = undefined;
      if (pending) {
        const next = pending;
        pending = undefined;
        setWeather(next);
      }
    }
  }
  function destroy() {
    observer?.disconnect();
    discard(current);
    discard(incoming);
    current = incoming = undefined;
  }
  scene.events.once('shutdown',destroy);
  update(0);
  return {setWeather,update,destroy,status:()=>({weatherId:current?.preset.id,transitionState:incoming?'transitioning':'settled',layerCount:5*(Number(!!current)+Number(!!incoming))})};
}

window.IsleLivingSky={preloadWeather,createWeather};
})();
