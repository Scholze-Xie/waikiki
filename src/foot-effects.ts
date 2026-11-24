import * as T from 'three';
import { coast, sandHeight, shoreEdge, waterHeight } from './waves';

export function createFootEffects(scene:T.Scene){
  const capacity=96;
  function batch(geometry:T.BufferGeometry,color:number,count:number){
    const material=new T.MeshBasicMaterial({color,transparent:true,depthWrite:false,side:T.DoubleSide});
    const mesh=new T.InstancedMesh(geometry,material,count);
    const alpha=new T.InstancedBufferAttribute(new Float32Array(count),1);
    geometry.setAttribute('instanceOpacity',alpha);
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float instanceOpacity; varying float vInstanceOpacity;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.x *= sign(instanceOpacity); vInstanceOpacity = abs(instanceOpacity);');
      shader.fragmentShader='varying float vInstanceOpacity;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
        'diffuseColor.a *= vInstanceOpacity;\n#include <alphatest_fragment>');
    };
    mesh.count=0;
    mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(mesh);
    return {mesh,alpha};
  }
  const outline=new T.Shape();
  outline.moveTo(-.033,-.098);
  outline.quadraticCurveTo(-.069,-.04,-.041,.013);
  outline.quadraticCurveTo(-.072,.078,-.014,.117);
  outline.quadraticCurveTo(.068,.145,.065,.073);
  outline.quadraticCurveTo(.034,.013,.035,-.07);
  outline.quadraticCurveTo(.016,-.116,-.033,-.098);
  const printGeometry=new T.ShapeGeometry(outline);
  printGeometry.rotateX(-Math.PI/2);
  printGeometry.rotateY(Math.PI);
  const prints=batch(printGeometry,0x785239,capacity);
  const rings=batch(new T.RingGeometry(.82,1,24).rotateX(-Math.PI/2),0xe5fff7,capacity);
  const spray=batch(new T.IcosahedronGeometry(1,0),0xd9fbf7,capacity*5);
  const slots=Array.from({length:capacity},()=>({x:0,z:0,yaw:0,side:1,time:-100,wet:false,washed:Infinity}));
  const model=new T.Object3D();
  const normal=new T.Vector3(),forward=new T.Vector3(),right=new T.Vector3();
  const basis=new T.Matrix4();
  let cursor=0;
  function contact(x:number,z:number,yaw:number,side:number,time:number){
    const depth=coast(z)-x;
    const wet=shoreEdge(x,z,time)>=0&&waterHeight(x,z,time)>sandHeight(x,z)+.012;
    if(wet ? depth< -5.8||depth>.8 : depth<-.3||depth>2.6)return;
    Object.assign(slots[cursor],{x,z,yaw,side,time,wet,washed:Infinity});
    cursor=(cursor+1)%capacity;
  }
  function draw(batch:typeof prints,opacity:number){
    model.updateMatrix();
    batch.alpha.setX(batch.mesh.count,opacity);
    batch.mesh.setMatrixAt(batch.mesh.count++,model.matrix);
  }
  function update(time:number){
    prints.mesh.count=rings.mesh.count=spray.mesh.count=0;
    for(const slot of slots){
      const {x,z,yaw,side,time:started,wet}=slot;
      const age=time-started;
      if(age<0||age>(wet?.74:9))continue;
      if(wet){
        const wave=waterHeight(x,z,time);
        const radius=.075+age*.62;
        model.position.set(x,wave+.029,z);
        model.rotation.set(0,0,0);
        model.scale.set(radius,1,radius*.83);
        draw(rings,.54*(1-age/.74)**2);
        if(age>.49)continue;
        for(let i=0;i<5;i++){
          const angle=i*2.4+yaw+side*.4;
          const px=x+Math.cos(angle)*age*(.42+i*.06),pz=z+Math.sin(angle)*age*(.42+i*.06);
          const height=age*(1.42+i*.14)-4.2*age*age;
          if(height<=0)continue;
          model.position.set(px,waterHeight(px,pz,time)+.025+height,pz);
          const size=.024*(1-age/.55);
          model.scale.set(size,size*1.35,size);
          draw(spray,.77*(1-age/.49));
        }
      }else{
        if(shoreEdge(x,z,time)>=0&&waterHeight(x,z,time)>sandHeight(x,z)+.012)slot.washed=Math.min(slot.washed,time);
        const opacity=.46*(1-age/9)*Math.max(0,1-(Math.max(0,time-slot.washed))/.65);
        if(opacity<=0)continue;
        const dx=(sandHeight(x+.08,z)-sandHeight(x-.08,z))/.16;
        const dz=(sandHeight(x,z+.08)-sandHeight(x,z-.08))/.16;
        normal.set(-dx,1,-dz).normalize();
        forward.set(Math.sin(yaw),0,Math.cos(yaw));
        forward.addScaledVector(normal,-forward.dot(normal)).normalize();
        right.crossVectors(normal,forward);
        model.quaternion.setFromRotationMatrix(basis.makeBasis(right,normal,forward));
        model.position.set(x,sandHeight(x,z)+.012,z);
        model.scale.set(1,1,1);
        draw(prints,opacity*side);
      }
    }
    for(const {mesh,alpha} of [prints,rings,spray]){
      mesh.instanceMatrix.needsUpdate=true;
      alpha.needsUpdate=true;
    }
  }
  return {contact,update};
}
