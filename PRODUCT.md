# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Confirmed by the brief: people who arrive from a search engine with one specific
file or number problem and want it solved immediately: "merge these PDFs",
"get this photo under 100 KB for a visa form", "what's 15% of 80", "convert this
MOV so I can send it".

**[inferred]** Three recurring situations, all one-shot and impatient:

- **The uploader who shouldn't be uploading.** A contract, a passport scan, a
  payslip, a medical PDF, an internal spreadsheet. They reach an upload-based
  converter, hesitate, and either proceed uneasily or leave. This is the user
  the product exists for.
- **The blocked-by-a-limit user.** Their file is 300 MB, or it's the 21st image
  today, or the download is behind a signup wall or stamped with a watermark.
- **The quick-answer user.** A calculator or converter query, wanting the number
  and the working, not an ad-choked page that takes six seconds to paint.

No accounts exist, so there are no returning-user or role distinctions to design
for. Every visit is effectively a first visit from a search result, landing
directly on a deep tool page, not on the homepage.

## Product Purpose

onthisdevice.com performs file conversion, document manipulation, media
processing and calculation entirely inside the visitor's browser, using
WebAssembly. Nothing is uploaded, queued, or stored; there is no server that
could receive a file.

Success is a visitor completing their task on the first page they land on,
without an account, an upload, a watermark, a queue, or a size cap. For the
file-sensitive user, success also means being able to *verify* that the file never left the
machine rather than being asked to trust a claim.

## Positioning

The mechanism is the position: **there is no server**. Competitors are
upload-based services: the file goes to their infrastructure, which is what forces their size caps, batch limits,
queues, retention windows and paywalls, and what makes their privacy policy a
promise rather than a fact.

Because computation happens on the visitor's own hardware, several things stop
being product decisions and become structural properties a competitor cannot
copy without rebuilding their architecture:

- No file size limit beyond the device's own memory.
- No batch cap, no queue, no per-day quota.
- Works offline once cached.
- **Iterative work is free.** Hitting an exact byte target ("compress to exactly
  100 KB") needs 10-15 encode attempts. That is trivial locally and financially
  ruinous per-request on someone else's servers. This is the sharpest wedge in
  the product and it should be exploited everywhere it applies.
- The privacy claim is enforced by a Content-Security-Policy with no
  third-party origin in `connect-src`, not asserted in a policy document.

The honest limits of the position, which must never be papered over: no OCR, no
HEIC decode, no AI/background removal, no live data (exchange rates, IP lookup),
and anything genuinely heavy is bounded by the visitor's device.

## Operating Context

- Entry is almost always a deep link from search to a single tool page. The
  homepage is not the front door; every tool page is.
- Mobile is a first-class case, not a fallback: "compress image to 100 KB for a
  government form" is overwhelmingly a phone task. **[inferred]**
- Tools are used under mild duress: an upload deadline, a form that rejected a
  file, a document due. Speed to first result outranks depth of features.
- Several tools need real hardware permissions (camera, microphone, screen
  capture) and a first-run 10 MB (compressed) WebAssembly download for video work.
- Deployment is Cloudflare Workers static assets (`wrangler.jsonc`). There is no backend, no database, and no runtime origin.

## Capabilities and Constraints

**Built:** ~195 registered tools across 16 categories: PDF manipulation and
conversion, image conversion and editing, video/audio via FFmpeg, documents and
data (CSV/JSON/YAML/Excel/Word/Markdown), and calculators for finance, health,
math, units, date/time, text, developer, security, generators and everyday use.
Flat SEO-exact URLs (`/merge-pdf`), a central tool registry driving navigation,
search, sitemap, related-tool links and structured data.

**Hard technical constraints:**

- Astro static output; React islands; Tailwind v4; shadcn/ui. No SSR, no API
  routes, no runtime origin.
- **No network calls at runtime, ever.** This is the product, not a preference.
  It rules out currency conversion, IP/DNS tools, remote fonts, analytics and
  CDN-loaded assets. The FFmpeg core is vendored to `public/ffmpeg/` for exactly
  this reason.
- Fixed dependency set. Adding one is a product decision, because several
  high-traffic tools (`qr-code-scanner`, YAML validation, bcrypt, OCR, HEIC) are
  blocked only by a missing library, and hand-rolling those is a correctness or
  security trap.
- Work must not block the main thread; heavy jobs need determinate progress and
  chunking or workers.
- The FFmpeg core is **GPL-2.0-or-later** and we redistribute it, which carries
  a licence-text and source-offer obligation (`public/licenses/README.txt`).

**Explicitly undecided:** the funding model. There are no ads, no accounts and
no paid tier, and no decision has been made about how the site sustains itself.
Future work must not invent one, and must not introduce anything that would
recreate the trust surface the architecture removes.

## Brand Commitments

- Name and domain: **onthisdevice.com**. The name is the promise; keep the two
  fused.
- No ads, no accounts, no tracking, no analytics, no watermarks, no upsell
  interstitials, no gated downloads. **[inferred as binding from the brief's
  framing, but treat as core: it is the entire reason to prefer this site.]**
- Voice: plain, technically literal, unhyped. State what a tool does and what it
  cannot do. The privacy claim is strongest when stated flatly and made
  checkable; it becomes noise if repeated as a slogan.

## Evidence on Hand

- The working product: ~195 tools in `src/`, registry in `src/lib/tools/`.
- `CONTRACT.md`: the build contract (file ownership, component APIs, quality bar).
- Strategy documents in the session scratchpad: `round2-plan.md` (90 further
  tools), `round3-plan.md`, `seo-content-briefs.md`, `pwa-performance-spec.md`,
  `ux-polish-backlog.md`, `EXECUTION-BACKLOG.md`.
- The CSP in `public/_headers` is real, shipped evidence for the privacy claim.

**Absences future work must not fabricate:** no users, no traffic, no testimonials,
no press, no benchmarks, no uptime or accuracy statistics, no named maintainer or
legal entity, and no launch date. The site has never been deployed and the build
has never successfully run.

## Product Principles

1. **The absence of a server is the product.** Every feature decision is
   measured by whether it exploits that or erodes it. A single third-party
   request would cost more than any feature it enabled.
2. **Prove, don't claim.** Privacy is demonstrated by verifiable artifacts (a
   CSP with no external origin, working offline, an inspectable network tab),
   not by a badge saying "secure".
3. **Be honest about limits, prominently.** "This PDF is a scan and has no text
   layer" earns more trust than a silently empty result. Never ship a tool that
   looks like it worked when it didn't.
4. **Do the thing servers can't afford to.** Unlimited size, unlimited batch,
   and iterate-to-an-exact-target. Where a competitor's constraint is economic
   rather than technical, take the ground.
5. **Show the working.** Calculators render the formula with the user's numbers
   substituted; converters state their method and precision. This is both the
   ranking wedge and the trust mechanism.

## Accessibility & Inclusion

No external standard has been mandated by the user. **[inferred]** requirement
from the product's nature: these are utility pages reached under time pressure,
so keyboard operability, correct labelling, live-region progress and
colour-independent status are baseline. The canvas-driven tools (crop,
signature, redaction, meme, colour picker) each need a documented keyboard
alternative. That is the known hard gap, not an incidental one.
