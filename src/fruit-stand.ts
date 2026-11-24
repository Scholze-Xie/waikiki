import * as T from 'three';
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
  const selection=new Map<Fruit,T.Group>();
  fruitMenu.forEach(({food,color},i)=>{
    const x=(i-3)*.62;
    const z=i%2===0?.94:.72;
    const crate=box(stand,0xd19557,.57,.11,.42,x,1.235,z);
    crate.rotation.y=(i%2===0?1:-1)*.035;
    box(stand,0x683c25,.56,.035,.026,x,1.3,z+.21);
    for(let j=0;j<4;j++){
      const specimen=new T.Group();
      specimen.position.set(x+(j%2-.5)*.235,1.29,z+(Math.floor(j/2)-.5)*.175);
      specimen.scale.setScalar(.74+.14*Math.sin(i*9+j*4));
      specimen.rotation.y=i*2.399+j*1.18;
      stand.add(specimen);
      fruit(specimen,food,color);
    }
    const selected=new T.Group();
    selected.position.set(x,1.205,1.35);
    selected.scale.setScalar(.73);
    stand.add(selected);
    fruit(selected,food,color);
    selected.visible=false;
    selection.set(food,selected);
  });
  return (foods:Fruit[])=>{
    selection.forEach((specimen,food)=>{specimen.visible=foods.includes(food);});
  };
}
