import {MathUtils} from 'three';

const smooth = MathUtils.smoothstep;

export function mangroveChannelMask(inland:number,z:number){
  const end=21.6+1.1*Math.sin(z*.34);
  return smooth(inland,-1.2,-.22)*(1-smooth(inland,end-1.3,end+1.1))
    *smooth(z,12.5,15.5)*(1-smooth(z,44.5,48.6));
}

export function mangroveChannelBed(inland:number,z:number){
  const bend=.85*Math.sin(inland*.41)+.42*Math.sin(inland*.97);
  const feeder=Math.abs(Math.sin((z-30.7-bend)*Math.PI/10.5));
  const innerCreek=Math.abs(inland-11.8-1.7*Math.sin(z*.31));
  const drainage=Math.max(1-smooth(feeder,.12,.43),1-smooth(innerCreek,.65,2.2));
  return -.012+.020*Math.sin(z*1.05+inland*.87)-.23*drainage;
}

export const mangroveTideShader = `
  float mangroveChannelMask(float inland, float z) {
    float end=21.6+1.1*sin(z*.34);
    return smoothstep(-1.2,-.22,inland)*(1.-smoothstep(end-1.3,end+1.1,inland))
      *smoothstep(12.5,15.5,z)*(1.-smoothstep(44.5,48.6,z));
  }
  float mangroveChannelBed(float inland, float z) {
    float bend=.85*sin(inland*.41)+.42*sin(inland*.97);
    float feeder=abs(sin((z-30.7-bend)*3.14159265359/10.5));
    float innerCreek=abs(inland-11.8-1.7*sin(z*.31));
    float drainage=max(1.-smoothstep(.12,.43,feeder),1.-smoothstep(.65,2.2,innerCreek));
    return -.012+.020*sin(z*1.05+inland*.87)-.23*drainage;
  }
`;
