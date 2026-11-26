import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {box,mesh,sphere} from './environment';
import {fruitMenu} from './fruit-menu';
import {sandHeight} from './waves';

type Fruit=typeof fruitMenu[number]['food'];

export function buildFruitStand(scene:T.Scene){
  const stand=new T.Group();
  stand.position.set(-14.7,sandHeight(-14.7,7.7),7.7);
  scene.add(stand);
  const teal=0x237c74,cream=0xffe5ab,wood=0xaa693a;
  box(stand,wood,5.18,.18,2.8,0,.09);
  box(stand,cream,4.68,2.64,.12,0,1.46,-1.05);
  for(const x of [-2.26,2.26]){
    box(stand,teal,.14,2.78,.16,x,1.53,1);
    box(stand,cream,.12,.91,1.95,x,.62,0);
  }
  box(stand,teal,4.48,.84,.17,0,.63,.99);
  box(stand,wood,4.74,.13,1.02,0,1.13,.83);
  box(stand,teal,4.94,.16,2.47,0,2.88,-.08);
  const canopy=[0xe25e42,0xffdf85,0x2d9587,0xffdf85,0xe8a638,0xffdf85,0x2d9587,0xffdf85,0xe25e42];
  canopy.forEach((tint,i)=>{
    const x=(i-4)*.55;
    box(stand,tint,.547,.065,1.09,x,2.74,1.34).rotation.x=.20;
    box(stand,tint,.547,.16,.065,x,2.55,1.86);
  });
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=96;
  const context=canvas.getContext('2d')!;
  context.fillStyle='#175b55';context.fillRect(0,0,512,96);
  context.fillStyle='#ffe7b1';context.font='bold 48px Georgia';context.textAlign='center';
  context.textBaseline='middle';context.fillText('TROPICAL FRUIT',256,49,470);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.PlaneGeometry(3.33,.62),new T.MeshBasicMaterial({map:texture}));
  sign.position.set(0,3.07,1.28);
  stand.add(sign);

  const peel=new T.IcosahedronGeometry(1,2);
  const leaf=new T.ConeGeometry(1,1,4);
  function fruit(parent:T.Group,kind:Fruit,tint:number){
    if(kind==='banana'){
      for(let i=0;i<3;i++){
        const offset=(i-1)*.063;
        const arc=new T.QuadraticBezierCurve3(new T.Vector3(-.13,.063,offset),
          new T.Vector3(.015,-.036,offset),new T.Vector3(.14,.12,offset));
        mesh(parent,new T.TubeGeometry(arc,8,.033,5,false),tint);
      }
    }else if(kind==='pineapple'||kind==='dragon'){
      const body=mesh(parent,peel,tint,0,kind==='pineapple'?.136:.115,0);
      body.scale.set(.106,kind==='pineapple'?.142:.116,.102);
      for(let i=0;i<7;i++){
        const yaw=i*2.399;
        const height=kind==='pineapple'?.133:.045;
        const sprout=mesh(parent,leaf,kind==='pineapple'?0x417a39:0x8bb75c,
          Math.sin(yaw)*(kind==='pineapple'?.05:.090),kind==='pineapple'?.29:.09+i*.018,Math.cos(yaw)*(kind==='pineapple'?.05:.090));
        sprout.scale.set(.022,height,.015);
        sprout.rotation.set(.57,yaw,.24,'YXZ');
      }
    }else{
      const long=kind==='papaya'||kind==='mango';
      const size=kind==='passion'?.072:.109;
      const skin=sphere(parent,tint,size,long?.085:size,size*(long?1.48:1),0,size,0);
      skin.rotation.y=.32;
      if(kind==='mango'||kind==='papaya'){
        sphere(parent,kind==='mango'?0xd84d39:0xcb6533,.067,.064,.073,.043,size+.014,.056);
      }
      if(kind==='coconut')box(parent,0xc3b375,.039,.018,.038,0,size*2,0);
    }
  }
  function makeFruitGeometry(kind:Fruit,tint:number){
    const model=new T.Group();
    fruit(model,kind,tint);
    model.updateMatrixWorld(true);
    const parts:T.BufferGeometry[]=[];
    for(const piece of model.children as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]){
      const part=(piece.geometry.index?piece.geometry.toNonIndexed():piece.geometry.clone());
      part.applyMatrix4(piece.matrixWorld);
      part.deleteAttribute('uv');
      const colors=new Float32Array(part.getAttribute('position').count*3);
      for(let i=0;i<colors.length;i+=3)piece.material.color.toArray(colors,i);
      part.setAttribute('color',new T.BufferAttribute(colors,3));
      parts.push(part);
    }
    const geometry=mergeGeometries(parts)!;
    for(const part of parts)part.dispose();
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!;
    const center=bounds.getCenter(new T.Vector3());
    const size=bounds.getSize(new T.Vector3());
    geometry.translate(-center.x,-bounds.min.y,-center.z);
    return {geometry,size};
  }

  const capacity=20;
  const fruitMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.79});
  const specimen=new T.Object3D();
  function place(batch:T.InstancedMesh,index:number,x:number,y:number,z:number,scale:number,rotation:number){
    specimen.position.set(x,y,z);
    specimen.scale.setScalar(scale);
    specimen.rotation.y=rotation;
    specimen.updateMatrix();
    batch.setMatrixAt(index,specimen.matrix);
  }

  // The raised bins hold regular stock. The low front shelf is reserved for selected fruit.
  const shelfZ=1.52;
  box(stand,wood,4.62,.10,.61,0,1.105,shelfZ);
  box(stand,0xb9814e,4.50,.025,.55,0,1.167,shelfZ);
  box(stand,0x78502e,4.62,.07,.038,0,1.16,1.83);
  for(const x of [-1.87,0,1.87])box(stand,wood,.084,.19,.36,x,.98,1.42).rotation.x=-.39;

  const selection=new Map<Fruit,{batch:T.InstancedMesh;radius:number}>();
  fruitMenu.forEach(({food,color},i)=>{
    const x=(i-3)*.64,z=.76;
    box(stand,0xd19557,.60,.065,.87,x,1.232,z);
    for(const side of [-1,1]){
      box(stand,0xa76b40,.033,.115,.87,x+side*.285,1.287,z);
      box(stand,0x9a5c35,.60,.070,.035,x,1.265,z+side*.418);
    }
    const {geometry,size}=makeFruitGeometry(food,color);
    const radius=Math.hypot(size.x,size.z)/2;
    const small=food==='passion'||food==='coconut'||food==='mango';
    const columns=small?3:2,rows=small?3:4;
    const baseCount=columns*rows;
    const topCount=small?3:2;
    const stock=new T.InstancedMesh(geometry,fruitMaterial,baseCount+topCount);
    for(let j=0;j<baseCount;j++){
      const column=j%columns,row=Math.floor(j/columns);
      const scale=(small?.84:.91)+.09*Math.sin(i*9+j*4);
      place(stock,j,x+(column-(columns-1)/2)*(small?.17:.255),1.266,
        z+(row-(rows-1)/2)*.191,scale,(i+j)*2.399);
    }
    for(let j=0;j<topCount;j++){
      place(stock,baseCount+j,x+(j%2-.5)*.13,1.267+size.y*.48,
        z+(j-1)*.18,.88,(i+j)*1.3);
    }
    stock.receiveShadow=true;
    stand.add(stock);
    const selected=new T.InstancedMesh(geometry,fruitMaterial,capacity);
    selected.instanceMatrix.setUsage(T.DynamicDrawUsage);
    selected.count=0;
    selected.receiveShadow=true;
    selected.frustumCulled=false;
    stand.add(selected);
    selection.set(food,{batch:selected,radius});
  });
  return (foods:Fruit[])=>{
    for(const {batch} of selection.values())batch.count=0;
    const columns=Math.min(26,Math.max(1,Math.ceil(foods.length/2)));
    const rows=Math.ceil(foods.length/columns);
    const pitchX=Math.min(.32,4.36/columns),pitchZ=Math.min(.24,.52/Math.max(1,rows));
    foods.forEach((food,i)=>{
      const {batch,radius}=selection.get(food)!;
      if(batch.count===capacity)return;
      const row=Math.floor(i/columns),column=i%columns;
      const rowCount=Math.min(columns,foods.length-row*columns);
      const scale=Math.min(1.1,Math.min(pitchX,pitchZ)*.5/radius);
      place(batch,batch.count++, (column-(rowCount-1)/2)*pitchX,1.18,
        shelfZ+(row-(rows-1)/2)*pitchZ,scale,i*2.399);
    });
    for(const {batch} of selection.values())if(batch.count>0)batch.instanceMatrix.needsUpdate=true;
  };
}
