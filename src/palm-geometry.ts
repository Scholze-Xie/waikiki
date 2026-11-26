import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function pinnateFrond(length:number,width:number,arch:number,droop:number,pairs:number,seed:number,petiole=.08) {
  const positions:number[]=[];
  const colors:number[]=[];
  const sweep=width*.36*Math.sin(seed*1.79);
  const point=(t:number)=>new T.Vector3(
    length*t,
    arch*Math.sin(t*2.65)-droop*t*t,
    sweep*t*t,
  );
  function triangle(
    a:T.Vector3,b:T.Vector3,c:T.Vector3,shades:[number,number,number],reverse=false,stem=false,
  ){
    const points=[a,b,c];
    for(const i of reverse?[0,2,1]:[0,1,2]){
      const {x,y,z}=points[i];
      const shade=shades[i];
      positions.push(x,y,z);
      colors.push(shade*(stem?1.08:1),shade,shade*(stem?.68:.90));
    }
  }
  for(let i=0;i<pairs;i++){
    for(const side of [-1,1]){
      const t=petiole+(.97-petiole)*(i+(side>0?.34:0))/pairs;
      const root=point(t);
      const envelope=Math.sin(Math.PI*t);
      const variation=Math.sin(i*3.7+seed+side);
      const span=width*Math.pow(envelope,.75)*(.92+.12*variation);
      const tip=point(Math.min(1,t+.10+.045*t+.016*variation));
      tip.y-=span*(.43+.17*envelope+.09*variation);
      tip.z+=side*span;
      const blade=length/pairs*(.25+.24*envelope);
      const fold=root.clone().lerp(tip,.43).add(new T.Vector3(0,span*.15,0));
      const leading=root.clone().lerp(tip,.33).add(new T.Vector3(-blade,-span*.06,0));
      const trailing=root.clone().lerp(tip,.56).add(new T.Vector3(blade,-span*.12,0));
      const tint=.77+.19*t+.09*Math.sin(i*2.13+seed);
      const reverse=side<0;
      triangle(root,leading,fold,[tint*.72,tint*.93,tint*1.05],reverse);
      triangle(leading,tip,fold,[tint*.93,tint*.98,tint*1.05],reverse);
      triangle(root,fold,trailing,[tint*.70,tint*.91,tint*.80],reverse);
      triangle(fold,tip,trailing,[tint*.91,tint*.98,tint*.80],reverse);
    }
  }
  // Sample each strip edge from the same rachis profile so adjacent panels meet.
  const stemEdge=(center:T.Vector3,t:number,side:number)=>center.clone().add(
    new T.Vector3(0,-.012*(1-t),side*(.028*(1-t)+.002)),
  );
  for(let i=0;i<pairs;i++){
    const t=i/pairs, next=(i+1)/pairs;
    const a=point(t), b=point(next);
    const left=stemEdge(a,t,-1), right=stemEdge(a,t,1);
    const nextLeft=stemEdge(b,next,-1), nextRight=stemEdge(b,next,1);
    triangle(left,a,nextLeft,[.81,1.07,.81],false,true);
    triangle(a,b,nextLeft,[1.07,1.07,.81],false,true);
    triangle(a,right,b,[1.07,.73,1.07],false,true);
    triangle(right,nextRight,b,[.73,.73,1.07],false,true);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function palmCrownFrond(index:number,count:number,seed:number,
  {length=1,width=.59,arch=1,droop=1,pairs=12}={}){
  const tier=index/count;
  const young=tier<.20;
  const outer=tier>=.64;
  const variation=Math.sin(index*5.31+seed);
  const reach=(young?1.30:outer?2.58:2.25)*length*(1+.14*variation);
  const rise=(young?1.49:outer?.54:.98)*arch*(1+.15*Math.cos(index*3.8+seed));
  const fall=(young?.25:outer?1.43:.68)*droop;
  const tint=young?[0x8fb84b,0x9ac256]:outer?[0x37633e,0x507743,0x687c3b]:[0x477f45,0x5d954b,0x6e9d49];
  const yaw=index*2.399+seed;
  const collar=young?.038:outer?.135:.09;
  return {
    geometry:pinnateFrond(reach,width*(young?.63:outer?1:.94),rise,fall,young?Math.max(6,pairs-3):pairs,index+seed,.15),
    color:tint[index%tint.length], yaw,
    origin:new T.Vector3(Math.cos(yaw)*collar,young?.13:outer?-.115:.025,-Math.sin(yaw)*collar)
  };
}

export function palmTrunk(curve:T.Curve<T.Vector3>,radius:number,seed:number,segments:number){
  const sides=10;
  const geometry=new T.TubeGeometry(curve,segments,radius,sides,false);
  const position=geometry.attributes.position;
  const colors:number[]=[];
  for(let ring=0;ring<=segments;ring++){
    const t=ring/segments;
    const center=curve.getPointAt(t);
    const foot=Math.exp(-t*20);
    const collar=T.MathUtils.smoothstep(t,.85,1);
    for(let j=0;j<=sides;j++){
      const index=ring*(sides+1)+j;
      const angle=j/sides*Math.PI*2;
      const grain=Math.sin(angle*3+t*8+seed);
      const fluting=Math.sin(angle*5+seed);
      const scarPhase=ring*2.35+.59*Math.sin(ring*.65+seed)+.29*Math.sin(angle+seed);
      const scar=Math.max(0,Math.cos(scarPhase))**6;
      const taper=1.05-.39*t+(.34+.12*fluting)*foot+.13*collar-.036*scar+.025*grain;
      position.setXYZ(index,center.x+(position.getX(index)-center.x)*taper,
        center.y+(position.getY(index)-center.y)*taper,
        center.z+(position.getZ(index)-center.z)*taper);
      const shade=.90-.17*scar+.079*grain+.048*Math.sin(angle*5+ring*.61);
      colors.push(shade,shade*(.95+.09*collar),shade*(.87+.06*collar));
    }
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  // Keep the tube's shared radial normals smooth across the UV seam.
  return geometry;
}


export function coconutBunches(seed:number,bunchCount=2){
  const parts:T.BufferGeometry[]=[];
  const up=new T.Vector3(0,1,0);
  function add(source:T.BufferGeometry,color:number){
    const geometry=source.toNonIndexed();
    source.dispose();
    geometry.deleteAttribute('uv');
    const tint=new T.Color(color);
    const colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    parts.push(geometry);
  }
  function stalk(from:T.Vector3,to:T.Vector3,radius:number,color:number){
    const direction=to.clone().sub(from);
    const center=from.clone().lerp(to,.5);
    const geometry=new T.CylinderGeometry(radius,radius*.78,direction.length(),5);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,direction.normalize()));
    geometry.translate(center.x,center.y,center.z);
    add(geometry,color);
  }
  for(let bunch=0;bunch<bunchCount;bunch++){
    const angle=seed+bunch*2.399;
    const radial=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
    const tangent=new T.Vector3(-radial.z,0,radial.x);
    const base=radial.clone().multiplyScalar(.16).setY(-.07);
    const bend=radial.clone().multiplyScalar(.39).setY(-.22);
    const end=radial.clone().multiplyScalar(.47).setY(-.45);
    stalk(base,bend,.032,0x71813c);
    stalk(bend,end,.023,0x71813c);
    for(let i=0;i<(bunch===0?4:3);i++){
      const attachment=bend.clone().lerp(end,.12+.24*i);
      const top=attachment.clone().addScaledVector(tangent,(i%2===0?-1:1)*(.12+i*.018));
      top.addScaledVector(radial,.05+i*.03);
      top.y-=.08;
      stalk(attachment,top,.013,0x77863e);
      const fruit=new T.SphereGeometry(1,8,6);
      const length=.142+.018*Math.sin(seed+i*2.3+bunch);
      const axis=new T.Vector3(.16*radial.x,1,.16*radial.z).normalize();
      const center=top.clone().addScaledVector(axis,-length*.96);
      fruit.scale(.11,length,.103);
      fruit.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,axis));
      fruit.translate(center.x,center.y,center.z);
      add(fruit,[0x809646,0x9ca049,0x708440,0xa39745][(i+bunch)%4]);
    }
  }
  const geometry=mergeGeometries(parts)!;
  for(const part of parts)part.dispose();
  return geometry;
}
