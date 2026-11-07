import type { Tool } from '../types'

export const tools: Tool[] = [
  {
    slug: 'remove-background-noise',
    title: 'Remove Background Noise',
    h1: 'Remove background noise from audio',
    description: 'Remove background noise from speech: fans, traffic, hum and room noise. An AI model cleans the recording on your device. Download WAV or MP3, no upload.',
    keywords: ['noise reduction', 'audio noise remover', 'clean up audio', 'denoise audio', 'remove noise from voice recording', 'noise cancelling online'],
    category: 'ai',
    icon: 'AudioWaveform',
    popular: true,
    accepts: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'webm', 'mp4', 'mov'],
    faqs: [
      { q: 'What kind of sound does it clean?', a: 'Speech. The model was trained to keep voices and remove everything else, so it also removes music. It is not made for music recordings.' },
      { q: 'Why does the result sound thin?', a: 'The model works at 16 kHz, the quality of a good phone call, so high tones above 8 kHz are lost. Lower the strength to mix some of the original back.' },
      { q: 'How long does it take?', a: 'About 5 to 15 seconds per minute of sound on a laptop, after a download of the model and its runtime once.' },
      { q: 'Is my recording uploaded?', a: 'No. The model runs in this browser tab and the sound never leaves your device.' },
    ],
    related: ['audio-to-text', 'trim-audio', 'voice-recorder', 'wav-to-mp3'],
    updated: '2026-11-07',
  },
]
