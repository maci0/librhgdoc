/**
 * librhgdoc — shared utilities for Red Hat Google-document tool-chains.
 *
 * @packageDocumentation
 */

export { type RgbColor, RH_COLORS, hexToRgb, rgbToHex, isGrayHex, normHex } from './colors.ts';
export { djb2, contentHash, blockHash } from './hash.ts';
export { toSlug } from './slug.ts';
export { type TextRun, type InlineSeg, parseInline, stripInline } from './inline.ts';
export {
  parseFrontmatter,
  stringifyFrontmatter,
  extractFrontmatter,
  replaceFrontmatter,
} from './frontmatter.ts';
export {
  type OAuthCredentials,
  type OAuthToken,
  type AuthConfig,
  loadCredentials,
  loadToken,
  saveToken,
  refreshAccessToken,
  getValidToken,
  isTokenExpired,
  buildAuthUrl,
  extractClientInfo,
} from './auth.ts';
export {
  type BatchUpdateRequest,
  type BatchUpdateResponse,
  batchUpdate,
  pt,
  emu,
  rgbColor,
  opaqueColor,
  wff,
  optionalColor,
  EMU_PER_PX,
  SLIDE_W_PX,
  SLIDE_H_PX,
  toEmu,
  GOOGLE_ID_RE,
  extractGoogleId,
} from './google-api.ts';
export {
  RH_MERMAID_THEME,
  RH_COLOR_MAP,
  applyRHTheme,
  renderMermaidPng,
  extractSvgDimensions,
} from './mermaid.ts';
export {
  IMAGE_EXTENSIONS,
  detectMimeType,
  isLocalPath,
  isImagePath,
  type ImageRef,
  findImageRefs,
  readImageAsBase64,
  resolveImagePaths,
} from './images.ts';
export {
  type UploadedImage,
  uploadImageToDrive,
  uploadImageViaTempSlides,
  uploadImagesBatch,
  deleteGoogleDriveFile,
  deleteGoogleDriveFiles,
} from './image-upload.ts';
export {
  type ColoredRun,
  type HighlightResult,
  HIGHLIGHT_COLORS,
  DARK_HIGHLIGHT_COLORS,
  tokenize,
  getSupportedLanguages,
} from './highlight.ts';
export { fmtTime, type PresenterEntry, parsePresenterEntry } from './cli.ts';
export { sparseMap } from './collections.ts';
export { type ColumnWidthOptions, calcColumnWidths } from './tables.ts';
export {
  type AdmonitionType,
  ADMONITION_TYPES,
  ADMONITION_LABELS,
  ADMONITION_ACCENT,
  ADMONITION_BG,
} from './admonitions.ts';
export {
  type LintLevel,
  type LintMessage,
  lintBrandNames,
  lintBareUrls,
} from './lint.ts';
