import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HairBinding, MANE_OPTIONS, TAIL_OPTIONS, createHairMaterial } from './materials/hairMaterial.ts';
import { toToonMaterial } from './toon.ts';

export const GALLOP_CLIP = 'Gallop';
/** Steglängd när modellen saknar userData.gallop_stride_m. */
export const DEFAULT_STRIDE_M = 2.5;
/** Platshållarens galoppcykel. */
const PLACEHOLDER_CYCLE_S = 0.6;

export interface Zebra {
  /** Placeras på banan: position, heading (rotation.y) och lutning (rotation.z). */
  readonly object: Group;
  /** Fart i m/s som gör att hovarna inte glider. */
  readonly speed: number;
  readonly isPlaceholder: boolean;
  update(dt: number): void;
}

/** Laddar zebran. Går det inte visas en platshållare av lådor i stället. */
export async function loadZebra(url: string): Promise<Zebra> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    return fromGltf(gltf);
  } catch (err) {
    console.info(`Kunde inte ladda ${url}, visar platshållare.`, err);
    return createPlaceholder();
  }
}

/**
 * Lägger modellen i en hållare som placeras på banan. `animate` driver
 * skelett/lådor; håret uppdateras efteråt med zebrans fart.
 */
function makeZebra(
  model: Object3D,
  speed: number,
  isPlaceholder: boolean,
  hair: HairBinding[],
  animate: (dt: number) => void,
): Zebra {
  const holder = new Group();
  holder.name = 'ZebraHolder';
  // Gir först, sedan lutning runt zebrans egen framåtaxel.
  holder.rotation.order = 'YXZ';
  holder.add(model);

  let time = 0;
  return {
    object: holder,
    speed,
    isPlaceholder,
    update(dt) {
      animate(dt);
      time += dt;
      if (hair.length === 0) return;
      holder.updateMatrixWorld(true);
      for (const h of hair) h.update(time, speed, model);
    },
  };
}

function fromGltf(gltf: GLTF): Zebra {
  const model = gltf.scene;
  const hair = prepareMaterials(model);

  const clip = AnimationClip.findByName(gltf.animations, GALLOP_CLIP) ?? gltf.animations[0];
  if (!clip) {
    console.warn('zebra.glb saknar animationer; zebran står still.');
    return makeZebra(model, 0, false, hair, () => {});
  }
  if (clip.name !== GALLOP_CLIP) console.warn(`Klippet "${GALLOP_CLIP}" saknas, använder "${clip.name}".`);

  const mixer = new AnimationMixer(model);
  mixer.clipAction(clip).play();

  const stride = findStride(gltf, clip);
  const speed = clip.duration > 0 ? stride / clip.duration : 0;
  return makeZebra(model, speed, false, hair, (dt) => mixer.update(dt));
}

/** Letar efter gallop_stride_m i klippets, scenens eller någon nods extras. */
function findStride(gltf: GLTF, clip: AnimationClip): number {
  const read = (data: Record<string, unknown>): number | undefined => {
    const v = data['gallop_stride_m'];
    return typeof v === 'number' && v > 0 ? v : undefined;
  };
  let stride = read(clip.userData) ?? read(gltf.scene.userData);
  if (stride === undefined) {
    gltf.scene.traverse((o) => {
      stride ??= read(o.userData);
    });
  }
  if (stride === undefined) console.info(`gallop_stride_m saknas, använder ${DEFAULT_STRIDE_M} m.`);
  return stride ?? DEFAULT_STRIDE_M;
}

const HAIR_OPTIONS = { Hair_Mane: MANE_OPTIONS, Hair_Tail: TAIL_OPTIONS } as const;

/**
 * Byter material efter namn: Hair_Mane/Hair_Tail får hårshadern, resten
 * (Zebra_Body m.fl.) blir toon med kvar textur. Returnerar hårkopplingarna.
 */
function prepareMaterials(root: Object3D): HairBinding[] {
  const hair: HairBinding[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    let hasHair = false;
    const convert = (m: Material): Material => {
      const opts = HAIR_OPTIONS[m.name as keyof typeof HAIR_OPTIONS];
      let result: Material;
      if (opts) {
        const { material, uniforms } = createHairMaterial(m, opts);
        hair.push(new HairBinding(o, uniforms));
        hasHair = true;
        result = material;
      } else {
        result = toToonMaterial(m);
      }
      m.dispose();
      return result;
    };
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    // Hårkort skulle kasta skugga som hela rektanglar (skuggpasset vet inget om stråna).
    o.castShadow = !hasHair;
    // Skinnade meshar har ofta fel omslutningssfär; det är bara en zebra.
    o.frustumCulled = false;
  });
  return hair;
}

/** Lådzebra som studsar i galopptakt, med samma materialnamn som den riktiga. */
function createPlaceholder(): Zebra {
  const named = (name: string, color: string): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({ color: new Color(color) });
    m.name = name;
    return m;
  };
  const bodyMat = named('Zebra_Body', '#f4f1ea');
  const darkMat = named('Zebra_Body', '#2b2622');
  const maneMat = named('Hair_Mane', '#2b2622');
  const tailMat = named('Hair_Tail', '#2b2622');
  maneMat.side = DoubleSide;
  tailMat.side = DoubleSide;

  const model = new Group();
  model.name = 'ZebraPlaceholder';
  const body = new Group();
  body.position.y = 1.0;
  model.add(body);

  const box = (w: number, h: number, d: number, mat: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), mat);

  const torso = box(0.45, 0.5, 1.3, bodyMat);
  body.add(torso);

  const neck = new Group();
  neck.position.set(0, 0.15, 0.6);
  neck.rotation.x = 0.6;
  body.add(neck);
  const neckBox = box(0.22, 0.65, 0.3, bodyMat);
  neckBox.position.y = 0.3;
  neck.add(neckBox);
  const head = box(0.22, 0.25, 0.55, bodyMat);
  head.position.set(0, 0.66, 0.12);
  head.rotation.x = 0.4;
  neck.add(head);

  // Man: remsa längs halsens baksida, stråna pekar uppåt-bakåt.
  const mane = new Mesh(hairStrip(0.8, 0.2, [0, 1, 0], [0, 0.5, -0.87]), maneMat);
  mane.position.set(0, 0.36, -0.15);
  neck.add(mane);

  // Svans: hänger ner bakåt från korsryggen.
  const tail = new Mesh(hairStrip(0.12, 0.6, [1, 0, 0], [0, -0.92, -0.39]), tailMat);
  tail.position.set(0, 0.18, -0.66);
  body.add(tail);

  const legs: Group[] = [];
  for (const [x, z] of [[-0.15, 0.5], [0.15, 0.5], [-0.15, -0.5], [0.15, -0.5]] as const) {
    const leg = new Group();
    leg.position.set(x, -0.2, z);
    const legBox = box(0.12, 0.8, 0.12, darkMat);
    legBox.position.y = -0.4;
    leg.add(legBox);
    body.add(leg);
    legs.push(leg);
  }

  const hair = prepareMaterials(model);

  let t = 0;
  return makeZebra(model, DEFAULT_STRIDE_M / PLACEHOLDER_CYCLE_S, true, hair, (dt) => {
    t = (t + dt / PLACEHOLDER_CYCLE_S) % 1;
    const a = t * Math.PI * 2;
    body.position.y = 1.0 + Math.abs(Math.sin(a)) * 0.12;
    body.rotation.x = Math.sin(a) * 0.08;
    neck.rotation.x = 0.6 + Math.sin(a + 0.6) * 0.1;
    // Fram- och bakbenpar i motfas, lite förskjutna inom paren.
    legs[0]!.rotation.x = Math.sin(a) * 0.6;
    legs[1]!.rotation.x = Math.sin(a + 0.4) * 0.6;
    legs[2]!.rotation.x = Math.sin(a + Math.PI) * 0.6;
    legs[3]!.rotation.x = Math.sin(a + Math.PI + 0.4) * 0.6;
  });
}

type Dir = readonly [number, number, number];

/**
 * Hårremsa enligt UV-kontraktet: roten centrerad längs `along` (U = 0..1),
 * stråna går i riktning `tip` (V = 0 vid roten, 1 vid spetsen, som i Blender).
 */
function hairStrip(width: number, length: number, along: Dir, tip: Dir): PlaneGeometry {
  const g = new PlaneGeometry(width, length, 6, 6);
  const pos = g.attributes['position']!;
  const uv = g.attributes['uv']!;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = 0.5 - pos.getY(i) / length; // plattans överkant blir roten
    const d = v * length;
    pos.setXYZ(i, along[0] * u + tip[0] * d, along[1] * u + tip[1] * d, along[2] * u + tip[2] * d);
    // Lagras som glTF gör (V vänt), så att remsan beter sig som den riktiga modellen.
    uv.setXY(i, u / width + 0.5, 1 - v);
  }
  g.computeVertexNormals();
  return g;
}
