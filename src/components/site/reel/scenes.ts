/**
 * The home page reel: one short scene for each tool that other sites usually charge for.
 * The heading shows `phrase` while the scene plays, and the caption links to the tool.
 * Each id has a painter in ./paint.ts.
 */
export type SceneId = 'background' | 'transcribe' | 'upscale' | 'erase' | 'speech' | 'sign' | 'compress'

export interface Scene {
  id: SceneId
  /** The tool the scene shows. */
  slug: string
  /** First line of the home heading; the second line is "free, on this device." */
  phrase: string
  /** What the tool gives here, in one short line. */
  note: string
}

export const SCENES: readonly Scene[] = [
  { id: 'background', slug: 'remove-background', phrase: 'Remove backgrounds', note: 'Full resolution PNG. No credits to buy.' },
  { id: 'transcribe', slug: 'audio-to-text', phrase: 'Transcribe audio', note: 'No minute limit. Export TXT, SRT or VTT.' },
  { id: 'upscale', slug: 'image-upscaler', phrase: 'Upscale photos', note: '2x or 4x the pixels. No watermark.' },
  { id: 'erase', slug: 'remove-object-from-photo', phrase: 'Erase objects', note: 'Paint over it. The model fills the gap.' },
  { id: 'speech', slug: 'text-to-speech', phrase: 'Read text aloud', note: 'Natural voices. No character quota.' },
  { id: 'sign', slug: 'sign-pdf', phrase: 'Sign PDFs', note: 'No account. No upgrade to download.' },
  { id: 'compress', slug: 'compress-video', phrase: 'Compress videos', note: 'Files of 1 GB and more. No queue.' },
]

/** Length of one scene. The first 10% dissolves from the previous scene. */
export const SCENE_MS = 3400
