/**
 * Resolve a user-supplied path against a base directory and refuse escapes.
 *
 * Lexical resolve() alone is not enough: a symlink under basePath can point
 * outside the tree. Callers that read user-supplied file paths must use this.
 *
 * @module
 */

import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Resolve `src` under `basePath`, following symlinks, and return the real path
 * only when it remains inside `basePath`. Returns null when the path is
 * missing, unreadable, or escapes the base directory (including via symlink).
 */
export function resolveUnderBase(basePath: string, src: string): string | null {
  if (!src || src.includes('\0')) return null;

  let baseReal: string;
  try {
    baseReal = realpathSync(resolve(basePath));
  } catch {
    return null;
  }

  const candidate = resolve(baseReal, src);
  if (!existsSync(candidate)) return null;

  let real: string;
  try {
    real = realpathSync(candidate);
  } catch {
    return null;
  }

  const rel = relative(baseReal, real);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return real;
}
