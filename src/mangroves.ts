import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {coast} from './waves';

type MangroveSite = {x:number; z:number; scale:number};
export type MangroveCollider = {from:T.Vector3; to:T.Vector3; radius:number};

// Spread trees across the tidal flat, leaving wider gaps between mature crowns.
const rows=11,columns=7;
export const mangroveSites:readonly MangroveSite[]=Array.from({length:rows*columns},(_,i)=>{
  const column=i%columns,row=Math.floor(i/columns);
  const z=15.9+row*2.82+.27*Math.sin(i*3.71);
  const inland=1.05+column*2.83+(row%2)*.78+.27*Math.cos(i*2.63);
  const scale=.68+.39*Math.sin(i*5.19+.48)**2;
  return {x:coast(z)-inland,z,scale};
});

const goldenAngle = 2.399963;
const bark = new T.Color(0x77604d);
const rootTip = new T.Color(0x51473c);
const youngWood = new T.Color(0x8c745b);
const canopyColors = [0x426d3f, 0x537d41, 0x658740, 0x73974a, 0x8aa453];
const shootBark = new T.Color(0x747653);

type CanopyBuffers={positions:number[]; colors:number[]; indices:number[]};
type GroundHeight=(x:number,z:number)=>number;
type RootSection={center:T.Vector3; radius:number; exposure:number};

function tubeRadius(start:number,end:number,progress:number){
  return T.MathUtils.lerp(end,start,Math.pow(1-progress,.76));
}

function collectColliders(colliders:MangroveCollider[],sections:readonly RootSection[]){
  const chord=new T.Line3();
  const closest=new T.Vector3();
  for(let i=0;i<sections.length-1;i+=2){
    const from=sections[i];
    const middle=sections[i+1];
    const to=sections[Math.min(i+2,sections.length-1)];
    if(Math.max(from.exposure,middle.exposure,to.exposure)<.11)continue;
    chord.set(from.center,to.center);
    chord.closestPointToPoint(middle.center,true,closest);
    colliders.push({
      from:from.center,
      to:to.center,
      radius:Math.max(from.radius,to.radius,middle.radius+closest.distanceTo(middle.center)),
    });
  }
}

function rootTube(curve:T.Curve<T.Vector3>,start:number,end:number,segments:number,base:T.Color,tip:T.Color,
  groundHeight?:GroundHeight,colliders?:MangroveCollider[]){
  const sides=6;
  const geometry=new T.TubeGeometry(curve,segments,1,sides,false);
  const positions=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  const colors=new Float32Array(positions.count*3);
  const tint=new T.Color();
  const normal=new T.Vector3();
  const sections:RootSection[]=[];
  for(let ring=0;ring<=segments;ring++){
    const u=ring/segments;
    const center=curve.getPointAt(u);
    const radius=tubeRadius(start,end,u);
    const clearance=groundHeight?center.y-groundHeight(center.x,center.z):Infinity;
    const damp=1-T.MathUtils.smoothstep(clearance,.015,.33);
    const flatten=1-.36*damp;
    if(colliders)sections.push({center,radius,exposure:clearance+radius*flatten});
    for(let side=0;side<=sides;side++){
      const index=ring*(sides+1)+side;
      positions.setXYZ(index,
        center.x+(positions.getX(index)-center.x)*radius,
        center.y+(positions.getY(index)-center.y)*radius*flatten,
        center.z+(positions.getZ(index)-center.z)*radius);
      const angle=side/sides*Math.PI*2;
      const grain=.087*Math.sin(angle*2+u*3.3)+.035*Math.cos(angle+u*18);
      tint.copy(base).lerp(tip,groundHeight?.21*u+.67*damp:u).multiplyScalar(.97+grain);
      tint.toArray(colors,index*3);
      normal.set(normals.getX(index),normals.getY(index)/flatten,normals.getZ(index)).normalize();
      normals.setXYZ(index,normal.x,normal.y,normal.z);
    }
  }
  geometry.deleteAttribute('uv');
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  if(colliders)collectColliders(colliders,sections);
  return geometry;
}

function growRoots(stems:T.BufferGeometry[],colliders:MangroveCollider[],trunk:T.Curve<T.Vector3>,site:MangroveSite,
  sites:readonly MangroveSite[],groundHeight:GroundHeight,seed:number,direction:number){
  const {x,z,scale}=site;
  const mainRoots:{curve:T.CatmullRomCurve3;width:number}[]=[];
  const neighbor=sites.filter(other=>other!==site&&other.scale>.65)
    .map(other=>({yaw:Math.atan2(other.z-z,other.x-x),distance:Math.hypot(other.x-x,other.z-z)}))
    .sort((a,b)=>a.distance-b.distance)[0];
  const bed=(px:number,pz:number,lift:number)=>new T.Vector3(px,groundHeight(px,pz)+lift*scale,pz);
  const radial=(yaw:number,distance:number,lift:number)=>bed(x+Math.cos(yaw)*distance,z+Math.sin(yaw)*distance,lift);
  const count=scale>.65?5+Math.floor(3*Math.sin(seed*2.38)**2):4;
  for(let i=0;i<count;i++){
    const towardNeighbor=i===0&&scale>.65&&neighbor&&neighbor.distance<4.8;
    const offset=.29*Math.sin(seed*3.7+i*6.23);
    const yaw=(towardNeighbor?neighbor.yaw:direction+i*goldenAngle)+offset;
    const shape=Math.sin(seed+i*2.58)**2;
    const length=towardNeighbor
      ? neighbor.distance*(.57+.13*shape)
      : scale*(.78+.99*shape+.17*Math.max(0,Math.cos(yaw)));
    const reach=Math.max(length,.38);
    const turn=.62*Math.sin(i*5.8+seed);
    const shoulder=trunk.getPoint(.21+.40*Math.cos(i*3.9+seed)**2);
    const hump=radial(yaw+turn*.18,reach*.32,.32+.27*shape);
    const ridge=radial(yaw+turn*.52,reach*.61,.096+.095*shape);
    const curve=new T.CatmullRomCurve3([
      shoulder,hump,ridge,radial(yaw+turn,reach*.77,.045+.055*shape),
      radial(yaw+turn*1.27,reach*.90,i%2===0?-.060:.018),
      radial(yaw+turn*1.19,reach*.97,i%2===0?.015:-.035),
      radial(yaw+turn*1.12,reach*1.035,-.105),
    ]);
    const width=(.078+.077*shape)*scale;
    stems.push(rootTube(curve,width,.010*scale,17,bark,rootTip,groundHeight,colliders));
    mainRoots.push({curve,width});
  }

  // A side root dips below the next prop root, then breaks the surface on the far side.
  const forks=scale>.65?4:2;
  for(let i=0;i<forks;i++){
    const parent=mainRoots[i];
    const upper=mainRoots[(i+1)%mainRoots.length];
    const joint=parent.curve.getPointAt(.51+.07*Math.sin(seed+i));
    const station=.59+.08*Math.sin(i*2.4+seed);
    const crossing=upper.curve.getPointAt(station);
    const tangent=upper.curve.getTangentAt(station);
    const side=new T.Vector2(-tangent.z,tangent.x).normalize();
    if(side.dot(new T.Vector2(joint.x-crossing.x,joint.z-crossing.z))<0)side.negate();
    const passing=(distance:number,lift:number)=>bed(crossing.x+side.x*distance*scale,
      crossing.z+side.y*distance*scale,lift);
    const width=(.031+.012*Math.sin(i+seed)**2)*scale;
    const underpass=[-.15,-.075,0,.075,.15].map(distance=>passing(distance,.026));
    // Use the upper root's real taper around the crossing, including its approach on each side.
    // Dipping several control points prevents the lower spline from bowing back through it.
    for(let j=-6;j<=6;j++){
      const u=station+j*.02;
      const point=upper.curve.getPointAt(u);
      const clearance=tubeRadius(upper.width,.010*scale,u)+width+.012*scale;
      for(const below of underpass){
        const distanceSquared=(point.x-below.x)**2+(point.z-below.z)**2;
        if(distanceSquared<clearance**2){
          below.y=Math.min(below.y,point.y-Math.sqrt(clearance**2-distanceSquared));
        }
      }
    }
    const curve=new T.CatmullRomCurve3([
      joint,passing(.29,.047),...underpass.reverse(),passing(-.30,.044),passing(-.57,i%2===0?-.035:.017),
      passing(-.75,.026),passing(-.93,-.09),
    ]);
    stems.push(rootTube(curve,width,.006*scale,22,bark,rootTip,groundHeight));
  }
}

function addLeaf(canopy:CanopyBuffers,stem:T.Vector3,yaw:number,tilt:number,length:number,tint:T.Color){
  const {positions,colors,indices}=canopy;
  const first=positions.length/3;
  const x=Math.cos(yaw),z=Math.sin(yaw);
  const halfWidth=.26*length;
  const outline=[
    [0,0,0,.75], [.31,.78,-.025,.92], [.63,.92,-.020,1.02], [1,0,-.07,1.08],
    [.68,-.91,-.035,.91], [.33,-.67,-.04,.84], [.52,0,.075,1.04],
  ];
  for(const [along,across,curl,light] of outline){
    const reach=length*along;
    positions.push(stem.x+x*reach-z*across*halfWidth,
      stem.y+reach*tilt+length*curl,stem.z+z*reach+x*across*halfWidth);
    colors.push(tint.r*light,tint.g*light,tint.b*light);
  }
  for(let i=0;i<6;i++)indices.push(first+6,first+i,first+(i+1)%6);
}

function canopySprig(canopy:CanopyBuffers,origin:T.Vector3,yaw:number,scale:number,seed:number){
  const {positions,colors,indices}=canopy;
  const x=Math.cos(yaw),z=Math.sin(yaw);
  const reach=scale*(.53+.105*Math.sin(seed*3.34));
  const rise=scale*(.38+.21*Math.sin(seed*2.06));
  const bend=scale*.13*Math.cos(seed*2.44);
  const point=(t:number)=>new T.Vector3(
    origin.x+x*reach*t-z*bend*t*t,
    origin.y+rise*t+.12*scale*Math.sin(t*Math.PI),
    origin.z+z*reach*t+x*bend*t*t,
  );
  const stemStart=positions.length/3;
  for(let i=0;i<=3;i++){
    const t=i/3;
    const base=point(t);
    const width=scale*T.MathUtils.lerp(.027,.005,t);
    positions.push(base.x+z*width,base.y,base.z-x*width);
    positions.push(base.x-z*width,base.y,base.z+x*width);
    colors.push(shootBark.r,shootBark.g,shootBark.b,shootBark.r,shootBark.g,shootBark.b);
    if(i>0){
      const a=stemStart+(i-1)*2;
      indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
  }
  const tint=new T.Color();
  for(let node=0;node<5;node++){
    const t=.19+node*.185;
    const length=scale*(.32+.14*Math.sin(Math.PI*t))*(.81+.17*Math.sin(seed+node*3.61)**2);
    for(const side of [-1,1]){
      const start=point(t+side*.018);
      const heading=yaw+side*(.96+.38*Math.sin(seed+node*1.49+side*.33));
      const tilt=.08+.48*Math.sin(seed*1.6+node*1.38+side*.97);
      const shade=(node>=3?2:0)+Math.floor(2.99*Math.sin(seed*2.17+node*2.4+side)**2);
      tint.set(canopyColors[shade]);
      addLeaf(canopy,start,heading,tilt,length*(side===1?.92:1),tint);
    }
  }
}

function groveMesh(name:string,parts:T.BufferGeometry[],roughness:number,side:T.Side=T.FrontSide){
  const geometry=mergeGeometries(parts)!;
  for(const part of parts)part.dispose();
  geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness,side}));
  mesh.name=name;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

export function buildMangroves(scene:T.Scene,sites:readonly MangroveSite[],groundHeight:GroundHeight):readonly MangroveCollider[]{
  if(!sites.length)return [];
  const stems:T.BufferGeometry[]=[];
  const colliders:MangroveCollider[]=[];
  const canopy:CanopyBuffers={positions:[],colors:[],indices:[]};
  for(const site of sites){
    const {x,z,scale}=site;
    const ground=groundHeight(x,z);
    const seed=x*.72+z*1.19;
    const direction=seed*goldenAngle;
    const at=(offsetX:number,height:number,offsetZ:number)=>
      new T.Vector3(x+offsetX*scale,ground+height*scale,z+offsetZ*scale);
    const leanX=(.21+.26*Math.sin(seed*.77)**2)*Math.cos(direction);
    const leanZ=(.22+.21*Math.cos(seed*.53)**2)*Math.sin(direction);
    const fork=at(leanX*.52,1.30,leanZ*.45);
    const trunkTop=at(leanX,2.26,leanZ);
    const trunk=new T.CubicBezierCurve3(at(0,-.13,0),at(-leanX*.34,.60,-leanZ*.38),fork,trunkTop);
    stems.push(rootTube(trunk,.16*scale,.036*scale,7,bark,youngWood,undefined,colliders));

    growRoots(stems,colliders,trunk,site,sites,groundHeight,seed,direction);

    for(let i=0;i<5;i++){
      const yaw=direction+i*goldenAngle+.26*Math.sin(seed+i*3.71);
      const spread=.81+.28*Math.sin(seed+i*2.4);
      const height=1.96+.31*Math.sin(i*2.3+seed);
      const branchEnd=at(Math.cos(yaw)*spread,height,Math.sin(yaw)*spread);
      const branchBase=trunk.getPoint(.50+.24*Math.sin(seed*.81+i*3.4)**2);
      const branch=new T.QuadraticBezierCurve3(branchBase,
        at(Math.cos(yaw)*spread*.68,height-.31,Math.sin(yaw)*spread*.68),branchEnd);
      stems.push(rootTube(branch,.059*scale,.013*scale,5,bark,youngWood));
      const sprayCount=(Math.sin(seed+i*1.9)>.28?5:7)-(scale<.5?2:0);
      for(let j=0;j<sprayCount;j++){
        const t=j/(sprayCount-1);
        const heading=yaw+(t-.5)*3.9+.46*Math.sin(seed+i+j*4);
        const start=branch.getPoint(.60+t*.40);
        const shootScale=scale*(.93+.24*Math.sin(seed*1.2+i+j*1.39));
        canopySprig(canopy,start,heading,shootScale,seed+i*3.1+j*1.77);
      }
    }
    const crownCount=(Math.sin(seed*1.29)>.1?5:7)-(scale<.5?2:0);
    for(let i=0;i<crownCount;i++){
      const start=trunk.getPoint(.86+.14*(i%3)/2);
      canopySprig(canopy,start,direction+i*goldenAngle,scale*(.92+.22*Math.sin(seed+i*5)),seed+i*1.7);
    }
  }
  const leaves=new T.BufferGeometry();
  leaves.setAttribute('position',new T.Float32BufferAttribute(canopy.positions,3));
  leaves.setAttribute('color',new T.Float32BufferAttribute(canopy.colors,3));
  leaves.setIndex(canopy.indices);
  leaves.computeVertexNormals();
  const foliage=groveMesh('Mangrove canopies',[leaves],.70,T.DoubleSide);
  foliage.material.alphaHash=true;
  foliage.material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',`
      diffuseColor.a *= smoothstep(.20,.59,length(vViewPosition));
      #include <alphahash_fragment>
    `);
  };
  const grove=new T.Group();
  grove.name='Mangrove Grove';
  grove.add(groveMesh('Mangrove trunks and prop roots',stems,.93),foliage);
  scene.add(grove);
  return colliders;
}
