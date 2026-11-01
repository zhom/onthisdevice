#!/usr/bin/env node
/**
 * Re-vendor the single-threaded FFmpeg core into public/ffmpeg/.
 *
 * The wasm binary (~32 MB) is larger than a single static asset may be on the
 * host (25 MiB), so it ships gzip-compressed and the page decompresses it with
 * DecompressionStream before handing ffmpeg a blob: URL. Everything stays on
 * this origin.
 *
 *   node scripts/vendor-ffmpeg.mjs
 *
 * Then copy the printed byte counts into src/lib/ffmpeg-core.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const src = 'node_modules/@ffmpeg/core/dist/esm'
const version = JSON.parse(fs.readFileSync('node_modules/@ffmpeg/core/package.json', 'utf8')).version
// A versioned folder, so the year-long immutable cache can never serve a stale core.
fs.rmSync('public/ffmpeg', { recursive: true, force: true })
const out = `public/ffmpeg/${version}`
fs.mkdirSync(out, { recursive: true })

fs.copyFileSync(path.join(src, 'ffmpeg-core.js'), path.join(out, 'ffmpeg-core.js'))
const wasm = fs.readFileSync(path.join(src, 'ffmpeg-core.wasm'))
const gz = zlib.gzipSync(wasm, { level: 9 })
fs.writeFileSync(path.join(out, 'ffmpeg-core.wasm.gz'), gz)

const js = fs.statSync(path.join(out, 'ffmpeg-core.js')).size
console.log(`@ffmpeg/core ${version}`)
console.log(`FFMPEG_CORE_JS_BYTES = ${js}`)
console.log(`FFMPEG_CORE_WASM_BYTES = ${wasm.length}`)
console.log(`FFMPEG_WASM_GZ_BYTES = ${gz.length}`)
