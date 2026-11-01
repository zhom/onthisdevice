/**
 * The signature detector: YOLOS-tiny fine-tuned on handwritten signatures
 * (Apache-2.0), exported to ONNX on this site's build machine (see
 * scripts/vendor-models.mjs). The fp32 file is used: the dynamic uint8 copy
 * placed boxes 10 to 25 px higher on 150 dpi pages and disagreed on 9 of 26
 * boxes on real scans.
 */
import { isCached } from '../assets'
import { ORT_FILES, modelWire } from '../ort'

export const SIGNATURE_MODEL = '/models/mdefrance/yolos-tiny-signature-detection/onnx/model.onnx'

export function signatureDownloadBytes(): number {
  return modelWire([SIGNATURE_MODEL])
}

export function signatureIsCached(): Promise<boolean> {
  return isCached([...ORT_FILES, SIGNATURE_MODEL]).catch(() => false)
}
