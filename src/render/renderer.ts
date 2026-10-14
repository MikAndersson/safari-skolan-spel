import { PCFShadowMap, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from 'three';

/** Högre pixelratio än så orkar inte en enkel surfplatta. */
export const MAX_PIXEL_RATIO = 1.5;

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

export function resizeView(renderer: WebGLRenderer, camera: PerspectiveCamera, width: number, height: number): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
