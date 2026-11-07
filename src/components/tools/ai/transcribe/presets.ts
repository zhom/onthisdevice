/** The speech tools differ in what they take, what they output first and whether they translate. */
export type Output = 'txt' | 'srt' | 'vtt'

export interface TranscribePreset {
  translate: boolean
  /** The main download. */
  output: Output
  /** Offer recording with the microphone first. */
  record: boolean
  accept: string
  title: string
  hint: string
}

const AUDIO = '.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.weba,.wma,.amr,audio/*'
const MEDIA = `${AUDIO},.mp4,.m4v,.mov,.mkv,.avi,video/*`

export const PRESETS = {
  'audio-to-text': { translate: false, output: 'txt', record: false, accept: MEDIA, title: 'Drop an audio or video file', hint: 'MP3, WAV, M4A, OGG, FLAC, MP4, MOV or WebM.' },
  'video-to-text': { translate: false, output: 'txt', record: false, accept: MEDIA, title: 'Drop a video', hint: 'MP4, MOV, WebM or MKV. Only the sound is read.' },
  'subtitle-generator': { translate: false, output: 'srt', record: false, accept: MEDIA, title: 'Drop a video or audio file', hint: 'MP4, MOV, WebM, MKV, MP3 or WAV.' },
  'mp3-to-text': { translate: false, output: 'txt', record: false, accept: MEDIA, title: 'Drop an MP3 file', hint: 'Other audio and video files work too.' },
  'wav-to-text': { translate: false, output: 'txt', record: false, accept: MEDIA, title: 'Drop a WAV file', hint: 'Other audio and video files work too.' },
  'm4a-to-text': { translate: false, output: 'txt', record: false, accept: MEDIA, title: 'Drop an M4A file', hint: 'Voice memos, AAC and other audio files work too.' },
  'transcribe-voice-memo': { translate: false, output: 'txt', record: true, accept: MEDIA, title: 'Drop a voice memo', hint: 'M4A from an iPhone, or any audio file.' },
  'speech-to-text': { translate: false, output: 'txt', record: true, accept: MEDIA, title: 'Or drop a recording', hint: 'MP3, WAV, M4A, OGG or WebM.' },
  'translate-audio-to-english': { translate: true, output: 'txt', record: false, accept: MEDIA, title: 'Drop an audio or video file', hint: 'Speech in any of about 90 languages.' },
} satisfies Record<string, TranscribePreset>

export type TranscribeSlug = keyof typeof PRESETS
