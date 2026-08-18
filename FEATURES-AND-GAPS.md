# Features and Gaps — Red Hat Google Document Toolchain

> Inventory of features and known gaps across librhgdoc, templar, and herald.
> Last updated: August 2026.

---

## librhgdoc (shared library)

v0.3.0 · 17 modules · ~3,250 lines · Bun runtime · MIT license
3 optional peer dependencies: `highlight.js`, `beautiful-mermaid`, `@resvg/resvg-js`

### Module: colors

**Features:**
- `RH_COLORS` — 8 named brand colours: `red`, `black`, `white`, `gray`, `lightGray`, `darkBg`, `greyBg`, `link`
- `hexToRgb(hex)` — converts hex to Google API `{ red, green, blue }` (0–1 floats); accepts `#RRGGBB`, `RRGGBB`, `#RGB`, `RGB`
- `rgbToHex(rgb)` — inverse conversion to `#rrggbb`
- `normHex(hex)` — normalizes to lowercase `#`-prefixed hex; handles 3/6 digit forms
- `isGrayHex(hex)` — HSV saturation < 0.15 + luminance heuristic
- `RgbColor` interface

**Gaps / Limitations:**
- `hexToRgb` returns black `{0,0,0}` for invalid input — callers cannot distinguish "invalid" from "genuinely black" (no error/null path)
- ✅ ~~`isGrayHex` only accepts 6-digit hex~~ — now accepts both 3-digit and 6-digit hex forms
- ✅ ~~`normHex` accepts 8-digit (RRGGBBAA) hex but no other function consumes alpha~~ — `normHex` now rejects 8-digit hex (regex only allows 3/6 digits; returns empty string for invalid input)

### Module: hash

**Features:**
- `djb2(s)` — 32-bit DJB2 hash returned as base-36 string
- `contentHash(type, text, extra?)` — normalized hash (whitespace collapsed for non-code blocks)
- `blockHash` — alias for `contentHash`

**Gaps / Limitations:**
- 32-bit DJB2 is collision-prone at scale; documented as adequate for "block-count workloads (a few hundred items)" only
- No streaming or incremental API — entire content must be in memory

### Module: slug

**Features:**
- `toSlug(text)` — generates GitHub-style anchor strings from heading text

**Gaps / Limitations:**
- Strips all non-`\w`, non-space, non-hyphen characters — this removes unicode letters (e.g. accented characters) that GitHub preserves
- No collision avoidance — GitHub appends `-1`, `-2` for duplicate headings; `toSlug` does not

### Module: inline

**Features:**
- `parseInline(text, parentBold?, parentItalic?)` — recursive parser for `**bold**`, `__bold__`, `*italic*`, `_italic_`, `` `code` ``, `[link](url)`, `~~strikethrough~~`, `![alt](url)` (alt-text passthrough), and backslash escapes; supports nested combinations
- `stripInline(s)` — regex-based plain-text extractor
- `TextRun` / `InlineSeg` interfaces

**Gaps / Limitations:**
- Underscore variants (`__bold__`, `_italic_`) only trigger at word boundaries — intentional for `snake_case`, but differs from CommonMark
- `![image](url)` becomes plain alt text, not a structured image run
- `stripInline` uses a separate greedy-regex implementation, not derived from `parseInline`; can mishandle nested/adjacent markers
- Link URLs limited to `http(s)://`, `mailto:`, and `#fragment` — other schemes (e.g. `ftp://`) are silently dropped

### Module: frontmatter

**Features:**
- `parseFrontmatter(text)` — parses YAML scalars, inline arrays, and block sequences (including object sequences)
- `stringifyFrontmatter(data)` — serializes to YAML body (no `---` delimiters)
- `extractFrontmatter(markdown)` — splits markdown into `{ frontmatter, body }`
- `replaceFrontmatter(markdown, data)` — replaces frontmatter in-place

**Gaps / Limitations:**
- Not a full YAML parser — no nested objects beyond one level, no multiline scalars (`|`, `>`), no flow mappings (`{ key: val }`)
- `extractFrontmatter` requires frontmatter at the very start of the string (anchored `^---`)
- `replaceFrontmatter` always prepends — no option to place frontmatter elsewhere

### Module: auth

**Features:**
- `getValidToken(config)` — returns a valid access token, refreshing if expired
- `refreshAccessToken(credentials, token)` — OAuth2 token refresh
- `buildAuthUrl(credentials, scopes, redirectUri?, state?)` — generates authorization URL
- `exchangeCodeForToken(credentials, code, redirectUri)` — authorization code exchange
- `runAuthFlow(config, options?)` — interactive browser-based OAuth2 flow via `Bun.serve`
- `isTokenExpired(token, bufferMs?)` — expiry check with configurable buffer
- `loadCredentials(path)`, `loadToken(path)`, `saveToken(path, token)` — file I/O
- `extractClientInfo(credentials)` — extracts client_id/secret from credentials file
- `defaultAuthConfig(overrides?)` — sensible defaults
- `DEFAULT_SCOPES` — 10-scope union covering both templar and herald

**Gaps / Limitations:**
- `runAuthFlow` uses `Bun.serve` and `Bun.spawn(['open', …])` — Bun-only, macOS-only (no cross-platform browser open)
- 120-second hard-coded timeout for interactive auth
- No PKCE support — uses basic authorization code flow
- `DEFAULT_SCOPES` is a union of all scopes for both projects — no per-project scope narrowing
- `loadToken` swallows all read errors as `null` — corrupt JSON is indistinguishable from missing file
- Token saved with `mode: 0o600` but parent directory permissions are not restricted
- No support for service account credentials — only OAuth2 installed/web client credentials

### Module: google-api

**Features:**
- `batchUpdate({ url, token, requests, chunkSize? })` — chunked batchUpdate with Bearer auth
- Dimension helpers: `pt(n)`, `emu(n)`, `toEmu(value, base, defaultValue)`
- Colour helpers: `rgbColor(r, g, b)`, `opaqueColor(r, g, b)`, `optionalColor(color)`, `wff(fontFamily, weight?)`
- Constants: `EMU_PER_PX` (9525), `SLIDE_W_PX` (1280), `SLIDE_H_PX` (720)
- `extractGoogleId(input)` — extracts document/presentation ID from URL or raw ID
- `GOOGLE_ID_RE` — validation regex

**Gaps / Limitations:**
- `batchUpdate` returns plain objects — no typed `docs_v1.Schema$*` integration; templar keeps a local `docsBatchUpdate` wrapping the `googleapis` typed client
- `pt()` and `emu()` return `{ magnitude, unit: string }` not typed enums — weaker type inference than `googleapis` equivalents
- `GOOGLE_ID_RE` requires 25+ chars — would reject shorter IDs if Google ever issues them
- No retry or exponential backoff on transient failures
- No streaming or progress callback for large batch updates

### Module: mermaid

**Features:**
- `applyRHTheme(mermaidSource)` — 14-rule regex colour remap to Red Hat palette
- `renderMermaidPng(code, options?)` — renders via `beautiful-mermaid` + `@resvg/resvg-js` at configurable scale (default 2×)
- `extractSvgDimensions(svg)` — parses width/height from SVG string
- `RH_MERMAID_THEME` — 7 colour slots: `bg`, `fg`, `accent`, `line`, `muted`, `surface`, `border`
- `RH_COLOR_MAP` — 14 pattern→replacement regex rules

**Gaps / Limitations:**
- `beautiful-mermaid` and `@resvg/resvg-js` are optional peer deps — `renderMermaidPng` throws at runtime if missing
- Different rendering engine from templar's Puppeteer-based renderer — templar cannot use this version (different output characteristics)
- `applyRHTheme` does global string replacement — could corrupt hex literals in Mermaid code comments or node labels that happen to match
- `extractSvgDimensions` uses a simple regex — fails on SVGs where dimensions are specified via `viewBox` alone
- CSS variable resolution uses a hardcoded 7-variable map; new `beautiful-mermaid` CSS vars fall back to `#000000`

### Module: images

**Features:**
- `detectMimeType(filePath)` — extension-based MIME detection, including office MIME types
- `isLocalPath(url)` — checks if a path is local vs URL
- `isImagePath(filePath)` — checks against `IMAGE_EXTENSIONS`
- `IMAGE_EXTENSIONS` — `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.ico`
- `mimeToExtension(mime)` — reverse mapping (14 MIME types)
- `findImageRefs(markdown)` — extracts `![alt](path)` references, skipping code blocks
- `readImageAsBase64(filePath)` — reads and encodes local images
- `resolveImagePaths(markdown, basePath)` — replaces local images with `[[IMAGE_N]]` placeholders
- `ImageRef` interface

**Gaps / Limitations:**
- `detectMimeType` returns `application/octet-stream` for unknown extensions — templar's local version returns `null` (different error semantics; intentionally kept separate)
- ✅ ~~`mimeToExtension` map is smaller than `detectMimeType`'s~~ — now covers all MIME types from `detectMimeType` (fully symmetric)
- `findImageRefs` uses a simple regex — cannot handle parentheses in URLs or multi-line image references
- `resolveImagePaths` silently skips unreadable images (catch-all `try/catch`)
- No image dimension detection or validation
- Herald's `isLocalPath` is more restrictive (only `./`, `../`, `/`, `file://`) — kept as a separate local implementation

### Module: image-upload

**Features:**
- `uploadImageToDrive({ token, base64, mimeType, name? })` — direct Drive upload
- `uploadImageViaTempSlides({ token, base64, mimeType })` — creates temp presentation to obtain CDN URL (bypasses `publishOutNotPermitted`)
- `uploadImagesBatch({ token, images })` — batches multiple images into one temp presentation
- `deleteGoogleDriveFile(token, fileId)` — single file deletion
- `deleteGoogleDriveFiles(token, fileIds)` — parallel batch deletion

**Gaps / Limitations:**
- No file size limit checks — Google Drive API limits are not pre-validated
- `uploadImagesBatch` attaches cleanup only to the first result — callers must call `results[0].cleanup()` for the entire temp presentation
- No retry logic on transient API errors
- `deleteGoogleDriveFiles` silently ignores all errors (`.catch(() => {})`)
- Herald cannot use `deleteGoogleDriveFiles` because it takes `string` tokens vs herald's `OAuth2Client` — auth interface split blocks convergence
- Temp presentation uses hard-coded title `'librhgdoc-temp-images'` — could collide with user Drive searches

### Module: highlight

**Features:**
- `tokenize(code, language?, colorMap?)` — syntax highlighting via highlight.js
- `HIGHLIGHT_COLORS` — 35 light-theme CSS class→hex mappings
- `DARK_HIGHLIGHT_COLORS` — 35 dark-theme mappings (used by herald)
- `getSupportedLanguages()` — lists available highlight.js languages
- `ColoredRun` / `HighlightResult` interfaces

**Gaps / Limitations:**
- highlight.js is an optional peer dep — `tokenize` falls back to a single unstyled run if missing
- Uses `require('highlight.js')` (CJS) — may conflict in pure ESM environments
- ✅ ~~`DARK_HIGHLIGHT_COLORS` has only 14 entries~~ — now has 35 entries (same as `HIGHLIGHT_COLORS`), covering all highlight.js token classes
- Different engine from templar's Shiki-based highlighting — different output format (`ColoredRun[]` vs `{start, end, color}`)
- HTML entity decoder handles common entities but may miss rare ones
- No line-number annotation or line-range highlighting

### Module: cli

**Features:**
- `fmtTime(ms)` — human-readable duration (`"450ms"`, `"2.3s"`)
- `parsePresenterEntry(entry)` — parses `"Name, Title <email>"` and variants; accepts object input
- `formatGoogleApiError(errorMessage)` — maps 5 common Google API error patterns to user-friendly suggestions
- `PresenterEntry` interface

**Gaps / Limitations:**
- `fmtTime` clamps negative/NaN to `"0ms"` — no error signaling
- `parsePresenterEntry` doesn't handle multiple commas well (only first comma split)
- `formatGoogleApiError` only recognizes 5 patterns — unmatched errors return `null`
- No structured exit-code helpers or progress-bar utilities

### Module: collections

**Features:**
- `sparseMap(inputs, isEmpty, defaultValue)` — sparse processing: filters non-empty items for batch operations, reconstructs full array at original indices

**Gaps / Limitations:**
- Single utility function — very thin module
- `reconstruct` uses `Array.fill(defaultValue)` — if `defaultValue` is an object, all empty slots share the same reference (mutation hazard)

### Module: tables

**Features:**
- `calcColumnWidths(markdownTable, options?)` — computes proportional column widths in points from pipe-delimited markdown tables
- Accounts for monospace code spans (1.3× width multiplier) and bold headers (1.8× multiplier)
- `ColumnWidthOptions` interface with configurable page width, min/narrow column thresholds

**Gaps / Limitations:**
- Only supports pipe-delimited markdown tables — no other table formats
- Separator row detection regex `^\|[\s:|-]+\|$` may misfire on data rows containing only dashes/colons
- Fixed default page width 468pt (6.5" letter) — needs override for A4 or other sizes
- Monospace width multiplier (1.3×) and header bold multiplier (1.8×) are hardcoded — may not match actual font metrics

### Module: admonitions

**Features:**
- `ADMONITION_TYPES` — 5 GitHub-standard types: NOTE, TIP, IMPORTANT, WARNING, CAUTION
- `ADMONITION_LABELS` — emoji + display label per type
- `ADMONITION_ACCENT` — accent `RgbColor` per type
- `ADMONITION_BG` — background `RgbColor` per type
- `AdmonitionType` type

**Gaps / Limitations:**
- IMPORTANT emoji is `❗` in librhgdoc vs `📌` in templar — templar keeps a local copy to preserve rendered output
- Only the 5 GitHub-standard types — no extensibility for custom admonition types
- Constants only — no parsing or rendering logic (consumer projects provide that)

### Module: drive

**Features:**
- `findOrCreateFolder(token, folderName, parentId?)` — search Drive for a folder by name (optionally under a parent), create if missing; returns folder ID
- `moveFileToFolder(token, fileId, folderId)` — move a file by replacing its parents via `addParents` / `removeParents`

**Gaps / Limitations:**
- Search returns at most one match (`pageSize: 1`) — duplicate folder names are not disambiguated
- Uses native `fetch()` only — no typed `googleapis` client
- No shared-drive / `supportsAllDrives` query flags

### Module: lint

**Features:**
- `forEachNonCodeLine(text, callback)` — utility that iterates lines outside fenced code blocks (used by most lint functions)
- `lintBrandNames(text)` — checks 8 brand spelling patterns: `Red Hat`, `OpenShift`, `Kubernetes`, `Ansible`, `RHEL`, `Fedora`, `Podman`, `CentOS`
- `lintBareUrls(text)` — flags bare URLs > 20 chars not wrapped in markdown link syntax
- `lintUnclosedCodeFence(text)` — detects unmatched ``` or ~~~ fences
- `lintCodeBlockLanguage(text)` — flags opening fences without a language identifier
- `lintEmDash(text)` — flags em dash (U+2014) in prose lines
- `lintPlaceholderText(text)` — flags TODO, TBD, PLACEHOLDER, FIXME, XXX in prose
- `lintEmptyImageAlt(text)` — flags images with empty alt text (`![](url)`)
- `lintLongCodeBlock(text, maxLines?)` — flags code blocks exceeding a line threshold (default 50)
- `LintMessage` / `LintLevel` types

**Gaps / Limitations:**
- Only 8 of templar's 20+ lint checks were extracted — the rest are too tightly coupled to templar's state machine
- ✅ ~~`lintBrandNames` only checks 4 brands~~ — now checks 8 brands (Red Hat, OpenShift, Kubernetes, Ansible, RHEL, Fedora, Podman, CentOS)
- No column-level positions in `LintMessage` (only `line`)
- `lintBareUrls` skips lines that are entirely a URL — may miss bare URLs in reference lists
- 20-char threshold is hardcoded — short bare URLs like `http://x.co/abc` won't trigger

---

## templar (Markdown → Google Docs)

### Commands

#### `templar new <title> [out.md]`

**Features:**
- Scaffolds a new markdown document with Red Hat frontmatter template (title, subtitle, authors, version, scope, date) and skeleton sections

**Gaps:**
- Output must be a plain filename — no paths or `..` allowed
- Hardcoded subtitle "Best Practices Guide"
- Uses `$USER` env for author name — no interactive prompts

#### `templar lint <file.md> [--json] [--quiet]`

**Features:**
- 20+ static-analysis checks for Red Hat template compliance (see full list below under Linter)

**Gaps:**
- Offline only — does not lint the final rendered Google Doc, only the source markdown
- No auto-fix capability (see `enforce` for post-render fixing)

#### `templar convert <file.md> [flags]`

**Features:**
- Creates or updates a Google Doc from markdown
- Flags: `--document`, `--force-new`, `--force-full`, `--open`, `--dry-run`, `--verbose`
- Incremental sync preserves existing Google Docs comments on unchanged blocks

**Gaps:**
- `--dry-run` only shows pre-processed markdown stats, does not preview the final doc

#### `templar watch <file.md> [--open]`

**Features:**
- File-system watcher with 800ms debounce, auto-re-converts on save
- Suppresses re-convert when the write is from templar itself (sync-hashes writeback)

**Gaps:**
- Uses `node:fs.watch` — platform-specific reliability
- No graceful shutdown — `Ctrl+C` only
- No `--document` flag forwarding from watch context

#### `templar open <file.md>`

**Features:**
- Opens cached Google Doc in default browser from `gdoc-id` in frontmatter

**Gaps:**
- macOS-only (`spawnSync('open', [url])`)
- Fails if no `gdoc-id` in frontmatter

#### `templar url <file.md>`

**Features:**
- Prints the Google Doc URL from cached `gdoc-id`

**Gaps:**
- Fails if no `gdoc-id` cached

#### `templar export <doc-id|url> [out.pdf]`

**Features:**
- Downloads a Google Doc as PDF via Drive export API

**Gaps:**
- Output path cannot contain `..`
- PDF only — no other export formats

#### `templar compare <doc-id|url> [--document]`

**Features:**
- Visual diff: exports PDF, renders pages as images (via `pdftoppm`), compares against reference template PDF (via `magick compare` RMSE)

**Gaps:**
- Requires external tools: `pdftoppm` (poppler) and `magick` (ImageMagick) — not bundled
- Only compares first 3 pages
- macOS-only (`open` command for diff directory)

#### `templar enforce <doc-id|url> [--document]`

**Features:**
- Detects and fixes style violations in an existing Google Doc against the Red Hat template spec (see Enforce Engine below)

**Gaps:**
- ✅ ~~No `--dry-run` flag exposed at CLI level~~ — `--dry-run` is now supported
- Only checks the first textRun in each paragraph — inline style variations within a paragraph are not audited

#### `templar toc-restyle <doc-id|url>`

**Features:**
- Re-applies Red Hat fonts/colours to existing TOC entries without rebuilding

**Gaps:**
- Identifies TOC by finding "Contents" text — brittle if the heading is renamed
- Applies two separate batchUpdate calls due to Docs API link-styling quirk

### Linter

**Error-level checks:**
- Missing YAML frontmatter (`---`), missing closing `---`
- Missing required `title` field
- Unknown admonition types
- Malformed table rows
- Unclosed code fences
- Mermaid `classDef end` / `classDef class` reserved keywords

**Warning-level checks:**
- Missing recommended fields: `date`, `authors`, `version`, `subtitle`, `scope`
- Author email format (missing `@`)
- Version starting with "v"
- Placeholder date values
- Code blocks without language tags
- Heading level jumps, duplicate headings, numeric-only headings, ALL-CAPS headings
- Long headings (>80 chars for H1/H2)
- Empty sections, H1 duplicating frontmatter title, multiple consecutive H1s, H1 without intro sentence
- H2 jumping to code block/table without intro
- Missing "Executive Summary" / "Introduction" section
- Missing "References" section
- Incomplete doc structure (1 H1 + <2 H2)
- WARNING/CAUTION overuse (>8 boxes)
- Empty image alt text
- Long code blocks (>50 lines)
- Mixed H1 capitalization
- Mermaid dark-on-dark contrast
- Bare URLs (>20 chars, delegated to librhgdoc `lintBareUrls`)
- Very long lines (>500 chars)
- Em dashes in prose
- Placeholder text (TODO, TBD, template boilerplate)
- Brand name spelling (delegated to librhgdoc `lintBrandNames`)
- Inconsistent H1 numbering
- Fragment links in body/list context (dropped by templar)

**Linter gaps:**
- No cross-file validation (single-file only)
- No broken link checking
- No spell checking beyond brand names
- No mermaid syntax validation (only reserved keywords and contrast)
- No table content validation (only column count consistency)
- Em dash check may false-positive on intentional usage

### Enforce Engine

**Features:**
- Two template variants: `formal` and `document`
- Checks: font family, font size (±0.4pt tolerance), foreground colour (hex-normalized), bold, italic
- Paragraph-level checks: spacing before/after, line spacing, indent start/end
- Handles all element types: TITLE, SUBTITLE, H1–H5, BODY, CODE (Red Hat Mono detection), QUOTE (italic + gray), LIST (bullet), TABLE-HDR, TABLE-CELL, QA ("Customer question:" pattern)
- Skips code-block tables (background `#e8e8e8`, `#f6f8fa`, `#f5f5f5`) and admonition tables (background matching the 5 types)
- Skips 2-column tables with narrow first column (≤10pt — admonition accent strip)
- Read-only audit mode via `auditTemplate()`
- Dry-run support via `options.dryRun`

**Enforce gaps:**
- Only checks the **first non-empty textRun** per paragraph — inline formatting variations mid-paragraph are not audited
- QA detection only works with exact "Customer question: " prefix
- `document` variant has `hasQA: false` — no QA detection
- `document` variant headings go only to H3 (H4/H5 clamp to H3 spec)
- Table cell checks only look at the first paragraph of each cell
- No detection of incorrect list nesting levels
- Admonition detection uses background colour only — a user table with a matching background colour would be falsely skipped

### Markdown Support

| Element | Supported | Notes |
|---------|-----------|-------|
| ATX headings (`#`–`#####`) | ✅ H1–H5 | No H6 |
| Setext headings (`===` / `---`) | ❌ | Not parsed |
| Bold, italic, code, strikethrough | ✅ | Strikethrough is parsed but not applied as a doc style |
| Hyperlinks | ✅ | Fragment links (`#slug`) resolved only in tables/admonitions; **dropped in body/list** |
| Bullet lists (`-`, `*`) | ✅ | Indent level tracked; disc/circle/square presets |
| Numbered lists (`1.`) | ✅ | Decimal/alpha/roman presets |
| Task lists (`[ ]`, `[x]`) | ✅ | Converted to ☐/☑ characters |
| Pipe tables | ✅ | With proportional column width calculation |
| Fenced code blocks | ✅ | 14 languages with Shiki syntax highlighting; others render plain |
| Mermaid diagrams | ✅ | Puppeteer + Chrome rendering, Red Hat themed |
| Admonitions (`> [!TYPE]`) | ✅ | 5 GitHub-standard types |
| Block images (`![alt](path)`) | ✅ | Local files only, center-aligned, 468pt width |
| Inline images | ❌ | Left as raw markdown text |
| Blockquotes (`>`) | ❌ | Only `> [!TYPE]` admonitions are parsed; plain blockquotes become body text |
| HTML elements | ❌ | `<details>`, `<summary>`, `<div>` etc. are stripped |
| Footnotes | ❌ | Not supported |
| Definition lists | ❌ | Not supported |
| Nested lists (semantic) | ⚠️ | Indent level tracked but nesting is flat — each item is an independent block |
| Multi-paragraph list items | ❌ | Continuation paragraphs become separate body blocks |
| Horizontal rules | ❌ | Silently skipped |
| Superscript / subscript | ❌ | Not supported |
| Table cell merging (colspan/rowspan) | ❌ | Not supported |

### Code Highlighting

**Shiki-highlighted languages (14):** `javascript`, `typescript`, `python`, `bash`, `shell`, `go`, `ruby`, `sql`, `yaml`, `json`, `dockerfile`, `markdown`, `jsx`, `tsx`

**Recognized language tags (round-trip):** `js`, `ts`, `py`, `sh`, `rb`, `md`, `html`, `css`, `c`, `cpp`, `java`, `rust`, `kotlin`, `swift`, `scala`, `php`, `r`, `perl`, `lua`, `text`, `plaintext`, `clang`, `rlang`

All other languages render as plain monospace text with no syntax colouring.

**Gaps:**
- No line numbers in code blocks
- No line highlighting (specific line emphasis)
- No code block titles/filenames
- No word wrap — long lines overflow the table cell
- Code block background colour (`#e8e8e8` / `#f6f8fa` / `#f5f5f5`) is not configurable
- No maximum code block size — very large blocks may hit Docs API limits

### Mermaid Diagrams

**Features:**
- Headless Puppeteer + Chrome rendering (prefers system Chrome)
- Red Hat theme via `applyRHTheme` — colours remapped to RH palette
- Auto-converts extreme landscape `LR` flowcharts to `TD` (aspect ratio > 3:1)
- Aspect ratio probing via `beautiful-mermaid` before full Puppeteer render
- 3× device scale factor for high-DPI output
- Cached hashes — skips unchanged diagrams on incremental sync
- Strips `%%{init:...}%%` frontmatter to avoid external font loading timeouts
- Lazy imports so `templar lint` works without Puppeteer

**Gaps:**
- Sequential rendering only — shared page state is not safe for concurrent renders
- Global dependency: Puppeteer and `mermaid.min.js` must be globally installed
- Custom `%%{init:}%%` frontmatter is stripped entirely — user theme customizations are lost
- Fixed target size (800×900 CSS px) — no user-configurable diagram size
- Render errors destroy and recreate the page — no retry
- Diagrams support whatever mermaid.js supports; no templar-specific restrictions or validation

### Images

**Features:**
- Local images read from disk relative to the markdown file's directory
- Formats: `.png`, `.jpg/.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`, `.tiff/.tif`
- Base64-encoded for upload via HTML-to-Drive pipeline
- Cached hashing — skips unchanged images on incremental sync

**Gaps:**
- Inline images (within body text) are not processed — left as raw markdown
- Alt text is not rendered in the final doc (no captions)
- No image resizing or optimization — large images uploaded as-is
- SVG via HTML-to-Drive — Google Docs may not render SVG perfectly
- No width/height specification — always full page width (468pt)
- File-not-found is a warning, not an error

### Incremental Sync

**Features:**
- Comment-preserving sync: unchanged blocks (by content hash) are never deleted/re-inserted, preserving Google Docs comment anchors
- Pipeline: `fetchDocBlocks → parseMdBlocks → diffBlocks → assignInsertionIndices → buildBatchRequests → docsBatchUpdate → handleComplexOpsBatched`
- Two-batch batchUpdate: (1) deletes + style updates descending, (2) inserts — prevents index shifts
- Complex block handling in separate Phase A/B (tables, mermaid, images)
- 200-request chunking for batchUpdate
- Per-request retry fallback on chunk failure (except auth errors)
- `--verbose` flag for detailed diff logging
- Dry-run support

**Gaps:**
- Fragment links in body/list items dropped during incremental sync (logged to stderr)
- Unmatched tables from Phase A leave empty tables in the doc — user must `--force-full` to recover
- No conflict detection — if someone else edits the doc between syncs, their changes may be overwritten
- No partial sync — entire document is diffed and updated
- No undo / rollback to a previous doc state

### Diff Engine

**Features:**
- LCS (Longest Common Subsequence) based block-level diff
- Op types: `keep`, `style_update`, `delete`, `insert`, `replace_text`, `replace_complex`
- Adjacent delete+insert pairs merged into `replace_text` or `replace_complex`

**Gaps:**
- O(n×m) space for LCS table — expensive for very large documents (hundreds of blocks)
- Heading promotion/demotion goes through delete+insert → replace, not `style_update`
- Mermaid blocks have empty text in the doc — always go through delete+insert → `replace_complex`
- No move detection — a reordered section is delete+insert, not a move
- Block identity is text-only — position is not considered

### Other templar Modules

| Module | Purpose | Key gaps |
|--------|---------|----------|
| `lib/file-upload.ts` | Uploads local non-image files to Google Drive (private); replaces local paths with `webViewLink` | Sequential uploads, no parallelism |
| `lib/placeholders.ts` | Phase 2 force-full pipeline: replaces placeholder text with real tables/images | Sequential table matching; can mis-pair if Phase A position deltas are large |
| `lib/image-upload.ts` | Two-strategy image hosting: HTML-to-Drive primary (auto-splits at 4.5 MB) | Signed URIs expire ~30 min — batchUpdate must complete within that window |
| `lib/docs-api.ts` | Low-level Docs REST API layer (create doc, named styles, page style, clear body, batchUpdate, footer, code blocks, tables, admonitions, fragment links, column widths) | 200-request-per-batchUpdate limit (Docs API constraint) |
| `lib/docs-blocks.ts` | Parses Docs API response into typed `DocsBlock[]` | Admonition false-positive guard (`ADMON_LABEL_RE`) may misidentify user tables with matching first-line keywords |
| `lib/requests.ts` | Builds batchUpdate requests for incremental sync text operations | Fragment links in body/list dropped with stderr warning |
| `lib/toc.ts` | TOC construction and restyling; 3 heading levels (H1, H2, H3) | Three-step per-entry approach to work around Docs API font-size-on-linked-text bug |
| `lib/convert.ts` | High-level 9-phase conversion pipeline | `forceFullRewrite` is the only mode that guarantees correct output |

---

## herald (Marp Markdown → Google Slides)

### Commands

#### `herald new <deck.md>`

**Features:**
- Scaffolds a starter Marp Markdown deck with frontmatter template

**Gaps:**
- Writes a static template; no interactive prompts for title/theme/etc.

#### `herald convert <deck.md>` / `herald sync <deck.md>`

**Features:**
- Creates a new Google Slides presentation (first run) or replaces content in place (subsequent)
- `--force` forces full recreation
- `sync` is an alias for `convert`

**Gaps:**
- No `--dry-run` mode
- ✅ ~~No `--open` flag~~ — `--open` is now supported to auto-open browser after conversion
- No incremental sync — full slide content is replaced on every update (no diff-based partial updates like templar's `syncDoc`)

#### `herald lint <deck.md> [--json] [--quiet]`

**Features:**
- Static analysis: invalid layouts, long titles, empty columns, missing frontmatter

**Gaps:**
- No auto-fix / `enforce` command
- Offline only — no API-side checks

#### `herald export <deck.md> --format pdf|pptx`

**Features:**
- Downloads existing presentation via Google Drive export
- Supports both PDF and PPTX formats

**Gaps:**
- Requires `presentationId` already set in frontmatter
- No filename control (derives from `.md` filename)

#### `herald auth`

**Features:**
- Interactive OAuth2 browser flow via librhgdoc `runAuthFlow`

**Gaps:**
- None beyond the librhgdoc auth limitations listed above

#### `herald version`

**Gaps:**
- ✅ ~~Hardcoded `0.1.0`~~ — version is now read dynamically from `package.json`

### Layout Support

Herald supports **38 distinct layouts** with **88 non-blank variants** (standard + dark themes):

| Category | Layouts |
|----------|---------|
| Title/Cover | `cover`, `cover-image`, `webinar`, `closing`, `closing-image` |
| Dividers | `divider`, `divider-subhead`, `divider-grey` |
| Agenda/Overview | `agenda`, `agenda-grey`, `overview`, `overview-grey` |
| Content | `title-only`, `title-body`, `title-subhead-body`, `title-col`, `title-left`, `body` |
| Multi-column | `two-col`, `three-col`, `four-col`, `two-by-two` |
| Process | `two-chevrons`, `three-chevrons` |
| Data | `data-callouts-2`, `data-callouts-3`, `data-chart-donut`, `data-chart-donut-3`, `data-chart-pie`, `data-chart-bar`, `data-table` |
| Quotes | `quote`, `quote-two-col`, `quote-three-col` |
| Media | `blank`, `large-text`, `image-left`, `image-body`, `full-image` |
| Complex | `timeline`, `icon-list` |

**Layout auto-detection** (when no `_class` directive):
- First slide → `cover`
- `#` + `##` + body → `title-subhead-body`
- `#` + `##` (no body) → `divider-subhead`
- `#` + body → `title-body`
- `#` alone → `divider`
- Body only → `body`

**Layout gaps:**
- `REUSE_OFFSETS` layouts (`data-chart-donut`, `data-chart-donut-3`, `data-chart-pie`, `data-chart-bar`, `timeline`, `icon-list`) reuse template demo slides — subsequent occurrences use `duplicateObject`, which copies all freeform demo content
- `data-chart-bar`: bar chart data is not programmable (native chart REUSE only; user must edit in Slides)
- `timeline`: only 2 event positions are layout-defined placeholders (5 in the demo are via freeform copies)
- `icon-list`: only 1 row of label+body is layout-defined (3 rows in demo are freeform copies)
- No `five-col` or higher column layouts
- No custom layout creation — limited to the 38 defined in the RH template

### Slide Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Bold, italic, code | ✅ | `Roboto Mono` for code with style-bleed kerning fix |
| Emoji | ✅ | Unicode emoji from Marp parser |
| Unordered bullets | ✅ | Custom ▸ glyph (U+25B8) matching RH template, 3 nesting levels |
| Ordered lists | ✅ | `createParagraphBullets` |
| Tables | ✅ | Fixed positioning; per-cell text + formatting |
| Fenced code blocks | ✅ | Dark background (`#141414`) rectangle with highlight.js syntax colouring |
| Mermaid diagrams | ✅ | `beautiful-mermaid` + `@resvg/resvg-js` at 2× zoom, Red Hat themed |
| LaTeX math | ✅ | KaTeX → HTML → Puppeteer screenshot (block level); inline `$$..$$` rendered as code-styled text run |
| Background images | ✅ | `![bg](url)` Marp syntax → layout `imageUrl` |
| Image panels | ✅ | Pre-cropped to panel aspect ratio via ImageMagick |
| Product logos | ✅ | Positioned at branded slot on `cover`, `cover-image`, `webinar` |
| Icons | ✅ | Extracted from template demo slides and re-inserted |
| Speaker notes | ✅ | `<!-- notes: text -->` or bare `<!-- text -->` |
| Column separator | ✅ | `<!-- col -->` for multi-column layouts |
| Source attribution | ✅ | `<!-- source: text -->` per-slide footer |
| Global footer | ✅ | `<!-- footer: text -->` propagates to subsequent slides |
| Dark theme | ✅ | `#292929` bg for content, `#141414` for cover/closing, white text override |
| Expressive theme | ✅ | Variant with custom styling |
| Grey backgrounds | ✅ | Layout-specific (`overview-grey` → `#F2F2F2`) |
| Z-order control | ✅ | `BRING_TO_FRONT`/`SEND_TO_BACK` etc. |
| Slide skip | ✅ | `<!-- _skip: true -->` |
| Geo positioning | ✅ | `<!-- geo: x=.. y=.. w=.. h=.. z=.. -->` for images/media |
| Hyperlinks | ❌ | Not supported in body text |
| Strikethrough / underline | ❌ | Not supported |
| Superscript / subscript | ❌ | Not supported |
| Slide transitions / animations | ❌ | Not supported (API limitation) |
| Notes formatting | ❌ | Plain text only — no bold/italic in notes |
| Custom text colours | ❌ | Only RH palette: red, white, near-black |
| Image alt text | ❌ | No accessibility support |
| Slide numbering | ⚠️ | Relies on template master — not set via API |

### Code Highlighting

Uses highlight.js (via librhgdoc's `tokenize`):
- Dark theme colours on `#141414` background
- `Roboto Mono` font (vs templar's `Red Hat Mono`)
- Fixed positioning: `CODE_X=2438400, CODE_Y=2400000, CODE_W=7315200, CODE_H=2286000 EMU`
- Multiple code blocks stack with 12px gap — no auto-sizing based on content length

### Rendering

| Renderer | Technology | Notes |
|----------|------------|-------|
| Mermaid | `beautiful-mermaid` + `@resvg/resvg-js` | PNG at 2× zoom, Red Hat themed (white bg, red accents) |
| LaTeX | KaTeX → HTML → Puppeteer screenshot | New browser instance per call — slow for many formulas; loads KaTeX CSS from CDN (requires internet) |

**Rendering gaps:**
- No PlantUML, Graphviz, or other diagram engine support
- No SVG-to-image conversion for arbitrary SVG content
- No offline mode for Mermaid (some paths use Kroki public API)

### API Operations

| Operation | Purpose |
|-----------|---------|
| `copyTemplate` | Copies RH template (hardcoded `TEMPLATE_ID`) via Drive |
| `getPresentation` | Fetches full presentation: slide IDs, placeholders, notes, layout IDs |
| `batchUpdate` | Sends Slides API requests in chunks of 100 |
| `extractTemplateAssets` | Extracts icon specs and image panel specs |
| `getFreeformElementIds` | Identifies non-placeholder elements for cleanup |
| `deleteQuickTips` | Removes teal Quick Tip tutorial boxes from reused slides |
| `updateMasterBoilerplate` | Replaces confidential/version master shapes |
| `uploadImagesBatch` | Batch upload via temp Slides → CDN URL (bypasses `publishOutNotPermitted`) |
| `cropToFillAspect` | ImageMagick-based crop to fill target aspect ratio |

**API gaps:**
- `TEMPLATE_ID` is hardcoded — no custom template support
- `batchUpdate` chunks at 100 requests — no retry/backoff for rate limits
- `cropToFillAspect` requires ImageMagick (`magick`) in PATH; falls back to original on failure
- No file/folder organization — presentations are created in Drive root

---

## Cross-Project

### Shared Auth

Both projects use librhgdoc's `auth` module with credentials stored at `~/.config/rhgdoc/`:
- `credentials.json` — OAuth2 client credentials
- `token.json` — cached access/refresh tokens

**Key limitation:** templar uses raw `string` tokens from `getValidToken()`, while herald uses `google-auth-library` `OAuth2Client` objects. This auth interface split is the **single biggest blocker** to further code consolidation — it prevents sharing `docsBatchUpdate`, `deleteDriveFiles`, `exportPdf`, and similar functions.

### What templar has that herald doesn't

| Feature | Notes |
|---------|-------|
| `watch` command | Auto-reconvert on file save with debounce |
| `open` command | Open document in browser from frontmatter ID |
| `url` command | Print document URL from frontmatter |
| `compare` command | PDF diff against reference template |
| `enforce` command | Fix formatting in existing document |
| `toc-restyle` command | Restyle Table of Contents |
| `--dry-run` flag | Preview without API upload |
| `--force-full` flag | Force full rewrite (skip incremental) |
| Incremental sync | Diff-based partial updates preserving doc comments |
| Table of Contents | Generated with clickable heading links |
| Admonitions | 5-type callout boxes with emoji labels and coloured backgrounds |
| File uploads | Arbitrary non-image file attachments to Google Drive |
| Shiki syntax highlighting | 14 languages with precise token colouring |

### What herald has that templar doesn't

| Feature | Notes |
|---------|-------|
| Google Slides output | Presentation format vs document format |
| 38 visual layouts | Pixel-perfect RH template matching |
| Dark / expressive themes | Automatic background and text colour management |
| Image panels | `cover-image`, `image-left`, `full-image` etc. with aspect-ratio cropping |
| Template icon extraction | Reuses icons from template demo slides |
| Template slide reuse | Complex freeform shapes (donut charts, timelines) |
| Z-order control | `BRING_TO_FRONT` / `SEND_TO_BACK` for positioned elements |
| Layout auto-detection | Infers layout from content structure |
| Slide skip | `<!-- _skip: true -->` |
| Custom bullet glyphs | ▸ (U+25B8) matching RH template |
| PPTX export | In addition to PDF |
| Geo positioning | `<!-- geo: x=.. y=.. w=.. h=.. z=.. -->` |
| LaTeX math rendering | KaTeX → PNG via Puppeteer |
| Column separators | `<!-- col -->` for multi-column content |
| Source attribution | Per-slide `<!-- source: text -->` footer |

### Architectural Gaps

| Gap | Impact | Reason |
|-----|--------|--------|
| Auth interface split (`string` vs `OAuth2Client`) | Blocks sharing ~10 functions between projects | Templar uses `googleapis` typed client; herald uses `google-auth-library`. Would require one project to change its auth model. |
| Different syntax highlighters | Different output format; can't swap engines | Templar uses Shiki (WASM, `{start, end, color}`); librhgdoc/herald uses highlight.js (`ColoredRun[]`). Different fidelity and language coverage. |
| Different Mermaid renderers | Templar: Puppeteer + Chrome; librhgdoc: `beautiful-mermaid` + resvg | Different visual output; templar needs LR→TD conversion and `%%{init}%%` stripping that the library version doesn't do. |
| Different code fonts | `Red Hat Mono` (templar/docs) vs `Roboto Mono` (herald/slides) | By design — each Google Workspace product has different font availability. |
| IMPORTANT admonition emoji | `📌` in templar vs `❗` in librhgdoc | Templar keeps a local copy to preserve its rendered output. |
| No shared structured logger | Both projects use ad-hoc `process.stderr.write` | No common pattern exists — would be a new abstraction, not an extraction. |
| No shared error handling | Different CLI error-to-message mapping | Application-specific exit code semantics. |

---

## Known Google API Limitations

These are **upstream constraints** that cannot be fixed in toolchain code.

### Google Docs API

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **No image insertion from raw bytes** | Can't embed images directly in batchUpdate | ✅ HTML-to-Drive (signed `contentUri`, ~30 min TTL); auto-splits HTML at 4.5 MB. |
| **No Table of Contents API** | No `body.appendToc()` equivalent in REST | ⚠️ Manual TOC with `insertText` + `updateTextStyle(link: { headingId })`. Clickable but **no page numbers and no auto-update**. |
| **No page numbers** | No `footer.appendPageNumber()` in REST | ⚠️ Static hint text in footer: "Use Insert → Page numbers". **Manual step required.** |
| **No bookmarks** | No `doc.addBookmark(position)` in REST | ⚠️ Uses heading IDs (`paragraphStyle.headingId`) for in-document links. **Heading-only**, no arbitrary position bookmarks. |
| **Font size on linked text** | Setting `fontSize` on linked text is ignored in the same batchUpdate | ✅ Apply `fontSize` in a second separate batchUpdate. Implemented in TOC via `colorOverrides`. |
| **No table border removal** | No `table.setBorderWidth(0)` in REST | ✅ Per-cell `updateTableCellStyle` with white-on-background borders. Verbose but functional. |
| **No positioned images** (watermarks) | No `para.addPositionedImage(blob)` in REST | ⚠️ Cover image uses inline image instead (right-aligned before TOC page break). **Not floating.** |
| **No auto-fit column widths** | `updateTableColumnProperties` only supports `FIXED_WIDTH` | ⚠️ Fixed-width only. `calcColumnWidths` computes proportional widths from content, but no auto-fit on render. |
| **200-request batchUpdate limit** | Large documents require multiple batched calls | ✅ Automatic chunking at 200 requests. |
| **Fragment links in body lose position** | Phase 1 text positions become stale after TOC/Phase 2 inserts | ⚠️ Fragment links resolved in tables/admonitions only. **Body/list fragment links are dropped.** |
| **Signed image URIs expire** | HTML-to-Drive URIs expire in ~30 minutes | ⚠️ batchUpdate must complete within the TTL window. Long documents with many images may fail. |

### Google Slides API

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **No slide transitions** | Cannot set transition effects via API | ❌ None — must be set manually in Google Slides UI. |
| **No animations** | Cannot animate elements via API | ❌ None — must be set manually. |
| **No chart data editing** | Native chart objects can be duplicated but data cannot be set | ⚠️ `data-chart-*` layouts reuse template chart objects; user must edit data manually in Slides. |
| **No notes formatting** | Speaker notes accept plain text only | ❌ No bold/italic/links in notes. |
| **No custom fonts** | Must use fonts available in Google Slides | ⚠️ Code uses `Roboto Mono` (available) instead of `Red Hat Mono` (not available in Slides). |
| **No slide numbering API** | Cannot set page numbers via API | ⚠️ Relies on template master to include slide numbers. |
| **100-request batchUpdate limit** | Smaller chunk size than Docs API | ✅ Automatic chunking at 100 requests. |
| **`publishOutNotPermitted` for image upload** | Direct image upload may be blocked by org policy | ✅ Temp-presentation CDN URL technique bypasses the restriction. |

### Google Drive API

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **Duplicate folder names** | `findOrCreateFolder` returns the first match only | ⚠️ Callers should use unique names or pass `parentId` to narrow the search. |
| **Shared drives** | Helpers omit `supportsAllDrives` | ❌ Shared-drive folders/files may fail until callers add those flags. |
