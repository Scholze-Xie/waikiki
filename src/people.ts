import * as T from 'three';
import {createFootEffects} from './foot-effects';
import {box,surfboard} from './environment';
import {makePerson,shaveIceCup,shaveIceSpoon,spoonReach} from './character-model';
import {crest,cycle,sandHeight,waterHeight} from './waves';

export type Role='carrier'|'customer'|'surfer';
type Person = ReturnType<typeof makePerson>;

const smooth=T.MathUtils.smoothstep;
const lerp=T.MathUtils.lerp;
const down=new T.Vector3(0,-1,0);
const up=new T.Vector3(0,1,0);
const forward=new T.Vector3(0,0,1);
const across=new T.Vector3(1,0,0);
const paddlePoles=[new T.Vector3(-1,.2,.25),new T.Vector3(1,.2,.25)];
const direction=new T.Vector3(), bendDirection=new T.Vector3(), bend=new T.Vector3();
const inverse=new T.Quaternion(), footHeading=new T.Quaternion(), footPitch=new T.Quaternion();
const initialUpper=new T.Quaternion(), initialJoint=new T.Quaternion();
const strideStart=new T.Vector3(), strideEnd=new T.Vector3(), ankle=new T.Vector3();
const lastStep=new WeakMap<T.Group,number>();
type Contact=ReturnType<typeof createFootEffects>['contact'];
type Path=(time:number,position:T.Vector3)=>number;
type Walk={path:Path; period:number; phase:number; effort:number; lift:number};

function solveLimb(upper:T.Group,joint:T.Group,end:T.Group,target:T.Vector3,pole:T.Vector3,weight=1){
  if(weight<=0)return;
  initialUpper.copy(upper.quaternion);
  initialJoint.copy(joint.quaternion);
  const first=-joint.position.y, second=-end.position.y;
  upper.parent!.worldToLocal(direction.copy(target)).sub(upper.position);
  const distance=T.MathUtils.clamp(direction.length(),Math.abs(first-second)+.001,first+second-.001);
  direction.normalize();
  bendDirection.copy(pole).addScaledVector(direction,-pole.dot(direction)).normalize();
  const offset=(first*first-second*second+distance*distance)/(2*distance);
  bend.copy(direction).multiplyScalar(offset)
    .addScaledVector(bendDirection,Math.sqrt(Math.max(0,first*first-offset*offset)));
  upper.quaternion.setFromUnitVectors(down,bendDirection.copy(bend).normalize());
  const lower=direction.multiplyScalar(distance).sub(bend).normalize();
  lower.applyQuaternion(inverse.copy(upper.quaternion).invert());
  joint.quaternion.setFromUnitVectors(down,lower);
  upper.quaternion.slerp(initialUpper,1-weight);
  joint.quaternion.slerp(initialJoint,1-weight);
}

function footAnchor(path:Path,time:number,side:number,target:T.Vector3){
  const yaw=path(time,target);
  target.x+=side*Math.cos(yaw);
  target.z-=side*Math.sin(yaw);
  return yaw;
}

function groundPose(p:Person,time:number,offset:number,shoes:boolean,walk?:Walk,contact?:Contact){
  const phase=walk?time/walk.period+walk.phase:0;
  const effort=walk?.effort??0;
  const rhythm=phase*Math.PI*2;
  const breath=Math.sin(time*2.1+offset);
  const weightShift=.027*Math.sin(time*.86+offset)*(1-effort);
  const stride=Math.sin(rhythm);
  const hipHeight=walk?.676+(.017*stride**2-.038)*effort:.731;
  p.body.position.set(weightShift-.022*stride*effort,hipHeight+.006*breath,0);
  p.body.rotation.set(.055*effort+.017*breath,.10*stride*effort,-.043*stride*effort+.85*weightShift);
  p.head.rotation.set(-.033*effort+.023*breath,-.07*stride*effort+.17*Math.sin(time*.63+offset)*(1-.65*effort),.45*weightShift);
  p.legs.forEach(({upper,knee,foot},i)=>{
    const side=upper.position.x*upper.parent!.scale.x*p.root.scale.x;
    const footPhase=phase+i*.5;
    const step=Math.floor(footPhase);
    const stance=.60;
    const swing=smooth(footPhase-step,stance,1);
    let yaw=p.root.rotation.y;
    let pitch=0;
    if(walk){
      // Sample the path at a fixed time so the supporting foot stays planted.
      const midpoint=(step-walk.phase-i*.5+stance*.5)*walk.period;
      yaw=footAnchor(walk.path,midpoint,side,strideStart);
      const nextYaw=footAnchor(walk.path,midpoint+walk.period,side,strideEnd);
      ankle.lerpVectors(strideStart,strideEnd,swing);
      yaw+=Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw))*swing;
      pitch=Math.sin(swing*Math.PI*2)*.26*effort;
      const previous=lastStep.get(foot);
      if(contact&&previous!==undefined&&previous!==step&&effort>.12){
        contact(ankle.x,ankle.z,yaw,i===0?-1:1,time);
      }
      lastStep.set(foot,step);
    }else{
      p.root.localToWorld(ankle.set(side/p.root.scale.x,0,i===0?.055:-.035));
    }
    const lift=(walk?.lift??0)*Math.sin(Math.PI*swing)*effort;
    ankle.y=sandHeight(ankle.x,ankle.z)+((shoes?.056:.049)+lift)*p.root.scale.y;
    solveLimb(upper,knee,foot,ankle,forward);
    footHeading.setFromAxisAngle(up,yaw).multiply(footPitch.setFromAxisAngle(across,pitch));
    foot.quaternion.copy(knee.getWorldQuaternion(inverse).normalize().invert().multiply(footHeading));
  });
  p.arms.forEach(({upper,elbow},i)=>{
    const counter=Math.cos(rhythm+i*Math.PI-.25)*effort;
    upper.rotation.set(.29*counter+.034*breath,0,(i===0?-1:1)*(.13+.06*effort));
    elbow.rotation.set(-.19-.24*Math.max(0,-counter),0,0);
  });
}

function carrierPath(time:number,position:T.Vector3){
  const stroll=T.MathUtils.euclideanModulo(time+3,19);
  const progress=smooth(stroll,0,8)-smooth(stroll,9.5,17.5);
  position.set(lerp(-6.1,.82,progress),0,3.9+.9*Math.sin(progress*1.6));
  const turn=smooth(stroll,8,9.5)+smooth(stroll,17.5,19);
  return Math.atan2(6.92,1.44*Math.cos(progress*1.6))+Math.PI*turn;
}

function placeOnSand(person:Person,time:number,path:Path){
  const position=person.root.position;
  person.root.rotation.y=path(time,position);
  position.y=sandHeight(position.x,position.z);
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
  const carryWalk:Walk={path:carrierPath,period:.84,phase:0,effort:0,lift:.125};
  const grip=carrier.arms[1];
  const gripPole=new T.Vector3(.9,-.4,.1);
  const customer=makePerson(scene,{
    shirt:0x229989,shorts:0xebaa39,skin:0xad613f,hair:0x291f22,
    haircut:'bun',print:'stripes',shoes:0x693b44,scale:.94,width:.90
  });
  const cupArm=customer.arms[1], spoonArm=customer.arms[0];
  const dessert=shaveIceCup(cupArm.hand,false);
  dessert.position.set(.02,.023,.036);
  const spoon=shaveIceSpoon(spoonArm.hand);
  const cupPole=new T.Vector3(1,-.8,-.1), spoonPole=new T.Vector3(-1,-.8,-.12);
  const handTarget=new T.Vector3(), scoopPoint=new T.Vector3(), mouthPoint=new T.Vector3();
  const utensilAim=new T.Vector3(), handOrientation=new T.Quaternion();
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
  const deckTarget=new T.Vector3();
  const crowdData=[
    [-13.3,2.6,0x4794ae],[-11,4.8,0xe2ab38],[-4.7,-.62,0xcf684f],[-5.6,-2.9,0x397e9f],
    [-4.6,8.4,0x1d8f80],[-1.5,-5.2,0xf4aa52],[2.8,-2.4,0x214675],[3.9,-9.1,0xe5684a]
  ];
  const crowd=crowdData.map(([x,z,color],i)=>{
    const person=makePerson(scene,{
      shirt:color,shorts:i%2?0x215677:0xbc573f,skin:[0x8b4f33,0xd29261,0xe6ab80][i%3],
      hair:i%4===0?0x76452f:0x38251e,haircut:i%4===0?'bucket':i%3===0?'bun':i%2?'swept':'short',
      scale:.89+(i%4)*.045,width:i%2?.92:1.04
    });
    const heading=.3+i*1.33;
    const strolling=i%3!==0;
    const wading=x>2;
    const radius=wading?.64:1.05;
    const pace=.49+i*.027;
    const path:Path=(time,position)=>{
      const angle=heading+time*pace;
      position.set(x+(strolling?radius*Math.sin(angle):0),0,z+(strolling?radius*Math.cos(angle):0));
      return strolling?angle+Math.PI/2:heading;
    };
    const walk=strolling?{path,period:wading?1.35:1.10,phase:i*.37,effort:wading?.54:.69,lift:wading?.17:.115}:undefined;
    return {person,path,walk};
  });
  const subjects:Subject[]=[
    {id:'carrier',label:'Board carrier',person:carrier},
    {id:'customer',label:'Shave ice customer',person:customer},
    {id:'surfer',label:'Surfer',person:surfer}
  ];
  function update(time:number){
    const stroll=T.MathUtils.euclideanModulo(time+3,19);
    const outbound=T.MathUtils.clamp(stroll/8,0,1);
    const inbound=T.MathUtils.clamp((stroll-9.5)/8,0,1);
    const walking=4*(outbound*(1-outbound)+inbound*(1-inbound));
    const turning=Math.sin(Math.PI*smooth(stroll,8,9.5))+Math.sin(Math.PI*smooth(stroll,17.5,19));
    carryWalk.effort=.18+.82*Math.max(walking,.66*turning);
    placeOnSand(carrier,time,carrierPath);
    groundPose(carrier,time,0,true,carryWalk,feet.contact);
    const boardSway=Math.sin(time/carryWalk.period*Math.PI*2-.45)*carryWalk.effort;
    board.rotation.set(-Math.PI*.49+.055*boardSway,.035*boardSway,-.09);
    solveLimb(grip.upper,grip.elbow,grip.hand,board.localToWorld(handTarget.copy(boardContact)),gripPole);

    const cx=-5.75,cz=1.27;
    customer.root.position.set(cx,sandHeight(cx,cz),cz);
    customer.root.rotation.y=-1.10;
    groundPose(customer,time,1.3,true);
    const bite=(time+1.4)%6.8;
    const scoop=smooth(bite,.65,1.42)-smooth(bite,1.48,1.98);
    const taste=smooth(bite,1.50,2.55)-smooth(bite,2.96,4.02);
    const watching=smooth(bite,.15,.9)-smooth(bite,3.65,4.6);
    customer.head.rotation.x+=.21*watching-.13*taste+.045*Math.sin(bite*15)*(smooth(bite,2.58,2.74)-smooth(bite,3.1,3.52));
    customer.head.rotation.y=lerp(customer.head.rotation.y,.24,watching*(1-taste));

    customer.root.localToWorld(handTarget.set(.19-.05*watching,1.01+.028*watching,.32));
    solveLimb(cupArm.upper,cupArm.elbow,cupArm.hand,handTarget,cupPole);
    cupArm.hand.quaternion.copy(cupArm.elbow.getWorldQuaternion(inverse).normalize().invert()
      .multiply(customer.root.quaternion));

    dessert.localToWorld(scoopPoint.set(-.031,.165-.056*scoop,.03));
    customer.head.localToWorld(mouthPoint.set(-.012,-.07,.164));
    handTarget.copy(scoopPoint).lerp(mouthPoint,taste);
    customer.root.localToWorld(utensilAim.set(-.093,lerp(.19,.055,taste),lerp(.06,.21,taste)))
      .sub(customer.root.position).normalize();
    scoopPoint.copy(handTarget);
    handTarget.addScaledVector(utensilAim,spoonReach*customer.root.scale.x);
    solveLimb(spoonArm.upper,spoonArm.elbow,spoonArm.hand,handTarget,spoonPole);
    spoonArm.hand.getWorldPosition(handTarget);
    utensilAim.subVectors(scoopPoint,handTarget).normalize();
    handOrientation.setFromUnitVectors(up,utensilAim);
    spoonArm.hand.quaternion.copy(spoonArm.elbow.getWorldQuaternion(inverse).normalize().invert().multiply(handOrientation));

    crowd.forEach(({person,path,walk},i)=>{
      placeOnSand(person,time,path);
      groundPose(person,time,i*1.37,false,walk,feet.contact);
    });

    feet.update(time);
    const t=time%cycle;
    const standing=smooth(t,2.74,3.68)*(1-smooth(t,8.55,9.65));
    const feetOnDeck=smooth(t,2.43,3.1)*(1-smooth(t,9.22,9.99));
    const handsOnDeck=(smooth(t,1.8,2.25)-smooth(t,2.60,3.18))
      +(smooth(t,9.16,9.66)-smooth(t,10.0,10.65));
    const crouch=(smooth(t,2.15,2.72)-smooth(t,2.99,3.77))
      +(smooth(t,8.65,9.24)-smooth(t,9.55,10.4));
    const turn=.73*Math.sin(t*1.55)+.27*Math.sin(t*2.48+.8);
    const catching=smooth(t,0,1.1)*(1-smooth(t,8.5,12));
    const sZ=-6+4.4*Math.sin(t*Math.PI/6);
    const sX=lerp(18.4+.8*Math.sin(-6*.12),crest(time)-.60+.8*Math.sin(sZ*.12)+.36*turn*standing,catching);
    const y=waterHeight(sX,sZ,time);
    rig.position.set(sX,y+.115,sZ);
    const yaw=-.32+standing*(-.23+turn*.42);
    const noseX=Math.sin(yaw)*.72, noseZ=Math.cos(yaw)*.72;
    const pitch=(waterHeight(sX+noseX,sZ+noseZ,time)-waterHeight(sX-noseX,sZ-noseZ,time))/1.44;
    rig.rotation.set(-.32*pitch+.045*standing*Math.sin(t*1.18),yaw,standing*(.18*turn-.055),'YXZ');
    const compression=standing*(.036+.042*turn**2);
    const stance=smooth(t,2.37,3.28)*(1-smooth(t,9.45,10.31));
    surfer.root.rotation.y=Math.PI-2.17*stance;
    surfer.body.position.set(.073*standing*turn,.184+.51*standing+crouch*(.24-.16*standing)-compression,
      -.13+.15*stance-.085*crouch);
    surfer.body.rotation.set(lerp(1.43,.13,standing)-.63*crouch*(1-standing),
      -.15*turn*standing,.17*turn*standing);
    surfer.head.rotation.set(-.45*(1-standing)+.06*standing-.16*crouch,
      standing*(.47+.18*turn),-.085*standing*turn);
    surfer.focus.position.set(0,.43+.78*standing+.22*crouch,0);
    surfer.hit.position.y=.43+.42*standing+.12*crouch;
    rig.getWorldQuaternion(deckOrientation);
    surfer.legs.forEach(({upper,knee,foot},i)=>{
      upper.rotation.set(-.13*(1-stance)+stance*(-.29+i*.17)-.33*crouch,0,(i===0?-1:1)*(.11+.08*stance));
      knee.rotation.set(.12+stance*(.35+i*.13)+.65*crouch,0,0);
      foot.rotation.set(.42*(1-stance),0,0);
      rig.localToWorld(deckTarget.set(i===0?-.105:.105,.146,i===0?.25:-.25));
      solveLimb(upper,knee,foot,deckTarget,forward,feetOnDeck);
      footHeading.copy(deckOrientation).multiply(surfer.root.quaternion);
      foot.quaternion.slerp(knee.getWorldQuaternion(inverse).normalize().invert().multiply(footHeading),feetOnDeck);
    });
    surfer.arms.forEach(({upper,elbow,hand},i)=>{
      const paddle=t/cycle*Math.PI*2*9+i*Math.PI;
      const side=i===0?-1:1;
      const recovery=smooth(Math.cos(paddle),-.30,.82);
      upper.rotation.set(lerp(.35+.82*Math.sin(paddle),-.33+.27*turn*side,standing),
        side*lerp(.14*recovery,.23*turn,standing),
        side*lerp(.22+.34*recovery,.88-.22*turn*side,standing));
      elbow.rotation.set(lerp(-.18-.80*recovery,-.43-.19*turn*side,standing),0,0);
      hand.rotation.set(lerp(-.15-.17*recovery,.27,handsOnDeck),0,standing*.13*turn*(1-handsOnDeck));
      if(handsOnDeck>0){
        const pushingUp=t<cycle/2;
        rig.localToWorld(deckTarget.set(pushingUp?-side*.20:.13+side*.04,.165,pushingUp?-.26:-side*.17));
        solveLimb(upper,elbow,hand,deckTarget,paddlePoles[i],handsOnDeck);
      }
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
