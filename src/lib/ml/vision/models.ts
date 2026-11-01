/** The vision models on this site and their download size. */
import { isCached } from '../assets'
import { ORT_FILES, modelWire } from '../ort'

export type VisionModel = 'face' | 'plate'

export const MODEL_PATH: Record<VisionModel, string> = {
  face: '/models/yunet/face_detection_yunet_2026may.onnx',
  plate: '/models/plate/deimv2-nano-plate.onnx',
}

/** Bytes the first run downloads: the model plus the shared runtime. */
export function modelDownloadBytes(model: VisionModel): number {
  return modelWire([MODEL_PATH[model]])
}

/** True when the model and the runtime are already in Cache Storage. */
export function modelIsCached(model: VisionModel): Promise<boolean> {
  return isCached([...ORT_FILES, MODEL_PATH[model]]).catch(() => false)
}
