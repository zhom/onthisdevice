import type { Tool } from '../types'

const updated = '2026-11-07'
const faqs = [
  { q: 'Which voices are there?', a: '11 English voices: 7 American and 4 British, women and men. They come from Kokoro, an open speech model under the Apache 2.0 licence.' },
  { q: 'Can I use the audio in videos and podcasts?', a: 'Yes. The model licence allows commercial use, and nothing on this page adds a watermark or asks for credit.' },
  { q: 'Is there a character limit?', a: '20,000 characters per run, about 25 minutes of speech. Split a longer text into parts. There is no daily limit.' },
  { q: 'Is my text sent anywhere?', a: 'No. The voice model runs in this browser tab. The text and the audio stay on your device, and the tool works offline after the first use.' },
]

export const tools: Tool[] = [
  {
    slug: 'text-to-speech',
    title: 'Text to Speech',
    h1: 'Text to speech with natural voices',
    description: 'Turn text into natural speech with 11 AI voices, American and British. The voice model runs in your browser. Download WAV or MP3, no sign-up and no limit.',
    keywords: ['tts', 'ai voice generator', 'read text aloud', 'text to voice', 'text reader', 'natural text to speech'],
    category: 'ai',
    icon: 'Volume2',
    popular: true,
    faqs,
    related: ['text-to-mp3', 'speech-to-text', 'audio-to-text', 'word-counter'],
    updated,
  },
  {
    slug: 'text-to-mp3',
    title: 'Text to MP3',
    h1: 'Convert text to MP3',
    description: 'Convert text to an MP3 file read by a natural AI voice. Choose from 11 English voices and the speed. Runs on your device, so your text stays private.',
    keywords: ['text to audio', 'text to mp3 converter', 'convert text to audio file', 'tts mp3', 'text to voice mp3'],
    category: 'ai',
    icon: 'FileAudio',
    faqs,
    related: ['text-to-speech', 'wav-to-mp3', 'audio-converter', 'mp3-to-text'],
    updated,
  },
]
