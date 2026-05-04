import { describe, it, expect } from 'vitest';
import {
  isValidCorners,
  normalizeCorners,
  type Corners,
} from '../../utils/perspectiveTransform';

describe('isValidCorners', () => {
  const valid: Corners = {
    topLeft:     { x: 0,   y: 0   },
    topRight:    { x: 1,   y: 0   },
    bottomRight: { x: 1,   y: 1   },
    bottomLeft:  { x: 0,   y: 1   },
  };

  it('accepts standard 0..1 corners', () => {
    expect(isValidCorners(valid)).toBe(true);
  });

  it('accepts slight overflow within tolerance', () => {
    expect(isValidCorners({ ...valid, topLeft: { x: -0.1, y: -0.1 } })).toBe(true);
  });

  it('rejects null / undefined', () => {
    expect(isValidCorners(null)).toBe(false);
    expect(isValidCorners(undefined)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidCorners({ ...valid, topLeft: { x: NaN, y: 0 } })).toBe(false);
    expect(isValidCorners({ ...valid, topLeft: { x: Infinity, y: 0 } })).toBe(false);
  });

  it('rejects values far outside 0..1', () => {
    expect(isValidCorners({ ...valid, topLeft: { x: -1, y: 0 } })).toBe(false);
    expect(isValidCorners({ ...valid, topLeft: { x: 2, y: 0 } })).toBe(false);
  });

  it('rejects missing corner', () => {
    const { topLeft, ...partial } = valid;
    expect(isValidCorners(partial)).toBe(false);
  });
});

describe('normalizeCorners', () => {
  it('clamps each component to 0..1', () => {
    const result = normalizeCorners({
      topLeft:     { x: -0.05, y: -0.05 },
      topRight:    { x:  1.05, y: -0.05 },
      bottomRight: { x:  1.05, y:  1.05 },
      bottomLeft:  { x: -0.05, y:  1.05 },
    });
    expect(result).toEqual({
      topLeft:     { x: 0, y: 0 },
      topRight:    { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft:  { x: 0, y: 1 },
    });
  });

  it('leaves in-range values untouched', () => {
    const c: Corners = {
      topLeft:     { x: 0.1, y: 0.2 },
      topRight:    { x: 0.9, y: 0.2 },
      bottomRight: { x: 0.9, y: 0.8 },
      bottomLeft:  { x: 0.1, y: 0.8 },
    };
    expect(normalizeCorners(c)).toEqual(c);
  });
});
