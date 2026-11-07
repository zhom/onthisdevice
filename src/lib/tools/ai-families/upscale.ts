import type { Tool } from '../types'

const updated = '2026-11-07'
const accepts = ['jpg', 'jpeg', 'png', 'webp', 'avif']
const upload = {
  q: 'Is my image uploaded?',
  a: 'No. The model runs in this browser tab and the image never leaves your device. The model file downloads once from this site and is kept for offline use.',
}
const speed = {
  q: 'How long does it take?',
  a: 'With WebGPU a typical image takes a few seconds. Without it the model runs on the processor at about 4 seconds per 128 by 128 pixel part, so the tool shows an estimate first.',
}
const limit = {
  q: 'Is there a size limit?',
  a: 'The result can be up to 16 megapixels at 4x and 64 megapixels at 2x, the largest image a browser can draw. There is no limit on the number of images.',
}

export const tools: Tool[] = [
  {
    slug: 'image-upscaler',
    title: 'Image Upscaler',
    h1: 'AI image upscaler',
    description: 'Upscale images 2x or 4x with an AI model that adds real detail, not blur. It runs in your browser, so the image is never uploaded. No sign-up or watermark.',
    keywords: ['ai upscaler', 'upscale image', 'image enlarger', 'super resolution', 'enlarge image without losing quality', 'photo upscaler'],
    category: 'ai',
    icon: 'ImageUpscale',
    popular: true,
    accepts,
    faqs: [
      { q: 'How is this better than resizing?', a: 'Resizing spreads the same pixels over a larger area, so the image gets soft. The model was trained on millions of image pairs and draws the edges and texture that a larger image would have.' },
      speed,
      limit,
      upload,
    ],
    related: ['upscale-image-4x', 'enhance-photo', 'remove-background', 'resize-image'],
    updated,
  },
  {
    slug: 'upscale-image-4x',
    title: 'Upscale Image 4x',
    h1: 'Upscale an image 4x',
    description: 'Make an image 4 times larger with an AI super resolution model: 500 px becomes 2000 px with sharp edges. Runs on your device, free and with no watermark.',
    keywords: ['4x upscale', 'upscale 400%', 'quadruple image size', '4x image enlarger', 'ai upscale 4x'],
    category: 'ai',
    icon: 'Maximize2',
    accepts,
    faqs: [
      { q: 'What does 4x mean?', a: 'The width and the height are both 4 times larger, so the image has 16 times as many pixels. 500 by 400 pixels becomes 2000 by 1600.' },
      speed,
      limit,
      upload,
    ],
    related: ['image-upscaler', 'increase-image-resolution', 'anime-upscaler', 'change-image-dpi'],
    updated,
  },
  {
    slug: 'increase-image-resolution',
    title: 'Increase Image Resolution',
    h1: 'Increase image resolution',
    description: 'Increase the resolution of a low quality image with AI: twice or 4 times the pixels, with clean edges and less noise. Works offline in your browser, no upload.',
    keywords: ['improve image resolution', 'low resolution to high resolution', 'increase photo resolution', 'make image higher resolution', 'image resolution enhancer'],
    category: 'ai',
    icon: 'Expand',
    accepts,
    faqs: [
      { q: 'Does it change the DPI?', a: 'It adds real pixels. DPI is only a print setting that tells a printer how many pixels to put in an inch. To set it after upscaling, use the DPI tool.' },
      { q: 'Can it fix a very blurry photo?', a: 'It removes mild blur and compression noise. A photo that is badly out of focus stays soft, because the detail is not in the file.' },
      speed,
      upload,
    ],
    related: ['image-upscaler', 'change-image-dpi', 'enhance-photo', 'compress-image'],
    updated,
  },
  {
    slug: 'enhance-photo',
    title: 'Enhance Photo',
    h1: 'Enhance a photo with AI',
    description: 'Clean up a photo with an AI model: less noise and JPEG blocks, sharper edges, at the same size or larger. Runs on your device, so your photo stays private.',
    keywords: ['photo enhancer', 'ai photo enhancer', 'improve photo quality', 'fix blurry photo', 'remove jpeg artifacts', 'image quality enhancer'],
    category: 'ai',
    icon: 'Sparkles',
    accepts,
    faqs: [
      { q: 'What does it change?', a: 'It removes noise and the blocks of heavy JPEG compression and makes edges sharper. It does not change colours, faces or the composition.' },
      { q: 'Why keep the same size?', a: 'The model works at 4 times the size, and the result is then made smaller again. This gives a cleaner photo with the same width and height. Choose 2x or 4x for a larger one.' },
      speed,
      upload,
    ],
    related: ['image-upscaler', 'remove-object-from-photo', 'compress-image', 'grayscale-image'],
    updated,
  },
  {
    slug: 'anime-upscaler',
    title: 'Anime Upscaler',
    h1: 'Upscale anime and drawings',
    description: 'Upscale anime, cartoons, manga and line art 2x or 4x with a model trained on animation. Clean lines and flat colours. Runs in your browser.',
    keywords: ['anime upscaler', 'waifu upscale', 'upscale drawing', 'cartoon upscaler', 'manga upscaler', 'upscale artwork'],
    category: 'ai',
    icon: 'Brush',
    accepts,
    faqs: [
      { q: 'Why a separate model for drawings?', a: 'Drawings have flat colours and clean lines. A model trained on them keeps lines crisp and colours flat, where a photo model can add texture that is not there.' },
      { q: 'Does it work on photos?', a: 'It runs, but photos look painted. Choose Photo as the image type for a photo.' },
      limit,
      upload,
    ],
    related: ['image-upscaler', 'upscale-image-4x', 'remove-background', 'image-converter'],
    updated,
  },
]
