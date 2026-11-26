import {buildFruitStand} from './fruit-stand';
import {createBeachLife,terrainSampler} from './beach-life';
import {makePerson,shaveIceCup} from './character-model';
import type {SnackFood} from './snack-menu';
import {coconutBunches,palmCrownFrond,palmTrunk} from './palm-geometry';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {channelWaterShader,coast,sandHeight,shoreShader,swashShader} from './waves';
import {buildWoodland,colorWoodland,woodlandHeight} from './woodland';
import {buildMangroves,mangroveSites} from './mangroves';

const materials = new Map<number,T.MeshStandardMaterial>();
export function paint(color: number) {
  if (!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,roughness:.86}));
  return materials.get(color)!;
}
export function mesh(parent:T.Object3D, geometry:T.BufferGeometry,color:number,x=0,y=0,z=0, shadow=true){
  const object=new T.Mesh(geometry,paint(color));
  object.position.set(x,y,z);
  object.castShadow=shadow;
  object.receiveShadow=true;
  parent.add(object);
  return object;
}
const cube=new T.BoxGeometry();
export function box(parent:T.Object3D,color:number,w:number,h:number,d:number,x=0,y=0,z=0){
  const object=mesh(parent,cube,color,x,y,z);
  object.scale.set(w,h,d);
  return object;
}
const ball=new T.SphereGeometry(1,14,9);
export function sphere(parent:T.Object3D,color:number,w:number,h:number,d:number,x=0,y=0,z=0){
  const object=mesh(parent,ball,color,x,y,z);
  object.scale.set(w,h,d);
  return object;
}
const boardShape=new T.Shape();
boardShape.moveTo(0,1.4);
boardShape.bezierCurveTo(.49,1.25,.48,-.77,.24,-1.34);
boardShape.quadraticCurveTo(0,-1.43,-.24,-1.34);
boardShape.bezierCurveTo(-.48,-.77,-.49,1.25,0,1.4);
const boardGeometry=new T.ExtrudeGeometry(boardShape,{depth:.07,bevelEnabled:true,bevelThickness:.045,bevelSize:.035,bevelSegments:2,curveSegments:14});
export function surfboard(parent:T.Object3D,color:number,stripe:number){
  const group=new T.Group();
  parent.add(group);
  mesh(group,boardGeometry,color);
  box(group,stripe,.105,2.30,.01,0,0,.115);
  box(group,0xfff2c5,.025,2.15,.01,.09,0,.116);
  return group;
}
function sign(parent:T.Object3D, lines: string[],w:number,h:number,x:number,y:number,z:number,angle=0,bg='#12375a',ink='#ffedbd'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
  const context=canvas.getContext('2d')!;
  context.fillStyle=bg;context.fillRect(0,0,512,192);
  context.strokeStyle=ink;context.lineWidth=3;context.strokeRect(9,9,494,174);
  context.fillStyle=ink;context.textAlign='center';context.textBaseline='middle';
  lines.forEach((line,i)=>{
    context.font=(i===0?'bold 55px Georgia':'bold 23px sans-serif');
    context.fillText(line,256,lines.length===1?98:71+i*64,457);
  });
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map}));
  panel.position.set(x,y,z);panel.rotation.y=angle;parent.add(panel);
}
function furnishKiosk(g:T.Group,shell:T.Group,timber:number,cream:number,blue:number){
  const teal=0x277e77, counter=0xe6af61, metal=0xb2c6c2;
  // Public space at the front, gear at the rear left, and a continuous staff aisle in the middle.
  for(let i=0;i<17;i++){
    box(g,i%4===0?0xc2824d:0xb47343,.342,.025,3.79,-2.78+i*.347,.268,-.36);
  }
  box(g,teal,1.98,.89,.65,-1.53,.735,.28);
  for(let i=0;i<9;i++)box(g,0x368f81,.052,.84,.022,-2.37+i*.21,.745,.616);
  box(g,counter,2.10,.095,.79,-1.53,1.225,.28);
  sign(g,['BOARD RENTALS','CHECK IN'],1.26,.39,-1.53,.86,.636,0,'#184a53','#fff0ca');
  const terminal=box(g,blue,.30,.18,.22,-.87,1.355,.15);
  terminal.rotation.x=-.28;
  const screen=box(g,0x8fd1bd,.22,.095,.019,-.87,1.368,.261);
  screen.rotation.x=-.28;
  box(g,cream,.29,.034,.23,-1.55,1.295,.31);

  box(g,timber,2.96,.12,.52,-1.40,.36,-1.89);
  box(g,timber,2.96,.08,.12,-1.40,1.67,-1.70);
  const gearColors=[0xe6af38,0x2cb5aa,0xeb5739,0xe7cd9c,0x3975a1];
  gearColors.forEach((color,i)=>{
    const board=surfboard(g,color,i%2?cream:blue);
    board.position.set(-2.52+i*.54,1.49,-1.72);
    board.scale.set(.62,.76,.78);
    board.rotation.x=-.11;
    board.rotation.y=-.14+i*.08;
  });
  for (let i=0;i<6;i++) box(g,timber,.07,.94,.28,-2.78+i*.55,.91,-1.61);
  sign(g,['BOARD RACK'],1.37,.28,-1.34,2.83,-2.162,0,'#f2be55','#12375a');
  for(const y of [.61,1.05,1.49]){
    box(g,timber,.33,.065,.75,-2.77,y,-.17);
    for(let i=0;i<3;i++){
      const towel=box(g,[0x8bad97,0xf7d586,0xe5945d][i],.23,.07,.145,-2.76,y+.069,-.41+i*.22);
      towel.rotation.y=(i-1)*.06;
    }
  }
  // An L-shaped shave-ice station faces the serving window.
  box(g,0xded3af,.61,.89,2.40,2.65,.735,-.085);
  box(g,metal,.76,.09,2.48,2.65,1.225,-.085);
  box(g,0xe0d7b7,2.32,.89,.60,1.64,.735,-1.86);
  box(g,metal,2.40,.09,.71,1.64,1.225,-1.86);
  for(const z of [-.94,-.24,.46]){
    box(g,0xc0b495,.025,.61,.65,2.335,.758,z);
    box(g,blue,.043,.035,.20,2.31,1.015,z);
  }
  const sink=box(g,0x547775,.49,.016,.45,1.18,1.279,-1.81);
  sink.castShadow=false;
  const tap=new T.QuadraticBezierCurve3(new T.Vector3(1.18,1.28,-2.02),new T.Vector3(1.18,1.72,-2.02),new T.Vector3(1.18,1.46,-1.86));
  mesh(g,new T.TubeGeometry(tap,12,.023,8,false),metal);
  box(g,blue,.44,.07,.48,2.65,1.305,-.77);
  box(g,0xde6246,.24,.41,.28,2.80,1.55,-.82);
  box(g,0xde6246,.36,.13,.32,2.66,1.76,-.82);
  const iceBowl=mesh(g,new T.CylinderGeometry(.14,.091,.095,16),0xe4ece0,2.56,1.39,-.82);
  iceBowl.castShadow=false;
  sphere(g,0xecf7f3,.129,.049,.119,2.56,1.435,-.82);
  [0xd74c45,0xeda43e,0x699d75,0x7d5b86].forEach((color,i)=>{
    const z=-.26+i*.225;
    const bottle=mesh(g,new T.CylinderGeometry(.052,.058,.19,12),color,2.73,1.365,z);
    bottle.castShadow=false;
    mesh(g,new T.CylinderGeometry(.025,.034,.065,12),cream,2.73,1.474,z,false);
  });
  for(let i=0;i<3;i++)mesh(g,new T.CylinderGeometry(.084,.054,.12,12),cream,2.78,1.33,.79+i*.11,false);
  sign(g,['SHAVE ICE','MANGO  /  GUAVA  /  LIME'],1.79,.51,1.74,2.20,-2.167,0,'#276d65','#fff0ca');
  const lamp=new T.PointLight(0xffd9a0,12,5.8,2);
  lamp.position.set(0,2.8,-.34);
  g.add(lamp);
  box(shell,timber,.055,.68,.055,0,3.36,-.34);
  mesh(shell,new T.CylinderGeometry(.075,.22,.14,16),timber,0,3,-.34,false);
  const bulb=new T.Mesh(new T.SphereGeometry(.068,12,8),new T.MeshBasicMaterial({color:0xffe6b1}));
  bulb.position.set(0,2.91,-.34);
  shell.add(bulb);
}

function buildKioskRoof(shell:T.Group){
  const roofParts:T.BufferGeometry[]=[];
  const slope=.31;
  const ridgeZ=-.34;
  const ridgeY=3.99;
  const halfSlope=1.25;
  const addRoofPart=(color:number,w:number,h:number,d:number,x:number,y:number,z:number,angle=0)=>{
    const geometry=cube.clone().scale(w,h,d).rotateX(angle).translate(x,y,z);
    const tint=new T.Color(color);
    const colors=[];
    for(let i=0;i<geometry.attributes.position.count;i++)colors.push(tint.r,tint.g,tint.b);
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    roofParts.push(geometry);
  };

  for(const side of [-1,1]){
    const angle=side*slope;
    const centerY=ridgeY-Math.sin(slope)*halfSlope;
    const centerZ=ridgeZ+side*Math.cos(slope)*halfSlope;
    const shades=side===1?[0xd04b32,0xdf5739,0xd65034,0xe15c3c]:[0xbd432d,0xcd4b33,0xc0432f,0xd15034];
    const width=6.96/18;
    for(let i=0;i<18;i++){
      const x=-3.48+(i+.5)*width;
      addRoofPart(shades[(i*7+Math.floor(i/3))%shades.length],width,.10,2.50,x,centerY,centerZ,angle);
      addRoofPart(0xe56b46,.042,.05,2.51,x-width/2+.021,centerY+.062,centerZ+side*.018,angle);
    }
    const eaveZ=ridgeZ+side*Math.cos(slope)*2.50;
    const eaveY=ridgeY-Math.sin(slope)*2.50;
    addRoofPart(0x874829,7.02,.18,.12,0,eaveY-.075,eaveZ);
    addRoofPart(0xeb8050,7.04,.055,.15,0,eaveY+.012,eaveZ);
    for(const x of [-3.49,3.49]){
      addRoofPart(0xb45838,.115,.17,2.55,x,centerY-.031,centerZ,angle);
    }
  }
  addRoofPart(0xef8053,7.08,.09,.23,0,ridgeY+.052,ridgeZ);
  const gableShape=new T.Shape();
  gableShape.moveTo(-1.96,0);
  gableShape.lineTo(1.96,0);
  gableShape.lineTo(0,.638);
  gableShape.closePath();
  const gableGeometry=new T.ShapeGeometry(gableShape);
  for(const side of [-1,1]){
    const gable=mesh(shell,gableGeometry,0xe2ad73,side*3.09,3.293,ridgeZ);
    gable.rotation.y=side*Math.PI/2;
    addRoofPart(0x7d5134,.035,.14,.64,side*3.111,3.51,ridgeZ);
    for(const y of [3.475,3.51,3.545]){
      addRoofPart(0xb57a4b,.022,.014,.585,side*3.133,y,ridgeZ);
    }
  }
  const geometry=mergeGeometries(roofParts)!;
  for(const part of roofParts)part.dispose();
  const roof=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.83}));
  roof.castShadow=true;
  roof.receiveShadow=true;
  shell.add(roof);
}

function buildKioskAwning(shell:T.Group){
  const positions:number[]=[];
  const colors:number[]=[];
  const indices:number[]=[];
  const segments=12;
  // Ease into a hanging scalloped valance at the outer edge.
  const profile=new T.CubicBezierCurve(
    new T.Vector2(3.11,2.81),new T.Vector2(3.48,2.77),
    new T.Vector2(4.05,2.67),new T.Vector2(4.10,2.51)
  );
  for(let stripe=0;stripe<10;stripe++){
    const tint=new T.Color(stripe%2?0xffe0a4:0xd94f33);
    const first=positions.length/3;
    for(let row=0;row<=segments;row++){
      const t=row/segments;
      const edge=profile.getPoint(t);
      for(let column=0;column<3;column++){
        const center=column===1;
        const scallop=center?.08*T.MathUtils.smoothstep(t,.78,1):0;
        const crown=center?.018*Math.sin(t*Math.PI):0;
        positions.push(edge.x,edge.y+crown-scallop,-1.275+(stripe+column/2)*.25);
        colors.push(tint.r,tint.g,tint.b);
      }
      if(row===0)continue;
      for(let column=0;column<2;column++){
        const a=first+(row-1)*3+column;
        indices.push(a,a+1,a+3,a+1,a+4,a+3);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const awning=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide}));
  awning.castShadow=true;
  awning.receiveShadow=true;
  shell.add(awning);
  box(shell,0x9d5636,.062,.062,2.55,4.00,2.58,-.025);
  for(const z of [-1.22,1.17]){
    box(shell,0x9d5636,.96,.048,.048,3.54,2.65,z).rotation.z=-.16;
    box(shell,0x9d5636,.82,.045,.045,3.48,2.44,z).rotation.z=.48;
  }
}

function kiosk(scene:T.Scene){
  const g=new T.Group();g.position.set(-10,.68,-1);scene.add(g);
  const timber=0x85472b, cream=0xffdf9f, red=0xe45136, blue=0x12375a;
  box(g,timber,7.5,.26,5.6,0,.13,0);
  for(let i=0;i<14;i++)box(g,i%3===0?0xb97441:0xa95e36,.011,.02,5.48,-3.5+i*.53,.267,0);
  const shell=new T.Group();
  g.add(shell);
  // Keep the back and west sides in the cutaway. The front and service side have actual openings.
  const plank=0xc18b51;
  box(g,cream,6.1,3.05,.14,0,1.78,-2.25);
  box(g,cream,.14,3.05,3.8,-3.02,1.78,-.35);
  const frontSections=[[-3.05,-2.20],[1.35,3.05]];
  for(const [left,right] of frontSections){
    box(shell,cream,right-left,3.05,.14,(left+right)/2,1.78,1.59);
    for(let row=0;row<9;row++)box(shell,plank,right-left,.023,.015,(left+right)/2,.36+row*.32,1.667);
  }
  box(shell,cream,3.55,.54,.14,-.425,3.025,1.59);
  for(const x of [-3.00,-2.20,1.35,3.00])box(shell,timber,.13,3.05,.20,x,1.78,1.60);
  box(shell,timber,3.55,.14,.23,-.425,2.74,1.62);
  box(shell,cream,.14,3.05,1.01,3.02,1.78,-1.74);
  box(shell,cream,.14,3.05,.55,3.02,1.78,1.32);
  box(shell,cream,.14,.94,2.29,3.02,.74,-.095);
  box(shell,cream,.14,.54,2.29,3.02,3.025,-.095);
  for(const z of [-1.24,1.05])box(shell,timber,.20,1.62,.12,3.03,1.98,z);
  box(shell,timber,.19,.13,2.35,3.03,2.72,-.095);
  box(g,red,.48,.115,2.47,3.08,1.20,-.095);
  furnishKiosk(g,shell,timber,cream,blue);
  buildKioskRoof(shell);
  buildKioskAwning(shell);
  sign(shell,['WAIKĪKĪ SURF','BOARD RENTALS'],2.92,.47,-.21,3.005,1.686);
  sign(shell,['SHAVE ICE','COLD DRINKS'],1.65,.44,3.108,2.98,.06,Math.PI/2);
  const rack=new T.Group();rack.position.set(-2.3,.1,3.1);g.add(rack);
  for(const x of [-1.14,1.14]) box(rack,timber,.14,1.44,.77,x,.72,0);
  for(const y of [.19,1.18])box(rack,timber,2.4,.12,.22,0,y,-.24);
  [0xe6af38,0x1ca9a3,0xf25b3e,0xffe6ad,0x3875a2].forEach((color,i)=>{
    const board=surfboard(rack,color,i%2?0xfff0bb:blue);
    board.position.set(-.92+i*.46,1.28,.03);
    board.scale.setScalar(.88);board.rotation.x=-.16;board.rotation.y=(i-2)*.13;
  });
  box(g,timber,1,.09,.65,1.9,.05,2.58);
  box(g,timber,.11,1.22,.12,1.9,.61,2.6);
  sign(g,['RENTALS','$15 / HOUR'],.92,.72,1.9,.84,2.68,0,'#f2be55','#12375a');
  return (open:boolean)=>{ shell.visible=!open; };
}
const coconutMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.88});

type PalmShape={
  lean?:number;
  bearing?:number;
  controlLean?:number;
  controlHeight?:number;
  sweep?:number;
  radius?:number;
  bark?:number;
  leaves?:number;
  length?:number;
  width?:number;
  arch?:number;
  droop?:number;
  bunches?:number;
};

function palm(scene:T.Scene,x:number,z:number,height:number,seed:number,shape:PalmShape={}){
  const {lean=.72*Math.sin(seed),bearing=0,controlLean=.31,controlHeight=.54,sweep=0,
    radius=.17,bark=0x9f7958,leaves=12,length:leafLength=1,width=.61,arch:leafArch=1,droop=1,bunches=2}=shape;
  const root=new T.Group();root.position.set(x,woodlandHeight(x,z)-.055,z);
  root.rotation.y=bearing;
  scene.add(root);
  const spline=new T.QuadraticBezierCurve3(new T.Vector3(),new T.Vector3(controlLean*lean,height*controlHeight,sweep),new T.Vector3(lean,height,0));
  const trunk=mesh(root,palmTrunk(spline,radius,seed,48),bark);
  trunk.material=new T.MeshStandardMaterial({color:bark,vertexColors:true,roughness:.94});
  const crown=new T.Group();crown.position.copy(spline.getPoint(1));root.add(crown);
  sphere(crown,0x72703d,.23,.28,.23,0,-.035,0);
  const fruit=new T.Mesh(coconutBunches(seed,bunches),coconutMaterial);
  fruit.castShadow=true;
  fruit.receiveShadow=true;
  crown.add(fruit);
  const fronds=Array.from({length:leaves},(_,k)=>{
    const {geometry,color,yaw,origin}=palmCrownFrond(k,leaves,seed,{length:leafLength,width,arch:leafArch,droop,pairs:17});
    const leaf=mesh(crown,geometry,color,origin.x,origin.y,origin.z);
    leaf.rotation.set(0,yaw,0,'YXZ');
    leaf.material=new T.MeshStandardMaterial({color,vertexColors:true,side:T.DoubleSide,roughness:.85});
    return leaf;
  });
  return (time:number)=>{
    const phase=x*.22+z*.29;
    const gust=.68+.32*Math.sin(time*1.28+phase);
    fronds.forEach((leaf,i)=>{
      // The pivot stays at the petiole attachment while the tip sweeps a wider arc.
      leaf.rotation.z=gust*.052*Math.sin(time*1.55+phase+i*.54)+.019*Math.sin(time*3.1+i*1.43+seed);
      leaf.rotation.x=gust*.039*Math.sin(time*1.2+phase+i*.87);
    });
  };
}
function buildSnackStand(scene:T.Scene){
  const stand=new T.Group();
  stand.position.set(-8,sandHeight(-8,7.6),7.6);
  scene.add(stand);
  const cream=0xffe5aa, red=0xb93929, navy=0x12375a;
  box(stand,0xa56840,4.3,.19,2.8,0,.095);
  box(stand,cream,3.8,2.62,.13,0,1.43,-1.03);
  for(const x of [-1.82,1.82]){
    box(stand,red,.14,2.76,.16,x,1.5,1.02);
    box(stand,cream,.14,1.05,1.94,x,.70,0);
  }
  box(stand,red,3.57,.89,.16,0,.61,1.01);
  box(stand,navy,3.87,.12,.65,0,1.12,1.02);
  box(stand,navy,4.2,.16,2.55,0,2.9,-.03);
  for(let i=0;i<9;i++){
    const panel=box(stand,i%2===0?red:cream,.465,.065,1.12,-1.86+i*.465,2.76,1.35);
    panel.rotation.x=.19;
    box(stand,i%2===0?red:cream,.463,.19,.07,-1.86+i*.465,2.57,1.88);
  }
  sign(stand,['HOT DOGS & SNACKS'],3.4,.51,0,3.12,1.29,0,'#12375a','#ffe5aa');
  sign(stand,['FRIES / NACHOS','SHAVE ICE / LEMONADE'],1.52,.65,0,2.04,-.95,0,'#12375a','#ffe5aa');
  for(let i=0;i<3;i++){
    const x=-1.05+i*.37;
    sphere(stand,0xd69143,.29,.13,.16,x,1.24,.94);
    sphere(stand,0xab4425,.24,.075,.07,x,1.31,.94);
  }
  for(const [x,color] of [[.84,0xd9442f],[1.07,0xf2b431]]){
    box(stand,color,.11,.23,.11,x,1.30,1.02);
    box(stand,cream,.045,.065,.045,x,1.44,1.02);
  }
  const clerk=makePerson(scene,{shirt:0xb73c2c,shorts:navy,skin:0xab7051,hair:0x30241d,
    haircut:'short',scale:.91,print:'stripes'});
  stand.add(clerk.root);
  clerk.root.position.set(0,.19,.48);
  clerk.body.position.y=.70;

  const counterFood=new T.Group();
  stand.add(counterFood);
  const carriedFood=new T.Group();
  clerk.arms[1].hand.add(carriedFood);
  carriedFood.position.set(0,-.09,.055);
  const categories:SnackFood[]=['dog','fries','nachos','ice','lemonade'];
  function plate(parent:T.Group,food:SnackFood){
    const dish=new T.Group();
    parent.add(dish);
    if(food==='dog'){
      box(dish,0xffedbd,.29,.019,.16);
      sphere(dish,0xe7a654,.14,.061,.068,0,.059,0);
      sphere(dish,0xa64328,.127,.034,.03,0,.094,0);
      box(dish,0xeab631,.18,.009,.014,0,.121,0);
    }else if(food==='fries'||food==='nachos'){
      box(dish,food==='fries'?red:0xffedbd,.18,.058,.13,0,.035,0);
      for(let i=0;i<7;i++){
        const piece=box(dish,i%2?0xf6bd54:0xe49436,.023,food==='fries'?.095:.056,.019,
          -.072+i*.023,.081+.022*Math.sin(i*8),.033*Math.sin(i*2));
        piece.rotation.z=(i-3)*.12;
      }
    }else if(food==='ice'){
      shaveIceCup(dish);
    }else{
      mesh(dish,new T.CylinderGeometry(.059,.046,.15,10),0xe9c44d,0,.075);
      box(dish,0xfff1c3,.013,.104,.013,.020,.171,0).rotation.z=-.21;
    }
    return dish;
  }
  const display=categories.map((food,i)=>{
    const dish=plate(counterFood,food);
    dish.position.set((i-2)*.29,1.195,1.09);
    return dish;
  });
  const carried=categories.map(food=>plate(carriedFood,food));
  let items:SnackFood[]=[];
  let started=0,lastTime=0;
  display.forEach(dish=>dish.visible=false);
  carried.forEach(dish=>dish.visible=false);
  function prepareSnacks(foods:SnackFood[]){
    items=foods;
    started=lastTime;
    display.forEach(dish=>dish.visible=false);
    carried.forEach(dish=>dish.visible=false);
  }
  function updateStand(time:number){
    lastTime=time;
    const elapsed=time-started;
    const segment=Math.floor(elapsed/1.22);
    const active=segment<items.length;
    const phase=elapsed/1.22-segment;
    const smooth=T.MathUtils.smoothstep;
    const reach=active?smooth(phase,.37,.74)*(1-smooth(phase,.81,1)):0;
    const pickup=active?smooth(phase,0,.20)*(1-smooth(phase,.27,.45)):0;
    const current=categories.indexOf(items[segment]);
    clerk.root.rotation.y=active?-.9*pickup+reach*(current-2)*.21:0;
    clerk.body.rotation.x=.17*pickup+.14*reach;
    clerk.head.rotation.x=.28*pickup+.19*reach+.025*Math.sin(time*2);
    clerk.head.rotation.y=.09*Math.sin(time*1.5)*(1-pickup);
    const {upper,elbow,hand}=clerk.arms[1];
    upper.rotation.set(-.18-.88*reach-.43*pickup,0,.14);
    elbow.rotation.x=-.27-.54*reach-.66*pickup;
    hand.rotation.x=-upper.rotation.x-elbow.rotation.x-clerk.body.rotation.x;
    clerk.arms[0].upper.rotation.set(-.15-.24*reach,0,-.17);
    clerk.arms[0].elbow.rotation.x=-.34;
    categories.forEach((food,i)=>{
      const index=items.indexOf(food);
      display[i].visible=index>=0&&(index<segment||index===segment&&phase>=.78);
      carried[i].visible=active&&i===current&&phase>=.25&&phase<.78;
    });
  }
  return {prepareSnacks,updateStand};
}

function buildBeachSeating(scene:T.Scene){
  const canopy=new T.BufferGeometry();
  const vertices:number[]=[];
  for(let panel=0;panel<10;panel++){
    const a=panel*Math.PI/5,b=(panel+1)*Math.PI/5;
    const point=(angle:number,r:number,y:number)=>[Math.cos(angle)*r,y,Math.sin(angle)*r];
    const innerA=point(a,.64,.26),innerB=point(b,.64,.26);
    const outerA=point(a,1.19,0),outerB=point(b,1.19,0);
    canopy.addGroup(vertices.length/3,15,panel%2);
    vertices.push(0,.40,0,...innerB,...innerA,
      ...innerA,...innerB,...outerB,...innerA,...outerB,...outerA,
      ...outerA,...outerB,...point(b,1.19,-.095),
      ...outerA,...point(b,1.19,-.095),...point(a,1.19,-.095));
  }
  canopy.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  canopy.computeVertexNormals();
  const pole=new T.CylinderGeometry(.031,.043,2.2,9);
  const fabric=new T.MeshStandardMaterial({color:0xffe9b9,roughness:.87,side:T.DoubleSide});
  const frame=0xa76a3e;
  const sets=[{x:-7.75,z:12.45,tint:0xd3563c},{x:-3.95,z:13.05,tint:0x297f7b}];
  for(const {x,z,tint} of sets){
    const umbrella=new T.Group();
    umbrella.position.set(x,woodlandHeight(x,z),z);
    scene.add(umbrella);
    mesh(umbrella,pole,frame,0,1.1,0);
    const roof=new T.Mesh(canopy,[new T.MeshStandardMaterial({
      color:tint,roughness:.87,side:T.DoubleSide
    }),fabric]);
    roof.position.y=1.94;
    roof.castShadow=true;
    roof.receiveShadow=true;
    umbrella.add(roof);
    sphere(umbrella,0xd89b5a,.055,.043,.055,0,2.37,0);
    for(const offset of [-.58,.58]){
      const chair=new T.Group();
      const cx=x+.4,cz=z+offset;
      chair.position.set(cx,woodlandHeight(cx,cz),cz);
      // Local +Z is the foot end, aimed toward the ocean at +X.
      chair.rotation.y=Math.PI/2+.10;
      scene.add(chair);
      for(const side of [-1,1]){
        const rail=side*.278;
        box(chair,frame,.044,.055,1.59,rail,.247,.18);
        for(const leg of [-.34,.81])box(chair,frame,.055,.27,.061,rail,.132,leg);
        box(chair,frame,.045,.045,.78,rail,.446,-.62).rotation.x=.51;
      }
      box(chair,0xffedc2,.51,.065,1.08,0,.279,.41);
      const back=new T.Group();
      back.position.set(0,.459,-.604);
      back.rotation.x=.51;
      chair.add(back);
      box(back,0xffedc2,.51,.065,.76);
      for(const stripe of [-.17,0,.17]){
        box(chair,tint,.063,.007,1.07,stripe,.314,.41);
        box(back,tint,.063,.007,.75,stripe,.036,0);
      }
    }
  }
}

export function buildEnvironment(scene:T.Scene){
  const geo=new T.PlaneGeometry(172,212,261,260);
  geo.rotateX(-Math.PI/2);geo.translate(-19,0,-13);
  const vertices=geo.attributes.position;
  const colors=[];
  const surfaceZones=new Float32Array(vertices.count*2);
  const surface=new T.Vector2();
  const dry=new T.Color(0xf2ce8c), wet=new T.Color(0xae8556), tint=new T.Color();
  const mangroveSilt=new T.Color(0x8f8267);
  const mangroveLitter=new T.Color(0xa29364);
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i);
    const y=woodlandHeight(x,z);
    vertices.setY(i,y);
    const landward=coast(z)-x;
    tint.copy(wet).lerp(dry,T.MathUtils.smoothstep(landward,0,4)).multiplyScalar(.97+.03*Math.sin(i*86.39));
    colorWoodland(tint,x,z,y,surface);
    if(z>13&&z<47&&landward>-.8&&landward<24){
      let litter=0;
      for(const tree of mangroveSites){
        const distanceSquared=(tree.x-x)**2+(tree.z-z)**2;
        litter=Math.max(litter,1-T.MathUtils.smoothstep(distanceSquared,.18*tree.scale**2,4.85*tree.scale**2));
      }
      const marsh=litter*(1-T.MathUtils.smoothstep(landward,.72,3.7));
      tint.lerp(mangroveLitter,litter*.30);
      tint.lerp(mangroveSilt,marsh*.58);
      surface.y=Math.max(surface.y,marsh*.78);
    }
    surface.toArray(surfaceZones,i*2);
    colors.push(tint.r,tint.g,tint.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setAttribute('surfaceZones',new T.BufferAttribute(surfaceZones,2));
  geo.computeVertexNormals();
  const causticTime={value:0};
  const terrainMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.99});
  terrainMaterial.onBeforeCompile=shader=>{
    shader.uniforms.causticTime=causticTime;
    shader.vertexShader='attribute vec2 surfaceZones; varying vec2 groundZones; varying vec3 reefFloor;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nreefFloor = position; groundZones = surfaceZones;');
    shader.fragmentShader=`
      uniform float causticTime;
      varying vec3 reefFloor;
      varying vec2 groundZones;
      ${shoreShader}
      ${swashShader}
      ${channelWaterShader}

      float groundHash(vec2 cell) {
        vec3 p = fract(vec3(cell.xyx)*.1031);
        p += dot(p,p.yzx+33.33);
        return fract((p.x+p.y)*p.z);
      }
      float groundNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 blend = fract(point);
        blend = blend*blend*(3.-2.*blend);
        return mix(mix(groundHash(cell),groundHash(cell+vec2(1.,0.)),blend.x),
          mix(groundHash(cell+vec2(0.,1.)),groundHash(cell+1.),blend.x),blend.y);
      }
      vec3 groundNormal(vec3 viewPoint, vec3 surfaceNormal, float height) {
        vec3 tangentX = dFdx(viewPoint), tangentY = dFdy(viewPoint);
        vec3 crossX = cross(tangentY,surfaceNormal), crossY = cross(surfaceNormal,tangentX);
        float det = dot(tangentX,crossX);
        vec3 gradient = dFdx(height)*crossX+dFdy(height)*crossY;
        return normalize(max(abs(det),1e-8)*surfaceNormal-sign(det)*gradient);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float sandDepth = reefFloor.x - shoreAt(reefFloor.z);
      float tidePhase = swashPhase(reefFloor.z, causticTime);
      float tideEdge = sandDepth - swashReach(reefFloor.z, causticTime, tidePhase);
      vec2 ground = reefFloor.xz;
      float pixelSpan = length(fwidth(ground));
      float nearGrain = 1.-smoothstep(.013,.057,pixelSpan);
      float coarse = groundNoise(ground*.51);
      float patches = groundNoise(ground*3.25+vec2(coarse,-coarse));
      float wetLimit = sandDepth + .29*(patches-.5);
      float retainedWetness = smoothstep(-.92,-.28,wetLimit)*(1.-smoothstep(.27,1.18,wetLimit));
      float freshWetness = smoothstep(-.88,-.47,wetLimit)*(1.-smoothstep(.04,.39,abs(tideEdge)));
      float wetBand = max(.74*retainedWetness,freshWetness);
      float channelBank = smoothstep(.29,.77,mangroveChannelMask(-sandDepth,reefFloor.z));
      float channelWater = channelWaterHeight(-sandDepth,reefFloor.z,causticTime);
      float wetMud = channelBank*(1.-smoothstep(.035,.29,reefFloor.y-channelWater));
      float dampness = max(max(wetBand,wetMud),groundZones.y);
      float land = 1.-smoothstep(.3,3.4,sandDepth);
      float soil = groundZones.x;
      float grains = groundNoise(ground*38. + vec2(8.1,3.7));
      float darkGrains = smoothstep(.56,.86,grains);
      float paleGrains = 1.-smoothstep(.18,.42,grains);
      float breaks = smoothstep(.19,.69,patches);
      float ripplePhase = sandDepth*17.5 + 1.64*sin(ground.y*.86) + coarse*5.4 + patches*.54;
      float rippleCrests = smoothstep(.16,.93,.5+.5*sin(ripplePhase));
      float dryRipples = rippleCrests*(1.-dampness)*(1.-soil)*smoothstep(.27,.72,coarse);
      dryRipples *= smoothstep(-12.,-6.,sandDepth)*(1.-smoothstep(.24,1.4,fwidth(ripplePhase)));

      // A few small leaf shapes break up the forest floor between the taller plants.
      vec2 litterGrid = ground*4.6;
      vec2 litterCell = floor(litterGrid);
      float litterSeed = groundHash(litterCell+vec2(6.3,2.7));
      float angle = groundHash(litterCell+vec2(17.1,9.2))*6.28318;
      vec2 leafAxis = vec2(cos(angle),sin(angle));
      vec2 leafOffset = fract(litterGrid)-.5-(litterSeed-.5)*vec2(.21,-.19);
      vec2 leafPoint = vec2(dot(leafOffset,leafAxis),dot(leafOffset,vec2(-leafAxis.y,leafAxis.x)));
      float leafEdge = length(leafPoint/vec2(.27 + .09*litterSeed,.079 + .029*litterSeed));
      float litter = (1.-smoothstep(.70,1.1,leafEdge))*step(.57,litterSeed)*soil;
      litter *= smoothstep(.28,.73,patches)*(1.-smoothstep(.044,.125,pixelSpan));
      litter *= 1.-.76*max(wetMud,groundZones.y);

      vec3 sandShade = mix(vec3(.93,.88,.79),vec3(1.07,1.05,1.03),.62*coarse+.38*patches);
      vec3 soilShade = mix(vec3(.68,.67,.59),vec3(1.16,1.12,.91),breaks);
      vec3 surfaceShade = mix(sandShade,soilShade,soil);
      float grainContrast = mix(.56,1.,patches)*(1.-.53*dampness);
      surfaceShade *= 1.+.072*dryRipples+nearGrain*grainContrast*(.070*paleGrains-.16*darkGrains);
      surfaceShade = mix(surfaceShade,surfaceShade*mix(vec3(.69,.57,.39),vec3(1.28,1.07,.62),litterSeed),litter*.69);
      surfaceShade = mix(surfaceShade,surfaceShade*vec3(.69,.70,.68),wetBand);
      surfaceShade = mix(surfaceShade,surfaceShade*vec3(.71,.70,.62),wetMud);
      diffuseColor.rgb *= mix(vec3(1.),surfaceShade,land);
      float microHeight = land*(.0064*dryRipples + .0027*grains*nearGrain*grainContrast
        + (.018*patches+.004*litter)*soil);
      microHeight *= mix(1.,.40,dampness);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor*(1.-.09*(1.-grains)*nearGrain),mix(.59,.72,soil),dampness);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      normal = groundNormal(-vViewPosition,normal,microHeight);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      #include <emissivemap_fragment>
      float reefMask=smoothstep(11.,17.,reefFloor.x)*(1.-smoothstep(34.,40.,reefFloor.x));
      vec2 p=reefFloor.xz*3.6;
      p+=vec2(sin(p.y*.63-causticTime*.76),sin(p.x*.71+causticTime*.59))*.76;
      float seam=abs(sin(p.x+p.y*.57)*sin(p.y-p.x*.43)+.23*sin(p.x-p.y));
      float lightWeb=1.-smoothstep(.022,.13+fwidth(seam),seam);
      totalEmissiveRadiance+=vec3(.065,.15,.115)*reefMask*lightWeb;
    `);
  };
  const terrain=new T.Mesh(geo,terrainMaterial);
  terrain.receiveShadow=true;scene.add(terrain);
  const showShopInterior=kiosk(scene);
  const {prepareSnacks,updateStand}=buildSnackStand(scene);
  buildBeachSeating(scene);
  const prepareFruit=buildFruitStand(scene);
  const updateCreek=buildWoodland(scene);
  const terrainHeight=terrainSampler(geo);
  const mangroveColliders=buildMangroves(scene,mangroveSites,terrainHeight);
  const updateBeachLife=createBeachLife(scene,geo);
  const palms=[[-18,4,6.8],[-20,-3,5.7],[-19.4,-8,7.2],[-9,-7,5.3],[-12,-13,6.9],[-6,-12,6],[-2,-18,5.1],[-10,10,6.5],[-16,14,7.4],[-16,-21,6.2],[-22,-14,6.5],[-4,-24,5.1]]
    .map(([x,z,h],i)=>palm(scene,x,z,h,i+.3));
  const shorelinePalms:{z:number;height:number;shape:PalmShape}[]=[
    {z:-9.6,height:5.05,shape:{bearing:.17,controlLean:.10,controlHeight:.66,sweep:.44,
      radius:.142,bark:0xa48565,leaves:10,length:.92,width:.51,arch:1.26,droop:.72,bunches:1}},
    {z:.10,height:3.30,shape:{bearing:-.24,controlLean:.61,controlHeight:.36,sweep:-.46,
      radius:.213,bark:0x836448,leaves:15,length:1.12,width:.71,arch:.87,droop:1.19,bunches:3}},
    {z:18.9,height:4.38,shape:{bearing:.28,controlLean:.42,controlHeight:.52,sweep:.88,
      radius:.176,bark:0x947254,leaves:12,length:1.25,width:.58,arch:.99,droop:1.04,bunches:2}}
  ];
  shorelinePalms.forEach(({z,height,shape},i)=>{
    // Equal horizontal reach and vertical rise give a 45-degree overall lean.
    palms.push(palm(scene,coast(z)-3.25,z,height,13.5+i,{...shape,lean:height}));
  });
  for(let i=0;i<9;i++){
    const x=-53+i*13,z=-99-Math.sin(i*52)*12,y=30+Math.sin(i*4)*4;
    for(let j=0;j<4;j++){
      const puff=sphere(scene,0xf1f5e0,3.8+j*.24,.77+j*.12,1.3,x+j*3,y+Math.sin(j*3)*.4,z);
      puff.castShadow=false;
    }
  }
  const update=(time:number)=>{
    causticTime.value=time;
    updateCreek(time);
    updateBeachLife(time);
    updateStand(time);
    palms.forEach(updatePalm=>updatePalm(time));
  };
  return {update,showShopInterior,prepareSnacks,prepareFruit,terrainHeight,mangroveColliders};
}
