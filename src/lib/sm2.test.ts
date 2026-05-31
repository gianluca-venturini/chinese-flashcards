import { describe, expect, test } from 'bun:test';
import { applySm2 } from './sm2';

const DEFAULT_SR = { n: 0, ef: 2.5, i: 1 };

describe('applySm2', () => {
  test('q < 3 resets n to 0 and i to 1', () => {
    for (const q of [0, 1, 2]) {
      const result = applySm2({ n: 3, ef: 2.5, i: 10 }, q);
      expect(result.n).toBe(0);
      expect(result.i).toBe(1);
    }
  });

  test('q >= 3 from n=0 produces i=1, n=1', () => {
    const result = applySm2({ ...DEFAULT_SR, n: 0 }, 5);
    expect(result.i).toBe(1);
    expect(result.n).toBe(1);
  });

  test('q >= 3 from n=1 produces i=6, n=2', () => {
    const result = applySm2({ ...DEFAULT_SR, n: 1, i: 1 }, 5);
    expect(result.i).toBe(6);
    expect(result.n).toBe(2);
  });

  test('q >= 3 from n=2 produces i=round(prev_i * ef), n=3', () => {
    const result = applySm2({ n: 2, ef: 2.5, i: 6 }, 5);
    expect(result.i).toBe(Math.round(6 * 2.5));
    expect(result.n).toBe(3);
  });

  test('q >= 3 from n=3 produces i=round(prev_i * ef), n=4', () => {
    const result = applySm2({ n: 3, ef: 2.0, i: 15 }, 4);
    expect(result.i).toBe(Math.round(15 * 2.0));
    expect(result.n).toBe(4);
  });

  test('ef floor of 1.3 holds across repeated low-quality reviews', () => {
    let sr = { n: 0, ef: 1.3, i: 1 };
    for (let k = 0; k < 10; k++) {
      sr = applySm2(sr, 0);
      expect(sr.ef).toBeGreaterThanOrEqual(1.3);
    }
  });

  test('ef delta matches SM-2 formula for each q in 0..5', () => {
    for (let q = 0; q <= 5; q++) {
      const initialEf = 2.5;
      const result = applySm2({ n: 0, ef: initialEf, i: 1 }, q);
      const expectedEf = Math.max(1.3, initialEf + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      expect(result.ef).toBeCloseTo(expectedEf, 10);
    }
  });
});
