import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Kameran ligger snett bakom och lite utanför målet (i målets egna koordinater). */
const FOLLOW_SIDE = -2.4; // -X = målets högra sida, alltså utsidan av en vänstersväng
const FOLLOW_HEIGHT = 2.6;
const FOLLOW_BACK = 5.5;
const LOOK_HEIGHT = 1.0;
const LOOK_AHEAD = 1.5;
const POSITION_STIFFNESS = 3;
const LOOK_STIFFNESS = 6;

/**
 * Följer ett mål mjukt snett bakifrån. I fritt läge styr OrbitControls
 * i stället kameran runt `orbitCenter`.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private free = false;
  private readonly desired = new Vector3();
  private readonly lookTarget = new Vector3();
  private readonly look = new Vector3();

  constructor(domElement: HTMLElement, orbitCenter: Vector3) {
    this.camera = new PerspectiveCamera(50, 1, 0.1, 250);
    this.camera.position.set(0, 4, 14);
    this.look.copy(orbitCenter);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.copy(orbitCenter);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.enabled = false;
  }

  get isFree(): boolean {
    return this.free;
  }

  setFree(free: boolean): void {
    this.free = free;
    this.controls.enabled = free;
  }

  /** Målets position i världen och girvinkel (0 = tittar mot +Z). */
  update(dt: number, target: Vector3, heading: number): void {
    if (this.free) {
      this.controls.update(dt);
      return;
    }
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    // Rotera förskjutningen (sida, höjd, -bak) runt Y med heading.
    this.desired.set(
      target.x + FOLLOW_SIDE * c - FOLLOW_BACK * s,
      target.y + FOLLOW_HEIGHT,
      target.z - FOLLOW_SIDE * s - FOLLOW_BACK * c,
    );
    this.lookTarget.set(target.x + LOOK_AHEAD * s, target.y + LOOK_HEIGHT, target.z + LOOK_AHEAD * c);

    this.camera.position.lerp(this.desired, 1 - Math.exp(-POSITION_STIFFNESS * dt));
    this.look.lerp(this.lookTarget, 1 - Math.exp(-LOOK_STIFFNESS * dt));
    this.camera.lookAt(this.look);
  }
}
