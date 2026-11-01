#!/usr/bin/env node
/**
 * Builds the small input files the smoke harness feeds to file tools.
 * Output: scripts/smoke/fixtures/ (not shipped; regenerate any time).
 *
 *   node scripts/smoke/fixtures.mjs
 *
 * Needs a local ffmpeg on PATH for the audio/video samples, and the Playwright
 * Chromium build for PNG/JPEG/WebP (drawn on a canvas so they are real images).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { chromium } from 'playwright'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'fixtures')
fs.mkdirSync(OUT, { recursive: true })
const out = (name) => path.join(OUT, name)
const write = (name, data) => fs.writeFileSync(out(name), data)

/* ── PDFs ─────────────────────────────────────────────────────────────── */
async function pdf(name, pages, { form = false } = {}) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Sample ${name}`)
  doc.setAuthor('Smoke harness')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`Sample document, page ${i} of ${pages}`, { x: 60, y: 760, size: 22, font })
    page.drawText('The quick brown fox jumps over the lazy dog. 0123456789', { x: 60, y: 720, size: 12, font })
    for (let l = 0; l < 18; l++) {
      page.drawText(`Line ${l + 1}: invoice total 1,234.56 due 2026-10-01.`, { x: 60, y: 680 - l * 18, size: 11, font })
    }
    page.drawRectangle({ x: 60, y: 200, width: 200, height: 80, color: rgb(0.2, 0.5, 0.35) })
  }
  if (form) {
    const f = doc.getForm()
    const page = doc.getPage(0)
    const name = f.createTextField('full_name')
    name.setText('Ada Lovelace')
    name.addToPage(page, { x: 320, y: 220, width: 200, height: 24 })
    const agree = f.createCheckBox('agree')
    agree.addToPage(page, { x: 320, y: 180, width: 16, height: 16 })
  }
  write(name, await doc.save())
}
await pdf('sample.pdf', 3)
await pdf('sample-2.pdf', 2)
await pdf('form.pdf', 1, { form: true })

// Landscape pages, for split-in-half.
{
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 2; i++) {
    const page = doc.addPage([842, 595])
    page.drawText(`Left half ${i}`, { x: 80, y: 300, size: 28, font })
    page.drawText(`Right half ${i}`, { x: 500, y: 300, size: 28, font })
  }
  write('wide.pdf', await doc.save())
}

/* ── Encrypted PDF: standard security handler, revision 3, RC4 128-bit ──
 * Written by hand (ISO 32000-1 §7.6.3) so no external tool is needed.
 * User password "secret", owner password "owner". */
{
  const { PDFName, PDFNumber, PDFDict, PDFArray, PDFString, PDFHexString, PDFRawStream } = await import('pdf-lib')
  const crypto = await import('node:crypto')
  const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex')
  const md5 = (...parts) => crypto.createHash('md5').update(Buffer.concat(parts)).digest()
  const rc4 = (key, data) => {
    const s = Array.from({ length: 256 }, (_, i) => i)
    for (let i = 0, j = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 255
      ;[s[i], s[j]] = [s[j], s[i]]
    }
    const outBytes = Buffer.alloc(data.length)
    for (let n = 0, i = 0, j = 0; n < data.length; n++) {
      i = (i + 1) & 255
      j = (j + s[i]) & 255
      ;[s[i], s[j]] = [s[j], s[i]]
      outBytes[n] = data[n] ^ s[(s[i] + s[j]) & 255]
    }
    return outBytes
  }
  const pad = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32)
  const rc4Rounds = (key, data) => {
    let d = rc4(key, data)
    for (let r = 1; r <= 19; r++) d = rc4(Buffer.from(key.map((b) => b ^ r)), d)
    return d
  }
  const n = 16
  const P = -3904 // print + copy + modify allowed, everything else per spec bits
  const id = crypto.randomBytes(16)
  // Algorithm 3: O entry.
  let ok = md5(pad('owner'))
  for (let i = 0; i < 50; i++) ok = md5(ok)
  const O = rc4Rounds(ok.subarray(0, n), pad('secret'))
  // Algorithm 2: file key.
  const pBytes = Buffer.alloc(4)
  pBytes.writeInt32LE(P)
  let key = md5(pad('secret'), O, pBytes, id)
  for (let i = 0; i < 50; i++) key = md5(key.subarray(0, n))
  key = key.subarray(0, n)
  // Algorithm 5: U entry.
  const U = Buffer.concat([rc4Rounds(key, md5(PAD, id)), Buffer.alloc(16)])

  const plain = await PDFDocument.create({ updateMetadata: false })
  const font = await plain.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 2; i++) {
    const page = plain.addPage([595, 842])
    page.drawText(`Locked document, page ${i}`, { x: 60, y: 760, size: 22, font })
  }
  plain.setTitle('Locked sample')
  const doc = await PDFDocument.load(await plain.save({ useObjectStreams: false }), { updateMetadata: false })
  const objKey = (ref) => {
    const b = Buffer.alloc(5)
    b.writeUIntLE(ref.objectNumber, 0, 3)
    b.writeUInt16LE(ref.generationNumber, 3)
    return md5(key, b).subarray(0, Math.min(n + 5, 16))
  }
  const enc = (obj, k) => {
    if (obj instanceof PDFString || obj instanceof PDFHexString) return PDFHexString.of(rc4(k, Buffer.from(obj.asBytes())).toString('hex'))
    if (obj instanceof PDFDict) {
      for (const [name, value] of obj.entries()) obj.set(name, enc(value, k))
      return obj
    }
    if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) obj.set(i, enc(obj.get(i), k))
      return obj
    }
    return obj
  }
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const k = objKey(ref)
    if (obj instanceof PDFRawStream) {
      enc(obj.dict, k)
      doc.context.assign(ref, PDFRawStream.of(obj.dict, rc4(k, Buffer.from(obj.contents))))
    } else enc(obj, k)
  }
  const encrypt = doc.context.obj({
    Filter: PDFName.of('Standard'),
    V: 2,
    R: 3,
    Length: 128,
    P: PDFNumber.of(P),
    O: PDFHexString.of(O.toString('hex')),
    U: PDFHexString.of(U.toString('hex')),
  })
  doc.context.trailerInfo.Encrypt = doc.context.register(encrypt)
  const idHex = PDFHexString.of(id.toString('hex'))
  doc.context.trailerInfo.ID = doc.context.obj([idHex, idHex])
  write('encrypted.pdf', await doc.save({ useObjectStreams: false, updateFieldAppearances: false }))
}

/* ── Text-ish formats ─────────────────────────────────────────────────── */
write('sample.txt', 'Hello from the smoke harness.\nSecond line, with some words.\nThird line: 42 apples.\n')
write('sample.md', '# Sample heading\n\nSome *emphasis* and a [link](https://example.com).\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n')
write('sample.csv', 'name,age,city\nAda,36,London\nAlan,41,Wilmslow\nGrace,85,Arlington\n')
write('sample.tsv', 'name\tage\tcity\nAda\t36\tLondon\nAlan\t41\tWilmslow\n')
write('sample.json', JSON.stringify({ name: 'Ada', tags: ['math', 'engines'], nested: { born: 1815, alive: false } }, null, 2))
write('sample.xml', '<?xml version="1.0"?>\n<people><person id="1"><name>Ada</name><age>36</age></person><person id="2"><name>Alan</name><age>41</age></person></people>\n')
write('sample.yaml', 'name: Ada\ntags:\n  - math\n  - engines\nnested:\n  born: 1815\n')
write('sample.html', '<!doctype html><html><head><title>Sample</title></head><body><h1>Sample</h1><p>Hello <strong>world</strong>.</p></body></html>\n')
write('sample.sql', 'select id, name from users where age > 30 order by name;\n')
write('sample.srt', '1\n00:00:00,500 --> 00:00:01,800\nHello there.\n\n2\n00:00:02,000 --> 00:00:03,500\nSecond subtitle.\n')
write('sample.vtt', 'WEBVTT\n\n00:00:00.500 --> 00:00:01.800\nHello there.\n\n00:00:02.000 --> 00:00:03.500\nSecond subtitle.\n')
write('sample.log', '2026-10-01T10:00:00Z INFO started\n2026-10-01T10:00:01Z WARN slow\n2026-10-01T10:00:02Z ERROR failed\n')
// Encoded text, for the decoders (hex, binary, octal, decimal → text).
write('hex.txt', '48 65 6c 6c 6f 2c 20 77 6f 72 6c 64\n')
write('binary.txt', '01001000 01100101 01101100 01101100 01101111\n')
write('octal.txt', '110 145 154 154 157\n')
write('decimal.txt', '72 101 108 108 111\n')
write('escaped.txt', '"{\\"name\\":\\"Ada\\",\\"line\\":\\"one\\\\ntwo\\"}"\n')
write('sample.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><rect width="200" height="120" fill="#2a7a52"/><circle cx="60" cy="60" r="36" fill="#f5a623"/><text x="110" y="68" font-size="20" fill="#fff">SVG</text></svg>\n')

/* ── DOCX (minimal, valid) ────────────────────────────────────────────── */
{
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Sample heading</w:t></w:r></w:p><w:p><w:r><w:t>Hello from a Word document. It has </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:t xml:space="preserve"> text.</w:t></w:r></w:p></w:body></w:document>')
  write('sample.docx', await zip.generateAsync({ type: 'nodebuffer' }))
}

/* ── Spreadsheets ─────────────────────────────────────────────────────── */
{
  const ws = XLSX.utils.aoa_to_sheet([['name', 'age', 'city'], ['Ada', 36, 'London'], ['Alan', 41, 'Wilmslow']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'People')
  write('sample.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  write('sample.ods', XLSX.write(wb, { type: 'buffer', bookType: 'ods' }))
  write('sample.xls', XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }))
}

/* ── Raster images: drawn in Chromium so they are real encodes ────────── */
{
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const images = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 420
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 640, 420)
    grad.addColorStop(0, '#1d5c40')
    grad.addColorStop(1, '#e8b04a')
    g.fillStyle = grad
    g.fillRect(0, 0, 640, 420)
    g.fillStyle = '#fff'
    g.font = 'bold 56px sans-serif'
    g.fillText('Sample 640×420', 40, 120)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `hsl(${i * 9} 70% 55%)`
      g.beginPath()
      g.arc(40 + (i % 10) * 62, 200 + Math.floor(i / 10) * 52, 20, 0, Math.PI * 2)
      g.fill()
    }
    const enc = (type, q) =>
      new Promise((res) => c.toBlob(async (b) => res(Array.from(new Uint8Array(await b.arrayBuffer()))), type, q))
    return { png: await enc('image/png'), jpg: await enc('image/jpeg', 0.92), webp: await enc('image/webp', 0.9) }
  })
  write('sample.png', Buffer.from(images.png))
  write('sample.jpg', Buffer.from(images.jpg))
  write('sample.webp', Buffer.from(images.webp))
  await browser.close()
}

// A PDF with an embedded JPEG, for image extraction.
{
  const doc = await PDFDocument.create()
  const jpg = await doc.embedJpg(fs.readFileSync(out('sample.jpg')))
  const page = doc.addPage([595, 842])
  page.drawImage(jpg, { x: 60, y: 400, width: 480, height: 315 })
  write('images.pdf', await doc.save())
}

/* ── JPEG with an EXIF APP1 segment (camera, date, GPS) ───────────────── */
{
  // Little-endian TIFF: IFD0 → Exif IFD + GPS IFD. Values that do not fit in
  // 4 bytes go to a data area after the IFDs.
  const entries = (list) => list
  const ascii = (s) => Buffer.from(`${s}\0`, 'latin1')
  const rational = (pairs) => {
    const b = Buffer.alloc(pairs.length * 8)
    pairs.forEach(([num, den], i) => {
      b.writeUInt32LE(num, i * 8)
      b.writeUInt32LE(den, i * 8 + 4)
    })
    return b
  }
  const ifds = [
    entries([
      { tag: 0x010f, type: 2, value: ascii('SmokeCam') },
      { tag: 0x0110, type: 2, value: ascii('Model 1') },
      { tag: 0x0112, type: 3, short: 1 },
      { tag: 0x0131, type: 2, value: ascii('Smoke harness') },
      { tag: 0x0132, type: 2, value: ascii('2026:10:01 10:00:00') },
      { tag: 0x8769, type: 4, ifd: 1 },
      { tag: 0x8825, type: 4, ifd: 2 },
    ]),
    entries([
      { tag: 0x9003, type: 2, value: ascii('2026:10:01 10:00:00') },
      { tag: 0xa002, type: 4, long: 640 },
      { tag: 0xa003, type: 4, long: 420 },
    ]),
    entries([
      { tag: 0x0001, type: 2, value: ascii('N') },
      { tag: 0x0002, type: 5, value: rational([[51, 1], [30, 1], [0, 1]]) },
      { tag: 0x0003, type: 2, value: ascii('W') },
      { tag: 0x0004, type: 5, value: rational([[0, 1], [7, 1], [0, 1]]) },
    ]),
  ]
  const ifdSize = (list) => 2 + list.length * 12 + 4
  const offsets = []
  let at = 8
  for (const list of ifds) {
    offsets.push(at)
    at += ifdSize(list)
  }
  let dataAt = at
  const data = []
  const tiff = Buffer.alloc(at)
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  ifds.forEach((list, k) => {
    let p = offsets[k]
    tiff.writeUInt16LE(list.length, p)
    p += 2
    for (const e of list) {
      tiff.writeUInt16LE(e.tag, p)
      tiff.writeUInt16LE(e.type, p + 2)
      if (e.ifd !== undefined) {
        tiff.writeUInt32LE(1, p + 4)
        tiff.writeUInt32LE(offsets[e.ifd], p + 8)
      } else if (e.short !== undefined) {
        tiff.writeUInt32LE(1, p + 4)
        tiff.writeUInt16LE(e.short, p + 8)
      } else if (e.long !== undefined) {
        tiff.writeUInt32LE(1, p + 4)
        tiff.writeUInt32LE(e.long, p + 8)
      } else {
        const count = e.type === 5 ? e.value.length / 8 : e.value.length
        tiff.writeUInt32LE(count, p + 4)
        if (e.value.length <= 4) e.value.copy(tiff, p + 8)
        else {
          tiff.writeUInt32LE(dataAt, p + 8)
          data.push(e.value)
          dataAt += e.value.length + (e.value.length % 2)
          if (e.value.length % 2) data.push(Buffer.alloc(1))
        }
      }
      p += 12
    }
    tiff.writeUInt32LE(0, p)
  })
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, ...data])
  const app1 = Buffer.alloc(4)
  app1.writeUInt16BE(0xffe1, 0)
  app1.writeUInt16BE(payload.length + 2, 2)
  const jpg = fs.readFileSync(out('sample.jpg'))
  // Insert right after SOI, before the encoder's own APP0 (JFIF) segment.
  write('exif.jpg', Buffer.concat([jpg.subarray(0, 2), app1, payload, jpg.subarray(2)]))
}

const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
ff('-i', out('sample.png'), out('sample.gif'))
ff('-i', out('sample.png'), out('sample.bmp'))
ff('-i', out('sample.png'), out('sample.tiff'))
try {
  ff('-i', out('sample.png'), '-c:v', 'libsvtav1', '-pix_fmt', 'yuv420p', '-frames:v', '1', '-f', 'avif', out('sample.avif'))
} catch {
  console.warn('avif: encoder unavailable, skipped')
}
// Animated GIF for GIF tools.
ff('-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=8:duration=1.5', out('animated.gif'))

// ICO: a one-image container that wraps a 32×32 PNG.
{
  ff('-i', out('sample.png'), '-vf', 'scale=32:32', out('ico32.png'))
  const png = fs.readFileSync(out('ico32.png'))
  const head = Buffer.alloc(22)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  head.writeUInt8(32, 6)
  head.writeUInt8(32, 7)
  head.writeUInt16LE(1, 10)
  head.writeUInt16LE(32, 12)
  head.writeUInt32LE(png.length, 14)
  head.writeUInt32LE(22, 18)
  write('sample.ico', Buffer.concat([head, png]))
  fs.rmSync(out('ico32.png'))
}

/* ── Audio and video (2 s, tiny) ──────────────────────────────────────── */
const SRC = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2']
ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out('sample.mp4'))
ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out('sample.mov'))
ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out('sample.m4v'))
ff(...SRC, '-c:v', 'libvpx', '-b:v', '300k', '-c:a', 'libopus', '-shortest', out('sample.webm'))
ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out('sample.mkv'))
ff(...SRC, '-c:v', 'mpeg4', '-c:a', 'libmp3lame', '-shortest', out('sample.avi'))
ff(...SRC, '-c:v', 'mpeg1video', '-c:a', 'mp2', '-shortest', '-f', 'mpeg', out('sample.mpg'))
ff(...SRC, '-c:v', 'mpeg4', '-c:a', 'aac', '-ar', '16000', '-ac', '1', '-shortest', '-f', '3gp', out('sample.3gp'))
const TONE = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2']
ff(...TONE, out('sample.wav'))
ff(...TONE, '-c:a', 'libmp3lame', out('sample.mp3'))
ff(...TONE, '-c:a', 'libopus', out('sample.ogg'))
ff(...TONE, '-c:a', 'libopus', out('sample.opus'))
ff(...TONE, '-c:a', 'libopus', '-f', 'webm', out('sample.weba'))
ff(...TONE, '-c:a', 'aac', out('sample.m4a'))
ff(...TONE, '-c:a', 'aac', '-f', 'adts', out('sample.aac'))
ff(...TONE, '-c:a', 'flac', out('sample.flac'))
ff(...TONE, out('sample.aiff'))
ff(...TONE, '-c:a', 'wmav2', out('sample.wma'))

/* ── Archives and iWork packages (zip with an embedded preview) ───────── */
{
  const zip = new JSZip()
  zip.file('hello.txt', 'hello')
  zip.file('data/sample.csv', fs.readFileSync(out('sample.csv')))
  write('sample.zip', await zip.generateAsync({ type: 'nodebuffer' }))
  for (const ext of ['pages', 'numbers', 'key']) {
    const z = new JSZip()
    z.file('preview.jpg', fs.readFileSync(out('sample.jpg')))
    z.file('QuickLook/Thumbnail.jpg', fs.readFileSync(out('sample.jpg')))
    z.file('Index/Document.iwa', Buffer.from([0]))
    write(`sample.${ext}`, await z.generateAsync({ type: 'nodebuffer' }))
  }
}

const files = fs.readdirSync(OUT).sort()
console.log(`${files.length} fixtures in ${path.relative(process.cwd(), OUT)}:`, files.join(' '))
