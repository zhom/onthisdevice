/**
 * Hand-picked lists for the home page and the 404 page. Kept out of the
 * registry modules so curation never touches tool data.
 */

/** A problem in the visitor's words, what this site does about it, and where to start. */
export interface Situation {
  problem: string
  answer: string
  tools: string[]
}

/** The situations before the live demonstration on the home page. */
export const SITUATIONS: Situation[] = [
  {
    problem: 'A passport scan for a visa form.',
    answer: 'Get it under the size limit and hide what the form does not need. The scan stays in this tab.',
    tools: ['compress-image-to-100kb', 'redact-id-card', 'jpg-to-pdf'],
  },
  {
    problem: 'A contract with names to remove.',
    answer: 'Find names, emails and numbers, then burn them out of the file. The text under the bars is gone, so nobody can copy it back.',
    tools: ['redact-pdf', 'redact-text', 'remove-metadata'],
  },
  {
    problem: 'A 300 MB video that a free plan refuses.',
    answer: 'The video tools take 1 GB or more, and your device does the work.',
    tools: ['compress-video', 'mov-to-mp4', 'video-to-gif'],
  },
  {
    problem: 'Photo 21 of the day.',
    answer: 'Upload sites count your files, then ask you to pay. Here there is no daily limit, no account and no watermark.',
    tools: ['resize-image', 'compress-image', 'image-converter'],
  },
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
