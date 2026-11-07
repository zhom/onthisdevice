/** The image to text tools differ only in their wording and the files they name. */
export interface ReadPreset {
  title: string
  hint: string
  accept: string
}

const IMAGES = 'image/*,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.tif,.tiff'

export const PRESETS = {
  'image-to-text': { title: 'Drop images here', hint: 'Photos, scans and screenshots: JPG, PNG, WebP. You can also paste.', accept: IMAGES },
  'screenshot-to-text': { title: 'Drop or paste a screenshot', hint: 'Press Ctrl+V or Cmd+V to paste from the clipboard.', accept: IMAGES },
  'jpg-to-text': { title: 'Drop JPG images here', hint: 'PNG, WebP and other images work too.', accept: IMAGES },
  'png-to-text': { title: 'Drop PNG images here', hint: 'JPG, WebP and other images work too.', accept: IMAGES },
} satisfies Record<string, ReadPreset>

export type ReadSlug = keyof typeof PRESETS
