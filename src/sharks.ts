import * as T from 'three';
import { waterHeight } from './waves';

const wakeSteps=22;
const wakeDuration=2.4;
const sharks=[
  {x:14,z:3,rx:3.2,rz:12,period:33,phase:.2,size:1},
  {x:14,z:3,rx:3.2,rz:12,period:33,phase:2.9,size:.8},
  {x:23,z:-2,rx:4.3,rz:16,period:43,phase:1.3,size:1.12}
];

function sample(shark:typeof sharks[number],time:number,point:T.Vector2,direction:T.Vector2){
  const angle=time*Math.PI*2/shark.period+shark.phase;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  point.set(shark.x+shark.rx*cos,shark.z+shark.rz*sin);
  direction.set(-shark.rx*sin,shark.rz*cos).normalize();
}

export function createSharks(scene:T.Scene){
  const outline=new T.Shape();
  outline.moveTo(-.54,-.21);
  outline.quadraticCurveTo(-.26,.04,.16,.59);
  outline.quadraticCurveTo(.23,.68,.21,.54);
  outline.quadraticCurveTo(.09,.18,.43,-.21);
  outline.closePath();
  const finGeometry=new T.ExtrudeGeometry(outline,{
    depth:.045,bevelThickness:.036,bevelSize:.024,bevelSegments:2,curveSegments:12
  });
  // The drawn profile points toward local negative Z.
  finGeometry.translate(0,0,-.0225);
  finGeometry.rotateY(Math.PI/2);
  const finMaterial=new T.MeshStandardMaterial({color:0x344b55,roughness:.68});
  const wakeMaterial=new T.MeshBasicMaterial({
    vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide
  });
  const foam=new T.Color(0xe4fff8);
  const point=new T.Vector2(),direction=new T.Vector2();
  const drop=new T.Object3D();
  const dropsPerShark=20;
  const spray=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
    new T.MeshBasicMaterial({color:0xd8f8f5}),sharks.length*dropsPerShark);
  spray.instanceMatrix.setUsage(T.DynamicDrawUsage);
  spray.frustumCulled=false;
  scene.add(spray);

  const swimmers=sharks.map(shark=>{
    const fin=new T.Mesh(finGeometry,finMaterial);
    fin.scale.setScalar(shark.size);
    scene.add(fin);
    const geometry=new T.BufferGeometry();
    const vertexCount=(wakeSteps+1)*4;
    const positions=new T.BufferAttribute(new Float32Array(vertexCount*3),3).setUsage(T.DynamicDrawUsage);
    const colors=new T.BufferAttribute(new Float32Array(vertexCount*4),4).setUsage(T.DynamicDrawUsage);
    const indices:number[]=[];
    for(let i=0;i<wakeSteps;i++){
      for(let side=0;side<2;side++){
        const a=i*4+side*2,b=a+4;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
    geometry.setIndex(indices);
    geometry.setAttribute('position',positions);
    geometry.setAttribute('color',colors);
    const wake=new T.Mesh(geometry,wakeMaterial);
    wake.frustumCulled=false;
    scene.add(wake);
    return {shark,fin,positions,colors};
  });

  return (time:number)=>{
    swimmers.forEach(({shark,fin,positions,colors},index)=>{
      sample(shark,time,point,direction);
      const y=waterHeight(point.x,point.y,time);
      fin.position.set(point.x,y-.045+.043*Math.sin(time*3.1+index),point.y);
      const forwardHeight=waterHeight(point.x+direction.x*.36,point.y+direction.y*.36,time);
      fin.rotation.set(Math.atan2(forwardHeight-y,.36),Math.atan2(-direction.x,-direction.y),
        .06*Math.sin(time*2.4+index),'YXZ');

      for(let i=0;i<=wakeSteps;i++){
        const age=i/wakeSteps;
        sample(shark,time-age*wakeDuration,point,direction);
        const spread=(.10+age*1.0)*shark.size;
        const breakup=.72+.28*Math.sin(i*2.3+time*3+index);
        const opacity=.72*(1-age)**1.7*breakup;
        for(let side=0;side<2;side++){
          for(let edge=0;edge<2;edge++){
            const offset=(side===0?-1:1)*(spread+(edge===0?-.045:.10+age*.09));
            const x=point.x-direction.y*offset,z=point.y+direction.x*offset;
            const vertex=i*4+side*2+edge;
            positions.setXYZ(vertex,x,waterHeight(x,z,time)+.034,z);
            colors.setXYZW(vertex,foam.r,foam.g,foam.b,opacity*(edge===0?1:.05));
          }
        }
      }
      positions.needsUpdate=true;
      colors.needsUpdate=true;

      for(let i=0;i<dropsPerShark;i++){
        const age=(time*2+i/dropsPerShark+index*.31)%1;
        sample(shark,time-age*.5,point,direction);
        const spread=(i%2===0?-1:1)*(.09+age*(.28+.035*(i%5)));
        const x=point.x-direction.y*spread,z=point.y+direction.x*spread;
        const height=Math.sin(age*Math.PI)*(.12+.035*(i%5));
        drop.position.set(x,waterHeight(x,z,time)+height+.01,z);
        const size=.043*shark.size*Math.sin(age*Math.PI)*(1-age);
        drop.scale.set(size,size*1.55,size);
        drop.updateMatrix();
        spray.setMatrixAt(index*dropsPerShark+i,drop.matrix);
      }
    });
    spray.instanceMatrix.needsUpdate=true;
  };
}
