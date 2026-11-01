#!/usr/bin/env node
/**
 * Draws the site icons from the mark (run once after changing the mark):
 * public/favicon.svg, public/favicon.ico (16/32/48), public/icons/*.png.
 *   node scripts/icons.mjs
 */
import fs from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const INK = '#000000'
const PAPER = '#ffffff'

// The mark: your file (the square) held inside the device (the frame).
const mark = (ink) =>
  `<rect x="2.25" y="2.25" width="19.5" height="19.5" rx="5" fill="none" stroke="${ink}" stroke-width="2.5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="${ink}"/>`

// Tab icon: transparent, follows the browser's colour scheme.
fs.writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.k{stroke:${INK}}.f{fill:${INK}}@media (prefers-color-scheme:dark){.k{stroke:${PAPER}}.f{fill:${PAPER}}}</style><rect class="k" x="2.25" y="2.25" width="19.5" height="19.5" rx="5" fill="none" stroke-width="2.5"/><rect class="f" x="9" y="9" width="6" height="6" rx="1"/></svg>\n`,
)

// App icons: the mark in paper on an ink tile.
const tile = (size, pad) => {
  const s = 24 / (1 - 2 * pad)
  const o = (s - 24) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-o} ${-o} ${s} ${s}"><rect x="${-o}" y="${-o}" width="${s}" height="${s}" fill="${INK}"/>${mark(PAPER)}</svg>`
}
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()
fs.mkdirSync('public/icons', { recursive: true })
fs.writeFileSync('public/icons/icon-192.png', png(tile(192, 0.16), 192))
fs.writeFileSync('public/icons/icon-512.png', png(tile(512, 0.16), 512))
fs.writeFileSync('public/icons/maskable-512.png', png(tile(512, 0.24), 512))
fs.writeFileSync('public/icons/apple-touch-icon.png', png(tile(180, 0.18), 180))

// favicon.ico: three PNG frames of the mark on a paper square (no theme in .ico).
const plain = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="${PAPER}"/>${mark(INK)}</svg>`
const frames = [16, 32, 48].map((n) => ({ n, data: png(plain(n), n) }))
const head = Buffer.alloc(6 + 16 * frames.length)
head.writeUInt16LE(0, 0)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(frames.length, 4)
let offset = head.length
frames.forEach((f, i) => {
  const at = 6 + i * 16
  head.writeUInt8(f.n, at)
  head.writeUInt8(f.n, at + 1)
  head.writeUInt16LE(1, at + 4)
  head.writeUInt16LE(32, at + 6)
  head.writeUInt32LE(f.data.length, at + 8)
  head.writeUInt32LE(offset, at + 12)
  offset += f.data.length
})
fs.writeFileSync('public/favicon.ico', Buffer.concat([head, ...frames.map((f) => f.data)]))
console.log('icons written')
