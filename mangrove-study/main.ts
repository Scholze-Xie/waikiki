import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const renderer=new T.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene=new T.Scene();
scene.background=new T.Color(0xb0d7dc);
scene.fog=new T.FogExp2(0xb0d7dc,.042);
const camera=new T.PerspectiveCamera(38,1,.08,40);
camera.position.set(6.8,2.75,8.8);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,1.60,0);
orbit.minDistance=2.2;
orbit.maxDistance=13;
orbit.maxPolarAngle=1.53;
orbit.enablePan=false;
orbit.enableDamping=true;
orbit.update();
scene.add(new T.HemisphereLight(0xe6f8ff,0x958166,2.1));
const sun=new T.DirectionalLight(0xffd498,3.25);
sun.position.set(-3,6,3);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.normalBias=.022;
sun.shadow.camera.left=sun.shadow.camera.bottom=-4;
sun.shadow.camera.right=sun.shadow.camera.top=4;
scene.add(sun);

function ground(x:number,z:number){
  const distance=(x/3.45)**2+((z-.23*x)/2.66)**2;
  return -.42+.52*Math.sqrt(Math.max(0,1-distance))
    +.041*Math.sin(x*3.9+z)*Math.cos(z*3.1)+.025*Math.sin(x*7.7-z*8.1);
}
const bed=new T.IcosahedronGeometry(1,5);
bed.scale(3.73,.39,3.02);
bed.translate(0,-.30,0);
const mudColor=new T.Color();
const position=bed.getAttribute('position');
const colors=new Float32Array(position.count*3);
for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=position.getZ(i)+.23*x;
  position.setXYZ(i,x,position.getY(i)>-.30?ground(x,z):position.getY(i),z);
}
for(let i=0;i<position.count;i+=3){
  const x=position.getX(i),z=position.getZ(i);
  const grain=.5+.5*Math.sin(x*19.8+z*11.7)*Math.sin(z*15.2);
  mudColor.set(position.getY(i)>-.06?0x886144:0x554532).multiplyScalar(.77+.34*grain);
  for(let j=0;j<3;j++)mudColor.toArray(colors,(i+j)*3);
}
bed.setAttribute('color',new T.BufferAttribute(colors,3));
const island=new T.Mesh(bed,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.78}));
island.receiveShadow=true;
scene.add(island);
const waterTime={value:0};
const reflection=(Reflector as typeof Reflector & {ReflectorShader:T.ShaderMaterialParameters &
  {vertexShader:string;fragmentShader:string}}).ReflectorShader;
const water=new Reflector(new T.PlaneGeometry(70,70),{
  textureWidth:768,textureHeight:768,multisample:0,clipBias:.001,
  shader:{
    ...reflection,
    uniforms:{...reflection.uniforms,time:waterTime},
    vertexShader:reflection.vertexShader.replace('void main() {','varying vec2 waterPoint;\nvoid main() { waterPoint=position.xy;'),
    fragmentShader:reflection.fragmentShader.replace('void main() {','varying vec2 waterPoint; uniform float time;\nvoid main() {')
      .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`
        vec2 p=waterPoint;
        vec2 wave=vec2(sin(p.x*7.8+p.y*5.1+time*1.2),cos(p.y*10.4-p.x*3.8-time*.7));
        vec3 reflected=texture2D(tDiffuse,vUv.xy/vUv.w+wave*.0034).rgb;
        float glint=pow(.5+.5*sin(p.x*11.3+p.y*8.6+wave.y*.8+time),12.)*.026;
        float haze=smoothstep(4.,27.,length(p));
        vec3 coastalWater=mix(vec3(.074,.27,.22),reflected,.64)+glint;
        vec4 base=vec4(mix(coastalWater,vec3(.39,.63,.65),haze),1.);
      `).replace('blendOverlay( base.rgb, color )','base.rgb'),
  },
});
water.rotation.x=-Math.PI/2;
water.position.y=-.102;
scene.add(water);

const treeUrl = new URL('./mangrove-v2.glb', import.meta.url).href;
new GLTFLoader().loadAsync(treeUrl).then(({scene: tree}) => {
  // Place the root tips in the existing tidal bed while preserving the Blender proportions.
  tree.position.y = 0.025;
  tree.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(tree);
}).catch((error: unknown) => {
  console.error('Could not load the mangrove model', error);
  const status = document.querySelector('header p');
  if (status) status.textContent = '红树模型加载失败，请刷新重试。';
});
const stoneGeometry=new T.IcosahedronGeometry(1,0);
const stoneMaterials=[0x786555,0x635e48,0x514839].map(color=>
  new T.MeshStandardMaterial({color,flatShading:true,roughness:.67}));
for(let i=0;i<36;i++){
  const angle=i*2.39996;
  const radius=1.25+1.48*Math.sin(i*5.81)**2;
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius+.20*x;
  const stone=new T.Mesh(stoneGeometry,stoneMaterials[i%3]);
  const size=.048+.12*Math.sin(i*3.7)**2;
  stone.scale.set(size*1.48,size*.58,size);
  stone.position.set(x,ground(x,z)+size*.16,z);
  stone.rotation.y=i*3.29;
  stone.castShadow=true;
  stone.receiveShadow=true;
  scene.add(stone);
}

function resize(){
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
resize();
renderer.setAnimationLoop(time=>{
  const material=water.material as T.ShaderMaterial;
  material.uniforms.time.value=time*.001;
  orbit.update();
  renderer.render(scene,camera);
});
