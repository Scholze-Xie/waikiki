import * as T from 'three';
import { woodlandHeight } from './woodland';

const actions=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);

export function createDiveControls(canvas:HTMLCanvasElement,camera:T.PerspectiveCamera,
  blocked:(position:T.Vector3)=>boolean){
  const keys=new Set<string>();
  const touches=new Map<number,string>();
  const panel=document.querySelector<HTMLElement>('#dive-pad');
  const rotation=new T.Euler(0,0,0,'YXZ');
  const desired=new T.Vector3(),velocity=new T.Vector3(),candidate=new T.Vector3();
  let active=false;
  let drag:number|null=null;
  let previousX=0,previousY=0;
  const touchActions=new Set<string>();
  const clear=()=>{keys.clear();touches.clear();drag=null;velocity.set(0,0,0);};
  window.addEventListener('blur',clear);
  window.addEventListener('keydown',event=>{
    if(!active||!actions.has(event.code)||event.target!==canvas)return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  canvas.addEventListener('blur',()=>keys.clear());
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
    rotation.x=T.MathUtils.clamp(rotation.x-(event.clientY-previousY)*.004,-1.38,1.38);
    previousX=event.clientX;
    previousY=event.clientY;
  });
  canvas.addEventListener('lostpointercapture',event=>{if(drag===event.pointerId)drag=null;});
  for(const button of panel?.querySelectorAll<HTMLButtonElement>('button')??[]){
    const action=button.dataset.swim!;
    button.addEventListener('pointerdown',event=>{
      if(!active||event.button!==0)return;
      event.preventDefault();
      touches.set(event.pointerId,action);
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('lostpointercapture',event=>touches.delete(event.pointerId));
    button.addEventListener('pointercancel',event=>touches.delete(event.pointerId));
    button.addEventListener('keydown',event=>{
      if(active&&(event.code==='Space'||event.code==='Enter')){event.preventDefault();keys.add(action);}
    });
    button.addEventListener('keyup',event=>{
      if(event.code==='Space'||event.code==='Enter')keys.delete(action);
    });
    button.addEventListener('blur',()=>keys.delete(action));
  }
  function setActive(next:boolean){
    if(next===active)return;
    active=next;
    if(panel)panel.hidden=!active;
    clear();
    if(active){
      rotation.setFromQuaternion(camera.quaternion,'YXZ');
      canvas.focus({preventScroll:true});
    }
  }
  function update(delta:number){
    touchActions.clear();
    for(const action of touches.values())touchActions.add(action);
    const held=(code:string)=>keys.has(code)||touchActions.has(code);
    const forward=Number(held('KeyW'))-Number(held('KeyS'));
    const right=Number(held('KeyD'))-Number(held('KeyA'));
    const vertical=Number(held('KeyE'))-Number(held('KeyQ'));
    rotation.y+=(Number(held('ArrowLeft'))-Number(held('ArrowRight')))*delta*1.65;
    rotation.x=T.MathUtils.clamp(rotation.x+(Number(held('ArrowUp'))-Number(held('ArrowDown')))*delta*1.65,-1.38,1.38);
    const sin=Math.sin(rotation.y),cos=Math.cos(rotation.y);
    desired.set(right*cos-forward*sin,vertical*.66,-right*sin-forward*cos);
    if(desired.lengthSq()>1)desired.normalize();
    velocity.lerp(desired.multiplyScalar(2.8),1-Math.exp(-delta*5));
    camera.rotation.copy(rotation);
    candidate.copy(camera.position);
    // Test each axis independently so swimmers slide along the reef boundary.
    for(const axis of ['x','z','y'] as const){
      candidate[axis]+=velocity[axis]*delta;
      candidate.x=T.MathUtils.clamp(candidate.x,15.9,33.2);
      candidate.z=T.MathUtils.clamp(candidate.z,-16.9,.2);
      candidate.y=T.MathUtils.clamp(candidate.y,woodlandHeight(candidate.x,candidate.z)+.65,-.60);
      if(!blocked(candidate))camera.position.copy(candidate);
      else{candidate.copy(camera.position);velocity[axis]=0;}
    }
  }
  return {setActive,update};
}
