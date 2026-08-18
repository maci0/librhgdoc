/**
 * Syntax highlighting to colored text runs.
 *
 * Tokenizes source code via highlight.js and produces an array of
 * `ColoredRun` objects — text segments with associated hex colours —
 * suitable for rendering into Google Docs/Slides styled text.
 *
 * highlight.js is an optional peer dependency; import errors are
 * caught gracefully and `tokenize` falls back to a single unstyled run.
 *
 * @module
 */

/** A text segment with a hex colour. */
export interface ColoredRun {
  /** The text content of this segment. */
  text: string;
  /** Hex colour string, e.g. `"#d73a49"`. */
  color: string;
}

/** The result of highlighting a code block. */
export interface HighlightResult {
  /** Ordered array of coloured text runs. */
  runs: ColoredRun[];
  /** The language used (specified or auto-detected). */
  language: string;
}

/**
 * Mapping from highlight.js CSS class names to hex colours.
 *
 * Uses a neutral light-theme palette similar to GitHub's.
 */
export const HIGHLIGHT_COLORS: Record<string, string> = {
  'hljs-keyword':           '#d73a49',
  'hljs-selector-tag':      '#d73a49',
  'hljs-string':            '#032f62',
  'hljs-attr':              '#005cc5',
  'hljs-attribute':         '#032f62',
  'hljs-comment':           '#6a737d',
  'hljs-meta':              '#6a737d',
  'hljs-number':            '#005cc5',
  'hljs-literal':           '#005cc5',
  'hljs-title':             '#6f42c1',
  'hljs-name':              '#22863a',
  'hljs-built_in':          '#005cc5',
  'hljs-variable':          '#e36209',
  'hljs-template-variable': '#e36209',
  'hljs-type':              '#d73a49',
  'hljs-class':             '#6f42c1',
  'hljs-function':          '#6f42c1',
  'hljs-params':            '#24292e',
  'hljs-symbol':            '#005cc5',
  'hljs-regexp':            '#032f62',
  'hljs-addition':          '#22863a',
  'hljs-deletion':          '#d73a49',
  'hljs-selector-class':    '#6f42c1',
  'hljs-selector-id':       '#005cc5',
  'hljs-tag':               '#22863a',
  'hljs-template-tag':      '#d73a49',
  'hljs-bullet':            '#005cc5',
  'hljs-link':              '#032f62',
  'hljs-subst':             '#24292e',
  'hljs-section':           '#005cc5',
  'hljs-emphasis':          '#24292e',
  'hljs-strong':            '#24292e',
  'hljs-formula':           '#005cc5',
  'hljs-quote':             '#6a737d',
  'hljs-doctag':            '#d73a49',
};

/**
 * Dark-theme colour palette matching herald's TOKEN_COLOR map.
 *
 * Designed for use on dark slide backgrounds.
 */
export const DARK_HIGHLIGHT_COLORS: Record<string, string> = {
  'hljs-keyword':           '#ee0000',
  'hljs-selector-tag':      '#ee0000',
  'hljs-string':            '#daf1f1',
  'hljs-attr':              '#daf1f1',
  'hljs-attribute':         '#daf1f1',
  'hljs-comment':           '#6a6e73',
  'hljs-meta':              '#6a6e73',
  'hljs-number':            '#147878',
  'hljs-literal':           '#147878',
  'hljs-title':             '#f6f6f6',
  'hljs-name':              '#f6f6f6',
  'hljs-built_in':          '#f6f6f6',
  'hljs-variable':          '#fce3e3',
  'hljs-template-variable': '#fce3e3',
  'hljs-type':              '#daf1f1',
  'hljs-class':             '#daf1f1',
  'hljs-symbol':            '#d4a8ff',
  'hljs-deletion':          '#ff9d9d',
  'hljs-addition':          '#a8ffc4',
  'hljs-link':              '#a8d4ff',
  'hljs-selector-id':       '#a8d4ff',
  'hljs-selector-class':    '#ffd4a8',
  'hljs-tag':               '#ff9d9d',
  'hljs-template-tag':      '#d4a8ff',
  'hljs-regexp':            '#a8ffc4',
  'hljs-doctag':            '#a8d4ff',
  'hljs-section':           '#ffffff',
  'hljs-bullet':            '#daf1f1',
  'hljs-function':          '#f6f6f6',
  'hljs-params':            '#daf1f1',
  'hljs-subst':             '#fce3e3',
  'hljs-emphasis':          '#daf1f1',
  'hljs-strong':            '#f6f6f6',
  'hljs-formula':           '#d4a8ff',
  'hljs-quote':             '#6a6e73',
};

/** Default text colour when no token-specific colour applies. */
const DEFAULT_COLOR = '#24292e';

// Lazy-loaded hljs instance
let _hljs: typeof import('highlight.js').default | null | undefined;

function getHljs(): typeof import('highlight.js').default | null {
  if (_hljs !== undefined) return _hljs;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _hljs = require('highlight.js') as typeof import('highlight.js').default;
  } catch {
    _hljs = null;
  }
  return _hljs;
}

/**
 * Decode HTML entities produced by highlight.js.
 */
const toCodePoint = (cp: number, fallback: string) =>
  Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : fallback;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#96;/g, '`')
    .replace(/&#x60;/g, '`')
    .replace(/&#x([0-9a-fA-F]+);/g, (raw, h) => toCodePoint(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, n) => toCodePoint(Number(n), raw));
}

/**
 * Highlight source code and return an array of coloured text runs.
 *
 * If `language` is specified and recognized by highlight.js, it is used
 * directly. Otherwise the language is auto-detected. When highlight.js
 * is not installed, the code is returned as a single run with the default
 * colour.
 *
 * @param code     - The source code to highlight.
 * @param language - Optional language hint (e.g. `"typescript"`, `"python"`).
 * @returns The highlight result with coloured runs and detected language.
 */
export function tokenize(code: string, language?: string, colorMap?: Record<string, string>): HighlightResult {
  const hljs = getHljs();
  const colors = colorMap ?? HIGHLIGHT_COLORS;

  if (!hljs) {
    return {
      runs: [{ text: code, color: DEFAULT_COLOR }],
      language: language ?? 'text',
    };
  }

  let result;
  try {
    const lang =
      language && hljs.getLanguage(language) ? language : undefined;
    result = lang
      ? hljs.highlight(code, { language: lang })
      : hljs.highlightAuto(code);
  } catch {
    return {
      runs: [{ text: code, color: DEFAULT_COLOR }],
      language: language ?? 'text',
    };
  }

  const detectedLang = result.language ?? language ?? 'text';
  const runs: ColoredRun[] = [];
  const colorStack: string[] = [DEFAULT_COLOR];
  const html = result.value;
  let i = 0;
  let buf = '';

  const flushBuf = () => {
    if (buf) {
      runs.push({ text: decodeEntities(buf), color: colorStack[colorStack.length - 1] });
      buf = '';
    }
  };

  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) { buf += html[i++]; continue; }
      const tag = html.slice(i + 1, end);
      flushBuf();
      if (tag.startsWith('/')) {
        if (colorStack.length > 1) colorStack.pop();
      } else if (tag.startsWith('span')) {
        const cm = tag.match(/class="([^"]+)"/);
        const cls = cm ? cm[1].split(' ')[0] : '';
        colorStack.push(colors[cls] ?? DEFAULT_COLOR);
      }
      i = end + 1;
    } else {
      buf += html[i++];
    }
  }
  flushBuf();

  return { runs, language: detectedLang };
}

/**
 * Get the list of languages supported by highlight.js.
 *
 * Returns an empty array if highlight.js is not installed.
 */
export function getSupportedLanguages(): string[] {
  const hljs = getHljs();
  if (!hljs) return [];
  return hljs.listLanguages();
}
