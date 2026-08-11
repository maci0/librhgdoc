# Shared Functionality Candidates

Audit of functionality in `templar` and `herald` evaluated for extraction into `librhgdoc`.

## Moved to librhgdoc

### Round 1 (initial library)

| Module | Exports | Source |
|--------|---------|--------|
| `colors` | `RH_COLORS`, `RgbColor`, `hexToRgb`, `rgbToHex`, `isGrayHex` | templar `lib/constants.ts`, `lib/docs-api.ts` |
| `hash` | `djb2`, `contentHash`, `blockHash` | templar `lib/hash.ts` |
| `slug` | `toSlug` | templar `lib/inline.ts` |
| `inline` | `parseInline`, `stripInline`, `TextRun`, `InlineSeg` | templar `lib/inline.ts`, herald `src/parse.ts` |
| `frontmatter` | `parseFrontmatter`, `stringifyFrontmatter`, `extractFrontmatter`, `replaceFrontmatter` | templar `lib/md-blocks.ts`, herald `src/parse.ts` |
| `auth` | `getValidToken`, `refreshAccessToken`, `buildAuthUrl`, `isTokenExpired`, `loadCredentials`, `loadToken`, `saveToken`, `extractClientInfo` | templar `lib/auth.ts`, herald `src/auth.ts` |
| `google-api` | `batchUpdate`, `pt`, `emu`, `wff`, `optionalColor`, `rgbColor`, `opaqueColor`, `toEmu`, `EMU_PER_PX`, `SLIDE_W_PX`, `SLIDE_H_PX` | templar `lib/docs-api.ts`, herald `src/geometry.ts`, `src/api.ts` |
| `mermaid` | `RH_MERMAID_THEME`, `RH_COLOR_MAP`, `applyRHTheme`, `renderMermaidPng`, `extractSvgDimensions` | templar `lib/mermaid.ts`, herald `src/render.ts` |
| `images` | `detectMimeType`, `isLocalPath`, `isImagePath`, `IMAGE_EXTENSIONS`, `findImageRefs`, `readImageAsBase64`, `resolveImagePaths` | templar `lib/images.ts`, herald `index.ts` |
| `image-upload` | `uploadImageToDrive`, `uploadImageViaTempSlides`, `uploadImagesBatch`, `deleteGoogleDriveFile` | templar `lib/image-upload.ts`, herald `src/api.ts` |
| `highlight` | `tokenize`, `ColoredRun`, `HighlightResult`, `HIGHLIGHT_COLORS`, `DARK_HIGHLIGHT_COLORS`, `getSupportedLanguages` | templar `lib/code.ts`, herald `src/parse.ts` |

### Round 2 (this pass)

| Module | Exports | Source |
|--------|---------|--------|
| `colors` | `normHex` | templar `gas/enforce-template.ts` |
| `google-api` | `extractGoogleId`, `GOOGLE_ID_RE` | templar `templar.ts` |
| `cli` | `fmtTime`, `parsePresenterEntry`, `PresenterEntry` | templar `templar.ts`, herald `src/build.ts` |
| `collections` | `sparseMap` | templar `lib/image-upload.ts` |
| `tables` | `calcColumnWidths`, `ColumnWidthOptions` | templar `lib/docs-api.ts` |
| `admonitions` | `AdmonitionType`, `ADMONITION_TYPES`, `ADMONITION_LABELS`, `ADMONITION_ACCENT`, `ADMONITION_BG` | templar `lib/docs-api.ts` |
| `lint` | `LintMessage`, `LintLevel`, `lintBrandNames`, `lintBareUrls` | templar `lib/linter.ts` |
| `image-upload` | `deleteGoogleDriveFiles` (batch) | herald `index.ts` |
| `images` | Extended `detectMimeType` with office MIME types | templar `lib/file-upload.ts` |

## Kept local (not extracted)

| Candidate | Location | Reason |
|-----------|----------|--------|
| `getDocsToken` / `getAuthClient` | templar `lib/auth.ts`, herald `src/auth.ts` | Different credential formats and return types. Templar uses a single combined credentials file and returns `string \| null`; herald uses `google-auth-library` `OAuth2Client` throughout. |
| `docsBatchUpdate` | templar `lib/docs-api.ts` | Uses `googleapis` client library with typed `docs_v1` request/response types. librhgdoc's `batchUpdate` uses raw `fetch()` — not a drop-in replacement. |
| `rgb()` / `pt()` / `wff()` (in templar) | templar `lib/docs-api.ts` | Return `docs_v1.Schema$*` typed objects. Replacing with librhgdoc's plain-object versions risks type inference issues in callers. One-liners not worth the risk. |
| `renderMermaidPng` (templar's) | templar `lib/mermaid.ts` | Uses puppeteer + headless Chrome with auto LR→TD conversion and `%%{init}%%` stripping. librhgdoc uses `beautiful-mermaid` + `@resvg/resvg-js`. Different rendering engines. |
| `preprocessMermaid` | templar `lib/mermaid.ts` | Full pipeline with puppeteer lifecycle, caching via `cachedHashes`, and placeholder substitution. Application-specific orchestration. |
| `preprocessCode` / `CodeBlock` (shiki) | templar `lib/code.ts` | Uses Shiki (WASM-based) with position-offset highlights `{start, end, color}`. librhgdoc uses highlight.js with run-based `ColoredRun[]`. Different engines, different output formats. |
| `preprocessImages` | templar `lib/images.ts` | Application-specific pipeline with caching, sync I/O, and templar's `ImageBlock` return type. |
| `parseMdBlocks` / `MdBlock` | templar `lib/md-blocks.ts` | Templar-specific block types (cover, mermaidIdx, codeKey, imageKey). Would need significant abstraction to generalize. |
| `parseBody` / `ParsedBody` | herald `src/parse.ts` | Tightly coupled to Marp Core token format. |
| `parseDeck` / `SlideSpec` / `DeckMeta` | herald `src/parse.ts`, `src/types.ts` | Herald's Marp-specific deck parsing and slide specification types. |
| `parseInline` (herald's) | herald `src/parse.ts` | Uses Marp Core's markdown-it parser. Handles Marp-specific tokens (emoji, math, hardbreak). Cannot replace with librhgdoc's hand-rolled parser without losing Marp syntax. |
| `runAuthFlow` | herald `src/auth.ts` | Interactive OAuth2 flow with `Bun.serve` local HTTP server. Application-specific. |
| `isLocalPath` (herald's) | herald `index.ts` | More restrictive than librhgdoc's version (only `./`, `../`, `/`, `file://`). Business logic specific to herald's URL handling. |
| `cropToFillAspect` | herald `src/api.ts` | ImageMagick dependency, only herald uses it. |
| `renderLatex` | herald `src/render.ts` | KaTeX + Puppeteer dependency, only herald uses it. |
| `lintMarkdown` (full) | templar `lib/linter.ts` | 20+ check categories deeply integrated with line-number tracking and scanning state. Only brand-name checks were extracted. |
| `lintDeck` | herald `index.ts` | Herald-specific Marp layout/frontmatter validation. |
| `normHex` (in GAS) | templar `gas/enforce-template.ts` | Google Apps Script cannot import npm modules. Local copy must remain. |
| `ADMONITION_LABELS` (in templar) | templar `lib/docs-api.ts` | IMPORTANT emoji differs: templar uses 📌, librhgdoc uses ❗. Kept local to preserve rendered output. |
| `Geo` / `parseGeo` | herald `src/parse.ts` | Only herald uses positioned elements. Templar has no use case. |
| `buildZOrderRequests` | herald `index.ts` | Slides-only API helper. Templar targets Docs. |
| LCS diff (`diffBlocks`, `lcsBodyDiff`) | templar `lib/diff.ts` | Match predicates are templar-specific. Would need parameterization. Herald doesn't do incremental updates. |
| `FontSpec` / heading specs | templar `gas/types.d.ts`, `gas/templates.ts` | Representation differs between Docs (pt-based) and Slides (EMU-based). GAS types can't import from npm. |
| `CompactBlock` / `fetchDocBlocks` | templar `lib/docs-api.ts` | Tightly coupled to Google Docs API response shape. |
| Layout configs / `LayoutConfig` | herald `src/layouts.ts` | Herald-specific Google Slides template architecture. |
| `deleteDriveFiles` (herald's) | herald `index.ts` | Takes `OAuth2Client`, not raw token. Incompatible with librhgdoc's `deleteGoogleDriveFiles`. |
| `detectMime` (templar `lib/images.ts`) | templar `lib/images.ts` | Returns `null` for unknown extensions (vs librhgdoc's `application/octet-stream`). Different error semantics in callers. |
| `exportPdf` / `exportGoogleFile` | templar `lib/pdf.ts`, herald `index.ts` | Both do Drive `files.export` but with different auth types (`googleapis` client vs `OAuth2Client`). 5-line pattern not worth the auth abstraction. |
| `RH_FONTS` constants | templar (203 occurrences) | Herald uses different code font (`Roboto Mono` vs `Red Hat Mono`). Self-documenting strings used inline in API request builders. Marginal value. |
| `docUrl` / `googleSlidesUrl` | templar `templar.ts`, herald `index.ts` | One-liner URL interpolations. Extracting adds dependency overhead for zero logic. |
| Structured logger | Both projects (ad-hoc `process.stderr.write`) | No shared pattern exists — each call is bespoke. Would be a new abstraction, not an extraction. |
| File I/O wrappers | Both projects (raw `readFileSync`/`writeFileSync`) | Standard Node.js calls, no wrapper needed. |
| Error classification | templar `templar.ts` | CLI-specific error-to-message mapping. Application-specific. |
| OAuth scope constants | templar `scripts/templar-auth.ts`, herald `src/auth.ts` | Different scope sets for different APIs. Well-known Google URLs — repeating is clearer than importing. |
| A4 page dimensions | templar `lib/docs-api.ts` | Only templar uses these (Docs page setup). Herald targets Slides (fixed 10"×5.625"). |

## Round 3 scan result

No new viable candidates found. The projects have been thoroughly picked clean of shared patterns. Remaining overlap is blocked by the `string` token vs `OAuth2Client` auth interface split, is application-specific, or is too trivial to justify library functions.
