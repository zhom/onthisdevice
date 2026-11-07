/** The two DTLN model files (MIT) and the bytes of a first run. */
import { wireBytes } from '../assets'
import { runtimeFiles } from '../runtime/runtime'

export const DTLN_MODELS = ['/models/dtln/model_1.onnx', '/models/dtln/model_2.onnx'] as const

export function denoiseDownloadBytes(): number {
  return wireBytes([...runtimeFiles('wasm'), ...DTLN_MODELS])
}
