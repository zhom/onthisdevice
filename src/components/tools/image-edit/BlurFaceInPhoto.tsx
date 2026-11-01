/**
 * Photo masking island for blur-face-in-photo, blur-license-plate,
 * pixelate-image and censor-image. The work is done by the shared photo
 * redactor; `subject` picks the detector and the copy.
 */
import PhotoRedactor from '@/components/tools/redact/vision/PhotoRedactor'
import type { RedactLook } from '@/components/tools/redact/shared/paint'

export type MaskEffect = 'blur' | 'pixelate' | 'block'

export interface BlurFaceInPhotoProps {
  defaultEffect?: MaskEffect
  defaultShape?: 'rect' | 'ellipse'
  /** 'face' and 'plate' detect automatically; 'anything' is drawn boxes only. */
  subject?: 'face' | 'plate' | 'anything'
}

const TITLE = {
  face: 'Drop photos with faces to blur',
  plate: 'Drop photos of the car',
  anything: 'Drop the photo to edit',
} as const

export default function BlurFaceInPhoto({ defaultEffect = 'blur', defaultShape = 'rect', subject = 'face' }: BlurFaceInPhotoProps) {
  const look: RedactLook = {
    style: defaultEffect === 'block' ? 'fill' : defaultEffect,
    shape: defaultShape === 'ellipse' ? 'oval' : 'rect',
    strength: 60,
  }
  return (
    <PhotoRedactor
      detector={subject === 'anything' ? null : subject}
      defaultLook={look}
      dropTitle={TITLE[subject]}
      allowWholeImage={subject === 'anything'}
    />
  )
}
