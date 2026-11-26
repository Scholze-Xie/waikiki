import * as T from 'three';

export function createStoneMaterial(parameters:T.MeshStandardMaterialParameters, scale=1){
  const material=new T.MeshStandardMaterial(parameters);
  material.onBeforeCompile=shader=>{
    shader.uniforms.stoneScale={value:scale};
    shader.vertexShader='varying vec3 vStonePosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec4 stonePosition = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        stonePosition = instanceMatrix * stonePosition;
      #endif
      vStonePosition = (modelMatrix * stonePosition).xyz;
    `);
    shader.fragmentShader=`
      varying vec3 vStonePosition;
      uniform float stoneScale;

      float stoneHash(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float stoneNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        vec3 w = f*f*(3. - 2.*f);
        float lower = mix(
          mix(stoneHash(i), stoneHash(i + vec3(1,0,0)), w.x),
          mix(stoneHash(i + vec3(0,1,0)), stoneHash(i + vec3(1,1,0)), w.x), w.y);
        float upper = mix(
          mix(stoneHash(i + vec3(0,0,1)), stoneHash(i + vec3(1,0,1)), w.x),
          mix(stoneHash(i + vec3(0,1,1)), stoneHash(i + vec3(1,1,1)), w.x), w.y);
        return mix(lower, upper, w.z);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 stoneP = vStonePosition * stoneScale;
      float stoneMottle = stoneNoise(stoneP * 1.7);
      vec3 grainPosition = stoneP * 19. + vec3(3.9, 1.5, 8.2);
      vec3 grainPixels = fwidth(grainPosition);
      float grainWeight = 1. - smoothstep(.32, 1.25, max(grainPixels.x, max(grainPixels.y, grainPixels.z)));
      float stoneGrain = (stoneNoise(grainPosition) - .5) * grainWeight;

      float stoneLayer = dot(stoneP, vec3(.44, 3.5, -.61)) + 1.5 * stoneMottle;
      float layerDistance = abs(fract(stoneLayer + .5) - .5);
      float layerWeight = 1. - smoothstep(.16, .62, fwidth(stoneLayer));
      float stoneSeam = (1. - smoothstep(.025, .102, layerDistance)) * layerWeight
        * smoothstep(.32, .65, stoneMottle);
      vec3 mineralTint = mix(vec3(.82, .88, .91), vec3(1.16, 1.10, 1.01), stoneMottle);
      diffuseColor.rgb *= mineralTint * (1. + .49 * stoneGrain - .25 * stoneSeam);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      roughnessFactor *= .84 + .16 * stoneMottle;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      float stoneRelief = (.028 * stoneMottle + .009 * stoneGrain - .010 * stoneSeam) / stoneScale;
      vec3 stoneDx = dFdx(-vViewPosition);
      vec3 stoneDy = dFdy(-vViewPosition);
      vec3 stoneTangentX = cross(stoneDy, normal);
      vec3 stoneTangentY = cross(normal, stoneDx);
      float stoneDet = dot(stoneDx, stoneTangentX);
      vec3 stoneGradient = sign(stoneDet)
        * (dFdx(stoneRelief) * stoneTangentX + dFdy(stoneRelief) * stoneTangentY);
      normal = normalize(max(abs(stoneDet), 1e-8) * normal - stoneGradient);
    `);
  };
  return material;
}
