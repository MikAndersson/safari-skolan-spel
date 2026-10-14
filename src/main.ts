import './style.css';
import { Vector3 } from 'three';
import { DEFAULT_CIRCLE, circlePose, createCirclePose } from './logic/circlePath.ts';
import { CameraRig } from './render/cameraRig.ts';
import { createRenderer, resizeView } from './render/renderer.ts';
import { createSavanna } from './render/savanna.ts';
import { watchViewport } from './platform/viewport.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = createRenderer(canvas);
const scene = createSavanna(DEFAULT_CIRCLE.radius);
const rig = new CameraRig(canvas, new Vector3(0, 0.8, 0));

watchViewport((w, h) => resizeView(renderer, rig.camera, w, h));

const SPEED = 4;
const pose = createCirclePose();
const target = new Vector3();
let distance = 0;
let lastTime = performance.now();

renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  distance = (distance + SPEED * dt) % (2 * Math.PI * DEFAULT_CIRCLE.radius);
  circlePose(distance, SPEED, pose);
  target.set(pose.x, 0, pose.z);

  rig.update(dt, target, pose.heading);
  renderer.render(scene, rig.camera);
});
