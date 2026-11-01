# onthisdevice.com

A large collection of free file, media and calculation tools that run **entirely in your
browser**. Merge a PDF, transcode a video, convert an image, work out a mortgage, and
nothing you touch ever leaves your machine.

There is no server, no API, no database, no account, no upload queue, no watermark, and
no analytics. You can load a tool page, switch off your network, and every tool still
works.

---

## Why on-device matters

Every incumbent in this space works the same way: you upload your file to someone else's
computer, they process it, they hand it back, and they keep a copy for "up to 24 hours".
That is a terrible trade for a 20-second task. It leaks your tax return, your passport
scan, your unreleased video and your client's contract to a third party, it is slow
because your file has to travel twice, it caps your file size to whatever their free tier
allows, and it needs ads to pay for the CPU time.

Browsers no longer require any of that. WebAssembly runs the same C/C++ codecs (FFmpeg,
mozjpeg, libwebp, libavif) at near-native speed, right on the page. So:

| | Upload-based tools | onthisdevice.com |
| --- | --- | --- |
| Where your file goes | a stranger's server | nowhere |
| Size limit | their free tier | your device's memory |
| Speed | two network trips + a queue | local CPU |
| Works offline | no | yes, after first load |
| Privacy policy you must trust | theirs | none needed |

This is not a claim we make in the footer. It is enforced by the
`Content-Security-Policy` in [`public/_headers`](public/_headers), which ships with
`connect-src 'self' blob: data:` and **no third-party origin whatsoever**. The site is
technically incapable of sending your data anywhere. If a change ever needs an external
host in `connect-src`, that change is wrong.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Astro 7**, `output: 'static'` | Ships zero JS by default; each tool page is HTML plus exactly one island. |
| Interactivity | **React 19** islands (`client:load`) | Only the tool itself hydrates. Header, menus and motion use a few lines of plain script. |
| Styling | **Tailwind CSS v4** (CSS-first config) | Tokens live in `src/styles/global.css`; dark mode is token-driven. |
| Components | **shadcn/ui** on Radix | Accessible primitives, owned in-repo under `src/components/ui/`. |
| Heavy lifting | **WebAssembly**: ffmpeg.wasm, jSquash codecs, pdf-lib, pdfjs-dist | Native-speed processing without a backend. |
| Language | **TypeScript 7** (tsrs), strict | `@/*` → `src/*`. `.astro` files are checked through `@astrojs/ts-content-mapper`. |
| Motion | CSS, View Transitions, a small canvas hero | Pixel glyph per category (`src/lib/glyphs.ts`), page transitions, still frames under reduced motion. |
| Detection | ONNX Runtime Web, Tesseract, Whisper, own detectors in `src/lib/ml/` | Faces, plates, signatures, text entities, OCR and speech run on the device. Model files are static files on this site. |

Full build rules (hard constraints, the page template, the shared component API, and the
library notes) are in **[CONTRACT.md](CONTRACT.md)**. Read it before writing a tool.

---

## How the tool registry works

Every tool is described **once**, in a plain TypeScript object, and that one description
drives the homepage grid, the category hubs, the ⌘K search index, breadcrumbs, the
related-tools rail, the sitemap, and all of the page's SEO metadata and JSON-LD.

```
src/lib/tools/
  types.ts      # Tool / Category interfaces + the CATEGORIES list   (do not edit)
  index.ts      # merges every category module, derives lookups      (do not edit)
  pdf.ts        # one module per category, each: export const tools: Tool[]
  image-edit.ts
  finance.ts
  …
```

`index.ts` concatenates every category module into `TOOLS` and derives everything else
from it: `TOOL_BY_SLUG`, `getTool()`, `requireTool()` (which **throws at build time** if a
page references an unregistered slug; a missing registry entry is a failed build, not a
broken page), `toolsByCategory()`, `relatedTools()`, `POPULAR_TOOLS` and `SEARCH_INDEX`.

URLs are flat and slug-exact: slug `merge-pdf` → `src/pages/merge-pdf.astro` → `/merge-pdf`.
Category hub pages at `/category/<slug>` are generated automatically. Never hand-write one.

See [CONTRACT.md §3](CONTRACT.md) for the full field reference.

---

## Adding a new tool in 3 steps

Say you're adding **Merge PDF**.

**1. Register it:** append to `src/lib/tools/pdf.ts`:

```ts
{
  slug: 'merge-pdf',
  title: 'Merge PDF',
  description: 'Combine multiple PDFs into one document, reorder pages by drag and drop, and download instantly. Free, private, no upload.',
  keywords: ['combine pdf', 'join pdf', 'pdf merger'],
  category: 'pdf',
  icon: 'FileStack',        // must be a real lucide-react export, PascalCase
  accepts: ['pdf'],
  faqs: [{ q: '…', a: '…' }],   // 3-5
  related: ['split-pdf', 'compress-pdf'],
  updated: '2026-08-16',
}
```

**2. Build the island:** `src/components/tools/pdf/MergePdf.tsx`. This is the only file
with real logic. Use the shared pieces (`FileDropzone`, `ToolPanel`, `ProgressPanel`,
`DownloadButton`, `ErrorNote`, `FileChips`) rather than reinventing them, and keep heavy
work off the main thread.

**3. Add the page:** `src/pages/merge-pdf.astro`, a thin wrapper and nothing more:

```astro
---
import ToolLayout from '@/layouts/ToolLayout.astro'
import MergePdf from '@/components/tools/pdf/MergePdf.tsx'
---

<ToolLayout slug="merge-pdf">
  <MergePdf client:load />
</ToolLayout>
```

`ToolLayout` reads the registry itself and renders the header, breadcrumbs, `<h1>`,
description, privacy badge, FAQ accordion, related rail, JSON-LD and footer. The filename
must match the slug exactly.

---

## Local development

Requires **Node 22.12** or later.

```bash
npm ci            # clean install from the lockfile
npm run dev       # dev server
npm run check     # astro sync + tsrs: TypeScript + template diagnostics
npm run build     # static build into dist/, then share cards + host limit checks
npm run preview   # serve dist/ the way the host does (headers, redirects, 404)
npm run smoke     # open every tool in Chromium against `npm run preview`
```

Models: `node scripts/vendor-models.mjs` copies the runtimes and downloads the detection models into
`public/{ort,ocr,models}/`, splits or gzips files over 24 MiB, and writes `src/lib/ml/manifest.json`.
`src/lib/ml/assets.ts` loads them in the page and keeps them in Cache Storage.

Review scripts (never shipped) live in `scripts/`: `shoot.mjs` (screenshots), `frames.mjs`
(motion frames), `overflow.mjs` (horizontal overflow at phone widths), `checkhtml.mjs` (one
`<h1>`, canonical, share card, internal links), `smoke/` (fixtures, tool harness, calculator checks, `narrow.mjs` for spills at 320 and 390 px),
`icons.mjs` and `vendor-ffmpeg.mjs` (regenerate icons and the FFmpeg core).

Web fonts: run `uv run scripts/subset-fonts.py` after a font update or a new width or OpenType
feature in the CSS; `--check` (after `npm run build`) finds both.

---

## Deployment

The site deploys to **Cloudflare Workers with static assets** (no Worker code):

```bash
npm run deploy    # npm run build && npx wrangler@latest deploy
```

- `wrangler.jsonc`: worker `onthisdevice`, the `onthisdevice.com` custom domain, assets from
  `./dist`, `html_handling: drop-trailing-slash` (URLs are `/merge-pdf`, never `/merge-pdf/`),
  `not_found_handling: 404-page`.
- `public/_headers`: the security headers and the Content-Security-Policy, plus cache rules.
  `public/_redirects`: two legacy path redirects. `www.onthisdevice.com` is redirected to the apex
  by a Cloudflare redirect rule.
- Cloudflare serves no single file over 25 MiB. The FFmpeg wasm (~31 MB) therefore ships
  gzip-compressed (`public/ffmpeg/0.12.10/ffmpeg-core.wasm.gz`, ~10 MB) and the page inflates it
  with the browser's `DecompressionStream` before FFmpeg loads it from a `blob:` URL
  (`src/lib/ffmpeg-core.ts`). Everything stays on this origin. `scripts/postbuild.mjs` fails the
  build if any file is over the limit.
- Share cards: `scripts/postbuild.mjs` renders a 1200×630 PNG for every page into `dist/og/`
  (layout by satori, rasterised by resvg): black card, category glyph, title, one line, domain.

### Caching and security headers

- `/_astro/*` and `/ffmpeg/<version>/*`: `max-age=31536000, immutable` (content-hashed or
  versioned names).
- HTML: Cloudflare's default (`max-age=0, must-revalidate`), so a deploy is live at once.
- `/sw.js`: `no-cache`. The service worker caches this site's own pages and code as they are
  used, so a tool that has run once keeps working offline.
- `nosniff`, `strict-origin-when-cross-origin`, `SAMEORIGIN`, a narrow `Permissions-Policy`, and
  the CSP described above. No COOP/COEP: the single-threaded FFmpeg core needs no
  `SharedArrayBuffer`.

---

## How the wasm pipeline works

Nothing heavy is in the initial bundle. A tool page loads as static HTML plus one small
React island; the multi-megabyte machinery arrives only when you actually pick a file.

**1. Lazy import.** Codecs are `await import(...)`-ed *inside* the handler, never at module
top level, so Vite splits them into their own chunks:

```ts
const { decode } = await import('@jsquash/png')
const { encode } = await import('@jsquash/jpeg')
```

FFmpeg is loaded the same way on first use, and the UI says that the first run downloads the
10 MB engine. After that it is in Cache Storage and loads without the network.

**2. Instantiate.** The browser compiles the `.wasm` module. This is the step that needs
`'wasm-unsafe-eval'` in the CSP. Without it every tool would die on
`WebAssembly.instantiate`. It is much narrower than `'unsafe-eval'`: it permits wasm
compilation and nothing else.

**3. Run off the main thread.** ffmpeg.wasm and pdfjs-dist bootstrap their workers from
**blob URLs**, which is why the CSP carries `script-src … blob:` and
`worker-src 'self' blob:`. Work that can't be moved to a worker is chunked with
`await nextFrame()` from `@/lib/utils` so the page never freezes, and progress is
determinate wherever the underlying library reports it (`ffmpeg.on('progress', …)`).

**4. Hand back a blob.** Output becomes a `Blob`, then an object URL for preview and for
`<DownloadButton>`, hence `img-src`/`media-src 'self' data: blob:`. Object URLs are
revoked when the component unmounts (`useObjectUrl`). Multiple outputs are zipped locally
with `jszip`/`fflate`.

At no point in those four steps is there a network request to anything but this origin,
and the CSP guarantees it.

---

## Repository layout

```
public/          _headers, _redirects, sw.js, fonts, icons, ffmpeg/, ort/, ocr/, models/  → copied to dist/
scripts/         build steps (postbuild, og/, vendor-models), indexing/, review tools (smoke/, shoot, …); not shipped
src/
  components/
    ui/          shadcn/ui primitives
    shared/      FileDropzone, ToolPanel, DownloadButton, …  (do not add files here)
    site/        header, footer, glyphs, hero, share bar; search/ (palette, hero search, drop anywhere)
    tools/<cat>/ one React island per tool; tools/redact/ has the shared redaction editor
  hooks/         useDebouncedValue, useLocalStorage, useObjectUrl
  layouts/       BaseLayout.astro, ToolLayout.astro
  lib/
    tools/       the registry
    search/      on-device search engine, instant answers, file type detection
    ml/          model loader, ONNX Runtime setup, vision, text, ocr, speech, signature, id, video
    glyphs.ts    the pixel glyph of each category
    handoff.ts   passes a file dropped on one page to the tool picked
    utils.ts     cn, formatBytes, downloadBlob, nextFrame, …
  pages/         one flat .astro file per tool slug
  styles/        global.css (Tailwind v4 config + tokens), motion.css
wrangler.jsonc   Cloudflare deploy config
CONTRACT.md      the build contract; read this first
```

---

## License

All rights reserved. Contact: contact@geolara.com
