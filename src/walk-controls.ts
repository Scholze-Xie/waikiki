import * as T from 'three';
import {coast} from './waves';
import type {MangroveCollider} from './mangroves';
import {beachCoconutSites} from './woodland';

const eyeHeight=1.65;
const walkSpeed=4;
const verticalSpeed=4;
const lookSpeed=1.7;
const bodyRadius=.27;
const maxPitch=1.42;
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE']);
const lookKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);

// X and Z bounds followed by bottom and top. The surf shop keeps its open doorway.
const barriers:ReadonlyArray<readonly [number,number,number,number,number,number]>=[
  [-13.1,-6.9,-3.33,-3.17,.93,4.00],
  [-13.10,-12.94,-3.33,.68,.93,4.00],
  [-7.10,-6.68,-3.33,.68,.93,4.00],
  [-13.1,-12.2,.52,.69,.93,4.00],
  [-8.65,-6.9,.52,.69,.93,4.00],
  [-12.20,-8.65,.50,.72,3.35,4.00],
  [-13.53,-6.47,-3.78,1.13,3.92,4.77],
  [-6.94,-5.87,-2.28,.23,3.12,3.52],
  [-12.59,-10.47,-1.13,-.31,.94,1.97],
  [-12.99,-9.88,-3.18,-2.50,.94,3.51],
  [-12.99,-12.59,-1.55,-.79,.94,2.27],
  [-7.74,-6.97,-2.33,.17,.94,1.99],
  [-9.56,-7.15,-3.23,-2.50,.94,2.53],
  [-13.54,-11.1,1.73,2.48,.78,3.24],
  [-10.15,-5.85,6.2,9.0,.68,3.75],
  [-10.13,-5.87,8.9,9.50,3.12,3.53],
  [-17.29,-12.11,6.3,9.1,.68,4.06],
  [-17.02,-12.37,8.80,9.55,1.66,1.91],
  [-17.19,-12.21,8.90,9.60,3.12,3.54],
];
const landmarkBases:ReadonlyArray<readonly [number,number,number]>=[
  [-16.2,-10.4,2.28],[-25,-15,1.43],
  [-18,4,.20],[-20,-3,.20],[-19.4,-8,.20],[-9,-7,.20],[-12,-13,.20],
  [-6,-12,.20],[-2,-18,.20],[-10,10,.20],[-16,14,.20],[-16,-21,.20],
  [-22,-14,.20],[-4,-24,.20],
  ...[-9.6,.10,18.9].map(z=>[coast(z)-3.25,z,.27] as const),
];

export function createWalkControls(canvas:HTMLCanvasElement,camera:T.PerspectiveCamera,
  terrainHeight:(x:number,z:number)=>number,mangroveColliders:readonly MangroveCollider[]){
  const panel=document.querySelector<HTMLElement>('#walk-pad');
  const keys=new Set<string>();
  const touches=new Map<number,string>();
  const buttonKeys=new Set<string>();
  const held=new Set<string>();
  const rotation=new T.Euler(0,0,0,'YXZ');
  let active=false;
  let drag:number|null=null;
  let previousX=0,previousY=0;
  let eyeFloor=0;
  let heightAboveGround=eyeHeight;
  const roots=mangroveColliders.map(({from,to,radius})=>{
    const direction=to.clone().sub(from);
    const reach=radius+bodyRadius;
    return {
      from,direction,reach,
      horizontal:direction.x**2+direction.z**2,
      length:direction.lengthSq(),
      left:Math.min(from.x,to.x)-reach,right:Math.max(from.x,to.x)+reach,
      near:Math.min(from.z,to.z)-reach,far:Math.max(from.z,to.z)+reach,
      low:Math.min(from.y,to.y)-reach,high:Math.max(from.y,to.y)+reach,
    };
  });
  const rootNear=Math.min(...roots.map(root=>root.near));
  const rootFar=Math.max(...roots.map(root=>root.far));

  function floorAt(x:number,z:number){
    const sand=terrainHeight(x,z);
    const onShopDeck=x>=-13.75&&x<=-6.25&&z>=-3.8&&z<=1.8;
    return onShopDeck?Math.max(sand,.94):sand;
  }

  function blockedByRoot(x:number,z:number,bottom:number,top:number){
    if(z<rootNear||z>rootFar)return false;
    for(const root of roots){
      if(x<root.left||x>root.right||z<root.near||z>root.far||top<root.low||bottom>root.high)continue;
      const {from,direction,horizontal,length,reach}=root;
      if(length===0)continue;
      const dx=x-from.x,dz=z-from.z;
      const projection=dx*direction.x+dz*direction.z;
      // Test the closest point to the vertical body and to each rounded end.
      const closestToBody=horizontal>0?projection/horizontal:0;
      const closestToFeet=(projection+(bottom-from.y)*direction.y)/length;
      const closestToHead=(projection+(top-from.y)*direction.y)/length;
      for(const candidate of [closestToBody,closestToFeet,closestToHead]){
        const t=T.MathUtils.clamp(candidate,0,1);
        const y=from.y+direction.y*t;
        const dy=y-T.MathUtils.clamp(y,bottom,top);
        if((dx-direction.x*t)**2+dy**2+(dz-direction.z*t)**2<reach**2)return true;
      }
    }
    return false;
  }

  function canOccupy(x:number,y:number,z:number,floor:number){
    if(x< -102||z< -115||z>88||x>coast(z)+.42)return false;
    const feet=Math.max(floor+.29,y-1.18);
    const head=y-.02;
    for(const [left,right,front,back,low,high] of barriers){
      if(feet-bodyRadius>=high||head+bodyRadius<=low)continue;
      const dx=x-T.MathUtils.clamp(x,left,right);
      const dz=z-T.MathUtils.clamp(z,front,back);
      if(dx*dx+dz*dz<bodyRadius*bodyRadius)return false;
    }
    if(landmarkBases.some(([cx,cz,radius])=>Math.hypot(x-cx,z-cz)<radius+bodyRadius))return false;
    if(beachCoconutSites.some(palm=>Math.hypot(x-palm.x,z-palm.z)<.27*palm.scale+bodyRadius
      && feet-bodyRadius<terrainHeight(palm.x,palm.z)+5.2*palm.scale))return false;
    return !blockedByRoot(x,z,feet,head);
  }

  function changeHeight(amount:number){
    if(amount===0)return;
    const position=camera.position;
    const floor=floorAt(position.x,position.z);
    const steps=Math.ceil(Math.abs(amount)/.10);
    for(let i=0;i<steps;i++){
      const height=T.MathUtils.clamp(heightAboveGround+amount/steps,.65,20);
      const y=Math.max(eyeFloor+height,floor+.55);
      if(!canOccupy(position.x,y,position.z,floor))break;
      heightAboveGround=height;
      position.y=y;
    }
  }

  function clear(){
    keys.clear();
    buttonKeys.clear();
    touches.clear();
    if(drag!==null&&canvas.hasPointerCapture(drag))canvas.releasePointerCapture(drag);
    drag=null;
  }

  function move(forward:number,right:number,stride:number){
    const sin=Math.sin(rotation.y),cos=Math.cos(rotation.y);
    const position=camera.position;
    const dx=(right*cos-forward*sin)*stride;
    const dz=-(right*sin+forward*cos)*stride;
    // Keep the free component of diagonal movement when it meets a wall or root.
    function tryAxis(axis:'x'|'z',distance:number){
      if(distance===0)return;
      const x=position.x+(axis==='x'?distance:0);
      const z=position.z+(axis==='z'?distance:0);
      const floor=floorAt(x,z);
      const y=Math.max(position.y,floor+.55);
      if(canOccupy(x,y,z,floor))position.set(x,y,z);
    }
    tryAxis('x',dx);
    tryAxis('z',dz);
  }

  function takeStep(action:string){
    if(action==='KeyE'||action==='KeyQ'){
      changeHeight(action==='KeyE'?.48:-.48);
      return;
    }
    const forward=Number(action==='KeyW')-Number(action==='KeyS');
    const right=Number(action==='KeyD')-Number(action==='KeyA');
    move(forward,right,.18);
  }
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('keydown',event=>{
    if(!active||event.altKey||event.ctrlKey||event.metaKey||!movementKeys.has(event.code)&&!lookKeys.has(event.code))return;
    if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable],dialog'))return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));

  canvas.addEventListener('pointerdown',event=>{
    if(!active||event.button!==0||drag!==null)return;
    drag=event.pointerId;
    previousX=event.clientX;
    previousY=event.clientY;
    canvas.focus({preventScroll:true});
    canvas.setPointerCapture(drag);
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==drag)return;
    rotation.y-=(event.clientX-previousX)*.004;
    rotation.x=T.MathUtils.clamp(rotation.x-(event.clientY-previousY)*.004,-maxPitch,maxPitch);
    previousX=event.clientX;
    previousY=event.clientY;
  });
  const stopDrag=(event:PointerEvent)=>{if(event.pointerId===drag)drag=null;};
  canvas.addEventListener('lostpointercapture',stopDrag);
  canvas.addEventListener('pointerup',stopDrag);
  canvas.addEventListener('pointercancel',stopDrag);
  for(const button of panel?.querySelectorAll<HTMLButtonElement>('button[data-walk]')??[]){
    const action=button.dataset.walk!;
    if(!movementKeys.has(action))continue;
    button.addEventListener('pointerdown',event=>{
      if(!active||event.button!==0)return;
      event.preventDefault();
      touches.set(event.pointerId,action);
      button.setPointerCapture(event.pointerId);
      takeStep(action);
    });
    const release=(event:PointerEvent)=>touches.delete(event.pointerId);
    button.addEventListener('lostpointercapture',release);
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('keydown',event=>{
      if(!active||event.code!=='Space'&&event.code!=='Enter')return;
      event.preventDefault();
      buttonKeys.add(action);
      if(!event.repeat)takeStep(action);
    });
    button.addEventListener('keyup',event=>{
      if(event.code==='Space'||event.code==='Enter')buttonKeys.delete(action);
    });
    button.addEventListener('blur',()=>buttonKeys.delete(action));
    button.addEventListener('click',event=>{
      if(active&&event.detail===0)takeStep(action);
    });
  }

  function setActive(next:boolean){
    if(next===active)return;
    active=next;
    clear();
    if(panel)panel.hidden=!active;
    if(!active)return;
    rotation.setFromQuaternion(camera.quaternion,'YXZ');
    eyeFloor=floorAt(camera.position.x,camera.position.z);
    heightAboveGround=eyeHeight;
    camera.position.y=eyeFloor+heightAboveGround;
    canvas.focus({preventScroll:true});
  }

  function update(delta:number){
    if(!active)return;
    const elapsed=Math.min(.05,Math.max(0,delta));
    held.clear();
    for(const key of keys)held.add(key);
    for(const key of buttonKeys)held.add(key);
    for(const action of touches.values())held.add(action);
    const direction=(positive:string,negative:string)=>Number(held.has(positive))-Number(held.has(negative));
    rotation.y+=direction('ArrowLeft','ArrowRight')*elapsed*lookSpeed;
    rotation.x=T.MathUtils.clamp(rotation.x+direction('ArrowUp','ArrowDown')*elapsed*lookSpeed,-maxPitch,maxPitch);
    camera.rotation.copy(rotation);

    const forward=direction('KeyW','KeyS');
    const right=direction('KeyD','KeyA');
    const stride=walkSpeed*elapsed/Math.max(1,Math.hypot(forward,right));
    move(forward,right,stride);
    changeHeight(direction('KeyE','KeyQ')*verticalSpeed*elapsed);
    const position=camera.position;
    const floor=floorAt(position.x,position.z);
    const nextFloor=T.MathUtils.lerp(eyeFloor,floor,1-Math.exp(-elapsed*16));
    const nextY=Math.max(nextFloor+heightAboveGround,floor+.55);
    if(nextY===position.y||canOccupy(position.x,nextY,position.z,floor)){
      eyeFloor=nextFloor;
      position.y=nextY;
    }
  }

  return {setActive,update};
}
