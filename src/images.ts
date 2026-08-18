/**
 * Local image detection, resolution, and base64 encoding.
 *
 * Scans Markdown for `![alt](path)` references to local images, reads them
 * from disk, base64-encodes the content, and optionally replaces them with
 * `[[IMAGE_N]]` placeholders for downstream processing.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { forEachNonCodeLine } from './lint.ts';

/** Map of file extensions to MIME types for recognized image formats. */
const IMAGE_MIME_MAP: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
  '.ico':  'image/x-icon',
};

/** Map of file extensions to MIME types for document, office, archive, and data formats. */
const DOC_MIME_MAP: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip':  'application/zip',
  '.gz':   'application/gzip',
  '.tar':  'application/x-tar',
  '.csv':  'text/csv',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.md':   'text/markdown',
  '.yaml': 'text/yaml',
  '.yml':  'text/yaml',
  '.html': 'text/html',
  '.odt':  'application/vnd.oasis.opendocument.text',
  '.ods':  'application/vnd.oasis.opendocument.spreadsheet',
  '.odp':  'application/vnd.oasis.opendocument.presentation',
};

/** Combined MIME map for all recognized file types (images + documents). */
const MIME_MAP: Record<string, string> = { ...IMAGE_MIME_MAP, ...DOC_MIME_MAP };

/** Set of recognized image file extensions (e.g. `.png`, `.jpg`). */
export const IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_MIME_MAP));

/** Auto-generated reverse map: MIME type → preferred extension.
 * When multiple extensions share a MIME type, the first one wins. */
const REVERSE_MIME_MAP: Record<string, string> = (() => {
  const rev: Record<string, string> = {};
  for (const [ext, mime] of Object.entries(MIME_MAP)) {
    if (!rev[mime]) rev[mime] = ext;
  }
  return rev;
})();

/** Map a MIME type string to a file extension (with leading dot).
 * Returns `'.bin'` for unrecognized MIME types.
 * @example mimeToExtension('image/jpeg') // → '.jpg' */
export function mimeToExtension(mime: string): string {
  return REVERSE_MIME_MAP[mime.toLowerCase()] ?? '.bin';
}

/**
 * Detect the MIME type of a file from its extension.
 *
 * @param filePath  - Path to the file.
 * @param fallback  - Value returned when the extension is not recognized.
 *                    Defaults to `'application/octet-stream'`.
 * @returns The detected MIME type, or {@link fallback} for unknown extensions.
 */
export function detectMimeType(filePath: string, fallback = 'application/octet-stream'): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? fallback;
}

/**
 * Check whether a URL or path refers to a local file.
 *
 * Returns `false` for any URI with a `://` scheme (e.g. `http://`, `https://`,
 * `ftp://`, `s3://`, `file://`) and for `data:` URIs.
 * Returns `true` for relative paths and absolute paths.
 *
 * @param url - The URL or file path to check.
 */
export function isLocalPath(url: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return false;
  if (url.startsWith('data:')) return false;
  return true;
}

/**
 * Check whether a file path has a recognized image extension.
 *
 * @param filePath - The file path to check.
 */
export function isImagePath(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/** A reference to a local image found in Markdown. */
export interface ImageRef {
  /** The alt text from `![alt](path)`. */
  alt: string;
  /** The local file path from the Markdown reference. */
  path: string;
  /** The full original Markdown syntax, e.g. `![alt](path)`. */
  originalMarkdown: string;
}

/**
 * Find all `![alt](path)` references in Markdown where the path is a local file.
 *
 * Skips references inside fenced code blocks, and skips any URI with a
 * `://` scheme or a `data:` prefix.
 *
 * @param markdown - The Markdown source to scan.
 * @returns An array of image references found.
 */
export function findImageRefs(markdown: string): ImageRef[] {
  const refs: ImageRef[] = [];

  forEachNonCodeLine(markdown, (line) => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const [originalMarkdown, alt, path] = m;
      if (!isLocalPath(path)) continue;
      refs.push({ alt, path, originalMarkdown });
    }
  });

  return refs;
}

/**
 * Read a local image file and return its base64-encoded content with MIME type.
 *
 * @param filePath - Absolute or relative path to the image file.
 * @returns An object with `base64` (the encoded content) and `mimeType`.
 * @throws If the file cannot be read.
 */
export async function readImageAsBase64(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const buf = await readFile(filePath);
  const base64 = buf.toString('base64');
  const mimeType = detectMimeType(filePath);
  return { base64, mimeType };
}

/**
 * Find all local image references in Markdown, read the files, replace them
 * with `[[IMAGE_N]]` placeholders, and return the modified Markdown along with
 * the image data.
 *
 * Images are resolved relative to `basePath`. Remote URLs and `data:` URIs
 * are left unchanged. References inside fenced code blocks are skipped.
 *
 * @param markdown  - The Markdown source.
 * @param basePath  - Directory to resolve relative image paths against.
 * @returns Modified Markdown with placeholders and an array of image data.
 */
export async function resolveImagePaths(
  markdown: string,
  basePath: string,
): Promise<{
  markdown: string;
  images: Array<{
    index: number;
    alt: string;
    base64: string;
    mimeType: string;
    originalPath: string;
  }>;
}> {
  const images: Array<{
    index: number;
    alt: string;
    base64: string;
    mimeType: string;
    originalPath: string;
  }> = [];

  let idx = 0;
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const outLines: string[] = [];
  let openMarker: string | null = null;

  for (const line of lines) {
    const fm = line.match(/^\s*(```+|~~~+)/);
    if (fm) {
      const marker = fm[1];
      if (openMarker === null) {
        openMarker = marker;
      } else if (marker.charAt(0) === openMarker.charAt(0) && marker.length >= openMarker.length) {
        openMarker = null;
      }
      outLines.push(line);
      continue;
    }
    if (openMarker !== null) { outLines.push(line); continue; }

    let result = line;
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const replacements: Array<{ match: string; replacement: string }> = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(line)) !== null) {
      const [match, alt, src] = m;
      if (!isLocalPath(src)) continue;

      const absPath = resolve(basePath, src);
      try {
        const { base64, mimeType } = await readImageAsBase64(absPath);
        const imageIdx = idx++;
        images.push({ index: imageIdx, alt, base64, mimeType, originalPath: src });
        replacements.push({ match, replacement: `[[IMAGE_${imageIdx}]]` });
      } catch {
        // File not found or unreadable — leave the reference unchanged
      }
    }

    for (const { match, replacement } of replacements) {
      result = result.replace(match, replacement);
    }
    outLines.push(result);
  }

  return { markdown: outLines.join('\n'), images };
}
