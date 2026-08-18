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
  type AuthFlowOptions,
  loadCredentials,
  loadToken,
  saveToken,
  refreshAccessToken,
  getValidToken,
  getEnvToken,
  TOKEN_ENV_VARS,
  isTokenExpired,
  buildAuthUrl,
  extractClientInfo,
  DEFAULT_CREDENTIALS_PATH,
  DEFAULT_TOKEN_PATH,
  DEFAULT_SCOPES,
  defaultAuthConfig,
  exchangeCodeForToken,
  runAuthFlow,
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
  mimeToExtension,
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
export { fmtTime, type PresenterEntry, parsePresenterEntry, formatGoogleApiError, openGoogleUrl } from './cli.ts';
export { sparseMap } from './collections.ts';
export { type ColumnWidthOptions, calcColumnWidths } from './tables.ts';
export {
  type AdmonitionType,
  ADMONITION_TYPES,
  ADMONITION_LABELS,
  ADMONITION_ACCENT,
  ADMONITION_BG,
  isAdmonitionType,
} from './admonitions.ts';
export {
  findOrCreateFolder,
  moveFileToFolder,
} from './drive.ts';
export {
  type LintLevel,
  type LintMessage,
  forEachNonCodeLine,
  lintBrandNames,
  lintBareUrls,
  lintUnclosedCodeFence,
  lintCodeBlockLanguage,
  lintEmDash,
  lintPlaceholderText,
  lintEmptyImageAlt,
  lintLongCodeBlock,
  lintMermaidDiagram,
} from './lint.ts';
export { resolveUnderBase } from './safe-path.ts';
