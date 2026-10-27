import { describe, expect, test } from 'bun:test';
import { parseSessionOrder } from './sessionParams';

describe('parseSessionOrder', () => {
  test('"difficult" gives difficult', () => {
    expect(parseSessionOrder('difficult')).toBe('difficult');
  });

  test('a missing or unknown value gives chronological', () => {
    expect(parseSessionOrder(null)).toBe('chronological');
    expect(parseSessionOrder('chronological')).toBe('chronological');
    expect(parseSessionOrder('other')).toBe('chronological');
  });
});
