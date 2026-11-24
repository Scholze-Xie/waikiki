import {MathUtils} from 'three';

export const hanaumaCoastOffset = 9;

export const hanauma = {
  centerZ: 49 + hanaumaCoastOffset,
  halfWidth: 17,
  inletDepth: 13,
};

export function hanaumaInlet(z: number) {
  const across = (z - hanauma.centerZ) / hanauma.halfWidth;
  const bowl = Math.max(0, 1 - across * across);
  return hanauma.inletDepth * bowl * bowl;
}

// The seaward face leaves room for the beach. Inland, a shallow saddle joins
// the crater rim to the coastal mountain foothills.
export function hanaumaRim(landward: number, z: number) {
  const across = (z - hanauma.centerZ) / hanauma.halfWidth;
  const extent = 1 - MathUtils.smoothstep(Math.abs(across), .68, 1.43);
  const ridge = 11.5 + 5.4 * Math.sin(across * 2.75) ** 2 + .85 * Math.sin(z * .73);
  const seawardFace = MathUtils.smoothstep(landward, 1.7, 10);
  const saddle = 1 - .28 * MathUtils.smoothstep(landward, 10, 24);
  const foothill = .52 * MathUtils.smoothstep(landward, 23, 39);
  const inlandFade = 1 - MathUtils.smoothstep(landward, 41, 57);
  return extent * ridge * seawardFace * (saddle + foothill) * inlandFade;
}
