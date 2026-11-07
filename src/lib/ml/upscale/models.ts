/**
 * Super resolution models: Real-ESRGAN compact networks (BSD-3-Clause), 4x, any input size.
 * "photo" is the general model (also removes noise and blur); "drawing" is the model trained
 * on anime and line art, which is about twice as fast.
 */
import type { Hardware } from '../runtime/backend'
import { downloadBytes } from '../runtime/runtime'

export type UpscaleModel = 'photo' | 'drawing'

export const UPSCALE_MODELS: Record<UpscaleModel, { path: string; name: string }> = {
  photo: { path: '/models/realesrgan/realesr-general-x4v3.onnx', name: 'Real-ESRGAN general x4v3' },
  drawing: { path: '/models/realesrgan/realesr-animevideov3.onnx', name: 'Real-ESRGAN anime video v3' },
}

/** The models enlarge 4 times; 2x and 1x results are the 4x result made smaller. */
export const NATIVE_SCALE = 4

/** Largest output in pixels: the canvas limit of Safari. */
export const MAX_OUTPUT_PIXELS = 4096 * 4096

/** Input pixels per tile side; tiles overlap by PAD on each side. */
export function tileSize(hw: Hardware): number {
  return hw.backend === 'webgpu' ? 256 : 128
}
export const PAD = 10

/** Rough seconds for an image on the processor, for the estimate shown before a long run. */
export function cpuSeconds(model: UpscaleModel, pixels: number): number {
  return (pixels / (128 * 128)) * (model === 'photo' ? 3.5 : 1.4)
}

export function upscaleDownloadBytes(hw: Hardware, model: UpscaleModel): number {
  return downloadBytes([UPSCALE_MODELS[model].path], hw.backend)
}
