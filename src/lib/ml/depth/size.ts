/** Input of Depth Anything V2: ImageNet normalisation, sides a multiple of its 14-pixel patches. */
export const DEPTH_MEAN = [0.485, 0.456, 0.406]
export const DEPTH_STD = [0.229, 0.224, 0.225]

/** Model input size: the shorter side becomes `base`, both sides a multiple of 14 (the patch size). */
export function inputSize(w: number, h: number, base: number): { w: number; h: number } {
  const scale = base / Math.min(w, h)
  const round = (v: number) => Math.max(14, Math.round((v * scale) / 14) * 14)
  return { w: round(w), h: round(h) }
}
