/**
 * Prepares a picture for text recognition: small pictures are enlarged 2 times (the engine
 * reads text of 20 to 40 pixels best) and light text on a dark background is inverted.
 */
export function prepareForOcr(image: ImageBitmap | HTMLCanvasElement): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.max(image.width, image.height) < 1400 ? 2 : 1
  const c = document.createElement('canvas')
  c.width = Math.round(image.width * scale)
  c.height = Math.round(image.height * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser blocked canvas drawing, so the image cannot be read.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  let sum = 0
  let n = 0
  for (let i = 0; i < data.data.length; i += 4 * 13) {
    sum += (data.data[i] * 54 + data.data[i + 1] * 183 + data.data[i + 2] * 19) >> 8
    n++
  }
  if (sum / n < 110) {
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255 - data.data[i]
      data.data[i + 1] = 255 - data.data[i + 1]
      data.data[i + 2] = 255 - data.data[i + 2]
    }
    ctx.putImageData(data, 0, 0)
  }
  return { canvas: c, scale }
}
