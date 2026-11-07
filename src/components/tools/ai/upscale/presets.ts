/**
 * The upscale tools differ in their default size and model.
 */
import type { UpscaleModel } from '@/lib/ml/upscale/models'

export type Scale = 1 | 2 | 4

export interface UpscalePreset {
  scale: Scale
  scales: Scale[]
  model: UpscaleModel
  suffix: string
}

export const PRESETS = {
  'image-upscaler': { scale: 2, scales: [2, 4], model: 'photo', suffix: '-upscaled' },
  'upscale-image-4x': { scale: 4, scales: [2, 4], model: 'photo', suffix: '-4x' },
  'increase-image-resolution': { scale: 2, scales: [2, 4], model: 'photo', suffix: '-hires' },
  'enhance-photo': { scale: 1, scales: [1, 2, 4], model: 'photo', suffix: '-enhanced' },
  'anime-upscaler': { scale: 4, scales: [2, 4], model: 'drawing', suffix: '-upscaled' },
} satisfies Record<string, UpscalePreset>

export type UpscaleSlug = keyof typeof PRESETS
