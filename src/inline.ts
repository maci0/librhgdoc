/**
 * Inline Markdown parser — converts inline markup to structured text runs.
 *
 * Handles: `**bold**`, `*italic*`, `` `code` ``, `[text](url)`,
 * `~~strikethrough~~`, and nested combinations (e.g.
 * `[**bold link**](url)` or `**text with \`code\` inside**`).
 *
 * The parser is recursive: bold/italic handlers call {@link parseInline}
 * on their inner content, propagating the parent style. This correctly
 * handles `**bold containing \`code\`**` — the code segment receives
 * both `code: true` and `bold: true`.
 */

/** A single styled text run produced by {@link parseInline}. */
export interface TextRun {
  /** The plain text content of this run. */
  text: string;
  /** Whether this run is bold. */
  bold?: boolean;
  /** Whether this run is italic. */
  italic?: boolean;
  /** Whether this run is inline code. */
  code?: boolean;
  /** Whether this run is struck through. */
  strikethrough?: boolean;
  /** URL target — `https://…`, `mailto:…`, or `#slug` fragment link. */
  link?: string;
}

/**
 * Parse inline Markdown into an array of styled {@link TextRun}s.
 *
 * Recognises `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and
 * `~~strikethrough~~`. Styles nest: a bold region may contain italic
 * and code spans. Parent bold/italic state is propagated downward.
 *
 * @param text         - Raw inline Markdown string.
 * @param parentBold   - Whether an enclosing context is already bold.
 * @param parentItalic - Whether an enclosing context is already italic.
 */
export function parseInline(
  text: string,
  parentBold = false,
  parentItalic = false,
): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;

  while (i < text.length) {
    // ── Strikethrough ~~text~~ ──────────────────────────────────────
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        for (const run of parseInline(text.slice(i + 2, end), parentBold, parentItalic))
          runs.push({ ...run, strikethrough: true });
        i = end + 2;
        continue;
      }
    }

    // ── Bold **text** ───────────────────────────────────────────────
    if (text[i] === '*' && text[i + 1] === '*') {
      let end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        // Handle *** as italic-close + bold-close: when the inner text
        // has an unmatched italic * and the closing ** is immediately
        // followed by another *, shift end forward by one so the inner
        // text receives the closing *.
        if (text[end + 2] === '*') {
          const inner = text.slice(i + 2, end);
          let singles = 0;
          for (let k = 0; k < inner.length; k++) {
            if (inner[k] === '*' &&
                (k === 0 || inner[k - 1] !== '*') &&
                (k === inner.length - 1 || inner[k + 1] !== '*'))
              singles++;
          }
          if (singles % 2 === 1) end++;
        }
        for (const run of parseInline(text.slice(i + 2, end), true, parentItalic))
          runs.push({ ...run, bold: true });
        i = end + 2;
        continue;
      }
    }

    // ── Italic *text* ───────────────────────────────────────────────
    if (text[i] === '*' && text[i + 1] !== '*') {
      let end = -1;
      for (let k = i + 1; k < text.length; k++) {
        if (text[k] === '*' && text[k + 1] !== '*') { end = k; break; }
      }
      if (end > i + 1) {
        for (const run of parseInline(text.slice(i + 1, end), parentBold, true))
          runs.push({ ...run, italic: true });
        i = end + 1;
        continue;
      }
    }

    // ── Inline code `text` ──────────────────────────────────────────
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        runs.push({
          text: text.slice(i + 1, end),
          code: true,
          bold: parentBold || undefined,
          italic: parentItalic || undefined,
        });
        i = end + 1;
        continue;
      }
    }

    // ── Link [text](url) ────────────────────────────────────────────
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > i && text[close + 1] === '(') {
        const urlEnd = text.indexOf(')', close + 2);
        if (urlEnd > close + 2) {
          const url = text.slice(close + 2, urlEnd);
          const isFragment = url.startsWith('#');
          const safeUrl = /^(https?:\/\/|mailto:)/.test(url)
            ? url
            : isFragment
              ? url
              : undefined;
          for (const run of parseInline(text.slice(i + 1, close), parentBold, parentItalic))
            runs.push(safeUrl ? { ...run, link: safeUrl } : { ...run });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    // ── Plain text ──────────────────────────────────────────────────
    let j = i + 1;
    while (j < text.length && text[j] !== '*' && text[j] !== '`' && text[j] !== '[' && text[j] !== '~') j++;
    runs.push({
      text: text.slice(i, j),
      bold: parentBold || undefined,
      italic: parentItalic || undefined,
    });
    i = j;
  }

  return runs.filter(r => r.text);
}

/**
 * Strip inline Markdown formatting, returning plain text.
 *
 * Removes `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and
 * `~~strikethrough~~` markers.
 */
export function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .trim();
}
