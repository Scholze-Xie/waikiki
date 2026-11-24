import * as T from 'three';
import {buildEnvironment} from './environment';
import {createReef} from './reef';
import {waterHeight,createSea} from './waves';
import {createSharks} from './sharks';
import {createPeople} from './people';
import type {Role,Subject} from './people';
import {cameraLabel,createCamera,scenicStops} from './camera';
import type {CameraView} from './camera';
import {fruitMenu} from './fruit-menu';
import {setupShopMenu,setupSnackMenu} from './snack-menu';
import {BeachSound} from './sound';
import './style.css';

function start(){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','3D beach scene. Arrow keys orbit and tilt the camera.');
  document.querySelector('#view')!.append(canvas);
  const scene=new T.Scene();
  const sky=new T.Color(0xa5d6d3),deep=new T.Color(0x23666c);
  const background=sky.clone();
  scene.background=background;
  const fog=new T.FogExp2(sky,.012);
  scene.fog=fog;
  scene.add(new T.HemisphereLight(0xfff2d8,0x819eb0,1.94));
  const sun=new T.DirectionalLight(0xffe6b4,2.35);
  sun.position.set(-15,26,13);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-30,right:25,top:28,bottom:-25,near:1,far:72});
  sun.shadow.normalBias=.03;
  scene.add(sun);
  const environment=buildEnvironment(scene);
  const moveSea=createSea(scene);
  const reef=createReef(scene);
  const moveSharks=createSharks(scene);
  const {subjects,update:movePeople}=createPeople(scene);
  const cameraRig=createCamera(canvas,reef.blocked);
  const {camera}=cameraRig;
  const markerLayer=document.querySelector<HTMLElement>('#markers')!;
  const mode=document.querySelector<HTMLElement>('#mode')!;
  const hint=document.querySelector<HTMLElement>('#hint')!;
  const back=document.querySelector<HTMLButtonElement>('#back')!;
  const nav=document.querySelector('nav')!;
  const viewpoint=document.querySelector<HTMLSelectElement>('#viewpoint')!;
  const bearing=document.querySelector<HTMLElement>('#bearing')!;
  for(const [id,spot] of Object.entries(scenicStops))viewpoint.add(new Option(spot.label,id));
  const choices=[...nav.querySelectorAll<HTMLButtonElement>('[data-follow]')];
  const markers=subjects.map(({label,id})=>{
    const marker=document.createElement('span');
    marker.className='marker';
    marker.dataset.label='Follow '+label;
    marker.dataset.subject=id;
    marker.setAttribute('aria-hidden','true');
    markerLayer.append(marker);
    return marker;
  });
  const pointer=new T.Vector2();
  const projection=new T.Vector3();
  const raycaster=new T.Raycaster();
  const hitboxes=subjects.map(s=>s.person.hit);
  let hovered:Subject|null=null;
  let pressed:{x:number;y:number}|null=null;
  let pointerPosition:PointerEvent|null=null;
  function pick(event:PointerEvent){
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(pointer,camera);
    const intersection=raycaster.intersectObjects(hitboxes,false)[0];
    return subjects.find(subject=>subject.person.hit===intersection?.object)??null;
  }
  function select(view:CameraView){
    cameraRig.select(view);
    bearing.hidden=true;
    environment.showShopInterior(view==='shop');
    hovered=null;
    canvas.style.cursor='';
    mode.textContent=cameraLabel(view).toUpperCase();
    document.querySelector<HTMLElement>('#snack-receipt')!.hidden=view!=='snacks';
    document.querySelector<HTMLElement>('#fruit-receipt')!.hidden=view!=='fruit';
    const scenic=typeof view==='string'&&view!=='shop';
    viewpoint.value=scenic?view:view===null?'overview':'';
    nav.hidden=view==='shop'||view==='dive'||typeof view==='object'&&view!==null;
    hint.textContent=view==='dive'?'Drag to look. WASD to swim. Q to dive, E to rise.':'Drag for 360-degree views. Scroll to zoom.';
    hint.hidden=nav.hidden&&view!=='shop'&&view!=='dive';
    markerLayer.hidden=nav.hidden||view==='dive';
    back.hidden=!view;
  }
  canvas.addEventListener('pointermove',(event)=>{pointerPosition=event});
  canvas.addEventListener('pointerleave',()=>{pointerPosition=null});
  canvas.addEventListener('pointerdown',(event)=>{
    if(event.button===0)pressed={x:event.clientX,y:event.clientY};
  });
  canvas.addEventListener('pointercancel',()=>{pressed=null});
  canvas.addEventListener('pointerup',(event)=>{
    if(pressed&&event.button===0&&cameraRig.orbiting&&!nav.hidden&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<6){
      const picked=pick(event);
      if(picked)select(picked);
    }
    pressed=null;
  });
  choices.forEach(button=>button.addEventListener('click',()=>{
    const subject=subjects.find(s=>s.id===button.dataset.follow as Role);
    if(subject)select(subject);
  }));
  viewpoint.addEventListener('change',()=>{
    const id=viewpoint.value;
    if(id==='overview')select(null);
    else if(Object.hasOwn(scenicStops,id))select(id as keyof typeof scenicStops);
  });
  setupSnackMenu(()=>{if(cameraRig.view!=='snacks')select('snacks');},environment.prepareSnacks);
  setupShopMenu('fruit',fruitMenu,()=>{if(cameraRig.view!=='fruit')select('fruit');},environment.prepareFruit);
  document.querySelector('#shop-view')!.addEventListener('click',()=>select('shop'));
  back.addEventListener('click',()=>select(null));
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&cameraRig.view&&!document.querySelector('dialog[open]'))select(null);
  });
  const sound=new BeachSound();
  const soundButton=document.querySelector<HTMLButtonElement>('#sound')!;
  soundButton.addEventListener('click',async()=>{
    const enabled=soundButton.getAttribute('aria-pressed')==='false';
    soundButton.disabled=true;
    try{
      await sound.setEnabled(enabled);
      soundButton.setAttribute('aria-pressed',String(enabled));
      soundButton.textContent=enabled?'Sound Off':'Sound On';
    }catch{
      soundButton.textContent='Sound unavailable';
    }finally{
      soundButton.disabled=false;
    }
  });
  const view=canvas.parentElement!;
  function resize(){
    const {clientWidth:width,clientHeight:height}=view;
    cameraRig.resize(width,height);
    renderer.setSize(width,height,false);
  }
  new ResizeObserver(resize).observe(view);
  resize();
  const timer=new T.Timer();
  timer.connect(document);
  let time=3.7;
  renderer.setAnimationLoop(()=>{
    timer.update();
    const delta=Math.min(timer.getDelta(),.06);
    time+=delta;
    environment.update(time);
    moveSea(time);
    moveSharks(time);
    movePeople(time);
    cameraRig.update(delta);
    const {x,y,z}=camera.position;
    const depth=waterHeight(x,z,time)-y;
    // Keep the underwater palette tied to the waterline during the camera transition.
    const underwater=x>8&&depth>0;
    const submerge=underwater?T.MathUtils.smoothstep(depth,0,.8):0;
    background.copy(sky).lerp(deep,submerge);
    fog.color.copy(background);
    fog.density=T.MathUtils.lerp(.012,.078,submerge);
    reef.update(time,underwater,cameraRig.view==='dive'?camera.position:null);
    renderer.render(scene,camera);
    bearing.hidden=!cameraRig.orbiting;
    if(cameraRig.orbiting){
      const heading=String(cameraRig.bearing).padStart(3,'0')+'°';
      if(bearing.textContent!==heading)bearing.textContent=heading;
    }
    if(cameraRig.orbiting&&!nav.hidden){
      hovered=pointerPosition&&!pressed?pick(pointerPosition):null;
      canvas.style.cursor=hovered?'pointer':pressed?'grabbing':'grab';
      markers.forEach((marker,index)=>{
        const subject=subjects[index];
        subject.person.focus.getWorldPosition(projection).project(camera);
        marker.hidden=projection.z>1||projection.z < -1||Math.abs(projection.x)>.98||Math.abs(projection.y)>.98;
        marker.style.left=(projection.x*.5+.5)*100+'%';
        marker.style.top=(.5-projection.y*.5)*100+'%';
        marker.dataset.hover=String(hovered===subject);
      });
    }else if(cameraRig.orbiting){
      canvas.style.cursor=pressed?'grabbing':'grab';
    }
  });
}

try{
  start();
}catch(error){
  document.querySelector<HTMLElement>('#error')!.hidden=false;
  console.error(error);
}
