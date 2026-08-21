// Parses an HTTP `Range` request header against a known resource size.
// Deliberately supports only a single byte-range (closed, open-ended, or
// suffix) — multi-range requests (`bytes=0-10,20-30`) are treated as if no
// Range header were sent, which RFC 7233 §3.1 permits a server to do.

export type RangeResult =
  { type: 'none' } | { type: 'single'; start: number; end: number } | { type: 'unsatisfiable' };

const SINGLE_RANGE_RE = /^bytes=(\d*)-(\d*)$/;

export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return { type: 'none' };

  const match = SINGLE_RANGE_RE.exec(header.trim());
  if (!match) return { type: 'none' };

  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return { type: 'none' };

  let start: number;
  let end: number;

  if (startStr === '') {
    // Suffix range (`bytes=-N`): the last N bytes of the resource.
    const suffixLength = Number(endStr);
    if (suffixLength <= 0) return { type: 'unsatisfiable' };
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? size - 1 : Number(endStr);
  }

  if (start > end || start >= size) return { type: 'unsatisfiable' };

  return { type: 'single', start, end: Math.min(end, size - 1) };
}
