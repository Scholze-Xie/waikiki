export const hanauma = {
  centerZ: 58,
  halfWidth: 17,
  inletDepth: 13,
};

export function hanaumaInlet(z: number) {
  const across = (z - hanauma.centerZ) / hanauma.halfWidth;
  const bowl = Math.max(0, 1 - across * across);
  return hanauma.inletDepth * bowl * bowl;
}
