import {coconutBunches,palmTrunk,pinnateFrond} from './palm-geometry';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {coast,sandHeight} from './waves';
import {hanaumaRim} from './hanauma';

const smooth = (a:number,b:number,v:number) => T.MathUtils.smoothstep(v,a,b);
const hills = [
  {x:-37,z:-49,height:15,rx:21,rz:23},
  {x:-58,z:-62,height:25,rx:27,rz:32},
  {x:-29,z:-75,height:20,rx:22,rz:23},
  {x:-73,z:-26,height:14,rx:21,rz:25}
];
export const streamZ = (x:number) => -9.4 + .43*x + 2.8*Math.sin(x*.208);
const streamWidth = (x:number) => 1.10 + .33*Math.sin(x*.28) + .18*Math.cos(x*.71);
const mouthX = .12;
const sourceX = -62;

function forestBase(x:number,z:number) {
  const front = Math.max(-z-4, -x-18);
  return smooth(0,10,front) * smooth(1,5,coast(z)-x);
}

function ground(x:number,z:number) {
  const offshore=x-coast(z);
  const shelf=smooth(7,34,offshore);
  const base=Math.max(-2,sandHeight(x,z))-shelf*(6.4+.50*Math.sin(x*.48)*Math.cos(z*.39));
  let relief = 0;
  for(const hill of hills){
    const dx=(x-hill.x)/hill.rx,dz=(z-hill.z)/hill.rz;
    const radial=Math.max(0,1-dx*dx-dz*dz);
    const folds=.91+.12*Math.cos(dx*9+dz*2)+.065*Math.sin(dz*16-dx*9);
    relief+=hill.height*.43*Math.pow(radial,1.9)*folds;
  }
  const undulation=(.26*Math.sin(x*.34+z*.19)+.19*Math.cos(z*.39-x*.27))*forestBase(x,z);
  return base+relief+undulation+hanaumaRim(-offshore,z);
}

export function woodlandHeight(x:number,z:number) {
  const riverWidth=streamWidth(x);
  const bank=1-smooth(riverWidth*.45,riverWidth*1.66,Math.abs(z-streamZ(x)));
  const limit=smooth(sourceX-3,sourceX+2,x)*(1-smooth(mouthX,mouthX+2,x));
  const creekBed=ground(x,streamZ(x))-.48;
  return T.MathUtils.lerp(ground(x,z),creekBed,bank*limit);
}

export function colorWoodland(color:T.Color,x:number,z:number,y:number) {
  const rim = hanaumaRim(coast(z)-x,z);
  if(rim>.001){
    const ribs=.5+.5*Math.sin(z*1.34+x*.41);
    color.lerp(loam,smooth(.06,1.9,rim)*.96);
    color.lerp(basalt,smooth(3,15,rim)*(.28+.43*ribs));
  }
  const forest=forestBase(x,z);
  if(forest>.001){
    const marbling=.5+.5*Math.sin(x*.39-z*.55+1.8*Math.cos(z*.19));
    color.lerp(loam,forest*(.74+marbling*.26));
    color.lerp(basalt,forest*smooth(7,24,y)*(.25+marbling*.35));
  }
  if(x>sourceX&&x<mouthX+1){
    const silt=1-smooth(streamWidth(x)*.65,streamWidth(x)*1.75,Math.abs(z-streamZ(x)));
    color.lerp(clay,silt*smooth(0,.45,sandHeight(x,z))*.74);
  }
}
const loam=new T.Color(0x53683a);
const basalt=new T.Color(0x4d6050);
const clay=new T.Color(0x715b38);
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

function frond(length:number,width:number,arch:number,notches:boolean){
  const points:number[]=[];
  for(let i=0;i<12;i++){
    const t=i/12,u=(i+1)/12;
    const center=(v:number)=>arch*Math.sin(v*2.52)-(notches?.68:.18)*v;
    const leaf=(v:number)=>width*Math.pow(Math.sin(v*Math.PI),.72);
    const sweep=(v:number)=>notches&&i%2===0?.67*leaf(v):leaf(v);
    for(const side of [-1,1]){
      const a=[t*length,center(t),0];
      const b=[u*length,center(u),0];
      const c=[t*length-.095,center(t)-.11,side*sweep(t)];
      const d=[u*length-.095,center(u)-.11,side*sweep(u)];
      points.push(...a,...b,...c,...b,...d,...c);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.computeVertexNormals();
  return geometry;
}

function coconut() {
  const tree=new TreeGeometry();
  const trunk=new T.QuadraticBezierCurve3(new T.Vector3(),new T.Vector3(.10,2.1,0),new T.Vector3(.58,5,0));
  tree.add(palmTrunk(trunk,.18,1,24),0x947252);
  tree.crown(.58,5,0,.30,.28,.30,0x59653b);
  tree.add(coconutBunches(1),0xffffff,.58,5,0);
  for(let i=0;i<10;i++){
    tree.add(pinnateFrond(2.39+.54*Math.sin(i*6.57),.59,.85+.21*Math.sin(i*2.1),i<7?.60:1.05,9,i),
      [0x326c45,0x53834b,0x668e49][i%3],.58,5,0,1,1,1,i*2.399);
  }
  return tree.finish();
}

function banyan() {
  const tree=new TreeGeometry();
  const base=new T.Vector3(0,0,0), shoulder=new T.Vector3(-.20,2.5,0);
  tree.branch(base,shoulder,.51,.37,0x655742);
  for(let j=0;j<7;j++){
    const angle=j*2.399;
    const x=1.86*Math.cos(angle),z=1.82*Math.sin(angle),y=3.8+.45*Math.sin(j*1.36);
    tree.branch(shoulder,new T.Vector3(x,y,z),.225,.07,0x685b43);
    tree.branch(new T.Vector3(x*.92,y-.22,z*.94),new T.Vector3(x*.98,0,z),.039,.08,0x775e43);
    for(let i=0;i<2;i++){
      const rootTop=new T.Vector3(x*(.72+i*.13),y-.33,z*(.72+i*.13));
      const rootEnd=rootTop.clone().add(new T.Vector3(.09*Math.sin(j+i),-1.1-i*.7,.13*Math.cos(j)));
      tree.branch(rootTop,rootEnd,.025,.013,0x765e43);
    }
    tree.branch(new T.Vector3(x*.66,1.0,z*.66),new T.Vector3(x,0,z),.14,.025,0x625541);
    tree.crown(x,y+.26,z,1.46,.83,1.20,[0x2c623f,0x3b7546,0x497744][j%3],1);
    for(let i=0;i<5;i++){
      const heading=angle+i*2.399;
      const spread=.64+.47*Math.sin(i*2+j)**2;
      tree.crown(x+spread*Math.cos(heading),y+.47+.41*Math.sin(i*3+j),
        z+spread*Math.sin(heading),.77,.49,.64,
        [0x376845,0x42794a,0x56834b,0x61914e][(i+j)%4],0);
    }
  }
  tree.crown(0,4.75,0,2.06,1.33,1.83,0x44844a,1);
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
  for(let i=0;i<8;i++)tree.add(frond(.96,.26,.60,true),i%2===0?0x628e42:0x759d49,0,.14,0,1,.58,1,i*2.399);
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
    const leaf=frond(1.72+.40*Math.sin(i*2.2),.46,.45+.16*Math.sin(i*1.7),false);
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
    const tip=new T.Vector3(direction*(.29-i*.035),y+.13,0);
    plant.branch(new T.Vector3(0,y,0),tip,.059-i*.006,.012,i<3?0xd7452b:0xeb5b29);
    plant.crown(tip.x*.94,tip.y,0,.038,.028,.027,0xf6b748);
  }
  return plant.finish();
}

function grove(scene:T.Scene){
  const prototypes=[coconut(),banyan(),fanPalm(),travelersPalm(),fern(),banana(),heliconia()];
  const trees:T.Matrix4[][]=prototypes.map(()=>[]);
  const plant=new T.Object3D();
  let seed=719;
  const rng=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  function add(kind:number,x:number,z:number,scale:number){
    plant.position.set(x,woodlandHeight(x,z)-.022,z);
    plant.rotation.set(0,rng()*Math.PI*2,0);
    plant.scale.set(scale*(.90+.24*rng()),scale,scale*(.90+.24*rng()));
    plant.updateMatrix();
    trees[kind].push(plant.matrix.clone());
  }
  for(let z=-92;z<=12;z+=3.55){
    for(let x=-76;x<=3;x+=3.6){
      const px=x+(rng()-.5)*3,pz=z+(rng()-.5)*3;
      const height=woodlandHeight(px,pz);
      if(forestBase(px,pz)<.52 || height>21 || Math.abs(pz-streamZ(px))<2.35
        || Math.hypot(px+16.2,pz+10.4)<3.7 || Math.hypot(px+25,pz+15)<2.7 || rng()<.10)continue;
      const variant=rng();
      const kind=variant<.43?0:variant<.65?1:variant<.86?2:3;
      add(kind,px,pz,(.70+rng()*.50)*(height>9?.77:1));
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
        || woodlandHeight(px,pz)>12 || Math.hypot(px+16.2,pz+10.4)<4.6
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
  for(let i=0;i<prototypes.length;i++){
    const geometry=prototypes[i];
    const position=geometry.getAttribute('position');
    const weights=new Float32Array(position.count);
    const bending=[.16,.055,.18,.17,.12,.28,.13][i];
    const leafBase=[4.82,3.05,3.03,1.12,.13,1.63,.43][i];
    for(let vertex=0;vertex<position.count;vertex++){
      const radial=Math.hypot(position.getX(vertex),position.getZ(vertex));
      const height=smooth(leafBase-.22,leafBase+.42,position.getY(vertex));
      weights[vertex]=bending*height*smooth(.24,i===4?.94:1.85,radial);
    }
    geometry.setAttribute('windWeight',new T.BufferAttribute(weights,1));
    const objects=new T.InstancedMesh(geometry,forestMaterial,trees[i].length);
    trees[i].forEach((matrix,j)=>objects.setMatrixAt(j,matrix));
    objects.computeBoundingSphere();
    objects.boundingSphere!.radius+=.5;
    objects.receiveShadow=true;
    // The individually animated beach palms already supply the visible foreground shadows.
    scene.add(objects);
  }
}

const rocks=new T.IcosahedronGeometry(1,1);
const darkRock=new T.MeshStandardMaterial({color:0x555f51,roughness:1,flatShading:true});
const grayRock=new T.MeshStandardMaterial({color:0x828075,roughness:.98,flatShading:true});
const stoneCut=new T.MeshStandardMaterial({color:0x4e514c,roughness:1});
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

function createCreek(scene:T.Scene){
  const positions:number[]=[],uv:number[]=[],triangles:number[]=[];
  const length=200,across=6;
  for(let i=0;i<=length;i++){
    const t=i/length,x=T.MathUtils.lerp(sourceX,mouthX,t);
    const z=streamZ(x),width=streamWidth(x);
    const y=ground(x,z)-.255+.022*Math.sin(x*.61);
    for(let j=0;j<=across;j++){
      const v=j/across;
      positions.push(x,y,z+(v*2-1)*width);
      uv.push(t,v);
      if(i>0&&j>0){
        const k=i*(across+1)+j;
        triangles.push(k-across-2,k-1,k-across-1,k-1,k,k-across-1);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(triangles);
  const material=new T.ShaderMaterial({
    uniforms:{time:{value:0},...T.UniformsUtils.clone(T.UniformsLib.fog)},
    fog:true,side:T.DoubleSide,
    vertexShader:`
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vUv=uv;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform float time;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        float depth=smoothstep(.01,.34,min(vUv.y,1.-vUv.y));
        vec3 edge=vec3(.18,.28,.135);
        vec3 center=vec3(.030,.28,.24);
        float flow=sin(vUv.x*146.-time*3.1+3.*sin(vUv.y*8.+vUv.x*22.));
        float broken=.5+.5*sin(vUv.x*107.+vUv.y*26.+sin(vUv.x*35.));
        float gleam=smoothstep(.87,.997,flow)*smoothstep(.25,.86,broken);
        vec3 col=mix(edge,center,depth)+gleam*vec3(.13,.26,.19);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  scene.add(new T.Mesh(geometry,material));
  for(let i=0;i<38;i++){
    const x=-43+i*1.1,z=streamZ(x)+(i%2===0?-1:1)*(streamWidth(x)*(.87+.22*Math.sin(i*5)));
    const s=.19+.45*Math.sin(i*2.4)**2;
    rock(scene,i%3===0?moss:darkRock,x,woodlandHeight(x,z)+s*.13,z,s*1.14,s*.48,s*.77).rotation.y=i*.99;
  }
  return (time:number)=>{material.uniforms.time.value=time;};
}

export function buildWoodland(scene:T.Scene) {
  grove(scene);
  const updateCreek=createCreek(scene);
  guardian(scene,-16.2,-10.4,1.39,.51,-.09);
  guardian(scene,-25,-15,.87,.68,.14);
  return (time:number)=>{forestWindTime.value=time;updateCreek(time);};
}
