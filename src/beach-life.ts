import * as T from 'three';
import { coast, shoreEdge } from './waves';
import { woodlandHeight } from './woodland';

function scallop(){
  const vertices=[0,.018,-.145],colors=[.64,.55,.46],indices:number[]=[];
  const segments=40, radial=5;
  for(let ring=1;ring<=radial+1;ring++){
    const rim=ring>radial;
    const t=Math.min(1,ring/radial);
    const start=vertices.length/3;
    for(let i=0;i<=segments;i++){
      const across=i/segments;
      const angle=(across-.5)*2.42;
      const rib=.5+.5*Math.cos(across*Math.PI*20);
      const length=(rim?.282:.294)*t*(1+.065*rib);
      const crown=.074*Math.sin(t*Math.PI)*(.65+.35*Math.cos(angle));
      const height=rim?.004:.023+crown-.008*t+.021*t*rib;
      vertices.push(Math.sin(angle)*length,height,Math.cos(angle)*length-.145);
      const shade=rim?.72:.66+.22*t+.12*rib-.055*Math.sin(t*Math.PI*3)**2;
      colors.push(shade,shade*(.9+.1*t),shade*(.79+.21*t));
      if(i===0)continue;
      const outer=start+i;
      if(ring===1){
        indices.push(0,outer-1,outer);
      }else{
        const inner=outer-segments-1;
        indices.push(inner-1,outer-1,outer,inner-1,outer,inner);
      }
    }
  }
  const stride=segments+1;
  const lastRing=1+radial*stride;
  const edge=[0];
  for(let start=1;start<lastRing;start+=stride)edge.push(start);
  for(let i=0;i<=segments;i++)edge.push(lastRing+i);
  for(let start=lastRing-stride;start>=1;start-=stride)edge.push(start+segments);
  const underside=vertices.length/3;
  vertices.push(0,0,.014);
  colors.push(.61,.55,.48);
  for(let i=0;i<edge.length;i++)indices.push(edge[(i+1)%edge.length],edge[i],underside);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function conch(){
  const vertices=[0,.042,-.17],colors=[.72,.65,.58],indices:number[]=[];
  const segments=12, whorlRings=16;
  const mouthRadius=.114, mouthHeight=.083, mouthZ=.162;
  function addRing(sample:(angle:number)=>[number,number,number,number]){
    const start=vertices.length/3;
    for(let i=0;i<segments;i++){
      const [x,y,z,shade]=sample(i/segments*Math.PI*2);
      const next=(i+1)%segments;
      vertices.push(x,y,z);
      colors.push(shade,shade*.95,shade*.9);
      if(start===1){
        indices.push(0,start+next,start+i);
      }else{
        const previous=start-segments;
        indices.push(previous+i,previous+next,start+next,previous+i,start+next,start+i);
      }
    }
  }
  for(let ring=1;ring<=whorlRings;ring++){
    const t=ring/whorlRings;
    const flare=T.MathUtils.smoothstep(t,.61,1);
    addRing(angle=>{
      const seam=Math.cos(t*Math.PI*8-angle)*Math.sin(t*Math.PI);
      const radius=(.01+.071*t+.033*flare)*(1+.17*seam);
      const z=T.MathUtils.lerp(-.17,mouthZ,t)+flare*.026*Math.cos(angle);
      const shade=.78+.14*seam+.2*flare;
      return [Math.cos(angle)*radius,T.MathUtils.lerp(.043,mouthHeight,t)+Math.sin(angle)*radius*.61,z,shade];
    });
  }
  // Follow the rolled mouth inward, so the edge has a lit lip and a recessed throat.
  for(const [scale,depth,shade] of [[.97,.008,1],[.77,.006,.88],[.65,-.029,.52],[.39,-.064,.37]]){
    addRing(angle=>[
      Math.cos(angle)*mouthRadius*scale,
      mouthHeight+Math.sin(angle)*mouthRadius*scale*.61,
      mouthZ+depth+.026*Math.cos(angle)*scale,
      shade,
    ]);
  }
  const throat=vertices.length/3;
  vertices.push(0,mouthHeight,mouthZ-.092);
  colors.push(.32,.29,.26);
  for(let i=0;i<segments;i++)indices.push(throat-segments+i,throat-segments+(i+1)%segments,throat);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function terrainSampler(terrain:T.PlaneGeometry){
  const {widthSegments,heightSegments}=terrain.parameters;
  const positions=terrain.getAttribute('position');
  const rowSize=widthSegments+1;
  const left=positions.getX(0),near=positions.getZ(0);
  const stepX=(positions.getX(widthSegments)-left)/widthSegments;
  const stepZ=(positions.getZ(heightSegments*rowSize)-near)/heightSegments;
  return (x:number,z:number)=>{
    const tileX=T.MathUtils.clamp((x-left)/stepX,0,widthSegments);
    const tileZ=T.MathUtils.clamp((z-near)/stepZ,0,heightSegments);
    const column=Math.min(widthSegments-1,Math.floor(tileX));
    const row=Math.min(heightSegments-1,Math.floor(tileZ));
    const u=tileX-column,v=tileZ-row;
    const index=row*rowSize+column;
    const a=positions.getY(index),b=positions.getY(index+rowSize);
    const c=positions.getY(index+rowSize+1),d=positions.getY(index+1);
    // Use the same diagonal as the rendered PlaneGeometry cell.
    return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
  };
}

export function createBeachLife(scene:T.Scene,terrain:T.PlaneGeometry){
  const shellMaterial=new T.MeshStandardMaterial({roughness:.72,vertexColors:true});
  const model=new T.Object3D(),color=new T.Color();
  const sandHeight=terrainSampler(terrain);
  const shellNormal=new T.Vector3(),shellVertex=new T.Vector3(),shellUp=new T.Vector3(0,1,0);
  const shellColors=[0xffebc8,0xe9bb91,0xf3d1b9,0xffe3aa,0xd99b7f];
  [scallop(),conch()].forEach((geometry,kind)=>{
    const shells=new T.InstancedMesh(geometry,shellMaterial,28);
    const vertices=geometry.getAttribute('position');
    for(let i=0;i<shells.count;i++){
      const cluster=Math.floor(i/4);
      const z=-17+cluster*5.3+1.35*Math.sin(i*2.39+kind);
      const x=coast(z)-1.25-(i%4)*.43-.35*Math.sin(cluster*2+kind);
      const dx=(sandHeight(x+.07,z)-sandHeight(x-.07,z))/.14;
      const dz=(sandHeight(x,z+.07)-sandHeight(x,z-.07))/.14;
      shellNormal.set(-dx,1,-dz).normalize();
      model.position.set(x,0,z);
      model.quaternion.setFromUnitVectors(shellUp,shellNormal);
      model.rotateY(i*2.399+kind);
      model.scale.setScalar(.69+.69*Math.sin(i*4.6+kind)**2);
      model.updateMatrix();
      let contactHeight=-Infinity;
      for(let j=0;j<vertices.count;j++){
        shellVertex.fromBufferAttribute(vertices,j).applyMatrix4(model.matrix);
        contactHeight=Math.max(contactHeight,sandHeight(shellVertex.x,shellVertex.z)-shellVertex.y);
      }
      model.position.y=contactHeight-.015;
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
