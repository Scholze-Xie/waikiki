import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import clownfishUrl from './assets/clownfish.glb?url';
import * as T from 'three';
import { woodlandHeight } from './woodland';
import { waterHeight } from './waves';
import {createStoneMaterial} from './stone-material';

function channel(x:number){
  return -8+.60*Math.sin((x-23)*.24);
}

export function createReef(scene:T.Scene){
  const reef=new T.Group();
  scene.add(reef);
  const rockMaterial=createStoneMaterial({roughness:.88,flatShading:true},1.4);
  const coralMaterial=new T.MeshStandardMaterial({roughness:.94,flatShading:true});
  const colonies=72, stems=5;
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),rockMaterial,colonies);
  const coral=new T.InstancedMesh(new T.CylinderGeometry(.58,1,1,6),coralMaterial,colonies*stems*2);
  const model=new T.Object3D();
  const color=new T.Color();
  const up=new T.Vector3(0,1,0);
  const axis=new T.Vector3();
  const palette=[0xe78864,0xb37297,0xe3af6d,0xbf614d];
  const obstacles:{x:number;z:number;radius:number;top:number}[]=[];
  let branchIndex=0;
  for(let i=0;i<colonies;i++){
    const x=17.4+(i%9)*1.75+.62*Math.sin(i*7.7);
    const row=Math.floor(i/9);
    const side=row<4?-1:1;
    const bank=row%4;
    const z=channel(x)+side*(2.55+bank*1.49+.34*Math.cos(i*4.3));
    const y=woodlandHeight(x,z);
    const size=.48+.61*Math.sin(i*9.3)**2;
    model.position.set(x,y+.11,z);
    model.rotation.set(.2,i*2.399,.11);
    model.scale.set(size*1.37,size*.73,size);
    model.updateMatrix();
    rocks.setMatrixAt(i,model.matrix);
    rocks.setColorAt(i,color.set([0x65695b,0x827761,0x6f8072][i%3]));
    let top=y+size*.8;
    for(let b=0;b<stems;b++){
      const angle=b*2.399+i;
      const height=Math.min((-1.25-y-size*.42)/1.15,(b===0?2.29:1.45+.36*Math.sin(i+b))*(.72+.58*size));
      axis.set(Math.cos(angle)*.55,1,Math.sin(angle)*.55).normalize();
      model.position.set(x+axis.x*height*.46,y+size*.42+height*.46,z+axis.z*height*.46);
      model.quaternion.setFromUnitVectors(up,axis);
      model.scale.set(.127*size,height,.127*size);
      model.updateMatrix();
      coral.setMatrixAt(branchIndex,model.matrix);
      coral.setColorAt(branchIndex++,color.set(palette[i%palette.length]));
      const twigLength=height*.37;
      model.position.addScaledVector(axis,height*.36);
      axis.set(Math.cos(angle+.76)*.72,1,Math.sin(angle+.76)*.72).normalize();
      model.position.addScaledVector(axis,twigLength*.35);
      model.quaternion.setFromUnitVectors(up,axis);
      model.scale.set(.056*size,twigLength,.056*size);
      model.updateMatrix();
      coral.setMatrixAt(branchIndex,model.matrix);
      coral.setColorAt(branchIndex++,color.multiplyScalar(1.10));
      top=Math.max(top,model.position.y+twigLength*.5);
    }
    obstacles.push({x,z,radius:Math.max(size*1.32,1.16),top});
  }
  reef.add(rocks,coral);
  function blocked(position:T.Vector3){
    return obstacles.some(({x,z,radius,top})=>position.y<top+.27
      && (position.x-x)**2+(position.z-z)**2<(radius+.20)**2);
  }

  const schoolSize=7,fishCount=42;
  const bubbles=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),
    new T.MeshBasicMaterial({color:0xc1eee6,transparent:true,opacity:.36,depthWrite:false}),27);
  reef.add(bubbles);
  bubbles.frustumCulled=false;
  bubbles.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const fishPositions=Array.from({length:fishCount},()=>new T.Vector3());
  const net=new T.Vector3(),flow=new T.Vector3();
  const fishYaws=new Float32Array(fishCount);
  const clownfish:{root:T.Group;mixer:T.AnimationMixer}[]=[];
  let requestedClownfish=false;

  function loadClownfish(){
    requestedClownfish=true;
    new GLTFLoader().loadAsync(clownfishUrl).then(({scene,animations})=>{
      const swim=T.AnimationClip.findByName(animations,'swim');
      if(!swim)throw new Error('Clownfish swim animation is missing');
      const bounds=new T.Box3().setFromObject(scene);
      const center=bounds.getCenter(new T.Vector3());
      const length=bounds.getSize(new T.Vector3()).z;
      if(!Number.isFinite(length)||length<=0)throw new Error('Clownfish model has invalid bounds');
      for(let i=0;i<fishCount;i++){
        const root=new T.Group();
        const fish=clone(scene);
        fish.position.sub(center);
        root.scale.setScalar((.53+(i%3)*.07)/length);
        root.visible=false;
        root.add(fish);
        const mixer=new T.AnimationMixer(fish);
        const action=mixer.clipAction(swim);
        action.time=swim.duration*((i*.618)%1);
        action.play();
        reef.add(root);
        clownfish.push({root,mixer});
      }
      previousTime=-1;
    }).catch(error=>console.warn('Unable to load reef clownfish',error));
  }

  let previousTime=-1;
  function update(time:number,underwater:boolean,diver:T.Vector3|null){

    reef.visible=underwater;
    if(!underwater){previousTime=-1;return;}
    if(!requestedClownfish)loadClownfish();
    const dt=previousTime<0?0:T.MathUtils.clamp(time-previousTime,0,.1);
    previousTime=time;
    for(let i=0;i<clownfish.length;i++){
      const school=Math.floor(i/schoolSize);
      const radius=4.1+school*.38;
      const crossing=school%2===1;
      const angle=time*(crossing?.30:.40)+school*1.7+(i%schoolSize)*.21;
      const baseX=24.5+Math.cos(angle)*radius;
      const span=(crossing?3.25:1.75)+school*.10;
      const baseZ=channel(baseX)+Math.sin(angle)*span+(i%3-1)*.30;
      net.set(baseX,-2.4-school*.31+.22*Math.sin(angle*2+i),baseZ);
      if(diver){
        flow.subVectors(net,diver);
        const distance=flow.length();
        if(distance<2.4&&distance>.001){
          net.addScaledVector(flow,(1-T.MathUtils.smoothstep(distance,0,2.4))*.82/distance);
        }
      }
      for(const obstacle of obstacles){
        const dx=net.x-obstacle.x,dz=net.z-obstacle.z;
        if(dx*dx+dz*dz<(obstacle.radius+.30)**2)net.y=Math.max(net.y,obstacle.top+.44);
      }
      net.y=Math.min(-.64,net.y);
      const position=fishPositions[i];
      if(dt===0){
        position.copy(net);
        fishYaws[i]=Math.atan2(-Math.sin(angle)*radius,Math.cos(angle)*span);
      }else{
        flow.subVectors(net,position);
        if(flow.x*flow.x+flow.z*flow.z>.001){
          const heading=Math.atan2(flow.x,flow.z);
          const difference=T.MathUtils.euclideanModulo(heading-fishYaws[i]+Math.PI,Math.PI*2)-Math.PI;
          fishYaws[i]+=difference*(1-Math.exp(-dt*7));
        }
        position.lerp(net,1-Math.exp(-dt*3.8));
      }
      let {x,y,z}=position;
      for(const obstacle of obstacles){
        if((x-obstacle.x)**2+(z-obstacle.z)**2<(obstacle.radius+.32)**2)
          y=Math.max(y,Math.min(-.61,obstacle.top+.38));
      }
      const yaw=fishYaws[i];
      const clown=clownfish[i];
      clown.root.position.set(x,y,z);
      clown.root.rotation.set(0,yaw,.06*Math.sin(time*6+i));
      clown.root.visible=true;
      clown.mixer.update(dt);
    }
    for(let i=0;i<bubbles.count;i++){
      const age=(time*.23+i*.371)%1;
      const x=26+(i%4)*.56+age*.6*Math.sin(i*2+age*6);
      const z=-5+(i%7)*.38+age*.62;
      const y=T.MathUtils.lerp(-5.4,waterHeight(x,z,time)-.1,age);
      const scale=(.019+.024*Math.sin(i*7)**2)*Math.sin(Math.PI*age)**.45;
      model.position.set(x,y,z);
      model.rotation.set(0,0,0);
      model.scale.setScalar(scale);
      model.updateMatrix();
      bubbles.setMatrixAt(i,model.matrix);
    }
    bubbles.instanceMatrix.needsUpdate=true;
  }
  return {update,blocked};
}
