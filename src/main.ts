import './style.css';
import { Vector3 } from 'three';
import { DEFAULT_CIRCLE, circlePose, createCirclePose } from './logic/circlePath.ts';
import { CameraRig } from './render/cameraRig.ts';
import { createRenderer, resizeView } from './render/renderer.ts';
import { createSavanna } from './render/savanna.ts';
import { loadZebra } from './render/zebra.ts';
import { watchViewport } from './platform/viewport.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = createRenderer(canvas);
const scene = createSavanna(DEFAULT_CIRCLE.radius);
const rig = new CameraRig(canvas, new Vector3(0, 0.8, 0));

watchViewport((w, h) => resizeView(renderer, rig.camera, w, h));

const zebra = await loadZebra(`${import.meta.env.BASE_URL}models/zebra.glb`);
scene.add(zebra.object);

const pose = createCirclePose();
const circumference = 2 * Math.PI * DEFAULT_CIRCLE.radius;
let distance = 0;

function step(dt: number): void {
  distance = (distance + zebra.speed * dt) % circumference;
  circlePose(distance, zebra.speed, pose);
  // Banan svänger vänster: negativ rullning lutar zebran inåt (mot +X lokalt).
  zebra.object.position.set(pose.x, 0, pose.z);
  zebra.object.rotation.set(0, pose.heading, -pose.lean);
  zebra.update(dt);
  rig.update(dt, zebra.object.position, pose.heading);
}

// Bara i dev: ?sim=<sekunder> spolar fram simuleringen före första bilden
// (för skärmdumpar från huvudlös webbläsare, där bildrutorna är få).
if (import.meta.env.DEV) {
  const sim = Number(new URLSearchParams(location.search).get('sim') ?? 0);
  for (let t = 0; t < sim; t += 1 / 30) step(1 / 30);
}

let lastTime = performance.now();
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  step(dt);
  renderer.render(scene, rig.camera);
});
