/**
 * CLI utility helpers.
 *
 * Shared functions for command-line tools: timing display,
 * presenter/author entry parsing.
 *
 * @module
 */

/** Format milliseconds as a human-readable duration string.
 * Returns `"450ms"` for sub-second durations, `"2.3s"` for seconds,
 * and `"6.0m"` for minute-level durations. */
export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
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

/**
 * Open a Google Docs or Google Drive HTTPS URL in the default browser.
 *
 * Validates that the URL is HTTPS and hosted on docs.google.com or
 * drive.google.com before spawning. Refuses invalid or non-Google URLs.
 * Cross-platform: `open` on macOS, `xdg-open` on Linux, `start` on Windows.
 */
export function openGoogleUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    process.stderr.write(`[open] Refusing to open invalid URL\n`);
    return;
  }
  const host = parsed.hostname.toLowerCase();
  const okHost = host === 'docs.google.com' || host === 'drive.google.com';
  if (parsed.protocol !== 'https:' || !okHost) {
    process.stderr.write(`[open] Refusing to open non-Google URL: ${parsed.origin}\n`);
    return;
  }
  // `--` stops option parsing so a URL starting with `-` cannot inject flags.
  // On Windows, `start` is a cmd builtin; the empty title arg avoids the
  // "first quoted arg is window title" quirk when the target is a URL.
  if (process.platform === 'win32') {
    Bun.spawn(['cmd', '/c', 'start', '', url]);
  } else {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    Bun.spawn([cmd, '--', url]);
  }
}

/**
 * Map common Google API error messages to user-friendly suggestions.
 * Returns a helpful message if the error matches a known pattern, or null if unrecognized.
 */
export function formatGoogleApiError(errorMessage: string): string | null {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('the caller does not have permission') || msg.includes('permission denied')) {
    return 'Permission denied. Check that the document is shared with your account, or re-authenticate.';
  }
  if (msg.includes('quota exceeded') || msg.includes('rate limit')) {
    return 'Google API quota exceeded. Wait a minute and try again.';
  }
  if (msg.includes('404') || msg.includes('file not found') || msg.includes('not found')) {
    return 'Document not found. Check the document ID or URL.';
  }
  if (msg.includes('invalid_grant') || msg.includes('token has been expired')) {
    return 'Authentication expired. Re-run the auth flow.';
  }
  if (msg.includes('insufficient authentication scopes')) {
    return 'Missing API scopes. Re-run the auth flow to grant additional permissions.';
  }

  return null;
}
