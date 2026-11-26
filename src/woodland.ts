import {coconutBunches,palmCrownFrond,palmTrunk,pinnateFrond} from './palm-geometry';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {coast,creekMouthTint,sandHeight,shoreShader,streamZ,swashShader} from './waves';
import {createStoneMaterial} from './stone-material';
import {mangroveChannelBed,mangroveChannelMask} from './mangrove-tide';

const smooth = (a:number,b:number,v:number) => T.MathUtils.smoothstep(v,a,b);
export {streamZ} from './waves';
const streamWidth = (x:number) => 1.22 + .26*Math.sin(x*.28) + .16*Math.cos(x*.71)
  + .27*Math.exp(-((x+12)**2)/19) + .49*smooth(-3.7,1.1,x);
const mouthX = 2.15;
const sourceX = -62;

// Vary the setback to leave openings in the tree line along the beach.
export const beachCoconutSites=[
  [-32.1,5.1,.85],[-30.0,3.0,.76],[-29.0,8.2,1.04],[-26.9,4.2,.90],
  [-24.4,7.6,.82],[-22.0,2.7,.96],[-22.6,9.6,1.09],[-19.6,5.5,.87],
  [-17.1,3.1,.78],[-16.0,7.5,1.01],[-14.1,4.2,.94],
  [-6.4,4.6,.85],[-4.1,2.9,.77],[-3.0,7.4,1.05],
  [2.5,4.0,.87],[4.4,2.6,.79],[6.0,5.8,1.08],[9.1,3.0,.85],
  [11.4,6.0,.98],[13.6,2.8,.75],[14.8,9.6,1.03],[16.7,5.9,.90],
  [20.0,7.8,1.07],[21.0,3.0,.77],
  [45.4,3.7,.81],[48.7,5.9,1.04],[52.3,3.3,.89],
  [59.2,6.3,1.00],[63.3,4.1,.92],[67.0,5.8,.84],
].map(([z,setback,scale])=>({x:coast(z)-setback,z,scale}));

function streamBankWidth(x:number,side:number){
  return streamWidth(x)*(1+side*(.14*Math.sin(x*.37)+.07*Math.cos(x*.93)));
}

function streamSurface(x:number){
  const upstream=mouthX-x;
  return -.057+.009*upstream;
}

function forestBase(x:number,z:number) {
  const front = Math.max(-z-4, -x-18);
  return smooth(0,10,front) * smooth(1,5,coast(z)-x);
}

function ground(x:number,z:number) {
  const offshore=x-coast(z);
  const shelf=smooth(7,34,offshore);
  const base=Math.max(-2,sandHeight(x,z))-shelf*(6.4+.50*Math.sin(x*.48)*Math.cos(z*.39));
  const undulation=(.26*Math.sin(x*.34+z*.19)+.19*Math.cos(z*.39-x*.27))*forestBase(x,z);
  const land=base+undulation;
  const channel=mangroveChannelMask(-offshore,z);
  return channel>0?T.MathUtils.lerp(land,Math.min(land,mangroveChannelBed(-offshore,z)),channel):land;
}

export function woodlandHeight(x:number,z:number) {
  const terrain=ground(x,z);
  if(x<sourceX-3||x>mouthX+1.4)return terrain;
  const offset=z-streamZ(x);
  const bankDistance=Math.abs(offset)/streamBankWidth(x,Math.sign(offset));
  const bank=1-smooth(1.12,1.86,bankDistance);
  const ends=smooth(sourceX-3,sourceX+1,x)*(1-smooth(mouthX-.25,mouthX+1.4,x));
  const creekBed=streamSurface(x)-.32+.46*smooth(.23,1.22,bankDistance);
  // Cut through the beach without raising sand bars above the surrounding shore.
  return T.MathUtils.lerp(terrain,Math.min(creekBed,terrain),bank*ends);
}

export function colorWoodland(color:T.Color,x:number,z:number,y:number,surface:T.Vector2) {
  const forest=forestBase(x,z);
  if(forest>.001){
    const marbling=.5+.5*Math.sin(x*.39-z*.55+1.8*Math.cos(z*.19));
    color.lerp(loam,forest*(.74+marbling*.26));
  }
  surface.set(forest,0);
  if(x>sourceX&&x<mouthX+1){
    const offset=z-streamZ(x);
    const bankDistance=Math.abs(offset)/streamBankWidth(x,Math.sign(offset));
    const shoreBlend=1-smooth(-.18,1.18,x-coast(z));
    const creekMask=(1-smooth(.96,1.75,bankDistance))*shoreBlend*smooth(sourceX,sourceX+2,x);
    const wetness=1-smooth(.02,.24,y-streamSurface(x));
    surface.y=creekMask*wetness;
    color.lerp(clay,creekMask*.73);
    color.lerp(wetSilt,creekMask*wetness*.82);
  }
}
const loam=new T.Color(0x53683a);
const clay=new T.Color(0x88724f);
const wetSilt=new T.Color(0x4c5140);
const forestMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide});

const forestWindTime={value:0};
forestMaterial.onBeforeCompile=shader=>{
  shader.uniforms.forestWindTime=forestWindTime;
  shader.vertexShader='uniform float forestWindTime; attribute float windWeight;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    #ifdef USE_INSTANCING
    vec3 anchor=instanceMatrix[3].xyz;
    float gustPhase=forestWindTime*1.75+anchor.x*.31+anchor.z*.34;
    float gust=.36+.64*smoothstep(.03,.92,sin(gustPhase));
    vec3 wind=vec3(.79,.06,.56)*gust
      +vec3(.19,.32,-.22)*sin(forestWindTime*5.1+dot(anchor.xz,vec2(.87,.71))+position.x*2.);
    vec3 localWind=vec3(dot(wind,normalize(instanceMatrix[0].xyz)),
      dot(wind,normalize(instanceMatrix[1].xyz)),dot(wind,normalize(instanceMatrix[2].xyz)));
    transformed+=localWind*windWeight;
    #endif
  `);
};

class TreeGeometry {
  private parts:T.BufferGeometry[]=[];
  add(input:T.BufferGeometry,tint:number,x=0,y=0,z=0,sx=1,sy=1,sz=1,rotation=0){
    const g=input.index?input.toNonIndexed():input;
    g.scale(sx,sy,sz);
    g.rotateY(rotation);
    g.translate(x,y,z);
    g.deleteAttribute('uv');
    const modulation=g.getAttribute('color');
    const c=new T.Color(tint), colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<g.attributes.position.count;i++){
      colors[i*3]=c.r*(modulation?.getX(i)??1);
      colors[i*3+1]=c.g*(modulation?.getY(i)??1);
      colors[i*3+2]=c.b*(modulation?.getZ(i)??1);
    }
    if(g!==input)input.dispose();
    g.setAttribute('color',new T.BufferAttribute(colors,3));
    this.parts.push(g);
  }
  branch(from:T.Vector3,to:T.Vector3,bottom:number,top:number,color:number){
    const delta=to.clone().sub(from);
    const g=new T.CylinderGeometry(top,bottom,delta.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    const center=from.clone().lerp(to,.5);
    this.add(g,color,center.x,center.y,center.z);
  }
  crown(x:number,y:number,z:number,rx:number,ry:number,rz:number,color:number,detail=0){
    this.add(new T.IcosahedronGeometry(1,detail),color,x,y,z,rx,ry,rz);
  }
  finish(){
    const geometry=mergeGeometries(this.parts)!;
    for(const part of this.parts)part.dispose();
    return geometry;
  }
}

function frond(length:number,width:number,arch:number,split:boolean){
  const points:number[]=[], colors:number[]=[], indices:number[]=[];
  const segments=12;
  const center=(t:number)=>arch*Math.sin(t*2.52)-.18*t;
  const vein=1.10;
  points.push(0,0,0);
  colors.push(vein,vein,.84);
  for(let i=1;i<segments;i++){
    const t=i/segments;
    const y=center(t);
    const breadth=width*Math.pow(Math.sin(Math.PI*t),.76)*(1.16-.31*t);
    for(const side of [-1,0,1]){
      const splitEdge=split&&(side===-1?i===5||i===9:i===7||i===10);
      const extent=side*breadth*(splitEdge?.54:1);
      const offset=extent/width;
      points.push(t*length-.07*Math.abs(offset),y-.18*Math.abs(extent)+.03*offset,extent);
      const shade=side===0?vein:(side<0?.83:.95)+(i%2?.035:0);
      colors.push(shade,shade,shade*(side===0?.76:.93));
    }
    const left=1+(i-1)*3;
    if(i===1){
      indices.push(0,left+1,left,0,left+2,left+1);
    }else{
      const previous=left-3;
      for(let side=0;side<2;side++){
        const a=previous+side,b=left+side;
        indices.push(a,a+1,b,a+1,b+1,b);
      }
    }
  }
  const tip=points.length/3;
  points.push(length,center(1),0);
  colors.push(1,1,.85);
  indices.push(tip-3,tip-2,tip,tip-2,tip-1,tip);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function coconut() {
  const tree=new TreeGeometry();
  const trunk=new T.QuadraticBezierCurve3(new T.Vector3(),new T.Vector3(.10,2.1,0),new T.Vector3(.58,5,0));
  tree.add(palmTrunk(trunk,.18,1,24),0x947252);
  tree.crown(.58,4.96,0,.23,.26,.23,0x65713c);
  tree.add(coconutBunches(1,1),0xffffff,.58,5,0);
  for(let i=0;i<10;i++){
    const {geometry,color,yaw,origin}=palmCrownFrond(i,10,1,{pairs:9});
    tree.add(geometry,color,.58+origin.x,5+origin.y,origin.z,1,1,1,yaw);
  }
  return tree.finish();
}

function banyanLobe(seed:number,small=false){
  const outline=small?[[-.43,.72],[.21,.92]]:[[-.64,.48],[-.36,.78],[-.02,1],[.40,.79]];
  const segments=small?6:9;
  const phase=seed*2.399;
  const vertices=[.12*Math.cos(phase),-.82,.12*Math.sin(phase)];
  const colors=[.73,.82,.72];
  const indices:number[]=[];
  for(let ring=0;ring<outline.length;ring++){
    const [height,radius]=outline[ring];
    for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2+.17*ring;
      const scallop=Math.sin(angle*3+phase+ring*.58);
      const asymmetry=Math.cos(angle*2-phase*.64);
      const scale=radius*(1+.13*scallop+.085*asymmetry);
      vertices.push(
        Math.cos(angle)*scale+.15*height*Math.cos(phase),
        height+(.10*scallop+.048*asymmetry)*radius,
        Math.sin(angle)*scale+.15*height*Math.sin(phase),
      );
      const light=.94+.16*height+.10*scallop;
      colors.push(light*(.96+.10*height),light+.04,light*(.90-.06*height));
    }
  }
  const top=vertices.length/3;
  vertices.push(.22*Math.cos(phase),.71,.22*Math.sin(phase));
  colors.push(1.12,1.13,1.02);
  for(let i=0;i<segments;i++){
    const j=(i+1)%segments;
    indices.push(0,1+i,1+j);
    for(let ring=0;ring<outline.length-1;ring++){
      const lower=1+ring*segments;
      const upper=lower+segments;
      indices.push(lower+i,upper+i,upper+j,lower+i,upper+j,lower+j);
    }
    indices.push(top,top-segments+j,top-segments+i);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function banyanWood(points:T.Vector3[],baseRadius:number,tipRadius:number,seed:number,detailed:boolean){
  const curve=new T.CatmullRomCurve3(points);
  const segments=(points.length-1)*(detailed?3:2),sides=detailed?8:6;
  const geometry=new T.TubeGeometry(curve,segments,1,sides,false);
  const positions=geometry.getAttribute('position');
  const colors:number[]=[];
  const radial=new T.Vector3();
  for(let ring=0;ring<=segments;ring++){
    const t=ring/segments;
    const center=curve.getPointAt(t);
    const radius=T.MathUtils.lerp(baseRadius,tipRadius,t**.76);
    for(let side=0;side<=sides;side++){
      const index=ring*(sides+1)+side;
      const angle=side/sides*Math.PI*2;
      const groove=Math.sin(angle*3+seed+.42*Math.sin(t*4+seed));
      const ridges=1+.13*groove+.061*Math.sin(angle*5-t*5);
      radial.fromBufferAttribute(positions,index).sub(center).multiplyScalar(radius*ridges).add(center);
      positions.setXYZ(index,radial.x,radial.y,radial.z);
      const shade=.87+.10*groove+.05*Math.cos(angle*2+t*9+seed);
      colors.push(shade,shade*(1.01+.031*t),shade*(.92+.08*t));
    }
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  return geometry;
}

function banyanSpray(from:T.Vector3,to:T.Vector3,seed:number){
  const points:number[]=[],colors:number[]=[];
  const span=to.clone().sub(from);
  const across=new T.Vector3(-span.z,0,span.x).normalize();
  for(let i=0;i<12;i++){
    const t=.11+.82*i/11;
    const side=i%2===0?-1:1;
    const base=from.clone().addScaledVector(span,t);
    const fall=Math.sin(i*3.17+seed)*.11;
    const tip=base.clone().addScaledVector(span,.11).addScaledVector(across,side*(.24+.081*Math.cos(i*4+seed)));
    tip.y+=fall;
    const stem=tip.clone().sub(base);
    const width=new T.Vector3(-stem.z,0,stem.x).normalize().multiplyScalar(.084);
    const middle=base.clone().lerp(tip,.49);
    const ridge=middle.clone().add(new T.Vector3(0,.040,0));
    const left=middle.clone().add(width),right=middle.clone().sub(width);
    for(const [point,shade] of [[base,.79],[left,.88],[ridge,1.13],[ridge,1.13],[left,.88],[tip,1.02],
      [base,.79],[ridge,1.13],[right,.78],[ridge,1.13],[tip,1.02],[right,.78]] as const){
      points.push(point.x,point.y,point.z);
      colors.push(shade,shade,shade*.85);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function banyan(detailed=false) {
  const tree=new TreeGeometry();
  const wood=(points:T.Vector3[],base:number,tip:number,tint:number,seed:number)=>
    tree.add(banyanWood(points,base,tip,seed,detailed),tint);
  const base=new T.Vector3(.06,-.38,.09), shoulder=new T.Vector3(-.20,2.36,.11);
  const leader=new T.Vector3(.21,4.61,-.36);
  wood([base,new T.Vector3(.13,.73,-.13),shoulder,leader],.53,.10,0x78634c,3);
  const rootCount=detailed?5:3;
  for(let i=0;i<rootCount;i++){
    const angle=i*2.399;
    const root=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
    wood([base.clone().lerp(shoulder,.33),root.clone().multiplyScalar(.72).setY(.28),
      root.multiplyScalar(1.23+.26*Math.sin(i*3)).setY(-.43)],.185,.036,0x6a5746,i);
  }
  const greens=[0x356244,0x457747,0x51824b,0x60834b,0x477452];
  for(let j=0;j<6;j++){
    const angle=j*2.399;
    const radial=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
    const tangent=new T.Vector3(-radial.z,0,radial.x);
    const reach=1.58+.58*Math.sin(j*2.13+.6)**2;
    const origin=shoulder.clone().lerp(leader,j%3*.15);
    const y=3.52+.52*Math.sin(j*2.17)+.12*j;
    const elbow=radial.clone().multiplyScalar(reach*.46).setY(y-.65);
    const fork=radial.clone().multiplyScalar(reach).setY(y);
    wood([origin,elbow,fork],.27-j*.017,.068,0x795f47,j+6);
    if(j%2===0){
      const root=fork.clone().lerp(elbow,.20);
      const rootEnd=root.clone().addScaledVector(tangent,.19).setY(-.38);
      wood([root,root.clone().lerp(rootEnd,.55).addScaledVector(radial,.12),rootEnd],.049,.10,0x776048,j);
    }else if(detailed){
      const root=fork.clone().lerp(elbow,.23);
      const rootEnd=root.clone().addScaledVector(tangent,.13).add(new T.Vector3(0,-1.26,0));
      wood([root,root.clone().lerp(rootEnd,.52),rootEnd],.034,.012,0x84684b,j);
    }
    for(const side of [-1,1]){
      const phase=j*2+side;
      const joint=fork.clone().lerp(elbow,side<0?.34:.13);
      const tip=fork.clone().addScaledVector(tangent,side*(.64+.29*Math.sin(phase*2.06)**2))
        .addScaledVector(radial,.48+.25*Math.cos(phase*.84));
      tip.y+=.49+.38*Math.sin(phase*1.48);
      if(detailed){
        wood([joint,joint.clone().lerp(tip,.51).add(new T.Vector3(0,-.08,0)),tip],.080,.019,0x80664d,phase);
        tree.add(banyanSpray(joint,tip,phase),greens[(j+(side>0?2:0))%greens.length]);
      }else{
        tree.branch(joint,tip,.071,.019,0x80664d);
      }
      const size=.83+.34*Math.sin(phase*1.2)**2;
      tree.add(banyanLobe(phase+12,!detailed),greens[(j+(side>0?2:0))%greens.length],
        tip.x,tip.y+.19,tip.z,size,.52+.08*Math.cos(phase),size*.87,angle);
      tree.add(banyanLobe(phase+19,true),greens[(j+2)%greens.length],
        tip.x+radial.x*.48,tip.y+.03,tip.z+radial.z*.48,size*.65,.31,size*.68,angle+.46);
    }
  }
  tree.add(banyanLobe(36,!detailed),0x568747,leader.x,leader.y+.24,leader.z,1.29,.72,1.23,.54);
  tree.add(banyanLobe(37,true),0x5c8849,leader.x+.50,leader.y+.69,leader.z-.28,.81,.52,.67,1.38);
  return tree.finish();
}

function fanPalm() {
  const tree=new TreeGeometry();
  tree.branch(new T.Vector3(),new T.Vector3(.19,3.18,0),.17,.13,0x827252);
  for(let i=0;i<9;i++){
    const yaw=i*2.399;
    const leaf=new T.Vector3(.19+1.04*Math.cos(yaw),3.49+.31*Math.sin(i*3),-1.04*Math.sin(yaw));
    tree.branch(new T.Vector3(.19,3.16,0),leaf,.033,.018,0x628343);
    const verts:number[]=[];
    for(let j=0;j<12;j++){
      const low=(j/12-.5)*2.1, mid=((j+.5)/12-.5)*2.1, high=((j+1)/12-.5)*2.1;
      const point=(a:number,r:number,dy:number)=>[.96*Math.cos(a)*r,dy,.99*Math.sin(a)*r];
      verts.push(0,0,0,...point(low,.90,-.10),...point(mid,1,.095));
      verts.push(0,0,0,...point(mid,1,.095),...point(high,.90,-.10));
    }
    const geom=new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    geom.computeVertexNormals();
    tree.add(geom,[0x4c843e,0x6b9a4a,0x477944][i%3],leaf.x,leaf.y,leaf.z,1,1,1,yaw);
  }
  return tree.finish();
}

function travelersPalm(){
  const tree=new TreeGeometry();
  tree.branch(new T.Vector3(),new T.Vector3(0,1.04,0),.20,.14,0x767346);
  for(let i=0;i<9;i++){
    const angle=(i-4)*.24;
    const tip=new T.Vector3(Math.sin(angle)*1.6,2.55+1.5*Math.cos(angle),0);
    tree.branch(new T.Vector3(0,.95,0),tip,.055,.018,0x86a950);
    const g=frond(1.32,.29,.14,false);
    g.rotateZ(Math.PI*.5-angle);
    tree.add(g,i%2===0?0x5b9748:0x77a54b,tip.x,tip.y-.49,0);
  }
  return tree.finish();
}

function fern(){
  const tree=new TreeGeometry();
  const greens=[0x447941,0x639747,0x80a952];
  for(let i=0;i<7;i++){
    const length=.80+.22*Math.sin(i*2.3)**2;
    const arch=.39+.28*Math.cos(i*1.7)**2;
    const blade=pinnateFrond(length,.19+.045*Math.sin(i*3.2)**2,arch,.31,5,i+4);
    tree.add(blade,greens[i%greens.length],0,.095,0,1,.83,1,i*2.399);
  }
  return tree.finish();
}

function banana(){
  const plant=new TreeGeometry();
  const crown=new T.Vector3(.16,1.6,0);
  plant.branch(new T.Vector3(),crown,.12,.073,0x859751);
  for(let i=0;i<7;i++){
    const angle=i*2.399;
    const base=crown.clone().add(new T.Vector3(Math.cos(angle)*.34,.21+.18*Math.sin(i*2),-Math.sin(angle)*.34));
    plant.branch(crown,base,.045,.022,0x92a951);
    const leaf=frond(1.72+.40*Math.sin(i*2.2),.49,.45+.16*Math.sin(i*1.7),i%3!==0);
    leaf.rotateZ(.38+.48*Math.sin(i*2.47));
    plant.add(leaf,[0x39794a,0x528e48,0x69a44d][i%3],base.x,base.y,base.z,1,1,1,angle);
  }
  return plant.finish();
}

function heliconia(){
  const plant=new TreeGeometry();
  const base=new T.Vector3();
  for(let i=0;i<5;i++){
    const angle=i*2.399;
    const tip=new T.Vector3(.28*Math.cos(angle),.52+.09*i,-.28*Math.sin(angle));
    plant.branch(base,tip,.025,.011,0x6c9843);
    const leaf=frond(.77,.21,.16,false);
    leaf.rotateZ(.48);
    plant.add(leaf,i%2?0x478841:0x5d9b45,tip.x,tip.y,tip.z,1,1,1,angle);
  }
  plant.branch(base,new T.Vector3(0,1.34,0),.023,.012,0x73934a);
  for(let i=0;i<5;i++){
    const direction=i%2===0?1:-1;
    const y=.76+i*.126;
    const length=.35-i*.037;
    const bract=new T.BufferGeometry();
    bract.setAttribute('position',new T.Float32BufferAttribute([
      0,0,0, length*.37,.015,-.066, length*.54,-.037,0, length*.37,.015,.066,
      length*.70,.078,-.043, length*.70,.078,.043, length,.153,0,
    ],3));
    bract.setAttribute('color',new T.Float32BufferAttribute([
      .68,.48,.40, .90,.57,.39, .73,.49,.32, .90,.57,.39,
      1,.80,.39, 1,.80,.39, 1.08,1.12,.48,
    ],3));
    bract.setIndex([0,1,2,0,2,3,1,4,2,2,4,6,2,6,5,2,5,3]);
    bract.computeVertexNormals();
    plant.add(bract,i<3?0xe14a2b:0xf27932,0,y,0,1,1,1,direction>0?0:Math.PI);
  }
  return plant.finish();
}

function grove(scene:T.Scene){
  const detailedBanyan=7;
  const prototypes=[coconut(),banyan(),fanPalm(),travelersPalm(),fern(),banana(),heliconia(),banyan(true)];
  const trees:T.Matrix4[][]=prototypes.map(()=>[]);
  const plant=new T.Object3D();
  let seed=719;
  const rng=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  function add(kind:number,x:number,z:number,scale:number){
    const height=woodlandHeight(x,z);
    plant.position.set(x,height-.022,z);
    plant.rotation.set(0,rng()*Math.PI*2,0);
    plant.scale.set(scale*(.90+.24*rng()),scale,scale*(.90+.24*rng()));
    plant.updateMatrix();
    const nearView=Math.hypot(x+16.8,z+6.8)<13||Math.hypot(x+14.4,z-streamZ(-14.4))<11;
    const matrix=plant.matrix.clone();
    trees[kind===1&&nearView?detailedBanyan:kind].push(matrix);
    return matrix;
  }
  function addFoliage(geometry:T.BufferGeometry,matrices:readonly T.Matrix4[],castShadow=false){
    const objects=new T.InstancedMesh(geometry,forestMaterial,matrices.length);
    matrices.forEach((matrix,index)=>objects.setMatrixAt(index,matrix));
    objects.computeBoundingSphere();
    objects.boundingSphere!.radius+=.5;
    objects.receiveShadow=true;
    objects.castShadow=castShadow;
    scene.add(objects);
    return objects;
  }
  for(let z=-92;z<=12;z+=3.55){
    for(let x=-76;x<=3;x+=3.6){
      const px=x+(rng()-.5)*3,pz=z+(rng()-.5)*3;
      if(forestBase(px,pz)<.52 || Math.abs(pz-streamZ(px))<2.35
        || Math.hypot(px+16.2,pz+10.4)<3.7 || Math.hypot(px+25,pz+15)<2.7 || rng()<.10)continue;
      const variant=rng();
      const kind=variant<.43?0:variant<.65?1:variant<.86?2:3;
      add(kind,px,pz,.70+rng()*.50);
      if(pz>-42)add(4,px+.55,pz+1.08,.57+rng()*.54);
    }
  }
  for(let x=-43;x<-.9;x+=1.31){
    const z=streamZ(x)+(x%2< -1?-1:1)*(streamWidth(x)+.72);
    add(4,x,z,.55+rng()*.64);
  }
  // Follow the banks while keeping the bed and the guardian clearing open.
  for(let i=0;i<29;i++){
    const x=-42+i*1.41;
    for(const side of [-1,1]){
      const z=streamZ(x)+side*(streamWidth(x)+1.75+.65*rng());
      if(forestBase(x,z)<.45 || Math.hypot(x+16.2,z+10.4)<4.3 || Math.hypot(x+25,z+15)<3.5)continue;
      add(i%3===0?5:6,x,z,.74+.48*rng());
    }
  }
  for(let i=0;i<27;i++){
    const x=-30+i*.97,z=-10-5.1*rng();
    if(forestBase(x,z)<.53 || Math.abs(z-streamZ(x))<2.5
      || Math.hypot(x+16.2,z+10.4)<4.6 || Math.hypot(x+25,z+15)<3.6)continue;
    add(5,x,z,.78+.49*rng());
    add(6,x+.48,z+.47,.66+.34*rng());
  }
  // Fill gaps near the viewpoints without adding canopy over the creek.
  for(let z=-39;z<=-6;z+=1.55){
    for(let x=-47;x<=0;x+=1.65){
      const px=x+(rng()-.5)*1.35,pz=z+(rng()-.5)*1.30;
      const bankDistance=Math.abs(pz-streamZ(px));
      if(forestBase(px,pz)<.56 || bankDistance<streamWidth(px)+.75
        || Math.hypot(px+16.2,pz+10.4)<4.6
        || Math.hypot(px+25,pz+15)<3.6 || rng()<.27)continue;
      const mix=rng();
      const kind=mix<.72?4:mix<.90?5:6;
      add(kind,px,pz,kind===4?.54+.56*rng():.66+.37*rng());
    }
  }
  // Cluster smaller fan palms behind the lower plants along the visible forest edge.
  for(let x=-35;x<-6;x+=2.5){
    const px=x+(rng()-.5)*1.4,z=-9-3.7*rng();
    if(forestBase(px,z)<.58 || Math.abs(z-streamZ(px))<3.1
      || Math.hypot(px+16.2,z+10.4)<5 || Math.hypot(px+25,z+15)<3.9)continue;
    add(2,px,z,.52+.25*rng());
  }
  const canopy=trees.filter((_,kind)=>kind<4||kind===detailedBanyan).flat();
  const understory=trees.slice(4,7).flat();
  const hasSpace=(plants:T.Matrix4[],x:number,z:number,gap:number)=>!plants.some(({elements})=>
    (x-elements[12])**2+(z-elements[14])**2<gap**2);
  // Fill open pockets behind the tree line and along the creek banks.
  for(let z=-43;z<=-5.5;z+=1.65){
    for(let x=-49;x<=-6;x+=1.7){
      const px=x+(rng()-.5)*1.48,pz=z+(rng()-.5)*1.43;
      if(forestBase(px,pz)<.56||coast(pz)-px<5.8
        ||Math.hypot(px+16.2,pz+10.4)<4.7||Math.hypot(px+25,pz+15)<3.8)continue;
      const bankGap=Math.abs(pz-streamZ(px))-streamWidth(px);
      if(bankGap<1.15)continue;
      if(bankGap>2.3&&hasSpace(canopy,px,pz,2.4)&&rng()<.29){
        const tree=add(rng()<.48?0:2,px,pz,.63+.29*rng());
        if(tree)canopy.push(tree);
      }
      if(rng()<.34||!hasSpace(understory,px,pz,.94)||!hasSpace(canopy,px,pz,.72))continue;
      const mix=rng();
      const kind=bankGap<2||mix<.66?4:mix<.86?5:6;
      const plant=add(kind,px,pz,.57+.36*rng());
      if(plant)understory.push(plant);
    }
  }
  // Coconut palms at the visible forest edge and in larger inland gaps.
  const coconutSites=[
    [-14.5,-5.5],[-30.5,-19],[-22,-6],[-17.5,-5.5],[-12,-7],[-27.5,-5.5],[-19.5,-19],[-28.5,-8],
    [-15,-34.5],[-24,-34],[-13.5,-23],[-34,-30.5],[-19,-22.5],[-21,-32.5],
    [-13,-28],[-10.5,-23],[-24,-24],[-26.5,-23],[-31,-30],[-38.5,-21.5]
  ];
  for(const [x,z] of coconutSites)add(0,x,z,.72+.31*rng());

  for(let i=0;i<prototypes.length;i++){
    const geometry=prototypes[i];
    const position=geometry.getAttribute('position');
    const weights=new Float32Array(position.count);
    const bending=[.17,.055,.18,.17,.12,.28,.13,.055][i];
    const leafBase=[4.94,3.00,3.03,1.12,.13,1.63,.43,3.00][i];
    for(let vertex=0;vertex<position.count;vertex++){
      const radial=Math.hypot(position.getX(vertex)-(i===0?.58:0),position.getZ(vertex));
      const height=smooth(leafBase-.22,leafBase+.42,position.getY(vertex));
      weights[vertex]=bending*height*smooth(.22,i===4?.94:i===0?2.56:2.26,radial);
    }
    geometry.setAttribute('windWeight',new T.BufferAttribute(weights,1));
    addFoliage(geometry,trees[i]);
  }
  const beachMatrices=beachCoconutSites.map(({x,z,scale})=>{
    plant.position.set(x,woodlandHeight(x,z)-.055,z);
    plant.rotation.set(0,rng()*Math.PI*2,0);
    plant.scale.set(scale*(.94+.14*rng()),scale,scale*(.94+.14*rng()));
    plant.updateMatrix();
    return plant.matrix.clone();
  });
  addFoliage(prototypes[0],beachMatrices,true).name='Beach Coconut Palms';
}

const rocks=new T.IcosahedronGeometry(1,1);
const darkRock=createStoneMaterial({color:0x555f51,roughness:1,flatShading:true});
const grayRock=createStoneMaterial({color:0x828075,roughness:.98,flatShading:true});
const stoneCut=createStoneMaterial({color:0x4e514c,roughness:1},1.6);
const moss=new T.MeshStandardMaterial({color:0x718349,roughness:1,flatShading:true});
function rock(parent:T.Object3D,tint:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const mesh=new T.Mesh(rocks,tint);
  mesh.position.set(x,y,z);
  mesh.scale.set(sx,sy,sz);
  mesh.receiveShadow=true;
  mesh.castShadow=true;
  parent.add(mesh);
  return mesh;
}
function vine(parent:T.Object3D,points:T.Vector3[],seed:number){
  const curve=new T.CatmullRomCurve3(points);
  const branch=new T.Mesh(new T.TubeGeometry(curve,points.length*6,.035,5,false),
    new T.MeshStandardMaterial({color:0x4f6734,roughness:1}));
  parent.add(branch);
  const leaves=new TreeGeometry();
  for(let i=0;i<17;i++){
    const p=curve.getPoint((i+.4)/17);
    const side=i%2===0?-1:1;
    leaves.crown(p.x+side*.12,p.y-.078,p.z+.045,.19,.095,.13,(i+seed)%3===0?0x87a047:0x536f36);
  }
  const cluster=new T.Mesh(leaves.finish(),forestMaterial);
  parent.add(cluster);
}

function guardian(scene:T.Scene,x:number,z:number,scale:number,yaw:number,lean:number){
  const group=new T.Group();
  group.position.set(x,woodlandHeight(x,z),z);
  group.rotation.set(-.045,yaw,lean);
  group.scale.setScalar(scale);
  scene.add(group);
  rock(group,darkRock,0,.40,0,2.12,.64,1.60);
  rock(group,grayRock,0,1.75,.02,1.47,1.58,.96);
  rock(group,grayRock,0,3.95,.02,1.24,1.40,1.0);
  rock(group,darkRock,0,5.11,-.07,1.13,.43,.90);
  rock(group,grayRock,-1.19,2.05,.48,.36,1.23,.49).rotation.z=-.26;
  rock(group,grayRock,1.19,2.05,.48,.36,1.23,.49).rotation.z=.26;
  for(const side of [-1,1]){
    rock(group,grayRock,side*1.07,3.87,.08,.35,.49,.37);
    rock(group,stoneCut,side*.46,4.05,.855,.33,.13,.085).rotation.z=side*.09;
    rock(group,grayRock,side*.47,4.27,.86,.44,.14,.24).rotation.z=side*-.13;
  }
  rock(group,grayRock,0,3.77,1.04,.24,.46,.32);
  rock(group,stoneCut,0,3.29,.86,.49,.075,.06);
  rock(group,grayRock,0,3.13,.76,.52,.19,.32);
  for(const [mx,my,mz,s] of [[-.67,4.81,.56,.39],[.82,4.40,.63,.37],[-1.1,2.77,.59,.42],[.88,1.41,.82,.34],[-.39,.81,1.12,.37]]){
    rock(group,moss,mx,my,mz,s,s*.42,s*.56);
  }
  vine(group,[new T.Vector3(-.79,4.97,.05),new T.Vector3(-1.15,4.30,.65),new T.Vector3(-1.32,3.6,.71),
    new T.Vector3(-.96,2.85,.86),new T.Vector3(-1.34,1.70,.79),new T.Vector3(-1.10,.82,.81)],1);
  vine(group,[new T.Vector3(.86,4.85,.34),new T.Vector3(1.11,4.20,.71),new T.Vector3(.96,3.65,.68),
    new T.Vector3(1.13,2.75,.91),new T.Vector3(.84,2.13,.94)],2);
}

function addCreekStones(scene:T.Scene){
  const scatterCount=52;
  const gravelBars=[[-6.8,-1],[-10.1,1],[-14.2,-1],[-19,1],[-28,-1]];
  const stones=new T.InstancedMesh(rocks,createStoneMaterial({
    roughness:.92,flatShading:true
  },2.1),scatterCount+gravelBars.length*5+1);
  const stone=new T.Object3D();
  const colors=[0x464c44,0x66685b,0x817966,0x687747].map(color=>new T.Color(color));
  let count=0;
  function place(x:number,bankOffset:number,size:number,seed:number){
    const z=streamZ(x)+bankOffset*streamBankWidth(x,Math.sign(bankOffset));
    stone.position.set(x,woodlandHeight(x,z)+size*.025,z);
    stone.rotation.set(.17*Math.sin(seed*3),seed*2.399,.21*Math.cos(seed*4));
    stone.scale.set(size*(1.05+.24*Math.sin(seed)),size*(.44+.13*Math.cos(seed*2)),size*.78);
    stone.updateMatrix();
    stones.setMatrixAt(count,stone.matrix);
    stones.setColorAt(count,colors[seed%colors.length]);
    count++;
  }
  for(let i=0;i<scatterCount;i++){
    const x=-47+i*.88+.38*Math.sin(i*7.1);
    const offset=Math.sin(i*2.399)*1.23;
    place(x,offset,.085+.18*Math.sin(i*4.1)**2,i);
  }
  place(-11.5,-.23,.77,78);
  gravelBars.forEach(([x,side],i)=>{
    place(x,side*.71,.50+i%3*.12,i+55);
    for(let j=0;j<4;j++){
      place(x+(j-1.4)*.31,side*(.66+.15*j),.14+.23*Math.sin(i*3+j)**2,i*4+j);
    }
  });
  stones.castShadow=true;
  stones.receiveShadow=true;
  scene.add(stones);
}

function createCreek(scene:T.Scene){
  const positions:number[]=[],uv:number[]=[],depths:number[]=[],triangles:number[]=[];
  const length=224,across=8;
  let previousX=sourceX,previousZ=streamZ(sourceX),distance=0;
  for(let i=0;i<=length;i++){
    const x=T.MathUtils.lerp(sourceX,mouthX,i/length);
    const z=streamZ(x),y=streamSurface(x);
    distance+=Math.hypot(x-previousX,z-previousZ);
    previousX=x;
    previousZ=z;
    for(let j=0;j<=across;j++){
      const acrossBank=j/across*2-1;
      const bankZ=z+acrossBank*1.19*streamBankWidth(x,Math.sign(acrossBank));
      positions.push(x,y,bankZ);
      uv.push(distance,acrossBank);
      depths.push(y-woodlandHeight(x,bankZ));
      if(i>0&&j>0){
        const k=i*(across+1)+j;
        triangles.push(k-across-2,k-across-1,k-1,k-1,k-across-1,k);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('depth',new T.Float32BufferAttribute(depths,1));
  geometry.setIndex(triangles);
  const material=new T.ShaderMaterial({
    uniforms:{
      time:{value:0},streamLength:{value:distance},
      shallows:{value:new T.Color(0x8baf84)},pool:{value:new T.Color(0x297c6c)},
      reflection:{value:new T.Color(0xb6d8c7)},glint:{value:new T.Color(0xd6e9cd)},
      estuaryTint:{value:new T.Color(creekMouthTint)},
      ...T.UniformsUtils.clone(T.UniformsLib.fog)
    },
    fog:true,transparent:true,depthWrite:false,
    vertexShader:`
      attribute float depth;
      varying vec2 vUv;
      varying float vDepth;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vUv=uv;
        vDepth=depth;
        vWorld=(modelMatrix*vec4(position,1.)).xyz;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform float time;
      uniform float streamLength;
      uniform vec3 shallows;
      uniform vec3 pool;
      uniform vec3 reflection;
      uniform vec3 glint;
      uniform vec3 estuaryTint;
      varying vec2 vUv;
      varying float vDepth;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${shoreShader}
      ${swashShader}
      void main(){
        float deep=smoothstep(.025,.30,vDepth);
        float downstream=vUv.x-time*.83;
        float cross=vUv.y;
        float ripple=sin(downstream*7.8+cross*16.+1.2*sin(downstream*2.-cross*5.));
        float smallRipples=sin(downstream*12.5-cross*22.+.8*sin(downstream*3.+cross*9.));
        float rippleMask=smoothstep(.23,.83,.5+.27*sin(downstream*2.37+cross*13.1)
          +.23*sin(downstream*.96-cross*21.7));
        float sparkle=smoothstep(.58,.96,.52*ripple+.48*smallRipples)*rippleMask;
        float grazing=pow(1.-clamp(normalize(cameraPosition-vWorld).y,0.,1.),4.);
        vec3 color=mix(shallows,pool,deep);
        color=mix(color,reflection,.09+.25*grazing+.033*ripple);
        color=mix(color,glint,sparkle*(.14+.11*grazing));
        // Fade the creek into the sea using the same moving swash line as the ocean.
        float shoreDepth=vWorld.x-shoreAt(vWorld.z);
        float phase=swashPhase(vWorld.z,time);
        float seaEdge=shoreDepth-swashReach(vWorld.z,time,phase);
        float estuary=smoothstep(-3.1,.42,shoreDepth);
        float swash=1.-smoothstep(.02,.28,abs(seaEdge+.10));
        color=mix(color,estuaryTint,estuary*.47);
        color=mix(color,glint,estuary*swash*(.12+.19*rippleMask));

        float edge=smoothstep(-.008,.065,vDepth);
        float ends=smoothstep(0.,1.4,vUv.x)*(1.-smoothstep(streamLength-.68,streamLength,vUv.x));
        float seaCover=1.-smoothstep(-.025,.55,seaEdge);
        float opacity=edge*ends*seaCover*mix(.47,.89,deep);
        gl_FragColor=vec4(color,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  scene.add(new T.Mesh(geometry,material));
  addCreekStones(scene);
  return (time:number)=>{material.uniforms.time.value=time;};
}

export function buildWoodland(scene:T.Scene) {
  grove(scene);
  const updateCreek=createCreek(scene);
  guardian(scene,-16.2,-10.4,1.39,.51,-.09);
  guardian(scene,-25,-15,.87,.68,.14);
  return (time:number)=>{forestWindTime.value=time;updateCreek(time);};
}
