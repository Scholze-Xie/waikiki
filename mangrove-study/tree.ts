import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Point=[number,number,number];

export function buildStudyTree(scene:T.Scene,ground:(x:number,z:number)=>number){
  const wood:T.BufferGeometry[]=[];
  const warm=new T.Color(0xa16d4e),dark=new T.Color(0x503b2d);
  function limb(points:Point[],sizes:number[],seed:number){
    const path=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
    const sections=(points.length-1)*4;
    const sides=9;
    const geometry=new T.TubeGeometry(path,sections,1,sides,false);
    const positions=geometry.getAttribute('position');
    const colors=new Float32Array(positions.count*3);
    const color=new T.Color();
    for(let ring=0;ring<=sections;ring++){
      const t=ring/sections;
      const center=path.getPointAt(t);
      const index=t*(sizes.length-1);
      const lo=Math.floor(index);
      const radius=T.MathUtils.lerp(sizes[lo],sizes[Math.min(lo+1,sizes.length-1)],index-lo);
      const wet=1-T.MathUtils.smoothstep(center.y-ground(center.x,center.z),.04,.45);
      for(let side=0;side<=sides;side++){
        const vertex=ring*(sides+1)+side;
        const angle=side/sides*Math.PI*2;
        const ridge=1+.12*Math.sin(angle*3+t*4+seed)+.07*Math.cos(angle*5-seed);
        positions.setXYZ(vertex,
          center.x+(positions.getX(vertex)-center.x)*radius*ridge,
          center.y+(positions.getY(vertex)-center.y)*radius*ridge,
          center.z+(positions.getZ(vertex)-center.z)*radius*ridge);
        color.copy(warm).lerp(dark,.63*wet).multiplyScalar(.91+.12*Math.cos(angle*3+seed)+.07*Math.sin(t*44+angle));
        color.toArray(colors,vertex*3);
      }
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    wood.push(geometry);
    return path;
  }

  limb([[0,-.19,0],[-.16,.68,.03],[-.21,1.51,.09],[.22,2.49,.16],[.1,3.19,.13]],
    [.52,.46,.36,.23,.03],2);

  const rootShapes=[
    [.13,2.70,1.68,.37], [.79,2.19,.86,-.31], [1.52,2.53,1.30,.22],
    [2.37,2.20,.66,-.38], [3.02,2.72,1.79,-.18], [3.93,2.34,.98,.35],
    [4.62,2.46,1.52,-.29], [5.48,2.21,.78,.40],
  ];
  rootShapes.forEach(([yaw,length,height,turn],i)=>{
    const foot=(t:number,bend:number,lift:number):Point=>{
      const a=yaw+bend;
      const x=Math.cos(a)*length*t,z=Math.sin(a)*length*t;
      return [x,ground(x,z)+lift,z];
    };
    const main=limb([
      [Math.cos(yaw)*.14,height,Math.sin(yaw)*.13],
      foot(.32,turn*.11,height*.52+.15),foot(.59,turn*.65,.32),
      foot(.82,turn,.09),foot(1,turn*.8,-.13),
    ],[.20+.07*(i%3),.19,.12,.073,.016],i);
    for(const side of [-1,1]){
      const start=main.getPointAt(side>0?.49:.65);
      limb([[start.x,start.y,start.z],foot(.73,turn+side*.25,.14),
        foot(.91,turn+side*.42,.065),foot(.99,turn+side*.38,-.09)],
      [.087,.067,.039,.012],i+side);
    }
  });

  const vertices:number[]=[],colors:number[]=[];
  const greens=[0x556927,0x6c822b,0x849638,0x9eaa42,0x485c26];
  const tint=new T.Color();
  let seed=825;
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  function leaf(origin:T.Vector3,yaw:number,length:number,tilt:number){
    const width=length*(.26+.09*random());
    const dx=Math.cos(yaw),dz=Math.sin(yaw);
    const outline=[[0,0,0],[.30,-.79,-.06],[.66,-.91,-.055],[1,0,-.05],[.67,.95,-.05],[.32,.78,-.06]];
    tint.set(greens[Math.floor(random()*greens.length)]);
    function vertex(u:number,v:number,h:number,tone:number){
      vertices.push(origin.x+dx*length*u-dz*width*v,origin.y+length*(u*tilt+h),origin.z+dz*length*u+dx*width*v);
      colors.push(tint.r*tone,tint.g*tone,tint.b*tone);
    }
    for(let k=0;k<outline.length;k++){
      const [a,b,c]=outline[k], [d,e,f]=outline[(k+1)%outline.length];
      vertex(.53,0,.085,1.12);
      vertex(a,b,c,.91);
      vertex(d,e,f,.84+.10*k/outline.length);
    }
  }
  for(let i=0;i<9;i++){
    const yaw=i*2.39996;
    const reach=1.38+.96*random(),height=2.38+1.30*random();
    const x=Math.cos(yaw),z=Math.sin(yaw);
    const branch=limb([[.09,1.50+.21*(i%5),.10],[x*reach*.45,height-.40-.35*random(),z*reach*.45],
      [x*reach,height,z*reach]],[.17,.10,.018],i);
    for(let j=0;j<11;j++){
      const node=branch.getPoint(.49+.48*j/10);
      const angle=yaw+(random()-.5)*3.7,travel=.28+.60*random();
      const tip=node.clone().add(new T.Vector3(Math.cos(angle)*travel,.20+.42*random(),Math.sin(angle)*travel));
      limb([[node.x,node.y,node.z],[tip.x,tip.y,tip.z]],[.037,.008],j);
      for(let k=0;k<12;k++){
        const origin=node.clone().lerp(tip,.38+.62*random());
        origin.add(new T.Vector3((random()-.5)*.49,(random()-.5)*.66,(random()-.5)*.49));
        leaf(origin,angle+(random()-.5)*4.9,.26+.21*random(),(random()-.52)*.84);
      }
    }
  }
  for(let i=0;i<5;i++){
    const angle=.4+i*2.39996;
    const x=Math.cos(angle),z=Math.sin(angle);
    const branch=limb([[.17,2.48,.13],[x*.50,3.16,z*.50],
      [x*.93,3.44+.39*random(),z*.93]],[.095,.057,.012],i+8);
    for(let j=0;j<60;j++){
      const origin=branch.getPoint(.46+.54*random());
      origin.add(new T.Vector3((random()-.5)*.72,(random()-.5)*.42,(random()-.5)*.72));
      leaf(origin,angle+(random()-.5)*6,.25+.22*random(),(random()-.5)*1.2);
    }
  }

  const trunk=new T.Mesh(mergeGeometries(wood)!,new T.MeshStandardMaterial({
    vertexColors:true,flatShading:true,roughness:.78,
  }));
  wood.forEach(geometry=>geometry.dispose());
  const leaves=new T.BufferGeometry();
  leaves.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  leaves.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  leaves.computeVertexNormals();
  const canopy=new T.Mesh(leaves,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.74}));
  for(const mesh of [trunk,canopy]){
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
}
