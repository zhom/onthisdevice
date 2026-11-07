/**
 * The background tools differ only in their defaults and in which options they show.
 */
import type { Frame } from './compose'

export type BackgroundKind = 'transparent' | 'color' | 'blur' | 'image'
export type Format = 'png' | 'jpeg' | 'webp'
export type Control = 'background' | 'frame' | 'outline' | 'shadow' | 'size'

export interface Settings {
  background: BackgroundKind
  color: string
  /** Blur radius as a share of the photo's longer side. */
  blur: number
  frame: Frame
  margin: number
  outline: number
  outlineColor: string
  shadow: boolean
  maxSide: number
  format: Format
}

export interface Preset {
  settings: Settings
  controls: Control[]
  /** Added to the file name of the result. */
  suffix: string
  /** Shown on the main button. */
  action: string
}

const BASE: Settings = {
  background: 'transparent',
  color: '#ffffff',
  blur: 0.02,
  frame: 'original',
  margin: 0.08,
  outline: 0,
  outlineColor: '#ffffff',
  shadow: false,
  maxSide: 0,
  format: 'png',
}

export const PRESETS = {
  'remove-background': {
    settings: BASE,
    controls: ['background', 'frame'],
    suffix: '-no-bg',
    action: 'Remove background',
  },
  'transparent-background-maker': {
    settings: { ...BASE, frame: 'subject', margin: 0.02 },
    controls: ['frame'],
    suffix: '-transparent',
    action: 'Make transparent',
  },
  'white-background-for-product-photos': {
    settings: { ...BASE, background: 'color', color: '#ffffff', frame: 'square', margin: 0.1, shadow: true, format: 'jpeg', maxSide: 2000 },
    controls: ['background', 'frame', 'shadow', 'size'],
    suffix: '-white',
    action: 'Make white background',
  },
  'blur-background': {
    settings: { ...BASE, background: 'blur', blur: 0.02, format: 'jpeg' },
    controls: ['background'],
    suffix: '-blur',
    action: 'Blur background',
  },
  'change-background-color': {
    settings: { ...BASE, background: 'color', color: '#2f6fde', format: 'jpeg' },
    controls: ['background', 'frame'],
    suffix: '-bg',
    action: 'Change background',
  },
  'profile-picture-maker': {
    settings: { ...BASE, background: 'color', color: '#e8e2d6', frame: 'circle', margin: 0.06, maxSide: 1024 },
    controls: ['background', 'frame', 'size'],
    suffix: '-profile',
    action: 'Make profile picture',
  },
  'sticker-maker': {
    settings: { ...BASE, frame: 'subject', margin: 0.04, outline: 0.03, outlineColor: '#ffffff', maxSide: 512, format: 'png' },
    controls: ['outline', 'size'],
    suffix: '-sticker',
    action: 'Make sticker',
  },
} satisfies Record<string, Preset>

export type CutoutSlug = keyof typeof PRESETS

/** Colours offered as one-press choices for backgrounds and outlines. */
export const SWATCHES: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
  { value: '#e8e2d6', label: 'Beige' },
  { value: '#d9d9d9', label: 'Light grey' },
  { value: '#2f6fde', label: 'Blue' },
  { value: '#e5484d', label: 'Red' },
  { value: '#30a46c', label: 'Green' },
  { value: '#f5d90a', label: 'Yellow' },
  { value: '#f7c6d9', label: 'Pink' },
]
