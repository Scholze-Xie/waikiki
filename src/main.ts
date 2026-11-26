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

const guide=document.querySelector<HTMLElement>('.guide')!;
const loading=document.querySelector<HTMLElement>('#loading')!;
const errorPanel=document.querySelector<HTMLElement>('#error')!;
const errorMessage=document.querySelector<HTMLElement>('#error-message')!;
const soundButton=document.querySelector<HTMLButtonElement>('#sound')!;
const divePad=document.querySelector<HTMLElement>('#dive-pad')!;
const walkPad=document.querySelector<HTMLElement>('#walk-pad')!;
document.querySelector('#retry')!.addEventListener('click',()=>location.reload());

function showSceneError(message:string){
  loading.hidden=true;
  guide.inert=true;
  divePad.inert=true;
  walkPad.inert=true;
  soundButton.disabled=true;
  errorMessage.textContent=message;
  errorPanel.hidden=false;
}

function start(){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
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
  const compact=matchMedia('(max-width: 620px)');
  const touch=matchMedia('(pointer: coarse)');
  const compactPanel=matchMedia('(max-width: 620px), (max-height: 480px)');
  sun.shadow.mapSize.setScalar(compact.matches?1024:2048);
  Object.assign(sun.shadow.camera,{left:-30,right:25,top:28,bottom:-25,near:1,far:72});
  sun.shadow.normalBias=.03;
  scene.add(sun);
  const environment=buildEnvironment(scene);
  const moveSea=createSea(scene);
  const reef=createReef(scene);
  const moveSharks=createSharks(scene);
  const {subjects,update:movePeople}=createPeople(scene,environment.terrainHeight);
  const cameraRig=createCamera(canvas,reef.blocked,environment.terrainHeight,environment.mangroveColliders);
  document.querySelector<HTMLElement>('#experience')!.addEventListener('wheel',event=>{
    if(event.defaultPrevented||event.ctrlKey||!(event.target instanceof Element))return;
    if(event.target.closest('dialog, select'))return;
    if(guide.contains(event.target)&&guide.scrollHeight>guide.clientHeight)return;
    const unit=event.deltaMode===1?16:event.deltaMode===2?100:1;
    if(cameraRig.zoom(event.deltaY*unit))event.preventDefault();
  },{passive:false});
  const {camera}=cameraRig;
  const markerLayer=document.querySelector<HTMLElement>('#markers')!;
  const mode=document.querySelector<HTMLElement>('#mode')!;
  const hint=document.querySelector<HTMLElement>('#hint')!;
  const zoomButtons=document.querySelector<HTMLElement>('#zoom')!;
  const walkButton=document.querySelector<HTMLButtonElement>('#walk')!;
  walkButton.addEventListener('click',()=>select('walk'));
  document.querySelector('#zoom-in')!.addEventListener('click',()=>cameraRig.zoom(-420));
  document.querySelector('#zoom-out')!.addEventListener('click',()=>cameraRig.zoom(420));
  const back=document.querySelector<HTMLButtonElement>('#back')!;
  const nav=document.querySelector<HTMLElement>('#shortcuts')!;
  const explore=document.querySelector<HTMLButtonElement>('#explore')!;
  const viewpoint=document.querySelector<HTMLSelectElement>('#viewpoint')!;
  const bearing=document.querySelector<HTMLElement>('#bearing')!;
  for(const [id,spot] of Object.entries(scenicStops))viewpoint.add(new Option(spot.label,id));
  const choices=[...nav.querySelectorAll<HTMLButtonElement>('[data-follow]')];
  const markers=subjects.map(subject=>{
    const marker=document.createElement('span');
    marker.className='marker';
    marker.dataset.label='Follow '+subject.label;
    marker.hidden=true;
    marker.addEventListener('click',()=>select(subject));
    markerLayer.append(marker);
    return marker;
  });
  const pointer=new T.Vector2();
  const projection=new T.Vector3();
  const raycaster=new T.Raycaster();
  const hitboxes=subjects.map(s=>s.person.hit);
  let hovered:Subject|null=null;
  let pressed:{id:number;x:number;y:number}|null=null;
  let pointerOverCanvas=false;
  let nextHoverCheck=0;
  let cursor='';
  let sceneReady=false;
  let contextLost=false;
  const snackReceipt=document.querySelector<HTMLElement>('#snack-receipt')!;
  const fruitReceipt=document.querySelector<HTMLElement>('#fruit-receipt')!;
  function setPointer(event:PointerEvent){
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  }
  function pick(){
    raycaster.setFromCamera(pointer,camera);
    const intersection=raycaster.intersectObjects(hitboxes,false)[0];
    return subjects.find(subject=>subject.person.hit===intersection?.object)??null;
  }
  function setExpanded(expanded:boolean){
    explore.setAttribute('aria-expanded',String(expanded));
  }
  explore.addEventListener('click',()=>setExpanded(explore.getAttribute('aria-expanded')==='false'));

  function updateHint(){
    const isTouch=touch.matches||compact.matches;
    const view=cameraRig.view;
    const following=view!==null&&typeof view==='object';
    hint.textContent=view==='walk'
      ? (touch.matches?'Drag to look. Hold a direction, Rise, or Descend to move.':'WASD to walk. E to rise, Q to descend. Drag or use arrow keys to look.')
      : view==='dive'
      ? (isTouch?'Drag to look. Hold a swim control to move.':'Drag or use arrows to look. WASD to swim. Q to dive, E to rise.')
      : following?'Use + / − to adjust the distance.':(isTouch?'Drag to look around. Pinch to zoom.':'Drag to look around. Scroll to zoom.');
    zoomButtons.hidden=view==='dive'||view==='walk';
    walkButton.hidden=view==='walk';
    canvas.setAttribute('aria-label',view==='walk'
      ? '3D beach walk. WASD to walk, E to rise, Q to descend, and arrow keys to look.'
      : '3D beach scene. Use arrow keys to look around and plus or minus to zoom.');
  }
  touch.addEventListener('change',updateHint);
  compact.addEventListener('change',updateHint);
  updateHint();
  function select(view:CameraView,restoreFocus=false){
    if(!sceneReady)return;
    const focusWasInNav=nav.contains(document.activeElement);
    cameraRig.select(view);
    bearing.hidden=true;
    environment.showShopInterior(view==='shop');
    hovered=null;
    markerLayer.hidden=true;
    mode.textContent=cameraLabel(view);
    snackReceipt.hidden=view!=='snacks';
    fruitReceipt.hidden=view!=='fruit';
    const scenic=typeof view==='string'&&view!=='shop';
    viewpoint.value=scenic?view:view===null?'overview':'';
    nav.hidden=view==='shop'||view==='walk'||view==='dive'||typeof view==='object'&&view!==null;
    explore.hidden=nav.hidden;
    if(nav.hidden)setExpanded(false);
    updateHint();
    back.hidden=!view;
    if(restoreFocus)viewpoint.focus({preventScroll:true});
    else if(focusWasInNav&&nav.hidden)back.focus({preventScroll:true});
  }
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||pressed)return;
    setPointer(event);
    pointerOverCanvas=true;
  });
  canvas.addEventListener('pointerleave',()=>{pointerOverCanvas=false;hovered=null;});
  canvas.addEventListener('pointerdown',(event)=>{
    if(event.button===0&&event.isPrimary)pressed={id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  canvas.addEventListener('pointercancel',event=>{if(pressed?.id===event.pointerId)pressed=null;});
  window.addEventListener('blur',()=>{pressed=null;pointerOverCanvas=false;hovered=null;});
  canvas.addEventListener('pointerup',(event)=>{
    if(pressed?.id!==event.pointerId)return;
    if(event.button===0&&cameraRig.orbiting&&!nav.hidden&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<6){
      setPointer(event);
      const picked=pick();
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
    else if(id==='walk')select('walk');
    else if(Object.hasOwn(scenicStops,id))select(id as keyof typeof scenicStops);
  });
  function settleOrder(){
    if(!compactPanel.matches)return;
    setExpanded(false);
    explore.focus({preventScroll:true});
  }
  setupSnackMenu(()=>{if(cameraRig.view!=='snacks')select('snacks');},environment.prepareSnacks,settleOrder);
  setupShopMenu('fruit',fruitMenu,()=>{if(cameraRig.view!=='fruit')select('fruit');},environment.prepareFruit,settleOrder,
    document.querySelector<HTMLButtonElement>('#fruit-display')!);
  document.querySelector('#shop-view')!.addEventListener('click',()=>select('shop'));
  back.addEventListener('click',()=>select(null,true));
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&cameraRig.view&&!document.querySelector('dialog[open]'))select(null,true);
  });
  const sound=new BeachSound();
  soundButton.addEventListener('click',async()=>{
    const enabled=soundButton.getAttribute('aria-pressed')==='false';
    soundButton.disabled=true;
    try{
      await sound.setEnabled(enabled);
      soundButton.setAttribute('aria-pressed',String(enabled));
      soundButton.textContent='Beach sound';
    }catch{
      soundButton.textContent='Try sound again';
    }finally{
      soundButton.disabled=!sceneReady;
    }
  });
  const view=canvas.parentElement!;
  let width=1,height=1,resolution=1,elapsed=0,frames=0;
  function resizeBuffer(){
    const limit=Math.sqrt(1_800_000/(width*height));
    const density=Math.min(window.devicePixelRatio,1.65,limit);
    renderer.setDrawingBufferSize(width,height,density*resolution);
  }
  function resize(){
    width=Math.max(1,view.clientWidth);
    height=Math.max(1,view.clientHeight);
    cameraRig.resize(width,height);
    resizeBuffer();
  }
  new ResizeObserver(resize).observe(view);
  resize();
  const timer=new T.Timer();
  timer.connect(document);
  canvas.addEventListener('webglcontextlost',()=>{
    contextLost=true;
    sceneReady=false;
    document.querySelector<HTMLDialogElement>('dialog[open]')?.close();
    showSceneError('The 3D scene paused while the graphics connection recovers.');
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    contextLost=false;
    elapsed=0;
    frames=0;
    resizeBuffer();
  });
  let time=3.7;
  renderer.setAnimationLoop(()=>{
    timer.update();
    if(contextLost||document.hidden)return;
    const frameTime=timer.getDelta();
    const delta=Math.min(frameTime,.06);
    // Adjust pixel density only after sustained slow or fast frames.
    if(frameTime>0&&frameTime<.15){
      elapsed+=frameTime;
      frames++;
      if(elapsed>=2){
        const budget=elapsed/frames;
        const next=budget>.030?Math.max(.78,resolution-.11):budget<.019?Math.min(1,resolution+.055):resolution;
        if(next!==resolution){resolution=next;resizeBuffer();}
        frames=0;
        elapsed=0;
      }
    }
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
    if(!sceneReady){
      sceneReady=true;
      guide.inert=false;
      divePad.inert=false;
      walkPad.inert=false;
      soundButton.disabled=false;
      loading.hidden=true;
      errorPanel.hidden=true;
    }
    const orbiting=cameraRig.orbiting;
    if(bearing.hidden===orbiting)bearing.hidden=!orbiting;
    if(orbiting){
      const heading=String(cameraRig.bearing).padStart(3,'0')+'°';
      if(bearing.textContent!==heading)bearing.textContent=heading;
    }
    const showMarkers=orbiting&&!nav.hidden;
    if(markerLayer.hidden===showMarkers)markerLayer.hidden=!showMarkers;
    if(showMarkers){
      if(pointerOverCanvas&&!pressed&&time>=nextHoverCheck){
        hovered=pick();
        nextHoverCheck=time+1/24;
      }
      markers.forEach((marker,index)=>{
        const subject=subjects[index];
        subject.person.focus.getWorldPosition(projection).project(camera);
        const offscreen=projection.z>1||projection.z < -1||Math.abs(projection.x)>.98||Math.abs(projection.y)>.98;
        if(marker.hidden!==offscreen)marker.hidden=offscreen;
        if(offscreen)return;
        const x=(projection.x*.5+.5)*width;
        const y=(.5-projection.y*.5)*height;
        marker.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-70%)`;
        const active=String(hovered===subject);
        if(marker.dataset.hover!==active)marker.dataset.hover=active;
      });
    }
    const nextCursor=pressed?'grabbing':showMarkers&&hovered?'pointer':orbiting||cameraRig.view==='dive'||cameraRig.view==='walk'?'grab':'';
    if(nextCursor!==cursor){cursor=nextCursor;canvas.style.cursor=cursor;}
  });
}

requestAnimationFrame(()=>requestAnimationFrame(()=>{
  try{
    start();
  }catch(error){
    showSceneError('Couldn’t start the beach scene. Reload in a browser with WebGL 2 enabled.');
    console.error(error);
  }
}));
