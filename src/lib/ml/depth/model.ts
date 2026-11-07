/** Depth estimation: Depth Anything V2 small with uint8 weights (Apache-2.0). */
import { downloadBytes } from '../runtime/runtime'

export const DEPTH_MODEL = '/models/onnx-community/depth-anything-v2-small/onnx/model_quantized.onnx'

export function depthDownloadBytes(): number {
  return downloadBytes([DEPTH_MODEL], 'wasm')
}
