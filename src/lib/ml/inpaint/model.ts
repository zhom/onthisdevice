/** Object removal model: MI-GAN with its own pre- and post-processing (MIT). */
import { downloadBytes } from '../runtime/runtime'

export const INPAINT_MODEL = '/models/migan/migan_pipeline_v2.onnx'

export function inpaintDownloadBytes(): number {
  return downloadBytes([INPAINT_MODEL], 'wasm')
}
