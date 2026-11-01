/**
 * YuNet face detector: tensor layout and output decoding. Pure functions with
 * no runtime imports, so they also run in Node tests.
 *
 * Model: /models/yunet/face_detection_yunet_2026may.onnx (MIT, 230 kB).
 * Input  "input": float32 [1, 3, H, W], BGR, 0..255, H and W multiples of 32.
 * Output per stride s in 8, 16, 32 (one row per grid cell, row-major):
 *   cls_s [1, N, 1], obj_s [1, N, 1], bbox_s [1, N, 4], kps_s [1, N, 10]
 * score = sqrt(clamp(cls) * clamp(obj)); centre = (col + dx, row + dy) * s;
 * size = exp(dw, dh) * s; landmark k = (col + kx, row + ky) * s.
 */
import type { Detection } from './geometry'

export interface FaceDetection extends Detection {
  /** Eyes, nose tip, mouth corners: x0, y0, ... x4, y4 in the same pixels as the box. */
  landmarks: number[]
}

export const YUNET_STRIDES = [8, 16, 32] as const

/** RGBA pixels of size w x h into a BGR CHW float tensor body. */
export function yunetTensor(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const plane = w * h
  const out = new Float32Array(plane * 3)
  for (let i = 0, p = 0; p < plane; p++, i += 4) {
    out[p] = rgba[i + 2]!
    out[plane + p] = rgba[i + 1]!
    out[2 * plane + p] = rgba[i]!
  }
  return out
}

export type YunetOutputs = Record<string, { data: ArrayLike<number> }>

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Decodes raw outputs for an input of w x h. Boxes come back in input pixels;
 * the caller maps them to the source image.
 */
export function decodeYunet(out: YunetOutputs, w: number, h: number, minScore: number): FaceDetection[] {
  const found: FaceDetection[] = []
  for (const s of YUNET_STRIDES) {
    const cls = out[`cls_${s}`]?.data
    const obj = out[`obj_${s}`]?.data
    const bbox = out[`bbox_${s}`]?.data
    const kps = out[`kps_${s}`]?.data
    if (!cls || !obj || !bbox || !kps) throw new Error(`Face model output for stride ${s} is missing.`)
    const cols = Math.floor(w / s)
    const rows = Math.floor(h / s)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const score = Math.sqrt(clamp01(cls[i]!) * clamp01(obj[i]!))
        if (score < minScore) continue
        const cx = (c + bbox[i * 4]!) * s
        const cy = (r + bbox[i * 4 + 1]!) * s
        const bw = Math.exp(bbox[i * 4 + 2]!) * s
        const bh = Math.exp(bbox[i * 4 + 3]!) * s
        const landmarks: number[] = []
        for (let k = 0; k < 5; k++) {
          landmarks.push((c + kps[i * 10 + 2 * k]!) * s, (r + kps[i * 10 + 2 * k + 1]!) * s)
        }
        found.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, score, landmarks })
      }
    }
  }
  return found
}

/** Input size for a crop of sw x sh at `scale`: each side a multiple of 32, at least 32. */
export function yunetSize(sw: number, sh: number, scale: number): { w: number; h: number } {
  return {
    w: Math.max(32, Math.round((sw * scale) / 32) * 32),
    h: Math.max(32, Math.round((sh * scale) / 32) * 32),
  }
}
