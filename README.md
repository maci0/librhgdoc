# librhgdoc

Shared TypeScript (Bun) utilities for Red Hat Google-document tool-chains.

## Install

```bash
bun add librhgdoc
```

## Modules

| Module | Key Exports | Description |
|---|---|---|
| `auth` | `getValidToken`, `loadCredentials`, `refreshAccessToken`, `buildAuthUrl` | Google OAuth2 credential loading, token refresh, and consent URL generation |
| `colors` | `RH_COLORS`, `hexToRgb`, `rgbToHex`, `isGrayHex` | Red Hat brand colour palette and hex/RGB conversions |
| `frontmatter` | `parseFrontmatter`, `stringifyFrontmatter`, `extractFrontmatter`, `replaceFrontmatter` | Parse, serialise, extract, and replace YAML frontmatter in Markdown |
| `google-api` | `batchUpdate`, `pt`, `emu`, `toEmu`, `rgbColor` | Google Slides/Docs batch-update helpers and unit conversions |
| `hash` | `djb2`, `contentHash` | Fast string hashing and stable content-identity hashing |
| `highlight` | `tokenize`, `HIGHLIGHT_COLORS`, `getSupportedLanguages` | Syntax highlighting via highlight.js with coloured text runs |
| `image-upload` | `uploadImageToDrive`, `uploadImagesBatch`, `uploadImageViaTempSlides` | Upload images to Google Drive or via temporary Slides presentations |
| `images` | `findImageRefs`, `readImageAsBase64`, `resolveImagePaths`, `detectMimeType` | Local image discovery, reading, MIME detection, and Markdown placeholder substitution |
| `inline` | `parseInline`, `stripInline`, `TextRun` | Parse inline Markdown (bold, italic, code, links, strikethrough) into styled text runs |
| `mermaid` | `renderMermaidPng`, `applyRHTheme`, `RH_MERMAID_THEME` | Render Mermaid diagrams to PNG with Red Hat brand theming |
| `slug` | `toSlug` | Convert heading text to GitHub-style anchor slugs |

## Usage

```ts
import {
  hexToRgb,
  RH_COLORS,
  parseInline,
  contentHash,
} from "librhgdoc";

// Convert a hex colour to the Google API's 0-1 RGB format
const rgb = hexToRgb("#cc0000");
// { red: 0.8, green: 0, blue: 0 }

// Parse inline Markdown into styled text runs
const runs = parseInline("Hello **world** and `code`");
// [{ text: "Hello " }, { text: "world", bold: true }, ...]

// Produce a stable content hash for a block
const hash = contentHash("code", "console.log('hi')");
```

## Development

```bash
# Install dependencies
bun install

# Run tests (222 tests across 11 modules)
bun test

# Type-check without emitting
bun run typecheck
```

## License

[MIT](LICENSE)
