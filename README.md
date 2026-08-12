# librhgdoc

Shared TypeScript (Bun) utilities for Red Hat Google-document toolchains
([templar](https://github.com/mwysocki/templar) + [herald](https://github.com/mwysocki/herald)).

## Install

```bash
# from npm
bun add librhgdoc

# or link a local checkout
bun add ../librhgdoc
```

## Modules

| # | Module | Key Exports | Description |
|---|--------|-------------|-------------|
| 1 | `colors` | `RH_COLORS`, `hexToRgb`, `rgbToHex`, `normHex`, `isGrayHex` | Red Hat brand colour palette and hex/RGB conversions |
| 2 | `hash` | `djb2`, `contentHash`, `blockHash` | Fast string hashing and stable content-identity hashing |
| 3 | `slug` | `toSlug` | Convert heading text to GitHub-style anchor slugs |
| 4 | `inline` | `parseInline`, `stripInline`, `TextRun`, `InlineSeg` | Parse inline Markdown (bold, italic, code, links, strikethrough) into styled text runs |
| 5 | `frontmatter` | `parseFrontmatter`, `stringifyFrontmatter`, `extractFrontmatter`, `replaceFrontmatter` | Parse, serialise, extract, and replace YAML frontmatter in Markdown |
| 6 | `auth` | `getValidToken`, `runAuthFlow`, `defaultAuthConfig`, `buildAuthUrl`, `exchangeCodeForToken`, `DEFAULT_CREDENTIALS_PATH`, `DEFAULT_TOKEN_PATH`, `DEFAULT_SCOPES` | Google OAuth2 credential loading, token management, and interactive auth flow |
| 7 | `google-api` | `batchUpdate`, `pt`, `emu`, `wff`, `optionalColor`, `rgbColor`, `opaqueColor`, `toEmu`, `extractGoogleId`, `EMU_PER_PX`, `SLIDE_W_PX`, `SLIDE_H_PX` | Google Slides/Docs batch-update helpers and unit conversions |
| 8 | `mermaid` | `RH_MERMAID_THEME`, `RH_COLOR_MAP`, `applyRHTheme`, `renderMermaidPng`, `extractSvgDimensions` | Render Mermaid diagrams to PNG with Red Hat brand theming |
| 9 | `images` | `detectMimeType`, `mimeToExtension`, `isLocalPath`, `isImagePath`, `IMAGE_EXTENSIONS`, `findImageRefs`, `readImageAsBase64`, `resolveImagePaths` | Local image discovery, reading, MIME detection, and path resolution |
| 10 | `image-upload` | `uploadImageToDrive`, `uploadImageViaTempSlides`, `uploadImagesBatch`, `deleteGoogleDriveFile`, `deleteGoogleDriveFiles` | Upload images to Google Drive or via temporary Slides presentations |
| 11 | `highlight` | `tokenize`, `ColoredRun`, `HighlightResult`, `HIGHLIGHT_COLORS`, `DARK_HIGHLIGHT_COLORS`, `getSupportedLanguages` | Syntax highlighting via highlight.js with coloured text runs |
| 12 | `cli` | `fmtTime`, `parsePresenterEntry`, `formatGoogleApiError` | CLI helper utilities — time formatting, presenter parsing, API error display |
| 13 | `collections` | `sparseMap` | Sparse-array mapping utility |
| 14 | `tables` | `calcColumnWidths` | Calculate proportional column widths for Google Docs tables |
| 15 | `admonitions` | `ADMONITION_TYPES`, `ADMONITION_LABELS`, `ADMONITION_ACCENT`, `ADMONITION_BG` | Admonition type definitions, labels, accent and background colours |
| 16 | `lint` | `lintBrandNames`, `lintBareUrls`, `LintMessage`, `LintLevel` | Brand-name and bare-URL linting for Markdown content |

## Usage

```ts
import {
  hexToRgb,
  RH_COLORS,
  parseInline,
  contentHash,
  toSlug,
  lintBrandNames,
} from "librhgdoc";

// Convert a hex colour to the Google API's 0–1 RGB format
const rgb = hexToRgb("#cc0000");
// → { red: 0.8, green: 0, blue: 0 }

// Parse inline Markdown into styled text runs
const runs = parseInline("Hello **world** and `code`");
// → [{ text: "Hello " }, { text: "world", bold: true }, ...]

// Produce a stable content hash for a block
const hash = contentHash("code", "console.log('hi')");

// Generate a GitHub-style anchor slug
const slug = toSlug("My Heading!"); // → "my-heading"

// Lint brand names
const issues = lintBrandNames("Install Openshift on RHEL.");
// → [{ line: 1, col: 9, level: "warning", message: "…OpenShift…" }]
```

## Shared Auth

Both templar and herald share Google OAuth2 credentials stored in
`~/.config/rhgdoc/`:

| File | Purpose |
|------|---------|
| `credentials.json` | OAuth2 client ID / secret (downloaded from Google Cloud Console) |
| `token.json` | Cached access + refresh token (auto-refreshed) |

The `auth` module's `defaultAuthConfig()` points to these paths.
`runAuthFlow()` launches a local HTTP server for the OAuth2 consent redirect,
then saves the token for both tools to reuse.

## Development

```bash
# Install dependencies
bun install

# Run tests (426 tests across 16 modules)
bun test

# Type-check without emitting
bun run typecheck
```

## Stats

- **16** modules (see table above)
- **426** tests across 16 test files
- Runtime: [Bun](https://bun.sh/)

## License

[MIT](LICENSE)
