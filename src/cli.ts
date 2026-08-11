/**
 * CLI utility helpers.
 *
 * Shared functions for command-line tools: timing display,
 * presenter/author entry parsing.
 *
 * @module
 */

/** Format milliseconds as a human-readable duration string.
 * Returns `"450ms"` for sub-second durations, `"2.3s"` for longer ones. */
export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0ms';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Parsed author/presenter entry. */
export interface PresenterEntry {
  name: string;
  email?: string;
  title?: string;
}

/** Parse a presenter/author string like `"Name, Title <email>"` into structured parts.
 * Accepts multiple formats: bare name, name with email, name with title, name with title and email.
 * Also accepts an object with `name`, `email?`, `title?` fields. */
export function parsePresenterEntry(entry: string | Record<string, string>): PresenterEntry {
  if (typeof entry === 'object' && entry !== null) {
    const name = entry.name ? String(entry.name).trim() : '';
    const email = entry.email ? String(entry.email).trim() : undefined;
    const title = entry.title ? String(entry.title).trim() : undefined;

    if (!name) {
      return { name: email || title || '' };
    }

    return { name, email, title };
  }

  const trimmed = String(entry || '').trim();

  // "Name <email>, Title"
  let match = trimmed.match(/^(.*?)\s*<([^>]+)>,\s*(.*)$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim(), title: match[3].trim() };
  }

  // "Name, Title <email>"
  match = trimmed.match(/^(.*?),\s*(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), title: match[2].trim(), email: match[3].trim() };
  }

  // "Name <email>"
  match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }

  // "Name, Title"
  match = trimmed.match(/^(.*?),\s*(.*)$/);
  if (match) {
    return { name: match[1].trim(), title: match[2].trim() };
  }

  return { name: trimmed };
}
