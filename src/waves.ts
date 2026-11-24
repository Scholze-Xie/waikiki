import * as T from 'three';
import {hanauma, hanaumaInlet} from './hanauma';

export const cycle = 12;
export const coast = (z: number) => -1.2 + 2.8 * Math.cos(z * .075) + .055 * z - hanaumaInlet(z);
export const crest = (time: number) => 19 - 1.1 * (time % cycle);
export const sandHeight = (x: number, z: number) => Math.min(.68, (coast(z) - x) * .14);

const waveShape = {
  height: 1.15,
  sweep: .8,
  release: 9,
  shoreFace: 1.13,
  backFace: .58
};
const smooth = (min: number, max: number, value: number) => T.MathUtils.smoothstep(value, min, max);

export function waterHeight(x: number, z: number, time: number) {
  const t = time % cycle;
  const d = x - crest(time) - waveShape.sweep * Math.sin(z * .12);
  const length = 1 - smooth(8, 30, Math.abs(z + 6));
  const swell = smooth(0, 2, t) * (1 - smooth(waveShape.release, cycle, t));
  const face = T.MathUtils.lerp(waveShape.shoreFace, waveShape.backFace, smooth(-.2, .2, d));
  const surf = waveShape.height * length * swell * Math.exp(-d * d * face);
  const chop = .042 * Math.sin(x * 1.55 + z * .28 + time * 2)
    + .021 * Math.sin(x * .66 - z * 1.07 + time * 1.3);
  const runup = Math.max(0, (coast(z) - x) * .14) * (1 - smooth(.65, 1.8, coast(z) - x));
  return surf + chop + runup + .028;
}

export function shoreEdge(x:number,z:number,time:number){
  const adv=time*1.48+z*.23+.34*Math.sin(z*.47);
  const run=.13+.49*Math.sin(adv)+.11*Math.sin(adv*1.91-.6);
  return x-coast(z)-run-.14*Math.sin(z*.68+time*.36)*Math.cos(z*.29-time*.18);
}

const shoreShader = `
  float bayAcross(float z) {
    return (z - ${hanauma.centerZ.toFixed(1)}) / ${hanauma.halfWidth.toFixed(1)};
  }
  float shoreAt(float z) {
    float across = bayAcross(z);
    float bowl = max(0., 1. - across*across);
    return -1.2 + 2.8*cos(z*.075) + .055*z - ${hanauma.inletDepth.toFixed(1)}*bowl*bowl;
  }
`;

function createWaterGeometry() {
  const inlandSegments = 28;
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
      ? T.MathUtils.lerp(-22, -13, column / inlandSegments)
      : u < .66 ? T.MathUtils.lerp(-13, 31, u / .66) : T.MathUtils.lerp(31, 133, (u - .66) / .34);
    position.setXYZ(i, x, 0, position.getZ(i) - 13);
  }
  return geometry;
}

export function createSea(scene: T.Scene) {
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vSurf;
      ${shoreShader}
      void main() {
        vec3 p = position;
        float t = mod(uTime,${cycle.toFixed(1)});
        float d = p.x - (19.-1.1*t) - ${waveShape.sweep}*sin(p.z*.12);
        float swell = smoothstep(0.,2.,t)*(1.-smoothstep(${waveShape.release.toFixed(1)},${cycle.toFixed(1)},t));
        float lengthMask = 1.-smoothstep(8.,30.,abs(p.z+6.));
        float face = mix(${waveShape.shoreFace},${waveShape.backFace},smoothstep(-.2,.2,d));
        float surf = swell*lengthMask*exp(-d*d*face);
        float sandRise = shoreAt(p.z)-p.x;
        float runup = max(0.,sandRise*.14)*(1.-smoothstep(.65,1.8,sandRise));
        float chop = .042*sin(p.x*1.55+p.z*.28+uTime*2.)
                   + .021*sin(p.x*.66-p.z*1.07+uTime*1.3);
        p.y = ${waveShape.height}*surf + chop + runup + .028;
        vWorld = p;
        vSurf = vec2(d, swell*lengthMask);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vSurf;
      ${shoreShader}

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
        float adv = uTime*1.48+p.y*.23+.34*sin(p.y*.47);
        float run = .13+.49*sin(adv)+.11*sin(adv*1.91-.6);
        float alongShore = noise(vec2(p.y*.62,uTime*.22));
        float edge = depth-run-.14*sin(p.y*.68+uTime*.36)*cos(p.y*.29-uTime*.18);
        float edgeAA = clamp(fwidth(edge),.008,.10);

        vec3 glass = vec3(.034,.54,.39);
        vec3 turquoise = vec3(.012,.32,.32);
        vec3 deep = vec3(.009,.062,.16);
        vec3 wetSand = vec3(.61,.45,.25);
        vec3 bed = mix(wetSand,glass,smoothstep(-.6,4.4,depth));
        vec3 water = mix(bed,turquoise,smoothstep(3.5,15.,depth));
        water = mix(water,deep,smoothstep(11.,49.,depth));
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
        water += vec3(.087,.125,.069)*caustic*shoal*closeDetail;
        water *= 1.-.15*shoal*(1.-bedGrain)*closeDetail;

        float distant = smoothstep(19.,76.,distanceToEye);
        vec3 slope = normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        vec2 ripples = rippleSlope(p,vec2(.94,.34),3.8,2.6,3.2*banks)*.093
          + rippleSlope(p,vec2(.49,-.87),6.9,3.1,4.1*banks)*.058
          + rippleSlope(p,vec2(.83,-.56),13.2,4.8,2.2*banks)*(.036*closeDetail);
        vec3 normal = normalize(mix(slope,vec3(0.,1.,0.),distant)
          + vec3(ripples.x,0.,ripples.y)*(1.-distant));
        vec3 view = normalize(cameraPosition-vWorld);
        vec3 sun = normalize(vec3(-15.,26.,13.));
        float facing = clamp(dot(normal,view),0.,1.);
        float fresnel = .022+.978*pow(1.-facing,5.);
        vec3 reflected = reflect(-view,normal);
        vec3 skyReflection = mix(vec3(.43,.68,.68),vec3(.20,.47,.60),
          smoothstep(0.,.82,max(0.,reflected.y)));
        water = mix(water,skyReflection,fresnel*.67);
        float highlight = clamp(dot(normal,normalize(sun+view)),0.,1.);
        float glitter = pow(highlight,75.);
        float sheen = pow(highlight,18.);
        float streak = noise(p*vec2(3.8,1.3)+vec2(uTime*.71,-uTime*.13));
        water += vec3(.77,.70,.51)*(glitter*(.22+.78*streak)+.12*sheen)*(1.-bay*.65);

        float cells = noise(p*3.2+vec2(uTime*.48,0.));
        float pores = noise(p*11.6+vec2(uTime*.84,-uTime*.23));
        float shoreFoamWidth = .12+.33*alongShore;
        float front = (1.-smoothstep(.025,shoreFoamWidth,edge))*smoothstep(-.025-edgeAA,-.025+edgeAA,edge);
        float lace = smoothstep(.39,.69,cells*.68+pores*.32);
        float bubbles = 1.-smoothstep(.035,.17+fwidth(pores),abs(pores-.52));
        float capDetail = mix(.78,.53+.47*lace,closeDetail);
        float strands = smoothstep(.23,.49,edge)*(1.-smoothstep(.49,1.03,edge));
        strands *= bubbles*smoothstep(.42,.67,cells)*closeDetail;
        float backwash = (1.-smoothstep(.38,1.55,edge))*smoothstep(.56,.78,cells);
        backwash *= .2+.8*smoothstep(-.25,.8,-cos(adv));
        float surfNoise = noise(vec2(vSurf.x*3.2+uTime*.8,p.y*1.1));
        float foamLine = 1.-smoothstep(.07,.34+surfNoise*.36,abs(vSurf.x+.16+(surfNoise-.5)*.43));
        float peel = smoothstep(.31,.65,noise(vec2(p.y*.23+uTime*.54,vSurf.x*.52)));
        float breaking = foamLine*peel*smoothstep(.26,.86,vSurf.y)*(.51+.49*lace);
        float trails = (1.-smoothstep(.16,1.16,-vSurf.x))*smoothstep(.03,.21,-vSurf.x);
        trails *= smoothstep(.52,.78,cells)*vSurf.y*peel;
        float foam = clamp(front*capDetail+backwash*.47+strands*.36+breaking+trails*.61,0.,1.);
        vec3 foamColor = mix(vec3(.64,.83,.79),vec3(.92,.98,.93),smoothstep(.22,.85,foam+.14*lace));
        water = mix(water,foamColor,foam);
        water = mix(water,vec3(.376,.672,.651),smoothstep(53.,118.,distanceToEye));
        if (edge < -.025) discard;
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
