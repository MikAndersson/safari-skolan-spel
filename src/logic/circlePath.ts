// Rörelse längs en cirkel i markplanet (x, z), moturs sett ovanifrån (+Y upp).
// Ren logik: inga three- eller DOM-beroenden.

export const DEFAULT_RADIUS_M = 6;
const GRAVITY = 9.81;

export interface CircleOptions {
  /** Cirkelns radie i meter. */
  radius: number;
  /** Lutning (rad) per m/s² centripetalacceleration. 1/g motsvarar fysisk lutning för små vinklar. */
  leanPerAccel: number;
  /** Tak för lutningen (rad). */
  maxLean: number;
}

export const DEFAULT_CIRCLE: Readonly<CircleOptions> = {
  radius: DEFAULT_RADIUS_M,
  leanPerAccel: 1 / GRAVITY,
  maxLean: 0.35,
};

export interface CirclePose {
  /** Position i markplanet. */
  x: number;
  z: number;
  /** Färdriktning (enhetsvektor). */
  dirX: number;
  dirZ: number;
  /** Girvinkel runt +Y där 0 = mot +Z, så att (sin, cos) = färdriktningen. */
  heading: number;
  /** Lutning inåt mot cirkelns mitt (rad, >= 0). */
  lean: number;
}

export function createCirclePose(): CirclePose {
  return { x: 0, z: 0, dirX: 0, dirZ: 0, heading: 0, lean: 0 };
}

/** Lutning inåt för en viss fart: växer med fart²/radie, med tak. */
export function leanForSpeed(speed: number, opts: Readonly<CircleOptions> = DEFAULT_CIRCLE): number {
  const accel = (speed * speed) / opts.radius;
  return Math.min(accel * opts.leanPerAccel, opts.maxLean);
}

/**
 * Pose efter att ha färdats `distance` meter längs cirkeln med farten `speed`.
 * Skriver till `out` (ingen allokering) och returnerar den.
 */
export function circlePose(
  distance: number,
  speed: number,
  out: CirclePose,
  opts: Readonly<CircleOptions> = DEFAULT_CIRCLE,
): CirclePose {
  const angle = distance / opts.radius;
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  out.x = opts.radius * s;
  out.z = opts.radius * c;
  out.dirX = c;
  out.dirZ = -s;
  out.heading = Math.atan2(out.dirX, out.dirZ);
  out.lean = leanForSpeed(speed, opts);
  return out;
}
