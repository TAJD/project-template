import { describe, expect, it } from 'vitest';
import { parseRange } from './range';

describe('parseRange', () => {
  it('returns none for a missing header', () => {
    expect(parseRange(null, 1000)).toEqual({ type: 'none' });
    expect(parseRange(undefined, 1000)).toEqual({ type: 'none' });
  });

  it('parses a closed range', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ type: 'single', start: 0, end: 99 });
  });

  it('parses an open-ended range', () => {
    expect(parseRange('bytes=900-', 1000)).toEqual({ type: 'single', start: 900, end: 999 });
  });

  it('parses a suffix range', () => {
    expect(parseRange('bytes=-500', 1000)).toEqual({ type: 'single', start: 500, end: 999 });
  });

  it('clamps a suffix range larger than the resource', () => {
    expect(parseRange('bytes=-5000', 1000)).toEqual({ type: 'single', start: 0, end: 999 });
  });

  it('clamps an open-ended end beyond the resource size', () => {
    expect(parseRange('bytes=0-999999', 100)).toEqual({ type: 'single', start: 0, end: 99 });
  });

  it('treats a syntactically malformed header as no range', () => {
    expect(parseRange('bytes=abc-def', 1000)).toEqual({ type: 'none' });
    expect(parseRange('bytes=-5-10', 1000)).toEqual({ type: 'none' });
    expect(parseRange('not-a-range-header', 1000)).toEqual({ type: 'none' });
  });

  it('treats a multi-range header as no range (server may serve the whole entity)', () => {
    expect(parseRange('bytes=0-10,20-30', 1000)).toEqual({ type: 'none' });
  });

  it('is unsatisfiable when start is past the end of the resource', () => {
    expect(parseRange('bytes=1000-1099', 1000)).toEqual({ type: 'unsatisfiable' });
  });

  it('is unsatisfiable when start is after end', () => {
    expect(parseRange('bytes=100-50', 1000)).toEqual({ type: 'unsatisfiable' });
  });

  it('is unsatisfiable for a zero-length suffix', () => {
    expect(parseRange('bytes=-0', 1000)).toEqual({ type: 'unsatisfiable' });
  });

  it('is unsatisfiable for any concrete range on a zero-size resource', () => {
    expect(parseRange('bytes=0-0', 0)).toEqual({ type: 'unsatisfiable' });
    expect(parseRange('bytes=-1', 0)).toEqual({ type: 'unsatisfiable' });
  });
});
