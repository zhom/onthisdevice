import type { Tool } from '../types'

export const tools: Tool[] = [
  {
    slug: 'depth-map-generator',
    title: 'Depth Map Generator',
    h1: 'Make a depth map from a photo',
    description: 'Make a depth map from any photo with an AI model: near is white, far is black. Use it for 3D, parallax and blur effects. Runs in your browser, no upload.',
    keywords: ['image to depth map', 'depth estimation', 'ai depth map', 'depth map from image', 'z depth generator', 'displacement map'],
    category: 'ai',
    icon: 'Mountain',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      { q: 'What can I do with a depth map?', a: 'Use it as a displacement or height map in 3D software, to make a parallax or 3D photo effect, or as a mask to blur the background in a photo editor.' },
      { q: 'Is the depth in metres?', a: 'No. The model gives relative depth: which parts are nearer and which are farther. The values are stretched so the nearest point is white and the farthest black.' },
      { q: 'What does High detail do?', a: 'It runs the model at a larger size, about 800 pixels on the short side instead of 518. Edges are finer and it takes about twice as long.' },
      { q: 'Is my photo uploaded?', a: 'No. The model runs in this browser tab and the photo never leaves your device. The model file downloads once from this site.' },
    ],
    related: ['blur-background', 'remove-background', 'image-upscaler', 'grayscale-image'],
    updated: '2026-11-07',
  },
]
