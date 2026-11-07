/** Image formats and the format pair pages built from them. */

export type InFormat = 'jpg' | 'jfif' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'heic' | 'heif' | 'ico' | 'svg'
export type OutFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'ico' | 'svg' | 'pdf'

export interface FormatInfo {
  label: string
  name: string
  /** Extensions, without the dot. */
  ext: string[]
  mime: string
  compression: string
  transparency: string
  animation: string
  colour: string
  support: string
  about: string
  bestFor: string
  limits: string
}

export const FORMATS: Record<InFormat | OutFormat, FormatInfo> = {
  jpg: {
    label: 'JPG',
    name: 'JPEG',
    ext: ['jpg', 'jpeg', 'jpe'],
    mime: 'image/jpeg',
    compression: 'Lossy (DCT)',
    transparency: 'No',
    animation: 'No',
    colour: '8 bits per channel',
    support: 'Every browser, app and device',
    about: 'JPEG dates from 1992 and is still the most common photo format. It discards detail the eye does not notice, so photos become 5 to 10 times smaller.',
    bestFor: 'Photos to share, email, print or upload anywhere.',
    limits: 'No transparency. Text, line art and screenshots get blurry edges, and each new save loses a little more quality.',
  },
  jfif: {
    label: 'JFIF',
    name: 'JPEG File Interchange Format',
    ext: ['jfif'],
    mime: 'image/jpeg',
    compression: 'Lossy (DCT)',
    transparency: 'No',
    animation: 'No',
    colour: '8 bits per channel',
    support: 'Browsers, but some upload forms and apps reject the extension',
    about: 'A .jfif file is an ordinary JPEG with a different file extension. Some browsers save images from the web with it.',
    bestFor: 'Nothing: rename it to .jpg so every app accepts it.',
    limits: 'Many upload forms and older programs refuse the .jfif extension even though the data is JPEG.',
  },
  png: {
    label: 'PNG',
    name: 'Portable Network Graphics',
    ext: ['png'],
    mime: 'image/png',
    compression: 'Lossless (Deflate)',
    transparency: 'Yes, 256 levels',
    animation: 'APNG only',
    colour: '8 or 16 bits per channel',
    support: 'Every browser, app and device',
    about: 'PNG appeared in 1996 as a patent-free replacement for GIF. It keeps every pixel exactly and supports full transparency.',
    bestFor: 'Screenshots, logos, icons, diagrams and anything with text or transparency.',
    limits: 'Photos in PNG are several times larger than the same photo in JPG or WebP.',
  },
  webp: {
    label: 'WebP',
    name: 'WebP',
    ext: ['webp'],
    mime: 'image/webp',
    compression: 'Lossy or lossless',
    transparency: 'Yes',
    animation: 'Yes',
    colour: '8 bits per channel',
    support: 'All current browsers; some older desktop apps cannot open it',
    about: 'WebP was published in 2010 for the web. Lossy WebP is about 25 to 35% smaller than JPEG at the same quality, and lossless WebP is smaller than PNG.',
    bestFor: 'Images on websites, where smaller files load faster.',
    limits: 'Older image editors, some social sites and print shops do not accept WebP.',
  },
  avif: {
    label: 'AVIF',
    name: 'AV1 Image File Format',
    ext: ['avif'],
    mime: 'image/avif',
    compression: 'Lossy or lossless (AV1)',
    transparency: 'Yes',
    animation: 'Yes',
    colour: '8, 10 or 12 bits per channel, HDR',
    support: 'All current browsers since 2024; fewer desktop apps',
    about: 'AVIF stores an AV1 video frame in a HEIF container. It is often half the size of JPEG at the same visual quality.',
    bestFor: 'The smallest high-quality images for websites.',
    limits: 'Encoding is slow, and many desktop programs and upload forms do not open AVIF yet.',
  },
  gif: {
    label: 'GIF',
    name: 'Graphics Interchange Format',
    ext: ['gif'],
    mime: 'image/gif',
    compression: 'Lossless (LZW), 256 colours',
    transparency: 'On or off per pixel',
    animation: 'Yes',
    colour: 'At most 256 colours per frame',
    support: 'Every browser, app and device',
    about: 'GIF dates from 1987. It stores up to 256 colours per frame and supports simple animation, which keeps it alive for short loops and reactions.',
    bestFor: 'Short animations, simple graphics with few colours, and places that accept nothing newer.',
    limits: 'Photos lose colour and show banding, and animated GIFs are much larger than the same clip as video or WebP.',
  },
  bmp: {
    label: 'BMP',
    name: 'Bitmap image',
    ext: ['bmp', 'dib'],
    mime: 'image/bmp',
    compression: 'None (usually)',
    transparency: '32-bit only, poorly supported',
    animation: 'No',
    colour: '1 to 32 bits per pixel',
    support: 'Browsers and desktop apps; rare on the web',
    about: 'BMP is the plain bitmap format of desktop operating systems since the late 1980s. It usually stores raw pixels with no compression.',
    bestFor: 'Old software, embedded displays and tools that need raw, uncompressed pixels.',
    limits: 'Files are very large: a 12-megapixel photo is about 36 MB as a 24-bit BMP.',
  },
  tiff: {
    label: 'TIFF',
    name: 'Tagged Image File Format',
    ext: ['tif', 'tiff'],
    mime: 'image/tiff',
    compression: 'None, LZW, Deflate, PackBits or JPEG',
    transparency: 'Yes',
    animation: 'No (but several pages)',
    colour: '1 to 32 bits per channel',
    support: 'Print, scanning and photo software; most browsers cannot show it',
    about: 'TIFF dates from 1986 and is the standard for print, scanning, faxes and archives. One file can hold several pages.',
    bestFor: 'Print production, scans, archives and high-bit-depth editing.',
    limits: 'Large files, and most browsers, phones and websites cannot display TIFF.',
  },
  heic: {
    label: 'HEIC',
    name: 'High Efficiency Image Container',
    ext: ['heic', 'heics'],
    mime: 'image/heic',
    compression: 'Lossy (HEVC)',
    transparency: 'Yes',
    animation: 'Image sequences',
    colour: '8 or 10 bits per channel, HDR',
    support: 'Some phones and operating systems; most browsers and websites cannot open it',
    about: 'HEIC is a HEIF file with HEVC-compressed images. Many phones save photos in it because it is about half the size of JPEG.',
    bestFor: 'Storing photos on the phone that took them.',
    limits: 'Most browsers, Windows programs, websites and print services cannot open HEIC, so photos must be converted to share them.',
  },
  heif: {
    label: 'HEIF',
    name: 'High Efficiency Image File Format',
    ext: ['heif', 'hif'],
    mime: 'image/heif',
    compression: 'Lossy (HEVC or other codecs)',
    transparency: 'Yes',
    animation: 'Image sequences',
    colour: '8 to 16 bits per channel, HDR',
    support: 'Some cameras, phones and operating systems; most browsers cannot open it',
    about: 'HEIF is the container standard (ISO/IEC 23008-12) behind HEIC and AVIF. Some cameras save .heif or .hif files with HEVC images.',
    bestFor: 'Storing high-quality photos in small files on a camera or phone.',
    limits: 'Like HEIC, most websites and Windows programs cannot open it.',
  },
  ico: {
    label: 'ICO',
    name: 'Windows icon',
    ext: ['ico'],
    mime: 'image/x-icon',
    compression: 'PNG or raw bitmap per size',
    transparency: 'Yes',
    animation: 'No',
    colour: 'Up to 32 bits per pixel',
    support: 'Browsers (favicons) and desktop operating systems',
    about: 'An ICO file holds the same icon at several sizes, such as 16, 32 and 48 pixels, so each display picks the sharpest one.',
    bestFor: 'Website favicons and desktop application icons.',
    limits: 'Only for icons: the largest size is 256 × 256 pixels.',
  },
  svg: {
    label: 'SVG',
    name: 'Scalable Vector Graphics',
    ext: ['svg'],
    mime: 'image/svg+xml',
    compression: 'None (XML text)',
    transparency: 'Yes',
    animation: 'Yes (CSS and SMIL)',
    colour: 'Any',
    support: 'Every browser and vector editor',
    about: 'SVG describes shapes, paths and text as XML, so it stays sharp at any size. It is the standard for logos and icons on the web.',
    bestFor: 'Logos, icons, illustrations and diagrams that must scale.',
    limits: 'Photos do not suit vectors: a traced photo becomes a large file of many shapes.',
  },
  pdf: {
    label: 'PDF',
    name: 'Portable Document Format',
    ext: ['pdf'],
    mime: 'application/pdf',
    compression: 'Depends on the content',
    transparency: 'Yes',
    animation: 'No',
    colour: 'Any',
    support: 'Every computer and phone',
    about: 'PDF fixes the layout of a document so it looks the same everywhere. Each image here becomes one page.',
    bestFor: 'Sending scans and photos as one document, and printing.',
    limits: 'A PDF is a document, not an image: image editors need the pages extracted again.',
  },
}

export interface ImagePairSpec {
  slug: string
  from: InFormat
  to: OutFormat
  keywords: string[]
  /** One sentence for the page, about this pair only. */
  note: string
}

const pair = (slug: string, from: InFormat, to: OutFormat, keywords: string[], note: string): ImagePairSpec => ({
  slug,
  from,
  to,
  keywords,
  note,
})

export const IMAGE_PAIRS: ImagePairSpec[] = [
  pair('heic-to-jpg', 'heic', 'jpg', ['heic to jpeg', 'convert heic', 'iphone photo to jpg', 'heic converter'], 'Converting to JPG makes a phone photo open everywhere, at a size close to the HEIC file at quality 85.'),
  pair('heic-to-png', 'heic', 'png', ['heic to png converter', 'convert heic to png'], 'PNG keeps every decoded pixel, but a photo as PNG is often 5 to 10 times larger than the HEIC.'),
  pair('heic-to-webp', 'heic', 'webp', ['convert heic to webp'], 'WebP keeps most of the size advantage of HEIC and opens in every current browser.'),
  pair('heic-to-pdf', 'heic', 'pdf', ['heic to pdf converter', 'iphone photo to pdf'], 'Each photo becomes one page of a single PDF, in the order you add them.'),
  pair('heif-to-jpg', 'heif', 'jpg', ['heif to jpeg', 'hif to jpg', 'convert heif'], 'Camera .hif and .heif files decode the same way as HEIC phone photos.'),
  pair('heif-to-png', 'heif', 'png', ['hif to png', 'convert heif to png'], 'PNG keeps every decoded pixel of the HEIF image without new compression.'),
  pair('tiff-to-jpg', 'tiff', 'jpg', ['tif to jpg', 'tiff to jpeg', 'convert tiff'], 'Each page of a multi-page TIFF becomes its own JPG. Scans shrink to a fraction of their size.'),
  pair('tiff-to-png', 'tiff', 'png', ['tif to png', 'convert tiff to png'], 'PNG is lossless like most TIFFs, and browsers can show it. Each page becomes its own PNG.'),
  pair('tiff-to-webp', 'tiff', 'webp', ['tif to webp'], 'WebP makes scans and print files small enough for the web.'),
  pair('tiff-to-pdf', 'tiff', 'pdf', ['tif to pdf', 'multi page tiff to pdf', 'fax tiff to pdf'], 'All pages of all TIFF files go into one PDF, in order.'),
  pair('jpg-to-tiff', 'jpg', 'tiff', ['jpeg to tiff', 'jpg to tif'], 'The TIFF is lossless from here on, with Deflate compression. It cannot restore detail the JPG already lost.'),
  pair('png-to-tiff', 'png', 'tiff', ['png to tif'], 'Pixels and transparency carry over exactly into a Deflate-compressed TIFF.'),
  pair('bmp-to-png', 'bmp', 'png', ['bitmap to png', 'convert bmp'], 'PNG is lossless like BMP but usually several times smaller.'),
  pair('bmp-to-jpg', 'bmp', 'jpg', ['bmp to jpeg', 'bitmap to jpg'], 'A BMP photo shrinks by 90% or more as a JPG.'),
  pair('png-to-bmp', 'png', 'bmp', ['png to bitmap'], 'The BMP stores raw pixels: 24-bit for opaque images, 32-bit when the PNG has transparency.'),
  pair('jpg-to-bmp', 'jpg', 'bmp', ['jpeg to bmp', 'jpg to bitmap'], 'The BMP holds the decoded pixels without compression, so expect a much larger file.'),
  pair('gif-to-png', 'gif', 'png', ['convert gif to png', 'gif frame to png'], 'The first frame of an animated GIF becomes a PNG with the same colours and transparency.'),
  pair('gif-to-jpg', 'gif', 'jpg', ['gif to jpeg', 'convert gif to jpg'], 'The first frame becomes a JPG. Transparent pixels get a solid background colour.'),
  pair('gif-to-webp', 'gif', 'webp', ['animated gif to webp', 'convert gif to webp'], 'Animated GIFs stay animated, and the WebP is usually much smaller.'),
  pair('png-to-gif', 'png', 'gif', ['convert png to gif'], 'The image is reduced to at most 256 colours, which suits logos and simple graphics.'),
  pair('jpg-to-gif', 'jpg', 'gif', ['jpeg to gif', 'convert jpg to gif'], 'A photo is reduced to at most 256 colours, so expect some banding in gradients.'),
  pair('webp-to-gif', 'webp', 'gif', ['animated webp to gif', 'convert webp to gif'], 'Animated WebP files stay animated where the browser can read their frames.'),
  pair('jfif-to-jpg', 'jfif', 'jpg', ['jfif to jpeg', 'convert jfif', 'open jfif'], 'A JFIF file is already JPEG data, so the page renames it without re-encoding and nothing is lost.'),
  pair('jfif-to-png', 'jfif', 'png', ['convert jfif to png'], 'The JPEG data is decoded once and stored losslessly as PNG.'),
  pair('svg-to-jpg', 'svg', 'jpg', ['svg to jpeg', 'convert svg to jpg'], 'The vector image is drawn at the size you choose, on a solid background.'),
  pair('svg-to-webp', 'svg', 'webp', ['convert svg to webp'], 'The vector image is drawn at the size you choose and keeps its transparency.'),
  pair('svg-to-ico', 'svg', 'ico', ['svg to favicon', 'svg favicon ico'], 'Each icon size is drawn from the vectors, so small sizes stay sharp.'),
  pair('png-to-svg', 'png', 'svg', ['png to vector', 'vectorize png', 'trace png'], 'Tracing turns areas of colour into vector shapes. It works best on logos and flat graphics.'),
  pair('jpg-to-svg', 'jpg', 'svg', ['jpeg to svg', 'jpg to vector', 'vectorize image'], 'Tracing turns areas of colour into vector shapes. A photo needs few colours to give a usable result.'),
  pair('jpg-to-ico', 'jpg', 'ico', ['jpeg to ico', 'jpg to favicon'], 'The photo is cropped to a square and scaled to each icon size.'),
  pair('avif-to-webp', 'avif', 'webp', ['convert avif to webp'], 'WebP opens in more programs than AVIF and keeps transparency.'),
  pair('ico-to-jpg', 'ico', 'jpg', ['ico to jpeg', 'favicon to jpg'], 'The largest image in the icon file becomes a JPG on a solid background.'),
]

export const IMAGE_PAIR_BY_SLUG: Map<string, ImagePairSpec> = new Map(IMAGE_PAIRS.map((p) => [p.slug, p]))

/** The accept string for the drop zone of a source format. */
export function acceptFor(from: InFormat): string {
  const info = FORMATS[from]
  const extra = from === 'heic' || from === 'heif' ? ',.heic,.heif,.hif,image/heic,image/heif' : from === 'jfif' || from === 'jpg' ? ',.jpg,.jpeg,.jfif,image/jpeg' : ''
  return `${info.ext.map((e) => `.${e}`).join(',')},${info.mime}${extra}`
}
