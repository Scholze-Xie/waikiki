import * as T from 'three';
import {hanauma, hanaumaInlet} from './hanauma';
import {mangroveChannelMask,mangroveTideShader} from './mangrove-tide';

export const cycle = 12;
export const coast = (z: number) => -1.2 + 2.8 * Math.cos(z * .075) + .055 * z - hanaumaInlet(z);
export const crest = (time: number) => 19 - 1.1 * (time % cycle);
export const sandHeight = (x: number, z: number) => Math.min(.68, (coast(z) - x) * .14);

export const creekMouthTint = 0x8ab29b;
const creekCourse = { z: -9.4, slope: .43, bend: 2.8, frequency: .208 };
export const streamZ = (x: number) =>
  creekCourse.z + creekCourse.slope * x + creekCourse.bend * Math.sin(x * creekCourse.frequency);

const waveShape = {
  height: 1.15,
  sweep: .8,
  release: 9,
  shoreFace: 1.32,
  backFace: .44,
  lipHeight: .21,
  lipOffset: .18,
  lipTightness: 5.6,
};
const smooth = (min: number, max: number, value: number) => T.MathUtils.smoothstep(value, min, max);
const swashPhase = (z:number,time:number) => time*1.48+z*.23+.34*Math.sin(z*.47);

function channelWaterHeight(inland:number,z:number,time:number){
  const phase=swashPhase(31,time)+(z-31)*.048-Math.max(0,inland)*.045;
  return .048-.072*Math.sin(phase)-.0015*Math.max(0,inland)+.007*Math.sin(inland*6.5+z*.84+time*2.9);
}

export function waterHeight(x: number, z: number, time: number) {
  const t = time % cycle;
  const d = x - crest(time) - waveShape.sweep * Math.sin(z * .12);
  const length = 1 - smooth(8, 30, Math.abs(z + 6));
  const swell = smooth(0, 2, t) * (1 - smooth(waveShape.release, cycle, t));
  const face = T.MathUtils.lerp(waveShape.shoreFace, waveShape.backFace, smooth(-.2, .2, d));
  const lip = d + waveShape.lipOffset;
  const surf = length * swell * (
    waveShape.height * Math.exp(-d * d * face) + waveShape.lipHeight * Math.exp(-lip * lip * waveShape.lipTightness)
  );
  const chop = .042 * Math.sin(x * 1.55 + z * .28 + time * 2)
    + .021 * Math.sin(x * .66 - z * 1.07 + time * 1.3);
  const inland=coast(z)-x;
  const runup = Math.max(0,inland*.14)*(1-smooth(.65,1.8,inland));
  const seaLevel=surf+chop+runup+.028;
  const channel=smooth(.12,.74,mangroveChannelMask(inland,z));
  return channel>0?T.MathUtils.lerp(seaLevel,channelWaterHeight(inland,z,time),channel):seaLevel;
}

export function shoreEdge(x:number,z:number,time:number){
  const adv=swashPhase(z,time);
  const run=.13+.49*Math.sin(adv)+.11*Math.sin(adv*1.91-.6);
  return x-coast(z)-run-.14*Math.sin(z*.68+time*.36)*Math.cos(z*.29-time*.18);
}

export const shoreShader = `
  float bayAcross(float z) {
    return (z - ${hanauma.centerZ.toFixed(1)}) / ${hanauma.halfWidth.toFixed(1)};
  }
  float shoreAt(float z) {
    float across = bayAcross(z);
    float bowl = max(0., 1. - across*across);
    return -1.2 + 2.8*cos(z*.075) + .055*z - ${hanauma.inletDepth.toFixed(1)}*bowl*bowl;
  }
`;

export const swashShader = `
  float swashPhase(float z, float time) {
    return time*1.48+z*.23+.34*sin(z*.47);
  }
  float swashReach(float z, float time, float phase) {
    return .13+.49*sin(phase)+.11*sin(phase*1.91-.6)
      + .14*sin(z*.68+time*.36)*cos(z*.29-time*.18);
  }
`;

export const channelWaterShader = `
  ${mangroveTideShader}
  float channelWaterPhase(float inland, float z, float time) {
    return swashPhase(31.,time)+(z-31.)*.048-max(0.,inland)*.045;
  }
  float channelWaterHeight(float inland, float z, float time) {
    float phase = channelWaterPhase(inland,z,time);
    return .048-.072*sin(phase)-.0015*max(0.,inland)+.007*sin(inland*6.5+z*.84+time*2.9);
  }
`;

function createWaterGeometry() {
  const inlandSegments = 54;
  const originalSegments = 233;
  const segments = inlandSegments + originalSegments;
  const geometry = new T.PlaneGeometry(1, 198, segments, 194);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  // Put most vertices near the shoreline and the surf break.
  for (let i = 0; i < position.count; i++) {
    const column = i % (segments + 1);
    const u = (column - inlandSegments) / originalSegments;
    const x = column < inlandSegments
      ? T.MathUtils.lerp(-30, -13, column / inlandSegments)
      : u < .66 ? T.MathUtils.lerp(-13, 31, u / .66) : T.MathUtils.lerp(31, 133, (u - .66) / .34);
    position.setXYZ(i, x, 0, position.getZ(i) - 13);
  }
  return geometry;
}

export function createSea(scene: T.Scene) {
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCreekMouthTint: { value: new T.Color(creekMouthTint) } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vSurf;
      ${shoreShader}
      ${swashShader}
      ${channelWaterShader}
      void main() {
        vec3 p = position;
        float t = mod(uTime,${cycle.toFixed(1)});
        float d = p.x - (19.-1.1*t) - ${waveShape.sweep}*sin(p.z*.12);
        float swell = smoothstep(0.,2.,t)*(1.-smoothstep(${waveShape.release.toFixed(1)},${cycle.toFixed(1)},t));
        float lengthMask = 1.-smoothstep(8.,30.,abs(p.z+6.));
        float face = mix(${waveShape.shoreFace},${waveShape.backFace},smoothstep(-.2,.2,d));
        float lip = d + ${waveShape.lipOffset};
        float surf = swell*lengthMask*(${waveShape.height}*exp(-d*d*face)
          + ${waveShape.lipHeight}*exp(-lip*lip*${waveShape.lipTightness}));
        float sandRise = shoreAt(p.z)-p.x;
        float runup = max(0.,sandRise*.14)*(1.-smoothstep(.65,1.8,sandRise));
        float chop = .042*sin(p.x*1.55+p.z*.28+uTime*2.)
                   + .021*sin(p.x*.66-p.z*1.07+uTime*1.3);
        p.y = surf + chop + runup + .028;
        float channel = smoothstep(.12,.74,mangroveChannelMask(sandRise,p.z));
        p.y = mix(p.y,channelWaterHeight(sandRise,p.z,uTime),channel);
        vWorld = p;
        vSurf = vec2(d, swell*lengthMask);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCreekMouthTint;
      varying vec3 vWorld;
      varying vec2 vSurf;
      ${shoreShader}
      ${swashShader}
      ${channelWaterShader}

      float hash(vec2 p) {
        vec3 h = fract(vec3(p.xyx)*.1031);
        h += dot(h,h.yzx+33.33);
        return fract((h.x+h.y)*h.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 s = f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),s.x),
                   mix(hash(i+vec2(0.,1.)),hash(i+1.),s.x),s.y);
      }
      vec2 rippleSlope(vec2 p, vec2 direction, float frequency, float speed, float warp) {
        float phase = dot(p,direction)*frequency + uTime*speed + warp;
        float resolve = 1.-smoothstep(.35,2.5,fwidth(phase));
        return direction*cos(phase)*resolve;
      }

      float causticRidges(vec2 p) {
        vec2 bend = vec2(sin(p.y*.83+uTime*.58),sin(p.x*.91-uTime*.46));
        vec2 cells = p + bend*.69;
        float a = sin(cells.x + cells.y*.62);
        float b = sin(cells.y - cells.x*.48);
        float ridge = abs(a*b + .18*sin(cells.x-cells.y));
        return 1.-smoothstep(.026,.12+fwidth(ridge),ridge);
      }

      void main() {
        vec2 p = vWorld.xz;
        float distanceToEye = distance(vWorld,cameraPosition);
        float closeDetail = 1.-smoothstep(18.,52.,distanceToEye);
        float shore = shoreAt(p.y);
        float depth = p.x-shore;
        float channelMask = mangroveChannelMask(-depth,p.y);
        float channel = smoothstep(.17,.62,channelMask)*smoothstep(-.64,.46,-depth);
        float channelFlow = smoothstep(.20,.70,channelMask)*smoothstep(-1.12,.24,-depth);
        float channelPhase = channelWaterPhase(-depth,p.y,uTime);
        float creekCenter = ${creekCourse.z}+${creekCourse.slope}*p.x
          +${creekCourse.bend}*sin(p.x*${creekCourse.frequency});
        float creekAcross = abs(p.y-creekCenter);
        float outlet = (1.-smoothstep(.58,1.46,creekAcross))*(1.-smoothstep(.75,2.2,depth));
        float plume = (1.-smoothstep(.55,1.60+max(0.,depth)*.30,creekAcross))
          *(1.-smoothstep(.45,3.4,depth));
        float adv = swashPhase(p.y,uTime);
        float run = swashReach(p.y,uTime,adv);
        float alongShore = noise(vec2(p.y*.62,uTime*.22));
        float edge = depth-run;
        float retreat = smoothstep(-.12,.43,.49*cos(adv)+.21*cos(adv*1.91-.6));
        float edgeAA = clamp(fwidth(edge),.008,.10);

        vec3 glass = vec3(.034,.54,.39);
        vec3 turquoise = vec3(.012,.32,.32);
        vec3 deep = vec3(.009,.062,.16);
        vec3 wetSand = vec3(.61,.45,.25);
        vec3 bed = mix(wetSand,glass,smoothstep(-.6,4.4,depth));
        vec3 water = mix(bed,turquoise,smoothstep(3.5,15.,depth));
        water = mix(water,deep,smoothstep(11.,49.,depth));
        water = mix(water,uCreekMouthTint,.76*plume);
        float banks = noise(p*vec2(.14,.21)+vec2(4.,1.3));
        water *= .89 + .20*banks;
        float bay = 1. - smoothstep(.55, .98, abs(bayAcross(p.y)));
        float reefBelt = smoothstep(2., 4., depth)*(1.-smoothstep(10., 15., depth));
        float coral = noise(p*vec2(.53,.44))*.74 + noise(p*1.6)*.26;
        float reef = bay*reefBelt*smoothstep(.34,.61,coral);
        water = mix(water,vec3(.019,.19,.135),reef*.78);
        float shoal = smoothstep(-.18,1.15,depth)*(1.-smoothstep(4.6,10.2,depth));
        vec2 lightCell = p*vec2(1.82,2.36) + vec2(uTime*.26,-uTime*.18);
        float caustic = causticRidges(lightCell);
        float bedGrain = noise(p*vec2(2.2,3.1));
        water += vec3(.059,.093,.052)*caustic*shoal*closeDetail;
        water *= 1.-.15*shoal*(1.-bedGrain)*closeDetail;
        float channelDepth = max(0.,vWorld.y-mangroveChannelBed(-depth,p.y));
        float flow = sin(-depth*9.5+p.y*.39+sin(channelPhase)*2.1);
        flow *= 1.-smoothstep(.42,1.8,fwidth(-depth*9.5+p.y*.39));
        vec3 shallows = mix(vec3(.32,.27,.16),vec3(.090,.29,.23),smoothstep(.004,.19,channelDepth));
        shallows *= .93 + .07*bedGrain + .035*flow*closeDetail;
        water = mix(water,shallows,channel);

        float distant = smoothstep(19.,76.,distanceToEye);
        vec3 slope = normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        vec2 ripples = rippleSlope(p,vec2(.94,.34),3.8,2.6,3.2*banks)*.093
          + rippleSlope(p,vec2(.49,-.87),6.9,3.1,4.1*banks)*.058
          + rippleSlope(p,vec2(.83,-.56),13.2,4.8,2.2*banks)*(.036*closeDetail);
        ripples *= mix(1.,.28,channel);
        vec3 normal = normalize(mix(slope,vec3(0.,1.,0.),max(distant,.94*channelFlow))
          + vec3(ripples.x,0.,ripples.y)*(1.-distant));
        vec3 view = normalize(cameraPosition-vWorld);
        vec3 sun = normalize(vec3(-15.,26.,13.));
        float facing = clamp(dot(normal,view),0.,1.);
        float fresnel = .022+.978*pow(1.-facing,5.);
        vec3 reflected = reflect(-view,normal);
        vec3 skyReflection = mix(vec3(.43,.68,.68),vec3(.20,.47,.60),
          smoothstep(0.,.82,max(0.,reflected.y)));
        water = mix(water,skyReflection,fresnel*mix(.67,.46,channel));
        float highlight = clamp(dot(normal,normalize(sun+view)),0.,1.);
        float glitter = pow(highlight,75.);
        float sheen = pow(highlight,18.);
        float streak = noise(p*vec2(3.8,1.3)+vec2(uTime*.71,-uTime*.13));
        water += vec3(.77,.70,.51)*(glitter*(.22+.78*streak)+.12*sheen)*(1.-bay*.65)*mix(1.,.31,channelFlow);

        float cells = noise(p*3.2+vec2(uTime*.48,0.));
        float pores = noise(p*11.6+vec2(uTime*.84,-uTime*.23));
        float shoreFoamWidth = (.15+.24*alongShore)*mix(1.,.56,retreat);
        float front = (1.-smoothstep(.018,shoreFoamWidth,edge))*smoothstep(-.025-edgeAA,.018+edgeAA,edge);
        float lace = smoothstep(.39,.69,cells*.68+pores*.32);
        float bubbles = 1.-smoothstep(.035,.17+fwidth(pores),abs(pores-.52));
        float capDetail = mix(.81,.49+.51*lace,closeDetail)*mix(1.,.71,retreat);
        float strands = smoothstep(.15,.39,edge)*(1.-smoothstep(.52,1.24,edge));
        strands *= bubbles*smoothstep(.40,.64,cells)*closeDetail;
        float backwash = smoothstep(.08,.29,edge)*(1.-smoothstep(.59,1.61,edge))*smoothstep(.49,.74,cells);
        float surfNoise = noise(vec2(vSurf.x*2.6+uTime*.68,p.y*1.06-uTime*.51));
        float breakAlong = noise(vec2(p.y*.29-uTime*.71,2.4));
        float peel = smoothstep(.23,.67,breakAlong);
        float swellStrength = smoothstep(.19,.83,vSurf.y);
        float capOffset = vSurf.x+${waveShape.lipOffset}+(surfNoise-.5)*.24;
        float foamLine = 1.-smoothstep(.04,.15+.27*surfNoise,abs(capOffset));
        float breaking = foamLine*swellStrength*(.17+.83*peel)*(.55+.45*lace);
        float trails = smoothstep(.08,.33,-capOffset)*(1.-smoothstep(.43,1.54,-capOffset));
        trails *= smoothstep(.43,.71,.69*surfNoise+.31*pores)*swellStrength*peel;
        float litLip = (1.-smoothstep(.16,.94,abs(capOffset)))*swellStrength;
        water = mix(water,vec3(.084,.60,.45),litLip*(.14+.25*pow(1.-facing,2.)));
        float frontFace = smoothstep(.18,.49,-capOffset)*(1.-smoothstep(.78,1.47,-capOffset));
        water *= 1.-.21*frontFace*swellStrength;
        // The breaker thins across the flowing outlet while foam still reaches both banks.
        float shoreFoam = (front*capDetail+backwash*.53*retreat+strands*.34)*(1.-.88*outlet)
          *(1.-.94*channelMask);
        float mouthFoam = channelMask*(1.-smoothstep(.16,1.35,abs(depth)))
          *smoothstep(.34,.92,-cos(channelPhase))*smoothstep(.64,.85,cells)*.27;
        float foam = clamp(shoreFoam+mouthFoam+breaking+trails*.78,0.,1.);
        // Small offshore caps follow the same traveling ripples as the displaced surface.
        float ripplePhase = p.x*1.55+p.y*.28+uTime*2.;
        float rippleCap = smoothstep(.88,.994,sin(ripplePhase));
        rippleCap *= 1.-smoothstep(.48,1.48,fwidth(ripplePhase));
        float patches = noise(p*vec2(.43,.69)+vec2(uTime*.47,-uTime*.13));
        float offshore = smoothstep(8.5,14.,depth)*(1.-smoothstep(36.,55.,depth));
        float whitecaps = .62*offshore*rippleCap*smoothstep(.63,.82,patches)*mix(.68,1.,lace);
        float surfaceFoam = clamp(foam+whitecaps,0.,1.);
        vec3 foamColor = mix(vec3(.64,.83,.79),vec3(.92,.98,.93),smoothstep(.22,.85,surfaceFoam+.14*lace));
        water = mix(water,foamColor,surfaceFoam);
        water = mix(water,vec3(.376,.672,.651),smoothstep(53.,118.,distanceToEye));
        if (edge < -.025 && channelMask < .24) discard;
        if (!gl_FrontFacing) {
          vec3 ceiling=mix(vec3(.046,.29,.30),vec3(.27,.67,.61),
            clamp(facing*.45+caustic*.18+sheen*.45+(1.-distant)*.16,0.,1.));
          water=mix(ceiling,vec3(.065,.31,.34),smoothstep(5.,40.,distanceToEye));
          water=mix(water,vec3(.54,.74,.69),foam*.42);
        }
        gl_FragColor = vec4(water,1.);
        #include <colorspace_fragment>
      }`
  });
  const mesh = new T.Mesh(createWaterGeometry(), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return (time: number) => { material.uniforms.uTime.value = time; };
}
