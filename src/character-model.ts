import * as T from 'three';
import {mesh,sphere} from './environment';

type Haircut = 'bucket' | 'bun' | 'curls' | 'swept' | 'short';
type Print = 'hibiscus' | 'stripes' | 'rashguard';
type Appearance = {
  shirt: number;
  shorts: number;
  skin: number;
  hair: number;
  haircut: Haircut;
  print?: Print;
  shoes?: number;
  scale?: number;
  width?: number;
};
const hitGeometry = new T.CapsuleGeometry(.43, 1.10, 5, 10);
const hitMaterial = new T.MeshBasicMaterial({ visible: false });
const sleeveGeometry = new T.CapsuleGeometry(.105, .09, 4, 10);
const upperArmGeometry = new T.CapsuleGeometry(.077, .18, 5, 10);
const forearmGeometry = new T.CapsuleGeometry(.065, .175, 5, 10);
const shortsGeometry = new T.CapsuleGeometry(.121, .19, 5, 10);
const shinGeometry = new T.CapsuleGeometry(.079, .22, 5, 10);
const fabric = new Map<string, T.MeshStandardMaterial>();

function shirtFabric(shirt: number, print: Print) {
  const key = print + ":" + shirt;
  const cached = fabric.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#' + shirt.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 256, 144);
  if (print === 'hibiscus') {
    for (let row = 0; row < 6; row++) {
      for (let col = -1; col < 10; col++) {
        const x = col * 30 + (row % 2) * 15;
        const y = 7 + row * 25;
        ctx.fillStyle = row % 2 ? '#ffbc75' : '#ffe8b8';
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal * Math.PI * 2 / 5 + row;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(angle) * 3.4, y + Math.sin(angle) * 3.2, 4.4, 2.25, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#842e2d';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  } else if (print === 'stripes') {
    ctx.fillStyle = '#eeedc5';
    for (const y of [55, 68, 81, 94, 107]) ctx.fillRect(0, y, 256, 3);
  } else {
    ctx.fillStyle = '#17616c';
    ctx.fillRect(0, 0, 256, 28);
    ctx.fillRect(0, 109, 256, 35);
    ctx.fillStyle = '#fff0c1';
    ctx.fillRect(0, 33, 256, 4);
    ctx.fillRect(0, 40, 256, 2);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new T.MeshStandardMaterial({ map: texture, roughness: .94 });
  fabric.set(key, material);
  return material;
}

function addHair(head: T.Group, haircut: Haircut, hair: number) {
  sphere(head, hair, .165, .116, .151, 0, .059, -.033);
  if (haircut === 'bucket') {
    mesh(head, new T.CylinderGeometry(.205, .245, .026, 26), 0xce954b, 0, .101);
    mesh(head, new T.CylinderGeometry(.122, .176, .111, 22), 0xe4b45f, 0, .168, -.01);
    mesh(head, new T.CylinderGeometry(.163, .176, .031, 22), 0x234655, 0, .126, -.01);
  } else if (haircut === 'bun') {
    sphere(head, hair, .132, .133, .113, 0, .008, -.096);
    sphere(head, 0xe9b544, .061, .061, .036, 0, .132, -.129);
    sphere(head, hair, .091, .086, .087, 0, .175, -.155);
    const fringe = sphere(head, hair, .091, .034, .051, -.061, .113, .112);
    fringe.rotation.z = .43;
  } else if (haircut === 'curls') {
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.399;
      const x = Math.sin(angle) * (.057 + .008 * i);
      const z = Math.cos(angle) * (.049 + .009 * i) - .025;
      const y = .125 - .0054 * i;
      sphere(head, i % 3 === 0 ? 0x593627 : hair, .076, .072, .075, x, y, z);
    }
  } else if (haircut === 'swept') {
    const fringe = sphere(head, hair, .116, .053, .088, -.038, .096, .075);
    fringe.rotation.z = .4;
    sphere(head, hair, .049, .073, .065, .104, .06, -.035);
  }
}

function addFace(head: T.Group, skin: number, hair: number, detailed: boolean) {
  sphere(head, skin, .153, .169, .137, 0, 0, .011);
  sphere(head, skin, .097, .081, .099, 0, -.074, .055);
  sphere(head, skin, .034, .044, .035, 0, -.007, .144);
  const shadow = new T.Color(skin).multiplyScalar(.74).getHex();
  for (const side of [-1, 1]) {
    sphere(head, skin, .026, .042, .025, side * .148, -.011, -.002);
    if (detailed) sphere(head, shadow, .013, .024, .012, side * .158, -.012, .015);
    if (detailed) {
      const eyebrow = sphere(head, hair, .032, .006, .009, side * .056, .041, .139);
      eyebrow.rotation.z = side * -.11;
      sphere(head, 0xfff0d5, .025, .015, .010, side * .055, .014, .139);
      sphere(head, 0x302729, .013, .016, .009, side * .054, .014, .146);
      sphere(head, 0xfff4dd, .004, .004, .004, side * .054 + .003, .019, .154);
    } else {
      sphere(head, 0x332827, .013, .017, .009, side * .055, .016, .145);
    }
  }
  if (detailed) {
    const mouth = new T.QuadraticBezierCurve3(new T.Vector3(-.035, -.064, .147),
      new T.Vector3(0, -.079, .152), new T.Vector3(.038, -.060, .147));
    mesh(head, new T.TubeGeometry(mouth, 10, .004, 5, false), shadow);
  }
}

export function makePerson(scene: T.Scene, appearance: Appearance) {
  const { shirt, shorts, skin, hair, haircut, print, shoes } = appearance;
  const detailed = Boolean(print);
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  scene.add(root);
  const model = new T.Group();
  model.scale.set(appearance.width ?? 1, 1, 1);
  body.add(model);
  root.scale.setScalar(appearance.scale ?? 1);
  const torso = sphere(model, shirt, .247, .322, .154, 0, .233, 0);
  if (print) torso.material = shirtFabric(shirt, print);
  sphere(model, shorts, .205, .147, .144, 0, .004, 0);
  sphere(model, skin, .071, .106, .073, 0, .526, .005);
  if (print === 'rashguard') sphere(model, 0x17616c, .079, .036, .083, 0, .505, .01);

  const head = new T.Group();
  head.position.set(0, .661, .014);
  model.add(head);
  addFace(head, skin, hair, detailed);
  addHair(head, haircut, hair);
  if (haircut === 'bun') {
    for (const side of [-1, 1]) sphere(head, 0xf5c650, .019, .019, .015, side * .151, -.039, .012);
  }

  const arms = [-1, 1].map(side => {
    const upper = new T.Group();
    upper.position.set(side * .215, .421, 0);
    model.add(upper);
    mesh(upper, sleeveGeometry, print === 'rashguard' ? 0x17616c : shirt, 0, -.071);
    mesh(upper, upperArmGeometry, skin, 0, -.194);
    const elbow = new T.Group();
    elbow.position.y = -.325;
    upper.add(elbow);
    sphere(elbow, skin, .069, .069, .069);
    mesh(elbow, forearmGeometry, skin, 0, -.126);
    const hand = new T.Group();
    hand.position.y = -.264;
    elbow.add(hand);
    sphere(hand, skin, .061, .077, .044);
    if (detailed) sphere(hand, skin, .024, .038, .022, -side * .048, .012, .025);
    return { upper, elbow, hand };
  });
  const legs = [-1, 1].map(side => {
    const upper = new T.Group();
    upper.position.set(side * .107, .009, 0);
    model.add(upper);
    mesh(upper, shortsGeometry, shorts, 0, -.146);
    if (detailed) {
      const hem = sphere(upper, print === 'rashguard' ? 0xe9b33e : shorts, .121, .022, .119, 0, -.234);
      hem.castShadow = false;
    }
    const knee = new T.Group();
    knee.position.y = -.345;
    upper.add(knee);
    sphere(knee, skin, .085, .091, .084);
    mesh(knee, shinGeometry, skin, 0, -.174);
    const foot = new T.Group();
    foot.position.y = -.366;
    knee.add(foot);
    sphere(foot, skin, .087, .049, .132, 0, 0, .047);
    if (shoes !== undefined) {
      sphere(foot, shoes, .088, .022, .137, 0, -.034, .047);
      sphere(foot, shoes, .077, .025, .030, 0, .031, .081);
    }
    return { upper, knee, foot };
  });
  const hit = new T.Mesh(hitGeometry, hitMaterial);
  hit.position.y = .84;
  root.add(hit);
  const focus = new T.Object3D();
  focus.position.set(0, 1.73, .03);
  root.add(focus);
  return { root, body, head, arms, legs, hit, focus };
}

export function shaveIceCup(parent: T.Object3D, includeSpoon = true) {
  const cup = new T.Group();
  parent.add(cup);
  const paper = mesh(cup, new T.CylinderGeometry(.083, .053, .105, 14), 0xffedbf, 0, .042);
  paper.castShadow = false;
  sphere(cup, 0xe96863, .083, .054, .082, -.014, .098);
  sphere(cup, 0xf3b64a, .056, .047, .072, .028, .115);
  if (includeSpoon) {
    const spoon = mesh(cup, new T.CylinderGeometry(.008, .009, .152, 7), 0xffe7bd, .049, .159, -.025);
    spoon.rotation.z = -.27;
  }
  return cup;
}

export const spoonReach = .15;

export function shaveIceSpoon(hand: T.Group) {
  const spoon = new T.Group();
  hand.add(spoon);
  mesh(spoon, new T.CylinderGeometry(.007, .009, spoonReach, 7), 0xffe7bd, 0, .058);
  sphere(spoon, 0xffe7bd, .024, .023, .009, 0, .136);
  return spoon;
}
