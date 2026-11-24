import * as T from 'three';
import {createFootEffects} from './foot-effects';
import {box,surfboard} from './environment';
import {makePerson,shaveIceCup} from './character-model';
import {coast,crest,cycle,sandHeight,waterHeight} from './waves';

export type Role='carrier'|'customer'|'surfer';
type Person = ReturnType<typeof makePerson>;

const smooth=T.MathUtils.smoothstep;
const lerp=T.MathUtils.lerp;
const down=new T.Vector3(0,-1,0);
const sole=new T.Vector3();
const planted=new WeakMap<T.Group,boolean>();
type Contact=ReturnType<typeof createFootEffects>['contact'];

function solveLimb(upper:T.Group,joint:T.Group,end:T.Group,target:T.Vector3,pole:T.Vector3){
  const first=-joint.position.y, second=-end.position.y;
  const direction=upper.parent!.worldToLocal(target.clone()).sub(upper.position);
  const distance=T.MathUtils.clamp(direction.length(),Math.abs(first-second)+.001,first+second-.001);
  direction.normalize();
  pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const offset=(first*first-second*second+distance*distance)/(2*distance);
  const bend=direction.clone().multiplyScalar(offset)
    .addScaledVector(pole,Math.sqrt(Math.max(0,first*first-offset*offset)));
  upper.quaternion.setFromUnitVectors(down,bend.clone().normalize());
  const lower=direction.multiplyScalar(distance).sub(bend).normalize();
  lower.applyQuaternion(upper.quaternion.clone().invert());
  joint.quaternion.setFromUnitVectors(down,lower);
}

function groundPose(p:Person,time:number,phase:number,strength:number,shoes:boolean,ground:(x:number,z:number)=>number,contact?:Contact){
  const rhythm=phase*Math.PI*2;
  p.body.position.set(.025*Math.sin(rhythm)*strength,.679+.026*Math.sin(rhythm)**2*strength
    +.004*Math.sin(time*2.4)*(1-strength),0);
  p.body.rotation.set(.04*strength,.075*Math.sin(rhythm)*strength,-.045*Math.sin(rhythm)*strength);
  p.head.rotation.set(-.025*strength+.018*Math.sin(time*2),-.045*Math.sin(rhythm)*strength+.12*Math.sin(time*.6),0);
  const rootOrientation=p.root.quaternion;
  p.legs.forEach(({upper,knee,foot},i)=>{
    const step=T.MathUtils.euclideanModulo(phase+i*.5,1);
    const stance=.61;
    const swing=T.MathUtils.clamp((step-stance)/(1-stance),0,1);
    const travel=step<stance?.5-step/stance:smooth(swing,0,1)-.5;
    const lift=.47*strength*Math.sin(Math.PI*swing)**2;
    const ankle=p.root.localToWorld(new T.Vector3(upper.position.x*upper.parent!.scale.x,0,.49*travel*strength));
    ankle.y=ground(ankle.x,ankle.z)+((shoes?.056:.049)+lift*.23)*p.root.scale.y;
    solveLimb(upper,knee,foot,ankle,new T.Vector3(0,0,1));
    const supporting=step<stance;
    if(contact&&supporting&&planted.get(foot)===false&&strength>.10){
      foot.getWorldPosition(sole);
      contact(sole.x,sole.z,p.root.rotation.y,i===0?-1:1,time);
    }
    planted.set(foot,supporting);
    const pitch=step<stance?-.17*smooth(step,.45,stance):-.17*(1-smooth(swing,0,.55));
    const heading=rootOrientation.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),pitch*strength));
    foot.quaternion.copy(knee.getWorldQuaternion(new T.Quaternion()).normalize().invert().multiply(heading));
  });
  p.arms.forEach(({upper,elbow},i)=>{
    const counter=Math.cos(rhythm+i*Math.PI)*strength;
    upper.rotation.set(.23*counter+.025*Math.sin(time*2.4),0,i===0?-.12:.12);
    elbow.rotation.set(-.18-.16*Math.max(0,-counter),0,0);
  });
}

export type Subject={id:Role; label:string; person:Person};
export function createPeople(scene:T.Scene){
  const feet=createFootEffects(scene);
  const carrier=makePerson(scene,{
    shirt:0xca4d38,shorts:0x193d59,skin:0xb97245,hair:0x36281e,
    haircut:'bucket',print:'hibiscus',shoes:0x26475a,scale:1.04
  });
  const board=surfboard(carrier.body,0xf7b938,0x167988);
  board.position.set(.52,.025,.37);board.rotation.set(-Math.PI*.49,0,-.09);board.scale.setScalar(.77);
  const customer=makePerson(scene,{
    shirt:0x229989,shorts:0xebaa39,skin:0xad613f,hair:0x291f22,
    haircut:'bun',print:'stripes',shoes:0x693b44,scale:.94,width:.90
  });
  const dessert=shaveIceCup(customer.arms[1].hand);
  dessert.position.set(.027,.043,.067);
  const surfer=makePerson(scene,{
    shirt:0xf4ac34,shorts:0x173e55,skin:0xc77d4b,hair:0x3c2821,
    haircut:'curls',print:'rashguard',width:1.07
  });
  const rig=new T.Group();scene.add(rig);rig.add(surfer.root);
  const ridingBoard=surfboard(rig,0xee573d,0xffe7ab);ridingBoard.rotation.x=-Math.PI/2;ridingBoard.scale.set(.74,.89,.8);
  const fin=box(rig,0x173b56,.04,.20,.21,0,-.16,.85);fin.rotation.x=-.23;
  const wake=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:0xe9fff1}),30);
  wake.frustumCulled=false;scene.add(wake);
  const drop=new T.Object3D();
  const tail=new T.Vector3();
  const boardContact=new T.Vector3(-.24,.11,-.10);
  const deckOrientation=new T.Quaternion();
  const crowdData=[
    [-13.3,2.6,0x4794ae],[-11,4.8,0xe2ab38],[-4.7,-.62,0xcf684f],[-5.6,-2.9,0x397e9f],
    [-4.6,8.4,0x1d8f80],[-1.5,-5.2,0xf4aa52],[2.8,-2.4,0x214675],[3.9,-9.1,0xe5684a]
  ];
  const crowd=crowdData.map(([x,z,color],i)=>({
    x,z,p:makePerson(scene,{
      shirt:color,shorts:i%2?0x215677:0xbc573f,skin:[0x8b4f33,0xd29261,0xe6ab80][i%3],
      hair:i%4===0?0x76452f:0x38251e,haircut:i%4===0?'bucket':i%3===0?'bun':i%2?'swept':'short',
      scale:.89+(i%4)*.045,width:i%2?.92:1.04
    })
  }));
  const subjects:Subject[]=[
    {id:'carrier',label:'Board carrier',person:carrier},
    {id:'customer',label:'Shave ice customer',person:customer},
    {id:'surfer',label:'Surfer',person:surfer}
  ];
  function update(time:number){
    const stroll=T.MathUtils.euclideanModulo(time+3,19);
    const outbound=stroll<8;
    const progress=outbound?stroll/8:1-(stroll-9.5)/8;
    const path=smooth(progress,0,1);
    const x=lerp(-6.1,.82,path),z=3.9+.9*Math.sin(path*1.6);
    carrier.root.position.set(x,sandHeight(x,z),z);
    const carrierTurn=smooth(stroll,8,9.5)-smooth(stroll,17.5,19);
    carrier.root.rotation.y=Math.atan2(6.92,1.44*Math.cos(path*1.6))+Math.PI*carrierTurn;
    const walking=4*T.MathUtils.clamp(progress,0,1)*(1-T.MathUtils.clamp(progress,0,1));
    groundPose(carrier,time,(outbound?path:2-path)*8,walking,true,sandHeight,feet.contact);
    const grip=carrier.arms[1];
    solveLimb(grip.upper,grip.elbow,grip.hand,board.localToWorld(boardContact.clone()),new T.Vector3(.9,-.4,.1));

    const cx=-5.75,cz=1.27;
    customer.root.position.set(cx,sandHeight(cx,cz),cz);
    customer.root.rotation.y=-1.10;
    groundPose(customer,time,0,0,true,sandHeight);
    const tasting=T.MathUtils.smoothstep(Math.sin(time*.88),.45,.98);
    const {upper:cupArm,elbow:cupElbow}=customer.arms[1];
    cupArm.rotation.x=-.36-.55*tasting;
    cupArm.rotation.z=.24-.31*tasting;
    cupElbow.rotation.x=-.92-.65*tasting;
    // Keep the cup upright through the shoulder and elbow motion.
    dessert.quaternion.copy(customer.arms[1].hand.getWorldQuaternion(new T.Quaternion()).normalize().invert()
      .multiply(customer.root.quaternion));
    customer.head.rotation.x=.17*tasting;
    customer.head.rotation.y=-.22*(1-tasting)+.19*Math.sin(time*.51);

    crowd.forEach(({x,z,p},i)=>{
      const wading=x>2;
      const heading=.3+i*1.33;
      const strolling=i%3!==0;
      const pace=time*.56+i;
      const radius=strolling?(wading?.52:.90):0;
      const angle=heading+pace;
      const xx=x+radius*Math.sin(angle),zz=z+radius*Math.cos(angle);
      const ground=wading?(px:number,pz:number)=>-.28+waterHeight(px,pz,time)*.4:sandHeight;
      p.root.position.set(xx,ground(xx,zz),zz);
      p.root.rotation.y=heading+(strolling?pace+Math.PI/2:0);
      groundPose(p,time,pace*radius/.52,strolling?(wading?.58:.88):0,false,ground,feet.contact);
      if(!strolling)p.head.rotation.y+=.20*Math.sin(time*.53+i);
    });

    feet.update(time);
    const t=time%cycle;
    const standing=T.MathUtils.smoothstep(t,2.2,3.35)*(1-T.MathUtils.smoothstep(t,8.6,10.1));
    const turn=Math.sin(t*2.1);
    const offshore=T.MathUtils.smoothstep(t,8.5,12);
    const sZ=-6+4.4*Math.sin(t*Math.PI/6);
    const sX=T.MathUtils.lerp(crest(time)-.60+.8*Math.sin(sZ*.12)+.36*turn*standing,18.4+.8*Math.sin(-6*.12),offshore);
    const y=waterHeight(sX,sZ,time);
    rig.position.set(sX,y+.115,sZ);
    rig.rotation.y=-.32+standing*(-.23+turn*.36);
    rig.rotation.z=standing*(.13*turn-.06);
    rig.rotation.x=.07*standing*Math.sin(t*1.18);
    const compress=Math.sin(standing*Math.PI)*.11+standing*(.046+.039*turn);
    surfer.root.rotation.y=Math.PI-2.17*standing;
    surfer.body.position.set(.045*standing*turn,.16+.55*standing-compress,-.12+.12*standing);
    surfer.head.rotation.x=-.38*(1-standing)+standing*.04;
    surfer.head.rotation.y=.48*standing+.12*standing*turn;
    surfer.body.rotation.x=1.46*(1-standing);
    surfer.body.rotation.z=standing*.16*turn;
    surfer.focus.position.set(0,.45+.83*standing,0);
    surfer.hit.position.y=.43+.42*standing;
    rig.getWorldQuaternion(deckOrientation);
    surfer.legs.forEach(({upper,knee,foot},i)=>{
      upper.rotation.set(standing*(-.29+i*.17),0,standing*(i===0?-.19:.19));
      knee.rotation.set(standing*(.47+i*.13)+compress*2.15,0,0);
      foot.rotation.set(0,0,0);
      const contact=smooth(standing,.55,.98);
      if(contact>0){
        const deck=rig.localToWorld(new T.Vector3(i===0?-.105:.105,.146,i===0?.25:-.25));
        const target=foot.getWorldPosition(new T.Vector3()).lerp(deck,contact);
        solveLimb(upper,knee,foot,target,new T.Vector3(0,.05,1));
        const heading=deckOrientation.clone().multiply(surfer.root.quaternion);
        foot.quaternion.slerp(knee.getWorldQuaternion(new T.Quaternion()).normalize().invert().multiply(heading),contact);
      }
    });
    surfer.arms.forEach(({upper,elbow},i)=>{
      const paddle=t/cycle*Math.PI*2*9+i*Math.PI;
      const recovery=smooth(Math.sin(paddle),-.25,.85);
      upper.rotation.x=(1-standing)*(.40+.84*Math.sin(paddle))+standing*(-.40+turn*(i===0?.16:-.16));
      upper.rotation.z=(i===0?-1:1)*(.16+(1-standing)*recovery*.24+standing*(.80+turn*(i===0?.12:-.12)));
      elbow.rotation.x=lerp(-.20-.63*recovery,-.48,standing);
    });
    rig.localToWorld(tail.set(0,0,1.09));
    for(let i=0;i<wake.count;i++){
      const age=(time*1.65+i/wake.count)%1;
      const wx=tail.x+age*1.6+Math.sin(i*21.1)*age*.7;
      const wz=tail.z+age*2.1+Math.cos(i*17.2)*age*.81;
      drop.position.set(wx,waterHeight(wx,wz,time)+Math.sin(Math.PI*age)*.64*standing,wz);
      drop.scale.setScalar((.02+.093*(1-age))*standing);
      drop.updateMatrix();
      wake.setMatrixAt(i,drop.matrix);
    }
    wake.instanceMatrix.needsUpdate=true;
  }
  return {subjects,update};
}