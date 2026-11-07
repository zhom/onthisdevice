/** Registry entries for the image pair pages. */
import type { Faq, Tool } from '@/lib/tools/types'
import { fitDescription } from '@/lib/convert/units/registry'
import { FORMATS, IMAGE_PAIRS, type ImagePairSpec } from './formats'

const LOSSY = new Set(['jpg', 'webp', 'avif', 'pdf'])

function pairFaq(p: ImagePairSpec): Faq | null {
  const A = FORMATS[p.from].label
  if (p.from === 'heic' || p.from === 'heif')
    return {
      q: `Why can't my computer open ${A} files?`,
      a: `${A} images are compressed with HEVC, a video codec that most browsers and many Windows programs do not include. This page carries its own HEIF decoder, compiled to WebAssembly, so it reads ${A} in any current browser.`,
    }
  if (p.from === 'tiff')
    return {
      q: 'What happens to a TIFF with several pages?',
      a: p.to === 'pdf' || p.to === 'tiff' ? 'Every page is kept, in order.' : `Each page becomes its own ${FORMATS[p.to].label} file, numbered -1, -2 and so on. Use Download all to get them as one ZIP.`,
    }
  if (p.to === 'svg')
    return {
      q: 'How does the tracing work?',
      a: 'The image is reduced to a few colours, the edge of each colour area is followed, and the edges become straight lines and curves in an SVG. Fewer colours and lower detail give simpler shapes and a smaller file. Photos keep their look only with many colours, which makes large files.',
    }
  if (p.from === 'gif' || p.to === 'gif' || p.from === 'webp')
    return {
      q: 'Is the animation kept?',
      a:
        (p.to === 'gif' || p.to === 'webp') && (p.from === 'gif' || p.from === 'webp')
          ? 'Yes, in browsers that can read the frames of an animation, which most current desktop browsers can. Each frame keeps its timing. Where the browser cannot, the first frame is converted.'
          : p.from === 'gif'
            ? `No. ${FORMATS[p.to].label} holds a single image, so the first frame of an animated GIF is converted. Use Split GIF for every frame.`
            : 'A still image becomes a single-frame GIF.',
    }
  if (p.to === 'ico')
    return {
      q: 'Which sizes should an icon have?',
      a: 'For a favicon, 16, 32 and 48 pixels cover browser tabs and shortcuts. Desktop icons also use 64, 128 and 256 pixels. Each size is stored once in the ICO file, so the operating system picks the best one.',
    }
  if (p.from === 'jfif')
    return {
      q: 'What is the difference between JFIF and JPG?',
      a: 'None in the image data. JFIF is the standard file layout of JPEG images, and .jfif is only an extension. Renaming the file to .jpg is enough, and that is what this page does unless you ask it to re-encode.',
    }
  if (p.to === 'bmp' || p.from === 'bmp')
    return {
      q: 'Why are BMP files so large?',
      a: 'BMP usually stores every pixel without compression: 3 bytes per pixel, or 4 with transparency. A 4000 × 3000 photo is about 36 MB as a 24-bit BMP and 3 to 5 MB as a JPG.',
    }
  if (p.to === 'pdf')
    return {
      q: 'What page size does the PDF use?',
      a: 'By default each page has the size of its image at 96 pixels per inch. Choose A4 or US Letter to fit each image on a standard page with a 1 cm margin, turned to landscape when the image is wide.',
    }
  if (p.from === 'svg')
    return {
      q: 'What resolution does the result have?',
      a: 'An SVG has no fixed resolution, so you choose the width in pixels and the height follows the drawing proportions. The vectors are drawn fresh at that size, so edges stay sharp.',
    }
  return null
}

function faqs(p: ImagePairSpec): Faq[] {
  const A = FORMATS[p.from].label
  const B = FORMATS[p.to].label
  const out: Faq[] = []
  const extra = pairFaq(p)
  if (extra) out.push(extra)
  out.push({
    q: `Does converting ${A} to ${B} lose quality?`,
    a:
      p.from === 'jfif' && p.to === 'jpg'
        ? 'No. By default the JPEG data is copied unchanged.'
        : LOSSY.has(p.to)
          ? `${B} compresses with some loss. At quality 85 most photos look the same as the original, and you can raise the quality for a larger, closer file.`
          : p.to === 'gif'
            ? 'GIF keeps at most 256 colours, so photos and gradients lose colour detail. Flat graphics with few colours keep their look.'
            : p.to === 'svg'
              ? 'Tracing approximates the image with shapes, so fine detail and gradients are simplified.'
              : `No. ${B} stores the decoded pixels without loss.`,
  })
  out.push({
    q: 'Can I convert several files at once?',
    a: `Yes. Drop as many ${A} files as you like. ${p.to === 'pdf' ? 'They become pages of one PDF.' : 'Download each result, or all of them as one ZIP.'}`,
  })
  out.push({
    q: 'Are my images uploaded?',
    a: 'No. The decoders and encoders run in this browser tab, and the page has no server to send files to. It works with the network switched off once it has loaded.',
  })
  return out
}

function description(p: ImagePairSpec): string {
  const A = FORMATS[p.from].label
  const B = FORMATS[p.to].label
  return fitDescription([
    `Convert ${A} to ${B} in your browser. ${p.note} Batch input, ZIP download, no upload.`,
    `Convert ${A} to ${B} on your device. ${p.note} No upload.`,
    `Convert ${A} images to ${B} in your browser, one file or many at once, with a ZIP download. Nothing is uploaded.`,
    `Convert ${A} to ${B} in your browser. ${p.note}`,
  ])
}

export const imageTools: Tool[] = IMAGE_PAIRS.map((p) => {
  const A = FORMATS[p.from].label
  const B = FORMATS[p.to].label
  const siblings = IMAGE_PAIRS.filter((x) => x.slug !== p.slug && (x.from === p.from || x.to === p.to)).map((x) => x.slug)
  const reverse = IMAGE_PAIRS.find((x) => x.from === p.to && x.to === p.from)?.slug
  return {
    slug: p.slug,
    title: `${A} to ${B}`,
    h1: `Convert ${A} to ${B}`,
    description: description(p),
    keywords: [`${A.toLowerCase()} to ${B.toLowerCase()} converter`, `convert ${A.toLowerCase()} to ${B.toLowerCase()}`, ...p.keywords],
    category: p.to === 'pdf' ? 'pdf-convert' : 'image-convert',
    icon: p.to === 'svg' ? 'PenTool' : p.to === 'pdf' ? 'FileImage' : p.to === 'ico' ? 'AppWindow' : 'Images',
    accepts: FORMATS[p.from].ext,
    faqs: faqs(p),
    related: [...(reverse ? [reverse] : []), ...siblings.slice(0, 4), 'image-converter'],
    updated: '2026-11-07',
  }
})
