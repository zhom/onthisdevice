# onthisdevice.com build contract

Everything on this site runs **100% in the browser**. No uploads, no API calls, no
server. That is the product promise and the marketing hook. Never break it.

- **Domain:** https://onthisdevice.com
- **Stack:** Astro 7 (`output: 'static'`) · React 19 islands · Tailwind CSS v4
  (CSS-first config, tokens live in `src/styles/global.css`) · shadcn/ui · WebAssembly
- **Alias:** `@/*` → `src/*` (configured in `tsconfig.json`)
- **Deps are already installed.** Do not run `npm install` or add dependencies.
  Everything you need is in `package.json`. Read it before importing.

---

## 1. Hard rules

1. **No network at runtime.** No `fetch` to any API, no CDN `<script>`, no remote fonts,
   no analytics. Exchange rates, IP lookups etc. are out of scope for that reason.
2. **Never write outside the paths you own.** Another agent is writing the neighbouring
   files at the same time. Overwriting shared files loses their work.
3. **Do not edit** `package.json`, `astro.config.mjs`, `tsconfig.json`,
   `src/styles/global.css`, `src/lib/utils.ts`, `src/lib/tools/index.ts`,
   `src/lib/tools/types.ts`, or `CONTRACT.md`.
4. **TypeScript strict.** No `any` where a real type exists, no `@ts-ignore`.
   Prefer `import type { ... }` for type-only imports (`verbatimModuleSyntax` is on).
5. **Heavy work goes off the main thread or in chunks.** For multi-second work, show
   determinate progress and `await nextFrame()` (from `@/lib/utils`) between chunks so
   the UI stays responsive.
6. **Dark mode must work.** Only use semantic tokens: `bg-background`, `text-foreground`,
   `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`,
   `bg-success`, `bg-warning`, `bg-chart-1`…`bg-chart-5`. Never hardcode
   `bg-white`, `text-black`, `bg-gray-100`, or hex colours.
7. **Accessibility:** every input has a `<Label htmlFor>`; icon-only buttons get
   `aria-label`; async status regions use `role="status"` / `aria-live="polite"`;
   never signal state with colour alone.
8. **Mobile first.** Everything must work at 360 px wide. Tables and wide output scroll
   inside their own `overflow-x-auto` container.

---

## 2. Files you create for each tool

For a tool with slug `merge-pdf`:

| Path | Purpose |
| --- | --- |
| `src/lib/tools/<category>.ts` | one file per category, listing all your tools (see §3) |
| `src/pages/merge-pdf.astro` | the page, a thin wrapper (see §4) |
| `src/components/tools/<category>/MergePdf.tsx` | the React island doing the work |

URLs are **flat and slug-exact**: `/merge-pdf`, `/png-to-jpg`, `/mortgage-calculator`.
Slugs are the keyword people actually search for. Category hub pages
(`/category/pdf`) are generated automatically. Do not write them.

---

## 3. Registry entry (required for every tool)

`src/lib/tools/<category>.ts`:

```ts
import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    h1: 'Merge PDF files online',            // optional, defaults to title
    description:
      'Combine multiple PDFs into one document, reorder pages by drag and drop, and download instantly. Free, private, no upload.', // 110-155 chars
    keywords: ['combine pdf', 'join pdf', 'pdf merger'],
    category: 'pdf',                          // must match your assigned CategoryId
    icon: 'FileStack',                        // a real lucide-react export, PascalCase
    popular: true,                            // 2-4 per category, max
    accepts: ['pdf'],
    faqs: [
      { q: 'Is there a file size limit?', a: 'No. Files are processed by your own device, so the only limit is available memory.' },
    ],                                        // 3-5 per tool
    related: ['split-pdf', 'compress-pdf'],   // slugs, may be from other categories
    updated: '2026-08-16',
  },
]
```

`slug` **must** equal the page filename. `icon` **must** be a real export of
`lucide-react`. Verify it: a wrong name is a build error. Every slug is globally
unique; stay inside the tool list you were assigned so you can't collide.

---

## 4. Page template (copy this exactly)

`src/pages/merge-pdf.astro`:

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
description, the privacy badge, your island, the FAQ accordion, the related-tools rail,
`SoftwareApplication` + `FAQPage` + `BreadcrumbList` JSON-LD, and the footer.

Optional extra content (a "how it works" or explainer section rendered below the tool)
goes in a named slot:

```astro
<ToolLayout slug="merge-pdf">
  <MergePdf client:load />
  <Fragment slot="explainer">
    <h2>How to merge PDF files</h2>
    <p>…</p>
  </Fragment>
</ToolLayout>
```

Use `client:load` for the island (these pages exist only to run the tool).

---

## 5. shadcn/ui: available, canonical API

Import from `@/components/ui/<name>`. All standard shadcn/ui components exist with
their canonical props:

`accordion` · `alert` · `badge` · `button` · `card` · `checkbox` · `dialog` ·
`dropdown-menu` · `input` · `label` · `popover` · `progress` · `radio-group` ·
`select` · `separator` · `skeleton` · `slider` · `switch` · `table` · `tabs` ·
`textarea` · `tooltip`

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
```

`Button` variants: `default | secondary | outline | ghost | link | destructive`,
sizes: `default | sm | lg | icon`.

---

## 6. Shared tool components: available, exact API

Import from `@/components/shared/<name>`.

```tsx
import { FileDropzone } from '@/components/shared/FileDropzone'
// accept: comma-separated extensions/mime, e.g. '.pdf,application/pdf'
<FileDropzone accept=".pdf" multiple onFiles={(files: File[]) => void} maxSizeMb={500}
  title="Drop PDFs here" hint="or click to browse. Files stay on your device" />

import { ToolPanel } from '@/components/shared/ToolPanel'
// The standard card wrapper for a tool's working area.
<ToolPanel title="Options" description="Optional" footer={<Button/>}>…</ToolPanel>

import { ResultStat } from '@/components/shared/ResultStat'
<ResultStat label="Monthly payment" value="$1,432.19" hint="principal + interest" emphasis />

import { DownloadButton } from '@/components/shared/DownloadButton'
<DownloadButton blob={blob} filename="merged.pdf" label="Download PDF" />

import { CopyButton } from '@/components/shared/CopyButton'
<CopyButton value={text} label="Copy" />

import { ProgressPanel } from '@/components/shared/ProgressPanel'
// value 0..100, or omit for an indeterminate bar
<ProgressPanel label="Merging pages…" value={42} />

import { ErrorNote } from '@/components/shared/ErrorNote'
<ErrorNote message="That file isn’t a valid PDF." onRetry={() => void} />

import { FileChips } from '@/components/shared/FileChips'
// Shows selected files with size + remove buttons; supports reordering when onReorder is passed.
<FileChips files={files} onRemove={(i: number) => void} onReorder={(from: number, to: number) => void} />
```

If you need something not on this list, build it **inside your own component file**.
Do not add files to `src/components/shared/`.

---

## 7. Helpers in `@/lib/utils`

`cn`, `formatBytes`, `downloadBlob`, `stripExtension`, `fileExtension`, `clamp`,
`formatNumber`, `formatCurrency`, `slugify`, `nextFrame`.

---

## 8. Library notes (all installed)

- **PDF read/write:** `pdf-lib` (create/merge/split/rotate/watermark/encrypt-free ops).
- **PDF rendering to canvas:** `pdfjs-dist`. Set the worker with a bundler URL:
  ```ts
  import * as pdfjs from 'pdfjs-dist'
  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  ```
- **Image codecs:** `@jsquash/jpeg|png|webp|avif` (`decode`/`encode`) and
  `@jsquash/resize`. These are dynamic-import-only: always `await import(...)` inside
  the handler, never at module top level, so the wasm isn't in the initial bundle.
- **Video/audio:** `@ffmpeg/ffmpeg` + `@ffmpeg/util`. Load lazily on first use, show
  progress via `ffmpeg.on('progress', …)`, and warn that the first run downloads the
  ~30 MB core. Use the single-threaded core (no SharedArrayBuffer requirement).
- **Archives:** `jszip`, `fflate`. **Spreadsheets:** `xlsx`. **CSV:** `papaparse`.
- **Word:** `mammoth` (docx → html/text). **Markdown:** `marked`, `turndown`.
- **Metadata:** `exifr`. **QR/barcode:** `qrcode`, `jsbarcode`.
- **Precision math:** `decimal.js`. Use it for any money calculation.
- **Dates:** `date-fns`.
- **Hashing/crypto:** the browser's native `crypto.subtle`, not a library.

Anything genuinely heavy (>1 s) must run behind a `Web Worker` or be chunked with
`nextFrame()`.

---

## 9. Quality bar

Each tool must be genuinely better than the ad-choked incumbent it competes with:

- Works immediately on load: no signup, no "upgrade to download", no watermarks.
- Sensible defaults; advanced options tucked behind a disclosure.
- Real progress feedback and real error messages ("This PDF is password-protected"),
  never a silent failure or a raw stack trace.
- Batch input where it makes sense; ZIP the output when there are several files.
- Calculators show the formula and the working, not just a number. That's what earns
  the ranking and the backlink.
- Empty, loading, error and success states are all designed.
- Every result is downloadable and/or copyable.
