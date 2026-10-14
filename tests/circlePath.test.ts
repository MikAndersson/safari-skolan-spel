import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CIRCLE,
  circlePose,
  createCirclePose,
  leanForSpeed,
} from '../src/logic/circlePath.ts';

const R = DEFAULT_CIRCLE.radius;

describe('circlePose', () => {
  it('ligger alltid på cirkeln med radie 6 m', () => {
    const p = createCirclePose();
    for (const d of [0, 1, 5.5, 20, 100]) {
      circlePose(d, 3, p);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 10);
    }
  });

  it('färdriktningen är tangent och enhetslång', () => {
    const p = createCirclePose();
    circlePose(7.3, 3, p);
    expect(Math.hypot(p.dirX, p.dirZ)).toBeCloseTo(1, 10);
    expect(p.x * p.dirX + p.z * p.dirZ).toBeCloseTo(0, 10);
  });

  it('riktningen stämmer med hur positionen ändras', () => {
    const a = circlePose(3, 0, createCirclePose());
    const b = circlePose(3.001, 0, createCirclePose());
    expect((b.x - a.x) / 0.001).toBeCloseTo(a.dirX, 3);
    expect((b.z - a.z) / 0.001).toBeCloseTo(a.dirZ, 3);
  });

  it('heading pekar i färdriktningen (0 = +Z)', () => {
    const p = createCirclePose();
    circlePose(11, 0, p);
    expect(Math.sin(p.heading)).toBeCloseTo(p.dirX, 10);
    expect(Math.cos(p.heading)).toBeCloseTo(p.dirZ, 10);
  });

  it('ett varv tillbaka till start', () => {
    const a = circlePose(0, 0, createCirclePose());
    const b = circlePose(2 * Math.PI * R, 0, createCirclePose());
    expect(b.x).toBeCloseTo(a.x, 10);
    expect(b.z).toBeCloseTo(a.z, 10);
  });

  it('skriver till out-objektet', () => {
    const p = createCirclePose();
    expect(circlePose(1, 1, p)).toBe(p);
  });
});

describe('lutning', () => {
  it('ingen lutning vid stillastående', () => {
    expect(leanForSpeed(0)).toBe(0);
  });

  it('växer med fart²/radie', () => {
    const l1 = leanForSpeed(1);
    const l2 = leanForSpeed(2);
    expect(l2 / l1).toBeCloseTo(4, 10);
    expect(l1).toBeCloseTo(DEFAULT_CIRCLE.leanPerAccel / R, 10);
  });

  it('mindre radie ger mer lutning', () => {
    const tight = leanForSpeed(3, { ...DEFAULT_CIRCLE, radius: 3 });
    expect(tight).toBeGreaterThan(leanForSpeed(3));
  });

  it('har ett tak', () => {
    expect(leanForSpeed(100)).toBe(DEFAULT_CIRCLE.maxLean);
    expect(circlePose(0, 100, createCirclePose()).lean).toBe(DEFAULT_CIRCLE.maxLean);
  });
});
