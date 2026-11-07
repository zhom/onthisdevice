/**
 * Hand-picked lists for the home page and the 404 page. Kept out of the
 * registry modules so curation never touches tool data.
 */

/** A tool that other sites usually charge for, and what it gives here, in a few words. */
export interface PaidTool {
  slug: string
  gives: string
}

/** The home page list after the hero. */
export const PAID: PaidTool[] = [
  { slug: 'remove-background', gives: 'Full resolution PNG, no credits' },
  { slug: 'image-upscaler', gives: '2x or 4x, no watermark' },
  { slug: 'audio-to-text', gives: 'No minute limit, SRT and VTT export' },
  { slug: 'text-to-speech', gives: 'Natural voices, no character quota' },
  { slug: 'remove-object-from-photo', gives: 'Full resolution, no credits' },
  { slug: 'image-to-text', gives: 'Any number of images and pages' },
  { slug: 'ocr-pdf', gives: 'Scans become searchable PDFs' },
  { slug: 'edit-pdf', gives: 'Change text and pages, no account' },
  { slug: 'sign-pdf', gives: 'Sign and date, no account' },
  { slug: 'redact-pdf', gives: 'The text under each bar is removed' },
  { slug: 'compress-video', gives: '1 GB and more, no queue' },
  { slug: 'pdf-to-word', gives: 'No daily file limit' },
]

/** Quick links under the home search. */
export const QUICK = ['redact-pdf', 'merge-pdf', 'compress-image-to-100kb', 'pdf-to-jpg', 'mov-to-mp4', 'mortgage-calculator']

/** Most used tools: they rank first in search and fill the 404 page. */
export const FEATURED = [
  'merge-pdf',
  'compress-pdf',
  'redact-pdf',
  'pdf-to-jpg',
  'jpg-to-pdf',
  'compress-image-to-100kb',
  'resize-image',
  'mov-to-mp4',
  'video-to-gif',
  'mortgage-calculator',
  'word-counter',
  'qr-code-generator',
]
