/**
 * Mermaid diagram rendering with Red Hat colour theming.
 *
 * Provides colour-remapping rules that transform generic Mermaid palette
 * colours into the Red Hat brand palette, a theme constant for
 * `beautiful-mermaid`, and a rendering function that produces PNG buffers.
 *
 * The renderer uses `beautiful-mermaid` + `@resvg/resvg-js` (no puppeteer
 * required).  Both packages are optional peer dependencies — the module
 * loads without them, but {@link renderMermaidPng} will throw if they are
 * missing at call time.
 */

// ─── Theme ───────────────────────────────────────────────────────────────────

/**
 * Red Hat–appropriate Mermaid theme colours.
 *
 * Pass this object to `renderMermaidSVG()` from `beautiful-mermaid` to get
 * diagrams that match the RH brand guidelines.
 */
export const RH_MERMAID_THEME = {
  bg: '#ffffff',
  fg: '#151515',
  accent: '#ee0000',
  line: '#6a6e73',
  muted: '#6a6e73',
  surface: '#f5f5f5',
  border: '#d2d2d2',
} as const;

// ─── Colour remapping ────────────────────────────────────────────────────────

/**
 * Rules for remapping non-RH colours to the brand palette.
 *
 * Each entry is a `{ pattern, replacement }` pair. Apply them in order
 * via {@link applyRHTheme} to normalise diagrams authored with arbitrary
 * colour choices.
 */
export const RH_COLOR_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  // green fills/strokes → charcoal / near-black
  { pattern: /#bbf7d0|#dcfce7|#d1fae5/gi, replacement: '#383838' },
  { pattern: /#16a34a|#22c55e|#15803d/gi, replacement: '#151515' },
  // yellow → dark red
  { pattern: /#FFF4CC|#fef9c3|#fef08a/gi, replacement: '#A60000' },
  { pattern: /#eab308|#d97706|#ca8a04/gi, replacement: '#707070' },
  // blue → light gray / mid gray
  { pattern: /#dbeafe|#bfdbfe|#93c5fd/gi, replacement: '#F2F2F2' },
  { pattern: /#3b82f6|#2563eb|#1d4ed8/gi, replacement: '#707070' },
  { pattern: /#1e3a5f|#1e40af/gi, replacement: '#151515' },
  // purple → dark gray
  { pattern: /#f3e8ff|#e9d5ff/gi, replacement: '#F2F2F2' },
  { pattern: /#9333ea|#7c3aed/gi, replacement: '#707070' },
  { pattern: /#581c87/gi, replacement: '#151515' },
  // pink / light red → RH red
  { pattern: /#fde8e8|#fee2e2|#fecaca/gi, replacement: '#EE0000' },
  { pattern: /#ef4444|#dc2626/gi, replacement: '#EE0000' },
  // dark text on dark fill → white
  { pattern: /#14532d|#713f12|#1e3a8a/gi, replacement: '#ffffff' },
];

/**
 * Apply Red Hat colour remapping to Mermaid source code.
 *
 * Iterates over {@link RH_COLOR_MAP} and replaces all matching hex colours
 * with their brand-palette equivalents.
 */
export function applyRHTheme(mermaidSource: string): string {
  let s = mermaidSource;
  for (const { pattern, replacement } of RH_COLOR_MAP) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// ─── SVG dimension extraction ────────────────────────────────────────────────

/**
 * Extract `width` and `height` from an SVG string.
 *
 * Looks for `width="…"` and `height="…"` attributes on the root
 * `<svg>` element.  Returns `null` if either attribute is missing or
 * cannot be parsed as a number.
 */
export function extractSvgDimensions(
  svg: string,
): { width: number; height: number } | null {
  const wMatch = svg.match(/width="([^"]+)"/);
  const hMatch = svg.match(/height="([^"]+)"/);
  if (!wMatch || !hMatch) return null;
  const width = parseFloat(wMatch[1]);
  const height = parseFloat(hMatch[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

// ─── PNG rendering ───────────────────────────────────────────────────────────

/**
 * Render Mermaid code to a PNG buffer.
 *
 * Uses `beautiful-mermaid` to produce an SVG and `@resvg/resvg-js` to
 * rasterise it — no headless browser required.  Both packages are
 * optional peer dependencies; if either is missing an informative error
 * is thrown.
 *
 * @param code    — Mermaid diagram source.
 * @param options — Optional render settings.
 * @returns A `Buffer` containing the PNG image data.
 * @throws If `beautiful-mermaid` or `@resvg/resvg-js` is not installed.
 */
export async function renderMermaidPng(
  code: string,
  options?: { scale?: number; maxWidth?: number },
): Promise<Buffer> {
  // Dynamic imports — these are optional peer deps
  let renderMermaidSVG: typeof import('beautiful-mermaid')['renderMermaidSVG'];
  let Resvg: typeof import('@resvg/resvg-js')['Resvg'];

  try {
    ({ renderMermaidSVG } = await import('beautiful-mermaid'));
  } catch {
    throw new Error(
      'beautiful-mermaid is required for Mermaid rendering. Install it with: bun add beautiful-mermaid',
    );
  }

  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
  } catch {
    throw new Error(
      '@resvg/resvg-js is required for Mermaid rendering. Install it with: bun add @resvg/resvg-js',
    );
  }

  const scale = options?.scale ?? 2;

  // Apply RH theme to colours, then render SVG
  const themed = applyRHTheme(code);
  const rawSvg = renderMermaidSVG(themed, RH_MERMAID_THEME);

  // Resolve CSS variables that beautiful-mermaid may leave in the SVG
  const resolved = rawSvg.replace(/var\(--[\w-]+\)/g, (match) => {
    const varMap: Record<string, string> = {
      '--bg': RH_MERMAID_THEME.bg,
      '--fg': RH_MERMAID_THEME.fg,
      '--accent': RH_MERMAID_THEME.accent,
      '--line': RH_MERMAID_THEME.line,
      '--muted': RH_MERMAID_THEME.muted,
      '--surface': RH_MERMAID_THEME.surface,
      '--border': RH_MERMAID_THEME.border,
    };
    const key = match.slice(4, -1); // strip "var(" and ")"
    return varMap[key] ?? '#000000';
  });

  const resvg = new Resvg(resolved, { fitTo: { mode: 'zoom', value: scale } });
  return Buffer.from(resvg.render().asPng());
}
