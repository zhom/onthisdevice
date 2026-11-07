/**
 * Background removal: ISNet general use (Apache-2.0), one file for both backends. Its weights
 * are stored as fp16 and cast to fp32 when the session loads. It takes a 1024 x 1024 picture
 * and gives a mask of that size.
 */
import type { Hardware } from '../runtime/backend'
import { downloadBytes } from '../runtime/runtime'

export const MASK_SIZE = 1024

export const CUTOUT_MODEL = {
  path: '/models/isnet/isnet-general-use-f16w.onnx',
  name: 'ISNet general use',
  /** Pixel values to model input: v / 255 - 0.5. */
  mean: [0.5, 0.5, 0.5],
  std: [1, 1, 1],
} as const

export function cutoutDownloadBytes(hw: Hardware): number {
  return downloadBytes([CUTOUT_MODEL.path], hw.backend)
}
