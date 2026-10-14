import {
  Color,
  DoubleSide,
  type Material,
  Matrix4,
  MeshToonMaterial,
  type Object3D,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { toToonMaterial } from '../toon.ts';

/**
 * Hårmaterial för man och svans: MeshToonMaterial med inskjuten kod, så att
 * skinning, ljus, skuggor och dimma fungerar som vanligt.
 *
 * UV-kontrakt: V = 0 vid roten och 1 vid spetsen, U längs remsan.
 */

export interface HairOptions {
  /** Antal strån över hela remsan (U 0..1). */
  strands: number;
  /** Kortaste strået, som andel av remsans längd. */
  minLength: number;
  /** Färgfaktor vid spetsen (1 = ingen mörkning). */
  tipDarken: number;
  /** Svängning: amplitud (m vid spetsen) och vinkelfrekvens (rad/s). */
  swayAmp: number;
  swayFreq: number;
  /** Drag bakåt vid spetsen: meter per m/s, med tak. */
  dragPerSpeed: number;
  dragMax: number;
  /** Glänsbandets styrka och skärpa (högre = smalare). */
  sheenStrength: number;
  sheenPower: number;
  /** Var längs stråna bandet hamnar (lutning mot normalen vid V = 0.5). */
  sheenShift: number;
  /** Hur mycket stråna "böjer sig" från rot till spets; bredare = bandet syns från fler håll. */
  sheenSpread: number;
}

export const MANE_OPTIONS: Readonly<HairOptions> = {
  strands: 70,
  minLength: 0.55,
  tipDarken: 0.6,
  swayAmp: 0.025,
  swayFreq: 9,
  dragPerSpeed: 0.02,
  dragMax: 0.1,
  sheenStrength: 0.12,
  sheenPower: 160,
  sheenShift: 0.1,
  sheenSpread: 2.0,
};

export const TAIL_OPTIONS: Readonly<HairOptions> = {
  strands: 24,
  minLength: 0.6,
  tipDarken: 0.7,
  swayAmp: 0.08,
  swayFreq: 6,
  dragPerSpeed: 0.06,
  dragMax: 0.3,
  sheenStrength: 0.1,
  sheenPower: 160,
  sheenShift: -0.2,
  sheenSpread: 2.4,
};

const VERTEX_PARS = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uSwayAmp;
uniform float uSwayFreq;
uniform float uDragPerSpeed;
uniform float uDragMax;
uniform vec3 uBackDir;
uniform vec3 uSideDir;
varying vec2 vHairUv;
`;

// Körs efter skinning: \`transformed\` är i meshens lokala rum, liksom uBackDir/uSideDir.
const VERTEX_MAIN = /* glsl */ `
vHairUv = uv;
{
  float w = uv.y * uv.y;
  float phase = uTime * uSwayFreq - uv.y * 2.5 + uv.x * 3.0;
  float drag = min(uSpeed * uDragPerSpeed, uDragMax);
  vec3 hairOffset = uSideDir * (sin(phase) * uSwayAmp)
    + uBackDir * (drag + sin(phase * 1.7) * uSwayAmp * 0.5);
  transformed += hairOffset * w;
}
`;

const FRAGMENT_PARS = /* glsl */ `
uniform float uStrands;
uniform float uMinLength;
uniform float uTipDarken;
uniform float uSheenStrength;
uniform float uSheenPower;
uniform float uSheenShift;
uniform float uSheenSpread;
uniform vec3 uSheenColor;
varying vec2 vHairUv;

float hairHash(float n) {
  return fract(sin(n * 12.9898 + 4.1414) * 43758.5453);
}
float hairNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hairHash(i), hairHash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
`;

// Efter map_fragment, före alphatest: färg och trasig kant.
const FRAGMENT_ALPHA = /* glsl */ `
float hairU = vHairUv.x * uStrands;
float hairCell = floor(hairU);
float hairRnd = hairHash(hairCell);
float hairV = vHairUv.y;
{
  float clump = hairNoise(vHairUv.x * uStrands * 0.15 + 3.7);
  // Varje strå slutar på sin egen längd: ojämn, trasig kant.
  float len = mix(uMinLength, 1.0, 0.7 * hairRnd + 0.3 * clump);
  float along = hairV / len;
  // Stråna smalnar mot spetsen; vid roten täcker de hela remsan.
  float width = mix(1.0, 0.3, clamp(along, 0.0, 1.0));
  // Långt bort är stråna under en pixel: bredda dem så att kanten inte flimrar.
  width = max(width, min(1.0, fwidth(hairU) * 1.5));
  float profile = 1.0 - abs(fract(hairU) - 0.5) * 2.0;
  float a = clamp((profile - (1.0 - width)) * 4.0 + 0.5, 0.0, 1.0);
  a *= 1.0 - smoothstep(0.9, 1.0, along);
  diffuseColor.a *= a;
  diffuseColor.rgb *= mix(1.0, uTipDarken, hairV) * (0.85 + 0.3 * hairNoise(hairU));
}
`;

// Glänsband (Kajiya-Kay), kvantiserat som toon. Läggs till efter ljusberäkningen.
// En platt hårremsa har nästan samma strårikting överallt; för att få ett smalt
// band tvärs över stråna lutas riktningen mot normalen allt mer längs V, som om
// stråna vore böjda. Bandet hamnar där lutningen ger störst glans.
const FRAGMENT_SHEEN = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  // Strånas riktning (dP/dV) från skärmderivator, i vyrymden.
  // Derivatorna är små (≈ mm och tusendelar per pixel); skala upp dem först
  // så att korsprodukterna inte försvinner i flyttalsprecisionen.
  vec3 q0 = dFdx(-vViewPosition);
  vec3 q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(vHairUv);
  vec2 st1 = dFdy(vHairUv);
  float qs = 1.0 / max(length(q0) + length(q1), 1e-12);
  float ss = 1.0 / max(length(st0) + length(st1), 1e-12);
  q0 *= qs; q1 *= qs; st0 *= ss; st1 *= ss;
  vec3 q1perp = cross(q1, normal);
  vec3 q0perp = cross(normal, q0);
  vec3 strandDir = q1perp * st0.y + q0perp * st1.y;
  float strandLen = length(strandDir);
  if (strandLen > 1e-4) {
    // Per strå förskjuts bandet lite så att det bryts upp.
    float tilt = uSheenShift + (hairV - 0.5) * uSheenSpread + (hairRnd - 0.5) * 0.3;
    vec3 T = normalize(strandDir / strandLen + normal * tilt);
    vec3 L = directionalLights[0].direction;
    vec3 H = normalize(L + normalize(vViewPosition));
    float th = dot(T, H);
    float spec = pow(sqrt(max(0.0, 1.0 - th * th)), uSheenPower);
    // Hårremsorna är tunna och dubbelsidiga, så normalen avgör inte vilken sida som är belyst.
    float band = step(0.5, spec);
    outgoingLight += band * uSheenStrength * uSheenColor * directionalLights[0].color;
  }
}
#endif
`;

export interface HairUniforms {
  uTime: { value: number };
  uSpeed: { value: number };
  uSwayAmp: { value: number };
  uSwayFreq: { value: number };
  uDragPerSpeed: { value: number };
  uDragMax: { value: number };
  uBackDir: { value: Vector3 };
  uSideDir: { value: Vector3 };
  uStrands: { value: number };
  uMinLength: { value: number };
  uTipDarken: { value: number };
  uSheenStrength: { value: number };
  uSheenPower: { value: number };
  uSheenShift: { value: number };
  uSheenSpread: { value: number };
  uSheenColor: { value: Color };
}

function inject(source: string, anchor: string, code: string, after = true): string {
  if (!source.includes(anchor)) {
    console.warn(`hairMaterial: hittar inte ${anchor} i shadern`);
    return source;
  }
  return source.replace(anchor, after ? `${anchor}\n${code}` : `${code}\n${anchor}`);
}

export function createHairMaterial(source: Material, opts: Readonly<HairOptions>): {
  material: MeshToonMaterial;
  uniforms: HairUniforms;
} {
  const material = toToonMaterial(source);
  material.side = DoubleSide;
  material.alphaTest = 0.5;
  material.transparent = false;

  const uniforms: HairUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uSwayAmp: { value: opts.swayAmp },
    uSwayFreq: { value: opts.swayFreq },
    uDragPerSpeed: { value: opts.dragPerSpeed },
    uDragMax: { value: opts.dragMax },
    uBackDir: { value: new Vector3(0, 0, -1) },
    uSideDir: { value: new Vector3(1, 0, 0) },
    uStrands: { value: opts.strands },
    uMinLength: { value: opts.minLength },
    uTipDarken: { value: opts.tipDarken },
    uSheenStrength: { value: opts.sheenStrength },
    uSheenPower: { value: opts.sheenPower },
    uSheenShift: { value: opts.sheenShift },
    uSheenSpread: { value: opts.sheenSpread },
    uSheenColor: { value: new Color('#fff4e0') },
  };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    let vs = shader.vertexShader;
    vs = inject(vs, '#include <common>', VERTEX_PARS);
    vs = inject(vs, '#include <skinning_vertex>', VERTEX_MAIN);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = inject(fs, '#include <common>', FRAGMENT_PARS);
    fs = inject(fs, '#include <map_fragment>', FRAGMENT_ALPHA);
    fs = inject(fs, '#include <opaque_fragment>', FRAGMENT_SHEEN, false);
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => 'hair-toon-1';

  return { material, uniforms };
}

const BACK = new Vector3(0, 0, -1);
const SIDE = new Vector3(1, 0, 0);

/** Kopplar ett hårmaterial till sin mesh och uppdaterar uniforms utan nya objekt. */
export class HairBinding {
  readonly mesh: Object3D;
  readonly uniforms: HairUniforms;
  private readonly inverse = new Matrix4();

  constructor(mesh: Object3D, uniforms: HairUniforms) {
    this.mesh = mesh;
    this.uniforms = uniforms;
  }

  /**
   * `body` är zebrans rot (tittar mot +Z). Bakåt/sidled räknas om till
   * meshens lokala rum, där vertexshadern förskjuter efter skinning.
   * Förutsätter att matrixWorld är uppdaterad.
   */
  update(time: number, speed: number, body: Object3D): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uSpeed.value = speed;
    this.inverse.copy(this.mesh.matrixWorld).invert();
    this.uniforms.uBackDir.value.copy(BACK).transformDirection(body.matrixWorld).transformDirection(this.inverse);
    this.uniforms.uSideDir.value.copy(SIDE).transformDirection(body.matrixWorld).transformDirection(this.inverse);
  }
}
