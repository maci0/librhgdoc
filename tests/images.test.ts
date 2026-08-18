import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  IMAGE_EXTENSIONS,
  detectMimeType,
  mimeToExtension,
  isLocalPath,
  isImagePath,
  findImageRefs,
  readImageAsBase64,
  resolveImagePaths,
} from '../src/images.ts';

// ─── IMAGE_EXTENSIONS ─────────────────────────────────────────────────────────

describe('IMAGE_EXTENSIONS', () => {
  test('is a non-empty Set', () => {
    expect(IMAGE_EXTENSIONS).toBeInstanceOf(Set);
    expect(IMAGE_EXTENSIONS.size).toBeGreaterThan(0);
  });

  test('contains common image extensions', () => {
    expect(IMAGE_EXTENSIONS.has('.png')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.jpg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.jpeg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.gif')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.svg')).toBe(true);
    expect(IMAGE_EXTENSIONS.has('.webp')).toBe(true);
  });
});

// ─── detectMimeType ─────────────────────────────────────────────────────────

describe('detectMimeType', () => {
  test.each([
    ['photo.png',    'image/png'],
    ['photo.jpg',    'image/jpeg'],
    ['photo.jpeg',   'image/jpeg'],
    ['anim.gif',     'image/gif'],
    ['icon.svg',     'image/svg+xml'],
    ['image.webp',   'image/webp'],
    ['bitmap.bmp',   'image/bmp'],
    ['scan.tiff',    'image/tiff'],
    ['scan.tif',     'image/tiff'],
    ['favicon.ico',  'image/x-icon'],
    ['file.xyz',     'application/octet-stream'],
    ['PHOTO.PNG',    'image/png'],
    ['image.JPG',    'image/jpeg'],
  ])('detectMimeType(%s) → %s', (file, mime) => {
    expect(detectMimeType(file)).toBe(mime);
  });

  test('returns custom fallback for unknown extension', () => {
    expect(detectMimeType('file.xyz', 'image/png')).toBe('image/png');
  });

  test('ignores fallback when extension is recognized', () => {
    expect(detectMimeType('photo.png', 'image/jpeg')).toBe('image/png');
  });
});

// ─── mimeToExtension ─────────────────────────────────────────────────────────

describe('mimeToExtension', () => {
  test.each([
    ['image/png',                                                                          '.png'],
    ['image/jpeg',                                                                         '.jpg'],
    ['image/gif',                                                                          '.gif'],
    ['image/svg+xml',                                                                      '.svg'],
    ['image/webp',                                                                         '.webp'],
    ['image/bmp',                                                                          '.bmp'],
    ['image/tiff',                                                                         '.tiff'],
    ['image/x-icon',                                                                       '.ico'],
    ['application/pdf',                                                                    '.pdf'],
    ['application/zip',                                                                    '.zip'],
    ['application/gzip',                                                                   '.gz'],
    ['application/x-tar',                                                                  '.tar'],
    ['application/msword',                                                                 '.doc'],
    ['application/vnd.ms-excel',                                                           '.xls'],
    ['application/vnd.ms-powerpoint',                                                      '.ppt'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',            '.docx'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',                  '.xlsx'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation',          '.pptx'],
    ['application/vnd.oasis.opendocument.text',                                            '.odt'],
    ['application/vnd.oasis.opendocument.spreadsheet',                                     '.ods'],
    ['application/vnd.oasis.opendocument.presentation',                                    '.odp'],
    ['application/json',                                                                   '.json'],
    ['application/xml',                                                                    '.xml'],
    ['text/plain',                                                                         '.txt'],
    ['text/html',                                                                          '.html'],
    ['text/markdown',                                                                      '.md'],
    ['text/csv',                                                                           '.csv'],
    ['text/yaml',                                                                          '.yaml'],
    ['unknown/type',                                                                       '.bin'],
    ['IMAGE/PNG',                                                                          '.png'],
  ])('mimeToExtension(%s) → %s', (mime, ext) => {
    expect(mimeToExtension(mime)).toBe(ext);
  });
});

// ─── isLocalPath ──────────────────────────────────────────────────────────────

describe('isLocalPath', () => {
  test('returns true for relative paths', () => {
    expect(isLocalPath('./image.png')).toBe(true);
    expect(isLocalPath('../img/photo.jpg')).toBe(true);
    expect(isLocalPath('images/test.gif')).toBe(true);
  });

  test('returns true for absolute paths', () => {
    expect(isLocalPath('/home/user/image.png')).toBe(true);
  });

  test.each([
    'http://example.com/image.png',
    'https://example.com/image.png',
    'data:image/png;base64,abc123',
    'ftp://files.example.com/image.png',
    'ssh://host/path/image.png',
    's3://bucket/key/image.png',
    'gs://bucket/object.png',
    'file:///tmp/image.png',
  ])('returns false for remote URI: %s', (uri) => {
    expect(isLocalPath(uri)).toBe(false);
  });
});

// ─── isImagePath ──────────────────────────────────────────────────────────────

describe('isImagePath', () => {
  test('returns true for image extensions', () => {
    expect(isImagePath('photo.png')).toBe(true);
    expect(isImagePath('photo.jpg')).toBe(true);
    expect(isImagePath('photo.jpeg')).toBe(true);
    expect(isImagePath('photo.gif')).toBe(true);
    expect(isImagePath('photo.svg')).toBe(true);
    expect(isImagePath('photo.webp')).toBe(true);
  });

  test('returns false for non-image extensions', () => {
    expect(isImagePath('doc.pdf')).toBe(false);
    expect(isImagePath('script.ts')).toBe(false);
    expect(isImagePath('readme.md')).toBe(false);
    expect(isImagePath('data.json')).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(isImagePath('PHOTO.PNG')).toBe(true);
    expect(isImagePath('image.JPG')).toBe(true);
  });
});

// ─── findImageRefs ────────────────────────────────────────────────────────────

describe('findImageRefs', () => {
  test('finds local image references', () => {
    const md = '![logo](./images/logo.png)\nSome text\n![photo](../photo.jpg)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(2);
    expect(refs[0].alt).toBe('logo');
    expect(refs[0].path).toBe('./images/logo.png');
    expect(refs[0].originalMarkdown).toBe('![logo](./images/logo.png)');
    expect(refs[1].alt).toBe('photo');
    expect(refs[1].path).toBe('../photo.jpg');
  });

  test('skips remote URLs', () => {
    const md = '![remote](https://example.com/img.png)\n![local](./img.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('./img.png');
  });

  test('skips http URLs', () => {
    const md = '![remote](http://example.com/img.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });

  test('skips data URIs', () => {
    const md = '![embedded](data:image/png;base64,abc123)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });

  test('skips images inside fenced code blocks', () => {
    const md = '```\n![code](./img.png)\n```\n![real](./real.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('./real.png');
  });

  test('finds multiple images on one line', () => {
    const md = '![a](a.png) ![b](b.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(2);
  });

  test('handles empty alt text', () => {
    const md = '![](image.png)';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(1);
    expect(refs[0].alt).toBe('');
  });

  test('returns empty array for no images', () => {
    const refs = findImageRefs('Just some text, no images here.');
    expect(refs).toHaveLength(0);
  });

  test('skips images inside tilde code fence', () => {
    const md = '~~~\n![img](path.png)\n~~~';
    const refs = findImageRefs(md);
    expect(refs).toHaveLength(0);
  });
});

// ─── readImageAsBase64 ────────────────────────────────────────────────────────

describe('readImageAsBase64', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'librhgdoc-img-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('reads a file and returns base64 + mimeType', async () => {
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const filePath = join(tmpDir, 'test.png');
    await Bun.write(filePath, content);

    const result = await readImageAsBase64(filePath);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(content.toString('base64'));
  });

  test('detects JPEG mime type', async () => {
    const filePath = join(tmpDir, 'test.jpg');
    await Bun.write(filePath, Buffer.from([0xff, 0xd8, 0xff]));

    const result = await readImageAsBase64(filePath);
    expect(result.mimeType).toBe('image/jpeg');
  });

  test('throws for non-existent file', async () => {
    await expect(readImageAsBase64(join(tmpDir, 'nonexistent.png'))).rejects.toThrow();
  });
});

// ─── resolveImagePaths ────────────────────────────────────────────────────────

describe('resolveImagePaths', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'librhgdoc-resolve-test-'));
    await Bun.write(join(tmpDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await Bun.write(join(tmpDir, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replaces local images with placeholders', async () => {
    const md = '![Logo](logo.png)\nSome text\n![Photo](photo.jpg)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('[[IMAGE_0]]');
    expect(result.markdown).toContain('[[IMAGE_1]]');
    expect(result.markdown).not.toContain('logo.png');
    expect(result.markdown).not.toContain('photo.jpg');
  });

  test('returns image data array', async () => {
    const md = '![Logo](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].index).toBe(0);
    expect(result.images[0].alt).toBe('Logo');
    expect(result.images[0].mimeType).toBe('image/png');
    expect(result.images[0].originalPath).toBe('logo.png');
    expect(result.images[0].base64.length).toBeGreaterThan(0);
  });

  test('leaves remote URLs unchanged', async () => {
    const md = '![remote](https://example.com/img.png)\n![local](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('https://example.com/img.png');
    expect(result.images).toHaveLength(1);
  });

  test('leaves non-existent files unchanged', async () => {
    const md = '![missing](nonexistent.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.markdown).toContain('nonexistent.png');
    expect(result.images).toHaveLength(0);
  });

  test('skips images inside code blocks', async () => {
    const md = '```\n![code](logo.png)\n```\n![real](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(1);
    expect(result.markdown).toContain('[[IMAGE_0]]');
  });

  test('handles empty markdown', async () => {
    const result = await resolveImagePaths('', tmpDir);
    expect(result.markdown).toBe('');
    expect(result.images).toHaveLength(0);
  });

  test('skips images inside tilde code fences', async () => {
    const md = '~~~\n![inside](logo.png)\n~~~\n![outside](logo.png)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(1);
    expect(result.markdown).toContain('[[IMAGE_0]]');
    expect(result.markdown).toContain('![inside](logo.png)');
  });

  test('normalizes CRLF line endings', async () => {
    const md = '![Logo](logo.png)\r\nSome text\r\n![Photo](photo.jpg)';
    const result = await resolveImagePaths(md, tmpDir);

    expect(result.images).toHaveLength(2);
    expect(result.markdown).toContain('[[IMAGE_0]]');
    expect(result.markdown).toContain('[[IMAGE_1]]');
    expect(result.markdown).not.toContain('\r');
  });
});

// ─── detectMimeType (office/document types) ──────────────────────────────────

describe('detectMimeType (office/document types)', () => {
  test.each([
    ['doc.pdf',      'application/pdf'],
    ['old.doc',      'application/msword'],
    ['report.docx',  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['data.xls',     'application/vnd.ms-excel'],
    ['data.xlsx',    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['old.ppt',      'application/vnd.ms-powerpoint'],
    ['slides.pptx',  'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['archive.zip',  'application/zip'],
    ['log.gz',       'application/gzip'],
    ['archive.tar',  'application/x-tar'],
    ['data.csv',     'text/csv'],
    ['config.json',  'application/json'],
    ['feed.xml',     'application/xml'],
    ['readme.txt',   'text/plain'],
    ['doc.md',       'text/markdown'],
    ['config.yaml',  'text/yaml'],
    ['config.yml',   'text/yaml'],
    ['page.html',    'text/html'],
    ['doc.odt',      'application/vnd.oasis.opendocument.text'],
    ['sheet.ods',    'application/vnd.oasis.opendocument.spreadsheet'],
    ['pres.odp',     'application/vnd.oasis.opendocument.presentation'],
    ['DOC.PDF',      'application/pdf'],
    ['DATA.JSON',    'application/json'],
  ])('detectMimeType(%s) → %s', (file, mime) => {
    expect(detectMimeType(file)).toBe(mime);
  });
});
