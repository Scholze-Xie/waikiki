import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function pinnateFrond(length:number,width:number,arch:number,droop:number,pairs:number,seed:number) {
  const positions:number[]=[];
  const colors:number[]=[];
  const point=(t:number)=>new T.Vector3(length*t,arch*Math.sin(t*2.65)-droop*t,0);
  function triangle(a:T.Vector3,b:T.Vector3,c:T.Vector3,shade:number){
    for(const p of [a,b,c]){
      positions.push(p.x,p.y,p.z);
      colors.push(shade,shade,shade*.90);
    }
  }
  for(let i=0;i<pairs;i++){
    for(const side of [-1,1]){
      const t=.075+.88*(i+(side>0?.28:0))/pairs;
      const root=point(t);
      const span=width*Math.pow(Math.sin(Math.PI*t),.75)*(.88+.12*Math.sin(i*3.7+seed+side));
      const tip=point(t+.12).add(new T.Vector3(0,-span*.58,side*span));
      const fold=root.clone().lerp(tip,.49);
      fold.y+=span*.1;
      const blade=length/pairs*(.27+.20*Math.sin(Math.PI*t));
      const leading=fold.clone().add(new T.Vector3(-blade,-span*.09,0));
      const trailing=fold.clone().add(new T.Vector3(blade,-span*.14,0));
      const tint=.76+.20*t+.10*Math.sin(i*2.13+seed);
      triangle(root,leading,fold,tint);
      triangle(leading,tip,fold,tint*.94);
      triangle(root,fold,trailing,tint*.79);
      triangle(fold,tip,trailing,tint*.86);
    }
  }
  for(let i=0;i<pairs;i++){
    const a=point(i/pairs), b=point((i+1)/pairs);
    const halfWidth=.026*(1-i/pairs)+.002;
    const left=a.clone().add(new T.Vector3(0,-.013,-halfWidth));
    const right=a.clone().add(new T.Vector3(0,-.013,halfWidth));
    const nextLeft=b.clone().add(new T.Vector3(0,-.013,-halfWidth*.9));
    const nextRight=b.clone().add(new T.Vector3(0,-.013,halfWidth*.9));
    triangle(left,a,nextLeft,.96);
    triangle(a,b,nextLeft,.96);
    triangle(a,right,b,.84);
    triangle(right,nextRight,b,.84);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function palmTrunk(curve:T.Curve<T.Vector3>,radius:number,seed:number,segments:number){
  const sides=10;
  const geometry=new T.TubeGeometry(curve,segments,radius,sides,false);
  const position=geometry.attributes.position;
  const colors:number[]=[];
  for(let ring=0;ring<=segments;ring++){
    const t=ring/segments;
    const center=curve.getPointAt(t);
    const scar=ring%3===1;
    for(let j=0;j<=sides;j++){
      const index=ring*(sides+1)+j;
      const angle=j/sides*Math.PI*2;
      const grain=Math.sin(angle*3+t*8+seed);
      const taper=1.06-.30*t+.28*Math.exp(-t*17)+(scar?.05:0)+.026*grain;
      position.setXYZ(index,center.x+(position.getX(index)-center.x)*taper,
        center.y+(position.getY(index)-center.y)*taper,
        center.z+(position.getZ(index)-center.z)*taper);
      const shade=(scar?.66:.91)+.11*grain+.07*Math.sin(angle*5+ring*.61);
      colors.push(shade,shade*.96,shade*.89);
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
