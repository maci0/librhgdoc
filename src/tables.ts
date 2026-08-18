/**
 * Markdown table column width calculation.
 *
 * Computes proportional column widths in points from a markdown table's
 * content, suitable for the Google Docs API.
 *
 * @module
 */

/** Options for column width calculation. */
export interface ColumnWidthOptions {
  /** Total page/container width in points. Default: 468 (6.5" at 72pt/inch). */
  pageWidthPt?: number;
  /** Minimum column width in points. Default: 50 (~0.69"). */
  minColPt?: number;
  /** Narrow column minimum for short content. Default: 42 (~0.58"). */
  narrowColPt?: number;
  /** Average char count threshold for narrow treatment. Default: 6. */
  narrowThreshold?: number;
}

/** Calculate proportional column widths from a markdown table's content.
 * Returns an array of widths in points that sum to the page width.
 * Uses average cell content length with header-length floors and min constraints. */
export function calcColumnWidths(markdownTable: string, options?: ColumnWidthOptions): number[] {
  const PAGE_WIDTH_PT    = options?.pageWidthPt     ?? 468;
  const MIN_COL_PT       = options?.minColPt        ?? 50;
  const NARROW_COL_PT    = options?.narrowColPt     ?? 42;
  const NARROW_THRESHOLD = options?.narrowThreshold ?? 6;

  const rows = markdownTable
    .split('\n')
    .filter(l => { const t = l.trim(); return t.startsWith('|') && !/^\|[\s:|-]+\|$/.test(t); })
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()));

  if (!rows.length || !rows[0]?.length) return [];

  const numCols = rows[0].length;
  const headers = rows[0];

  // Average and max content length per column (data rows only)
  const avgLen = Array(numCols).fill(0) as number[];
  const maxLen = Array(numCols).fill(0) as number[];
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    const base = Math.floor(PAGE_WIDTH_PT / numCols);
    const widths = Array(numCols).fill(base);
    widths[numCols - 1] = PAGE_WIDTH_PT - base * (numCols - 1);
    return widths;
  }

  for (const row of dataRows) {
    for (let c = 0; c < numCols; c++) {
      const cell = row[c] ?? '';
      // Scale character count for backtick-wrapped (monospace) content:
      // monospace fonts are ~1.3× wider per character than proportional text.
      const codeMatch = cell.match(/^`([^`]+)`$/);
      const len = codeMatch ? cell.length * 1.3 : cell.length;
      avgLen[c] += len;
      if (len > maxLen[c]) maxLen[c] = len;
    }
  }
  for (let c = 0; c < numCols; c++) avgLen[c] /= dataRows.length;

  // Effective length: blend of average and max to prevent the longest value
  // from word-wrapping. Uses 70% avg + 30% max as a compromise between
  // proportional fairness and accommodating outliers.
  const effectiveLen = Array(numCols).fill(0) as number[];
  for (let c = 0; c < numCols; c++) {
    effectiveLen[c] = avgLen[c] * 0.7 + maxLen[c] * 0.3;
  }

  // Floor each column's effective length to at least the header text length
  // so that column headers never get truncated/word-wrapped.
  for (let c = 0; c < numCols; c++) {
    const hdrLen = (headers[c]?.length ?? 0) * 1.8; // 1.8× because header is bold + needs breathing room
    if (effectiveLen[c] < hdrLen) effectiveLen[c] = hdrLen;
  }

  // Ensure minimum and compute proportional widths.
  // Columns with very short average content (IDs, priorities, short labels)
  // get a tighter minimum so they don't waste space in wide tables.
  const total = effectiveLen.reduce((a, b) => a + Math.max(b, 3), 0); // min 3 chars
  const widths = effectiveLen.map(len => {
    const minPt = len <= NARROW_THRESHOLD ? NARROW_COL_PT : MIN_COL_PT;
    return Math.max(minPt, (Math.max(len, 3) / total) * PAGE_WIDTH_PT);
  });

  const widthSum = widths.reduce((a, b) => a + b, 0);
  const rounded = widths.map(w => Math.round((w / widthSum) * PAGE_WIDTH_PT));
  const roundedSum = rounded.reduce((a, b) => a + b, 0);
  if (roundedSum !== PAGE_WIDTH_PT && rounded.length > 0) {
    rounded[rounded.length - 1] += PAGE_WIDTH_PT - roundedSum;
  }
  return rounded;
}
