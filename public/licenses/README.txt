Third-party licences — onthisdevice.com
=======================================

This site redistributes compiled third-party binaries to your browser. The most
significant is a WebAssembly build of FFmpeg, which is copyleft-licensed and
therefore carries obligations we have to meet in public.


1. FFmpeg (WebAssembly core)
----------------------------

Files served:  /ffmpeg/0.12.10/ffmpeg-core.js
               /ffmpeg/0.12.10/ffmpeg-core.wasm.gz (the wasm binary, gzip-compressed;
               your browser inflates it locally)

Source package: @ffmpeg/core 0.12.x  (https://github.com/ffmpegwasm/ffmpeg.wasm)
Declared licence: GPL-2.0-or-later

This build of FFmpeg is configured with GPL-licensed components (notably
libx264, the H.264 encoder used by our MP4 tools). FFmpeg itself is LGPL-2.1+,
but enabling those components makes the resulting binary GPL-2.0-or-later as a
whole.

Because we serve that binary to every visitor who opens a video or audio tool,
onthisdevice.com is a redistributor, and the GPL requires that we:

  (a) pass on the licence with the binary — this notice and the full licence
      text alongside it satisfy that;
  (b) offer the corresponding source code.

WRITTEN OFFER FOR SOURCE
The complete corresponding source for the FFmpeg build we serve, together with
the build scripts used to produce it, is available from the upstream project at
https://github.com/ffmpegwasm/ffmpeg.wasm (the exact revision is pinned by the
@ffmpeg/core version in our package.json) and from FFmpeg itself at
https://ffmpeg.org/download.html. We will also supply it on request through the
contact route published on the site.

We do not modify the FFmpeg build. It is vendored byte-for-byte from the npm
package so that it can be served same-origin — see src/lib/ffmpeg-core.ts for
why that matters.


2. Everything else
------------------

The remaining dependencies are permissively licensed (MIT, Apache-2.0, BSD or
ISC): pdf-lib, pdfjs-dist (Apache-2.0), the @jsquash codecs and their underlying
libjpeg-turbo / libpng / libwebp / libavif builds, SheetJS, mammoth, marked,
turndown, papaparse, jszip, fflate, decimal.js, date-fns, qrcode, jsbarcode,
exifr, utif2, gifenc, imagetracerjs (Unlicense), yaml, js-beautify, smol-toml,
hash-wasm, React, Astro, Tailwind CSS, Radix UI and lucide-react.

A generated, per-dependency licence manifest belongs at /licenses on the site
itself. Until that page exists, `npx license-checker --summary` over the
installed tree is the authoritative list.


libheif (HEIC and HEIF decoder)
-------------------------------

Files served:  the WebAssembly build of libheif, a separate file under /_astro/ that only
               the HEIC and HEIF tools load
Source package: libheif-js 1.23.5 (https://github.com/catdad-experiments/libheif-js), a build
               of libheif (https://github.com/strukturag/libheif)
Licence:       LGPL-3.0, full text in /licenses/libheif-LGPL-3.0.txt. The site loads it
               unchanged as its own module, so it can be replaced with another build of the
               same version.


3. Data tables embedded in the site
-----------------------------------

Several tools embed static reference data (CPI-U inflation figures, VAT rates,
ingredient densities, shoe and clothing size charts, HTTP status codes, MIME
types). Each is factual reference data rather than a creative work, but each
also goes stale. Every such table states its "as of" date on the page that uses
it. There is a maintenance register for them in the project backlog.


Archivo (typeface)
------------------

Files served:  /fonts/archivo-latin.*.woff2
               /fonts/archivo-latin-ext.*.woff2
Changes:       Archivo 2.001, latin and latin-ext subsets, width axis fixed at 100
Licence:       SIL Open Font License 1.1, full text in /licenses/archivo-OFL.txt
