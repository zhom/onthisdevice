import type { Tool } from './types'

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  {
    slug: 'png-to-jpg',
    title: 'PNG to JPG',
    h1: 'Convert PNG to JPG',
    description:
      'Convert PNG to JPG in batches. Pick a background colour for transparent areas, set the JPEG quality, and preview the result before you save.',
    keywords: ['png to jpeg', 'convert png to jpg', 'png jpg converter', 'change png to jpg', 'png to jpg batch'],
    category: 'image-convert',
    icon: 'FileImage',
    popular: true,
    accepts: ['png'],
    faqs: [
      {
        q: 'What happens to transparent areas?',
        a: 'JPEG has no alpha channel, so each transparent pixel must get a colour. The tool flattens transparency onto the background colour you pick (white by default), and you can preview the result before you save.',
      },
      {
        q: 'What quality setting should I use?',
        a: 'For photographs, 80–85 is the point where most people cannot tell the JPEG from the original. Below about 70, blocks appear around sharp edges. Above 92, the file grows quickly for very little visible gain.',
      },
      {
        q: 'Will a PNG screenshot of text look worse as a JPG?',
        a: 'Usually yes. JPEG uses a frequency transform that smears the hard edges of text and line art into visible ringing. For screenshots, diagrams and logos, keep the PNG or convert to WebP. Both stay sharp.',
      },
      {
        q: 'Is the EXIF and colour data kept?',
        a: 'No. The image is rebuilt from raw pixels, so EXIF, XMP and IPTC blocks are dropped and the output is plain sRGB. That is usually what you want before you share a file publicly.',
      },
      {
        q: 'Can I convert a whole folder of PNGs at once?',
        a: 'Yes. Drop in as many PNGs as you like. There is no batch limit and no daily quota, because the encoding runs on your own CPU. Two or more outputs download as one ZIP.',
      },
    ],
    related: ['jpg-to-png', 'png-to-webp', 'image-converter', 'compress-image', 'resize-image', 'png-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'jpg-to-png',
    title: 'JPG to PNG',
    h1: 'Convert JPG to PNG',
    description:
      'Convert JPG to PNG with lossless output. Phone photos keep their EXIF orientation, and a batch of files downloads as one ZIP.',
    keywords: ['jpeg to png', 'convert jpg to png', 'jpg png converter', 'change jpeg to png', 'photo to png'],
    category: 'image-convert',
    icon: 'Image',
    accepts: ['jpg', 'jpeg'],
    faqs: [
      {
        q: 'Does converting JPG to PNG improve the quality?',
        a: 'No. The detail that the JPEG removed when it was first saved is lost. PNG stores the decoded pixels exactly, JPEG artefacts included, so the image gets bigger but not better.',
      },
      {
        q: 'Why is the PNG so much larger than the JPG?',
        a: 'PNG is lossless, so it must describe each pixel exactly. A photograph has millions of slightly different colours, which compress badly. A 2 MB JPEG photo often becomes a 10–20 MB PNG. This is normal.',
      },
      {
        q: 'When should I convert JPG to PNG?',
        a: 'When you need a format with transparency for later editing, when a tool or printer accepts only PNG, or when you will edit and save many times and want to stop generation loss.',
      },
      {
        q: 'Are photos rotated correctly?',
        a: 'Yes. The decoder applies the EXIF orientation flag from phone cameras, so a portrait photo stays portrait in the PNG.',
      },
      {
        q: 'Is there a size limit on the JPGs I can convert?',
        a: 'Only the memory of your device. Very large images (above about 80 megapixels) can use up the RAM of a phone during decoding.',
      },
    ],
    related: ['png-to-jpg', 'jpg-to-webp', 'image-converter', 'compress-image', 'resize-image', 'jpg-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'png-to-webp',
    title: 'PNG to WebP',
    h1: 'Convert PNG to WebP',
    description:
      'Convert PNG to WebP with the libwebp encoder. Transparency is kept, and lossless WebP is usually 20–30% smaller than the same PNG.',
    keywords: ['png to webp converter', 'webp from png', 'compress png as webp', 'png webp batch', 'lossless webp'],
    category: 'image-convert',
    icon: 'Zap',
    accepts: ['png'],
    faqs: [
      {
        q: 'How much smaller will my PNGs get?',
        a: 'Lossless WebP is usually 20–30% smaller than the same PNG. Lossy WebP at quality 80 is often 60–80% smaller, and for flat graphics with few colours the difference can be larger.',
      },
      {
        q: 'Should I use lossy or lossless WebP?',
        a: 'Use lossless for logos, icons, screenshots and anything with hard edges or text. Use the quality slider for photographs and complex illustrations, where a small amount of loss is invisible but saves a lot of bytes.',
      },
      {
        q: 'Does WebP keep transparency?',
        a: 'Yes, in lossy and lossless mode. WebP stores a full 8-bit alpha channel, so soft shadows and anti-aliased edges stay intact. You can also flatten the image onto a solid colour here.',
      },
      {
        q: 'Which browsers and apps can open WebP files?',
        a: 'Every current browser: Chrome, Edge, Firefox, Safari 14+ (2020) and all modern mobile browsers. Windows Photos and macOS Preview also open WebP. Internet Explorer, older Photoshop builds, some desktop image viewers, a few email clients and some print workflows still need a PNG or JPG.',
      },
    ],
    related: ['webp-to-png', 'png-to-jpg', 'image-to-avif', 'image-converter', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'webp-to-png',
    title: 'WebP to PNG',
    h1: 'Convert WebP to PNG',
    description:
      'Convert WebP to PNG so older apps, print shops and upload forms can open the file. The output is lossless, and the alpha channel is kept.',
    keywords: ['webp to png converter', 'save webp as png', 'webp png batch', 'open webp file', 'webp converter'],
    category: 'image-convert',
    icon: 'ImageDown',
    popular: true,
    accepts: ['webp'],
    faqs: [
      {
        q: 'Why will nothing on my computer open a .webp file?',
        a: 'WebP is a web format. Browsers all support it, but older desktop apps, print shops, some office suites and many marketplace upload forms do not. Converting to PNG gives you a file that anything from 1997 onwards can read.',
      },
      {
        q: 'Is anything lost converting WebP to PNG?',
        a: 'No pixels are lost. PNG is lossless, so the decoded WebP is stored exactly. But if the WebP was lossy, its compression artefacts are copied into the PNG.',
      },
      {
        q: 'Does an animated WebP convert?',
        a: 'Only the first frame. PNG is a still format, so animated WebP files come out as a single image. For animation, convert to GIF or MP4 with the video tools instead.',
      },
      {
        q: 'Can I convert a whole folder at once?',
        a: 'Yes. Drop as many WebP files as you like. They convert one after another with a progress bar, and two or more results download as one ZIP.',
      },
      {
        q: 'Is the transparency preserved?',
        a: 'Yes. WebP and PNG both have a full 8-bit alpha channel, so semi-transparent edges stay exact. The image is flattened onto a background only if you ask for it.',
      },
    ],
    related: ['png-to-webp', 'webp-to-jpg', 'image-converter', 'avif-to-png', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'jpg-to-webp',
    title: 'JPG to WebP',
    h1: 'Convert JPG to WebP',
    description:
      'Convert JPG to WebP in the browser with an adjustable quality slider. Usually 25-35% smaller than the JPEG for the same visual quality.',
    keywords: ['jpeg to webp', 'convert jpg to webp', 'webp converter', 'shrink jpg for web', 'bulk jpg to webp'],
    category: 'image-convert',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg'],
    faqs: [
      {
        q: 'How much smaller is WebP than JPEG?',
        a: 'At matched visual quality, WebP is normally 25–35% smaller than a MozJPEG-encoded JPEG. The saving is largest on smooth images such as gradients and skies. It is smallest on noisy or textured photographs and on JPEGs that are already heavily compressed, where little redundancy is left.',
      },
      {
        q: 'Am I losing quality twice?',
        a: 'Yes. The JPEG is decoded and then encoded again, so the artefacts from the first pass are compressed again. At quality 80 or above, you cannot see the second generation in practice.',
      },
      {
        q: 'What quality should I pick for a website?',
        a: 'Start at 80. Hero images and product photos usually look right at 82–85. Thumbnails and background textures look fine at 65–75. Compare the before and after sizes for each file, and pick the lowest quality that still looks clean.',
      },
      {
        q: 'Should I use WebP or AVIF?',
        a: 'AVIF files are smaller again, often 20–30% below WebP. But AVIF encodes much more slowly, and some older browsers do not support it. WebP is the safe default. Use AVIF when the bandwidth saving matters more.',
      },
    ],
    related: ['webp-to-jpg', 'png-to-webp', 'image-to-avif', 'image-converter', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'webp-to-jpg',
    title: 'WebP to JPG',
    h1: 'Convert WebP to JPG',
    description:
      'Convert WebP to JPG so any app can open it. Set the JPEG quality, pick a background colour for transparent areas, and convert a whole batch.',
    keywords: ['webp to jpeg', 'save webp as jpg', 'webp jpg converter', 'convert webp photo', 'webp to jpg bulk'],
    category: 'image-convert',
    icon: 'ImageUp',
    accepts: ['webp'],
    faqs: [
      {
        q: 'What happens to transparent WebP images?',
        a: 'JPEG cannot store transparency, so transparent pixels are composited onto the background colour you choose. White is the default; pick black or a brand colour if the image will sit on a dark surface.',
      },
      {
        q: 'Will the JPG be bigger than the WebP?',
        a: 'Often, yes. WebP compresses more efficiently, so the same picture as a JPEG at similar quality is usually 25–35% larger. You trade bytes for compatibility, which is usually the reason for the conversion.',
      },
      {
        q: 'Which quality avoids visible damage?',
        a: 'The source is already compressed once, so use 85–90 in place of the usual 80. Then the second encoding does not add visible artefacts around edges.',
      },
      {
        q: 'Can I convert dozens of files in one go?',
        a: 'Yes. Batch conversion is the default. Each file shows its before and after size, and two or more files download as one ZIP.',
      },
      {
        q: 'What happens to an animated WebP?',
        a: 'JPEG cannot hold animation, so only the first frame is written. For the whole sequence, convert the source to a GIF or MP4.',
      },
    ],
    related: ['webp-to-png', 'jpg-to-webp', 'png-to-jpg', 'image-converter', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'image-to-avif',
    title: 'Image to AVIF',
    h1: 'Convert images to AVIF',
    description:
      'Convert images to AVIF from JPG, PNG or WebP, with quality and effort controls. An AVIF photo is often half the size of the same JPEG.',
    keywords: ['jpg to avif', 'png to avif', 'webp to avif', 'avif converter', 'avif encoder online'],
    category: 'image-convert',
    icon: 'Sparkles',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Why is AVIF encoding so slow?',
        a: 'AVIF uses the intra-frame coder of the AV1 video codec, which searches a large space of block partitions and prediction modes. That search makes the files smaller. A large photo can take several seconds on your CPU, and progress is shown for each image. Lower the effort slider to trade some compression for speed.',
      },
      {
        q: 'What do the quality and effort sliders actually do?',
        a: 'Quality sets how much detail the encoder can remove: AVIF at 50 looks roughly like JPEG at 80. Effort sets how hard the encoder searches for a compact encoding at that quality. It changes the size and the time, but never the visual target.',
      },
      {
        q: 'How much smaller is AVIF than JPEG?',
        a: 'For photographs, 40–60% smaller at matched quality is typical, and AVIF degrades much more gracefully at very low bitrates. For flat graphics with few colours, lossless WebP or PNG can still be smaller.',
      },
      {
        q: 'Can everyone view AVIF?',
        a: 'Chrome, Edge, Firefox, Safari 16+ and current mobile browsers all decode AVIF. Older desktop software often cannot. Serve AVIF through a picture element with a WebP or JPEG fallback, and keep the originals.',
      },
    ],
    related: ['avif-to-jpg', 'avif-to-png', 'jpg-to-webp', 'png-to-webp', 'image-converter', 'compress-image'],
    updated: UPDATED,
  },
  {
    slug: 'avif-to-jpg',
    title: 'AVIF to JPG',
    h1: 'Convert AVIF to JPG',
    description:
      'Convert AVIF to JPG for software that cannot open .avif files. A bundled libavif decoder works even when your browser has no AVIF support.',
    keywords: ['avif to jpeg', 'open avif file', 'avif jpg converter', 'save avif as jpg', 'avif converter'],
    category: 'image-convert',
    icon: 'Aperture',
    accepts: ['avif'],
    faqs: [
      {
        q: 'My software cannot open .avif files. Will this help?',
        a: 'Yes. The tool decodes the AVIF with a WebAssembly build of libavif and saves it as a JPEG. Every operating system, editor, printer and upload form has read JPEG for thirty years.',
      },
      {
        q: 'Does it work if my browser has no AVIF support?',
        a: 'Yes. The tool first tries the native decoder of the browser, because it is faster. If the browser cannot read the file, the tool uses the bundled libavif decoder.',
      },
      {
        q: 'Will the JPG look worse than the AVIF?',
        a: 'Slightly, because two lossy codecs are applied one after the other. At quality 88 or above (the default), the second pass is almost invisible at normal viewing sizes.',
      },
      {
        q: 'What about transparent AVIF images?',
        a: 'JPEG has no alpha channel, so transparent regions are flattened onto the background colour you select. Convert to PNG instead if you need the transparency preserved.',
      },
      {
        q: 'Why convert away from AVIF at all?',
        a: 'Much software still cannot read it: older phones, most desktop image viewers, many CMS uploaders and almost every print shop. JPEG is accepted everywhere, but the file is larger.',
      },
    ],
    related: ['avif-to-png', 'image-to-avif', 'webp-to-jpg', 'image-converter', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'avif-to-png',
    title: 'AVIF to PNG',
    h1: 'Convert AVIF to PNG',
    description:
      'Convert AVIF to PNG with lossless output and the transparency kept. Open the result in an image editor that has no AVIF plug-in.',
    keywords: ['avif to png converter', 'avif transparency', 'open avif in photoshop', 'avif png batch', 'decode avif'],
    category: 'image-convert',
    icon: 'Layers',
    accepts: ['avif'],
    faqs: [
      {
        q: 'Is the alpha channel kept?',
        a: 'Yes. AVIF stores transparency in a separate alpha plane and PNG stores it per pixel, so soft shadows, rounded corners and anti-aliased edges all survive the conversion exactly.',
      },
      {
        q: 'Why is the PNG so much bigger?',
        a: 'AVIF is one of the most efficient lossy codecs. PNG is lossless and cannot remove anything. A 200 KB AVIF photo often becomes a 3–6 MB PNG. If size matters, choose JPG or WebP.',
      },
      {
        q: 'Can Photoshop or GIMP open the result?',
        a: 'Yes. All image editors open PNG. This is the usual reason to convert: to open an AVIF from a website in an editor that has no AVIF plug-in.',
      },
      {
        q: 'Does it handle 10-bit or HDR AVIF files?',
        a: 'They are decoded and tone-mapped to standard 8-bit sRGB, which the PNG output uses. The image looks correct on a normal display, but the extra HDR headroom is lost.',
      },
      {
        q: 'Does AVIF to PNG restore the original quality?',
        a: 'No. Decoding is exact, so the PNG matches the AVIF pixel for pixel, but detail that the AVIF encoder removed is lost. You get a lossless copy of a lossy image, so the PNG is usually much larger.',
      },
    ],
    related: ['avif-to-jpg', 'image-to-avif', 'webp-to-png', 'image-converter', 'compress-image', 'resize-image'],
    updated: UPDATED,
  },
  {
    slug: 'svg-to-png',
    title: 'SVG to PNG',
    h1: 'Convert SVG to PNG',
    description:
      'Convert SVG to PNG at any scale, such as 2× for retina screens, or at an exact pixel width. Keep the background transparent or fill it with a colour.',
    keywords: ['svg to png converter', 'rasterize svg', 'svg png 2x', 'export svg as png', 'svg to image'],
    category: 'image-convert',
    icon: 'Shapes',
    accepts: ['svg'],
    faqs: [
      {
        q: 'What size will the PNG be?',
        a: 'You choose. Scale mode multiplies the width and height of the SVG (2× is correct for retina assets). Or set an exact output width or height, and the other dimension follows the aspect ratio.',
      },
      {
        q: 'My SVG has no width or height attribute. What happens?',
        a: 'The viewBox is used instead, which is how browsers themselves size such files. If there is no viewBox either, the CSS default of 300 × 150 px applies, so set an explicit output width to be sure.',
      },
      {
        q: 'Why do my fonts look wrong in the PNG?',
        a: 'An SVG that names a font renders with the fonts installed on your system. The tool does not download fonts. For an exact match, convert text to paths in your editor before you export.',
      },
      {
        q: 'Is the background transparent?',
        a: 'Yes, by default. PNG keeps the alpha channel, so unfilled areas stay transparent. Turn on the background option to put the artwork on a solid colour.',
      },
      {
        q: 'Does it work with SVGs that link to external images?',
        a: 'Only if the images are embedded as data: URIs. The tool makes no network requests, so remote references render blank.',
      },
    ],
    related: ['png-to-jpg', 'image-converter', 'favicon-generator', 'resize-image', 'png-to-webp', 'png-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'image-converter',
    title: 'Image Converter',
    h1: 'Convert images between any format',
    description:
      'Image converter for JPG, PNG, WebP, AVIF, GIF, BMP and SVG input, with JPG, PNG, WebP or AVIF output. Mix formats in one batch and set quality.',
    keywords: [
      'convert image format',
      'online image converter',
      'change image format',
      'bulk image converter',
      'free image converter',
    ],
    category: 'image-convert',
    icon: 'Images',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'svg'],
    faqs: [
      {
        q: 'Which formats can I convert between?',
        a: 'Input can be JPG, PNG, WebP, AVIF, GIF, BMP or SVG, and every one of them can be written out as JPG, PNG, WebP or AVIF. The source format is read from the file’s magic bytes, so a mislabelled extension does not matter.',
      },
      {
        q: 'Can I mix different input formats in one batch?',
        a: 'Yes. Drop mixed JPGs, PNGs and WebPs together. Each file is detected and decoded separately, then all are encoded to the target format you selected.',
      },
      {
        q: 'Is there a file size or file count limit?',
        a: 'There is no fixed limit. The limit is the memory of your device, because each image is held as uncompressed RGBA during conversion. Very large batches work, but take longer.',
      },
      {
        q: 'Which output format should I choose?',
        a: 'WebP for general web use, AVIF when you want the smallest possible file and can afford slow encoding, JPG for maximum compatibility with old software, and PNG when you need lossless pixels or an alpha channel.',
      },
      {
        q: 'Does converting back and forth degrade the image?',
        a: 'Between lossy formats, yes. Each JPEG, WebP or AVIF encode removes a little more detail, and the loss adds up. Convert from the original once, do not chain conversions, and keep a lossless master if you can.',
      },
    ],
    related: ['png-to-jpg', 'jpg-to-png', 'webp-to-png', 'image-to-avif', 'svg-to-png', 'compress-image'],
    updated: UPDATED,
  },
]
