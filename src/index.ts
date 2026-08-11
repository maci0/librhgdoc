/**
 * librhgdoc — shared utilities for Red Hat Google-document tool-chains.
 *
 * @packageDocumentation
 */

export { type RgbColor, RH_COLORS, hexToRgb, rgbToHex, isGrayHex } from './colors.ts';
export { djb2, contentHash } from './hash.ts';
export { toSlug } from './slug.ts';
export { type TextRun, parseInline, stripInline } from './inline.ts';
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
  EMU_PER_PX,
  SLIDE_W_PX,
  SLIDE_H_PX,
  toEmu,
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
} from './image-upload.ts';
export {
  type ColoredRun,
  type HighlightResult,
  HIGHLIGHT_COLORS,
  tokenize,
  getSupportedLanguages,
} from './highlight.ts';
