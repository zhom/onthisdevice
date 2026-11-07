# onthisdevice.com

Free file, media and calculation tools that run in the browser. There is no server, account or analytics, so a file cannot leave the device. `public/_headers` enforces this: `connect-src 'self' blob: data:` blocks every other origin. A change that adds a host there is wrong.

## Stack

Astro (static output), React islands, Tailwind, WebAssembly. FFmpeg, jSquash, pdf.js and ONNX Runtime do the media and detection work. Rust in `rust/` does the heavy math: factoring, prime sieves, file hashes and retirement simulations. It compiles to `src/lib/engine/engine.wasm`, which runs on a pool of workers.

## Develop

Requires Node 22.12 or later. Run `npm run build:engine` after a change in `rust/` and commit `engine.wasm`. CI rebuilds it and fails if the bytes differ.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run preview
npm run smoke
```

## Add a tool

1. Add an entry to a module in `src/lib/tools/`. It drives search, navigation, SEO and the sitemap.
2. Build the island in `src/components/tools/<category>/`.
3. Add `src/pages/<slug>.astro`. A tool in `ai.ts`, `convert.ts`, `calculators.ts` or `text-dev.ts` can skip this: `src/pages/[slug].astro` renders it through the `Page.astro` of its folder.

`scripts/registry-test.mjs` (part of `npm test`) fails on a duplicate slug, a tool without a page, an unknown icon or a broken related link. [CONTRACT.md](CONTRACT.md) has the rules and the page template.

## Deployment

`npm run deploy` publishes `dist/` to Cloudflare Workers static assets. `npm run build:ci` also fetches the detection models. The host serves no file above 25 MiB, and `scripts/postbuild.mjs` fails the build on one. `.github/workflows/data.yml` refreshes the data sets on a schedule.

## License

All rights reserved. Contact: contact@geolara.com
