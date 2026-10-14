import {
  DataTexture,
  type Material,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from 'three';

let sharedGradient: DataTexture | null = null;

/** Gradientkarta med tre ljusband (skugga, mellan, ljus), delad av alla toon-material. */
export function toonGradient(): DataTexture {
  if (!sharedGradient) {
    sharedGradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
    sharedGradient.minFilter = NearestFilter;
    sharedGradient.magFilter = NearestFilter;
    sharedGradient.generateMipmaps = false;
    sharedGradient.needsUpdate = true;
  }
  return sharedGradient;
}

/** Gör ett toon-material av ett inläst material och behåller färg och textur. */
export function toToonMaterial(source: Material): MeshToonMaterial {
  const toon = new MeshToonMaterial({ gradientMap: toonGradient() });
  toon.name = source.name;
  toon.side = source.side;
  toon.alphaTest = source.alphaTest;
  toon.vertexColors = source.vertexColors;
  if (source instanceof MeshStandardMaterial) {
    toon.color.copy(source.color);
    toon.map = source.map;
  }
  return toon;
}
