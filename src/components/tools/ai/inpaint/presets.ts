/** The object removal tools differ in what they mark first. */
export interface InpaintPreset {
  /** Find text with OCR and mark it as soon as the photo is open. */
  findText: boolean
  suffix: string
  hint: string
}

export const PRESETS = {
  'remove-object-from-photo': { findText: false, suffix: '-removed', hint: 'Paint over what you want to remove, then press Remove.' },
  'remove-people-from-photo': { findText: false, suffix: '-removed', hint: 'Paint over each person you want to remove, with their shadow, then press Remove.' },
  'remove-text-from-image': { findText: true, suffix: '-no-text', hint: 'The text that was found is marked. Paint to add more, or clear the marks, then press Remove.' },
} satisfies Record<string, InpaintPreset>

export type InpaintSlug = keyof typeof PRESETS
