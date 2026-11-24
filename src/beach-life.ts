import * as T from 'three';
import { coast, shoreEdge } from './waves';
import { woodlandHeight } from './woodland';

function scallop(){
  const vertices:number[]=[],indices:number[]=[];
  const radial=6, ribs=40;
  for(let ring=0;ring<=radial;ring++){
    const t=ring/radial;
    for(let i=0;i<=ribs;i++){
      const angle=(i/ribs-.5)*2.16;
      const rib=.5+.5*Math.cos(i/ribs*Math.PI*20);
      const length=.28*t*(1+.041*rib);
      vertices.push(Math.sin(angle)*length,Math.sin(t*Math.PI)*.047+.017*t* rib,Math.cos(angle)*length-.13);
      if(ring>0&&i>0){
        const a=ring*(ribs+1)+i;
        indices.push(a-ribs-2,a-ribs-1,a,a-ribs-2,a,a-1);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function spiral(){
  const points:T.Vector3[]=[];
  for(let i=0;i<=42;i++){
    const t=i/42,angle=t*Math.PI*4.4;
    const radius=.011+.082*t;
    points.push(new T.Vector3(Math.cos(angle)*radius,.035+.047*(1-t),Math.sin(angle)*radius));
  }
  return new T.TubeGeometry(new T.CatmullRomCurve3(points),42,.028,6,false);
}

export function createBeachLife(scene:T.Scene){
  const shellMaterial=new T.MeshStandardMaterial({roughness:.72,side:T.DoubleSide});
  const model=new T.Object3D(),color=new T.Color();
  const shellColors=[0xffebc8,0xe9bb91,0xf3d1b9,0xffe3aa,0xd99b7f];
  [scallop(),spiral()].forEach((geometry,kind)=>{
    const shells=new T.InstancedMesh(geometry,shellMaterial,28);
    for(let i=0;i<shells.count;i++){
      const cluster=Math.floor(i/4);
      const z=-17+cluster*5.3+1.35*Math.sin(i*2.39+kind);
      const x=coast(z)-1.25-(i%4)*.43-.35*Math.sin(cluster*2+kind);
      const y=woodlandHeight(x,z);
      const dx=(woodlandHeight(x+.07,z)-woodlandHeight(x-.07,z))/.14;
      const dz=(woodlandHeight(x,z+.07)-woodlandHeight(x,z-.07))/.14;
      const normal=new T.Vector3(-dx,1,-dz).normalize();
      model.position.set(x,y+.012,z);
      model.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);
      model.rotateY(i*2.399+kind);
      model.scale.setScalar(.69+.69*Math.sin(i*4.6+kind)**2);
      model.updateMatrix();
      shells.setMatrixAt(i,model.matrix);
      shells.setColorAt(i,color.set(shellColors[(i+kind*2)%shellColors.length]));
    }
    shells.receiveShadow=true;
    scene.add(shells);
  });

  const crabs=[-13.4,-4.2,4.8,11.8,17.2].map((z,i)=>({
    z,x:coast(z)-1.9-i%2*.55,scale:.79+.13*i,phase:i*1.79,tint:[0xb94531,0xcc633b,0xc25236][i%3]
  }));
  const crabMaterial=new T.MeshStandardMaterial({roughness:.67});
  const ball=new T.SphereGeometry(1,12,8);
  const bodies=new T.InstancedMesh(ball,crabMaterial,crabs.length);
  const arms=new T.InstancedMesh(new T.CylinderGeometry(.69,1,1,6),crabMaterial,crabs.length*20);
  const claws=new T.InstancedMesh(ball,crabMaterial,crabs.length*4);
  const eyes=new T.InstancedMesh(ball,new T.MeshStandardMaterial({color:0x272221,roughness:.38}),crabs.length*2);
  for(const batch of [bodies,arms,claws,eyes]){
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    batch.frustumCulled=false;
    scene.add(batch);
  }
  for(let i=0;i<crabs.length;i++){
    color.set(crabs[i].tint);
    bodies.setColorAt(i,color);
    for(let j=0;j<4;j++)claws.setColorAt(i*4+j,color);
    for(let j=0;j<20;j++)arms.setColorAt(i*20+j,color);
  }
  const root=new T.Object3D();
  const from=new T.Vector3(),bend=new T.Vector3(),end=new T.Vector3(),direction=new T.Vector3();
  const up=new T.Vector3(0,1,0);
  function segment(index:number,a:T.Vector3,b:T.Vector3,width:number){
    direction.subVectors(b,a);
    model.position.addVectors(a,b).multiplyScalar(.5);
    model.scale.set(width,direction.length(),width);
    model.quaternion.setFromUnitVectors(up,direction.normalize());
    model.updateMatrix();
    arms.setMatrixAt(index,model.matrix);
  }
  function shape(batch:T.InstancedMesh,index:number,x:number,y:number,z:number,w:number,h:number,d:number,turn=0){
    model.position.set(x,y,z).applyMatrix4(root.matrix);
    model.rotation.set(0,root.rotation.y+turn,0);
    model.scale.set(w*root.scale.x,h*root.scale.x,d*root.scale.x);
    model.updateMatrix();
    batch.setMatrixAt(index,model.matrix);
  }
  return (time:number)=>{
    crabs.forEach(({x,z,scale,phase},i)=>{
      const path=time*(.53+i*.038)+phase;
      const zz=z+Math.sin(path)*(1.15+i*.11);
      const shore=coast(zz)-coast(z);
      const retreat=T.MathUtils.smoothstep(.25-shoreEdge(x+shore,zz,time),0,.8)*.68;
      const xx=x+shore+.34*Math.sin(path*2)-retreat;
      root.position.set(xx,woodlandHeight(xx,zz),zz);
      root.rotation.set(0,-Math.PI*.5+.25*Math.sin(path+1.1),0);
      root.scale.setScalar(scale);
      root.updateMatrix();
      const rhythm=Math.sin(path)*19+time*1.4;
      const bob=.021*Math.sin(rhythm*2);
      shape(bodies,i,0,.195+bob,0,.223,.103,.153);
      for(let side=0;side<2;side++){
        const sign=side===0?-1:1;
        for(let leg=0;leg<4;leg++){
          const step=rhythm+(leg+side)*Math.PI;
          const offset=(leg-1.5)*.084;
          from.set(sign*.13,.177+bob,offset).applyMatrix4(root.matrix);
          bend.set(sign*(.273+.03*Math.cos(leg)),.143,offset*1.45).applyMatrix4(root.matrix);
          end.set(sign*(.35+.058*Math.cos(step)),0,offset*1.73+.043*Math.sin(step)).applyMatrix4(root.matrix);
          end.y=woodlandHeight(end.x,end.z)+.014+.10*Math.max(0,Math.sin(step));
          const index=i*20+side*10+leg*2;
          segment(index,from,bend,.026*scale);
          segment(index+1,bend,end,.018*scale);
        }
        const lift=.052*Math.sin(time*2.5+phase+side);
        from.set(sign*.139,.192+bob,.105).applyMatrix4(root.matrix);
        bend.set(sign*.237,.176,.245).applyMatrix4(root.matrix);
        end.set(sign*.222,.204+lift,.32).applyMatrix4(root.matrix);
        segment(i*20+side*10+8,from,bend,.038*scale);
        segment(i*20+side*10+9,bend,end,.041*scale);
        shape(claws,i*4+side*2,sign*.222,.204+lift,.345,.082,.063,.092,sign*.3);
        shape(claws,i*4+side*2+1,sign*.183,.213+lift,.414,.041,.037,.071,-sign*.31);
        shape(eyes,i*2+side,sign*.092,.298+bob,.118,.027,.031,.028);
      }
    });
    for(const batch of [bodies,arms,claws,eyes])batch.instanceMatrix.needsUpdate=true;
  };
}
