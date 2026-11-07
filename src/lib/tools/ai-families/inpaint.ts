import type { Tool } from '../types'

const updated = '2026-11-07'
const accepts = ['jpg', 'jpeg', 'png', 'webp', 'avif']
const upload = {
  q: 'Is my photo uploaded?',
  a: 'No. The model runs in this browser tab and the photo never leaves your device. The model file downloads once from this site and is kept for offline use.',
}
const best = {
  q: 'When does it work best?',
  a: 'On small and medium objects in front of grass, sky, walls, water or other even surfaces. A large object in front of detailed buildings or faces leaves a softer patch.',
}
const again = {
  q: 'Can I remove several things?',
  a: 'Yes. Remove one, then paint the next and press Remove again. Undo removal goes back one step at a time.',
}

export const tools: Tool[] = [
  {
    slug: 'remove-object-from-photo',
    title: 'Remove Object from Photo',
    h1: 'Remove objects from a photo',
    description: 'Paint over an unwanted object and an AI model fills the area so it looks like it was never there. Runs in your browser, with no upload, account or watermark.',
    keywords: ['object remover', 'remove unwanted objects', 'photo eraser', 'erase object from photo', 'inpainting', 'cleanup pictures'],
    category: 'ai',
    icon: 'Eraser',
    popular: true,
    accepts,
    faqs: [
      { q: 'How do I mark the object?', a: 'Paint over it with the brush. Cover the whole object and a little of the area around it, with its shadow. Make the brush smaller for detail.' },
      best,
      again,
      upload,
    ],
    related: ['remove-people-from-photo', 'remove-text-from-image', 'remove-background', 'enhance-photo'],
    updated,
  },
  {
    slug: 'remove-people-from-photo',
    title: 'Remove People from Photo',
    h1: 'Remove people from a photo',
    description: 'Remove tourists, strangers and photobombers from a photo: paint over them and an AI model fills in the background. Private, free, and it runs on your device.',
    keywords: ['remove person from photo', 'remove tourists from photo', 'erase people from picture', 'remove photobomber', 'delete person from image'],
    category: 'ai',
    icon: 'UserRound',
    accepts,
    faqs: [
      { q: 'Which people are easy to remove?', a: 'People who are small in the frame, in front of an even background such as sand, grass, sky or a wall. A person close to the camera leaves a larger area to fill, which looks softer.' },
      { q: 'Should I paint the shadow too?', a: 'Yes. Paint over the shadow and any reflection, or they stay in the photo after the person is gone.' },
      again,
      upload,
    ],
    related: ['remove-object-from-photo', 'blur-face-in-photo', 'remove-background', 'crop-image'],
    updated,
  },
  {
    slug: 'remove-text-from-image',
    title: 'Remove Text from Image',
    h1: 'Remove text from an image',
    description: 'Remove captions, dates, labels and other text from an image: the text is found and marked for you, and an AI model fills the background. Runs on your device.',
    keywords: ['erase text from image', 'remove words from picture', 'remove date stamp from photo', 'remove caption from image', 'text remover'],
    category: 'ai',
    icon: 'Type',
    accepts,
    faqs: [
      { q: 'How is the text found?', a: 'A text recognition engine reads the image and marks a box around each word. You can clear the marks, add more with the brush, or run the finder again.' },
      { q: 'Does it find all text?', a: 'It finds printed text in good contrast. Handwriting, very small text and text on busy backgrounds can be missed. Paint over those by hand.' },
      { q: 'Should I use this on images I do not own?', a: 'Only remove text from images you have the right to change. Removing a watermark or a credit from someone else’s work can break their copyright.' },
      upload,
    ],
    related: ['remove-object-from-photo', 'image-to-text', 'redact-screenshot', 'add-text-to-image'],
    updated,
  },
]
