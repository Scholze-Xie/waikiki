import {createDiveControls} from './dive-controls';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Subject } from './people';
import { streamZ, woodlandHeight } from './woodland';
import { hanauma } from './hanauma';

type OrbitStop = {
  label: string;
  focus: T.Vector3;
  opening: T.Vector3;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle?: number;
  fieldOfView?: number;
};

export const scenicStops = {
  grove: {
    label:'Palm Grove', focus:new T.Vector3(-16.8,3.5,-6.8),
    opening:new T.Vector3(-22,7.4,2.3), minDistance:5.5,maxDistance:21
  },
  creek: {
    label:'Jungle Creek', focus:new T.Vector3(-9.5,.68,streamZ(-9.5)),
    opening:new T.Vector3(.5,4.1,streamZ(-9.5)+8.7), minDistance:5,maxDistance:19
  },
  guardians: {
    label:'Stone Guardians', focus:new T.Vector3(-17.5,4.05,-11.1),
    opening:new T.Vector3(-9.1,6.5,-2.7), minDistance:6,maxDistance:22
  },
  ridge: {
    label:'Mountain Lookout', focus:new T.Vector3(-22,5.2,-24),
    opening:new T.Vector3(-45,26,-39), minDistance:16,maxDistance:39
  },
  snacks: {
    label:'Beach Snack Stand', focus:new T.Vector3(-8,1.95,8.24),
    opening:new T.Vector3(-5.3,3.55,14.8), minDistance:5,maxDistance:18
  },
  fruit: {
    label:'Tropical Fruit Stand',focus:new T.Vector3(-14.7,2.06,8.53),
    opening:new T.Vector3(-11.4,3.74,14.75),minDistance:4.4,maxDistance:15
  },
  tide: {
    label:'Beach Tide Line',focus:new T.Vector3(-.55,.29,5.35),
    opening:new T.Vector3(2.4,2.13,8.3),minDistance:2.6,maxDistance:13
  },
  hanauma: {
    label:'Hanauma Bay',focus:new T.Vector3(-14,5.5,hanauma.centerZ),
    opening:new T.Vector3(52,25,hanauma.centerZ-30),minDistance:12,maxDistance:90,
    fieldOfView:68
  },
  dive: {
    label:'Diver View',focus:new T.Vector3(22,-4.35,-8.2),
    opening:new T.Vector3(32,-3.05,-7.55),minDistance:3,maxDistance:11,maxPolarAngle:1.63
  },
  surf: {
    label:'Surf Break', focus:new T.Vector3(14,.88,-6),
    opening:new T.Vector3(23,4.8,4), minDistance:8,maxDistance:28
  }
} satisfies Record<string,OrbitStop>;

type ScenicStop = keyof typeof scenicStops;
export type CameraView = Subject | ScenicStop | 'shop' | null;

const overview:OrbitStop = {
  label:'Beach Overview',focus:new T.Vector3(1,1,-5.5),
  opening:new T.Vector3(13,15.5,30),minDistance:12,maxDistance:49
};
const shop:OrbitStop = {
  label:'Inside the Surf Shop',focus:new T.Vector3(-10,1.18,-.95),
  opening:new T.Vector3(-3.8,9,6.8),minDistance:7.2,maxDistance:17,maxPolarAngle:1.02
};

function orbitStop(view:CameraView):OrbitStop|null {
  if (view===null) return overview;
  if (view==='shop') return shop;
  return typeof view==='string'?scenicStops[view]:null;
}

export function cameraLabel(view:CameraView) {
  if(view&&typeof view!=='string')return 'Following \u00b7 '+view.label;
  return orbitStop(view)?.label ?? overview.label;
}

export function createCamera(canvas:HTMLCanvasElement,blocked:(position:T.Vector3)=>boolean=()=>false){
  const camera=new T.PerspectiveCamera(48,1,.15,230);
  const diving=createDiveControls(canvas,camera,blocked);
  camera.position.copy(overview.opening);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;
  controls.enablePan=false;
  controls.minPolarAngle=.18;
  // Keep the unbounded azimuth of OrbitControls for every scenic stop.
  const look=overview.focus.clone();
  const fromLook=new T.Vector3();
  const fromPosition=new T.Vector3();
  const point=new T.Vector3();
  const target=new T.Vector3();
  const goal=new T.Vector3();
  let view:CameraView=null;
  let stop:OrbitStop|null=overview;
  let transition=1;
  let swimming=false;
  let defaultFov=48;
  let fromFov=camera.fov;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

  function setFov(fov:number){
    if(camera.fov===fov)return;
    camera.fov=fov;
    camera.updateProjectionMatrix();
  }

  function resize(width:number,height:number){
    camera.aspect=width/Math.max(1,height);
    defaultFov=width<650?57:48;
    camera.fov=T.MathUtils.lerp(fromFov,stop?.fieldOfView??defaultFov,T.MathUtils.smoothstep(transition,0,1));
    camera.updateProjectionMatrix();
  }

  function enableOrbit(spot:OrbitStop){
    // Clear any drag momentum before applying a new orbit center.
    controls.enableDamping=false;
    controls.update();
    controls.target.copy(spot.focus);
    controls.minDistance=spot.minDistance;
    controls.maxDistance=spot.maxDistance;
    controls.maxPolarAngle=spot.maxPolarAngle??1.49;
    camera.position.copy(spot.opening);
    controls.update();
    controls.enableDamping=true;
    controls.enabled=true;
    keepAboveGround();
  }

  function keepAboveGround(){
    const {x,y,z}=camera.position;
    if(view==='dive'){
      camera.position.y=Math.max(woodlandHeight(x,z)+.7,y);
      if(controls.enabled)camera.position.y=Math.min(-.55,camera.position.y);
      return;
    }
    const surface=Math.max(.17,woodlandHeight(x,z));
    const shopRoof=x>-13.65&&x< -5.62&&z> -3.65&&z<1.46&&view!=='shop'?4.75:0;
    const snackRoof=x>-10.3&&x<-5.7&&z>6.2&&z<9.55?4.08:0;
    const fruitRoof=x>-17.4&&x<-12&&z>6.45&&z<9.4?4.16:0;
    const safe=Math.max(surface+.72,shopRoof,snackRoof,fruitRoof);
    if(y<safe)camera.position.y=safe;
  }

  function select(next:CameraView){
    swimming=false;
    diving.setActive(false);
    if(controls.enabled)look.copy(controls.target);
    fromLook.copy(look);
    fromPosition.copy(camera.position);
    fromFov=camera.fov;
    controls.enabled=false;
    view=next;
    stop=orbitStop(next);
    transition=0;
  }

  function follow(subject:Subject){
    subject.person.root.getWorldPosition(point);
    subject.person.focus.getWorldPosition(target);
    target.y-=subject.id==='surfer'?.23:.58;
    goal.copy(point);
    switch(subject.id){
      case 'carrier':
        // Follow from the beach side so the snack stand cannot block the shot.
        goal.x+=2.65;goal.y+=1.84;goal.z+=2.65;
        break;
      case 'customer':
        goal.x-=1.70;goal.y+=1.61;goal.z+=2.34;
        target.x-=.16;
        break;
      case 'surfer':
        goal.x-=5.1;goal.y+=2;goal.z+=3.4;
        target.z-=.7;
        break;
    }
  }

  function update(delta:number){
    if(swimming){
      diving.update(delta);
      camera.getWorldDirection(look).multiplyScalar(8).add(camera.position);
      return;
    }
    if(controls.enabled){
      controls.update();
      keepAboveGround();
      camera.lookAt(controls.target);
      return;
    }
    if(stop){
      goal.copy(stop.opening);
      target.copy(stop.focus);
    }else if(view&&typeof view!=='string'){
      follow(view);
    }
    transition=Math.min(1,transition+delta*(reducedMotion.matches?5:1.08));
    const ease=T.MathUtils.smoothstep(transition,0,1);
    setFov(T.MathUtils.lerp(fromFov,stop?.fieldOfView??defaultFov,ease));
    if(transition<1){
      camera.position.lerpVectors(fromPosition,goal,ease);
      // Lift crossing shots gently before approaching the scene again.
      const outdoorCrossing=stop===scenicStops.creek||stop===scenicStops.snacks;
      const lift=Math.min(outdoorCrossing?6:4,fromPosition.distanceTo(goal)*.17);
      if(view!=='dive'&&!reducedMotion.matches)camera.position.y+=Math.sin(ease*Math.PI)*lift;
      look.lerpVectors(fromLook,target,ease);
    }else if(view==='dive'&&stop){
      camera.position.copy(stop.opening);
      look.copy(stop.focus);
      camera.lookAt(look);
      swimming=true;
      diving.setActive(true);
      return;
    }else if(stop){
      enableOrbit(stop);
      return;
    }else{
      const alpha=1-Math.exp(-delta*5);
      camera.position.lerp(goal,alpha);
      look.lerp(target,alpha);
    }
    keepAboveGround();
    camera.lookAt(look);
  }

  canvas.addEventListener('keydown',event=>{
    if(!controls.enabled)return;
    const angle=.13;
    switch(event.key){
      case 'ArrowLeft': controls.rotateLeft(angle);break;
      case 'ArrowRight': controls.rotateLeft(-angle);break;
      case 'ArrowUp': controls.rotateUp(angle);break;
      case 'ArrowDown': controls.rotateUp(-angle);break;
      default:return;
    }
    event.preventDefault();
  });
  enableOrbit(overview);
  return {
    camera,select,update,resize,
    get view(){return view},
    get orbiting(){return controls.enabled},
    get bearing(){
      const azimuth=controls.getAzimuthalAngle()*T.MathUtils.RAD2DEG;
      return (Math.round(-azimuth)+360)%360;
    }
  };
}
