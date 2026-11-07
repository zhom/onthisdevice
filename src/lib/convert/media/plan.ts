/**
 * FFmpeg arguments for the media pair pages. Pure: takes the pair, the settings and what
 * FFmpeg found in the file, returns the command. Streams are copied when the target
 * container can hold them as they are.
 */
import type { MediaFmt } from './formats'

/** What FFmpeg reports about the input (codec names as FFmpeg prints them). */
export interface Probe {
  duration: number
  videoCodec: string | null
  audioCodec: string | null
  width: number
  height: number
}

export type Quality = 'high' | 'balanced' | 'small'

export interface MediaSettings {
  /** kbps for lossy audio. */
  bitrate: number
  /** WAV and AIFF sample format. */
  bitDepth: 16 | 24
  flacLevel: number
  /** Hz, or 0 for the source rate. */
  sampleRate: number
  /** 1, 2, or 0 for the source channels. */
  channels: number
  quality: Quality
  /** Largest output height, or 0 to keep. */
  maxHeight: number
  /** Re-encode even when the streams could be copied. */
  forceEncode: boolean
  gifFps: number
  gifWidth: number
  /** Seconds. */
  start: number
  /** Seconds, 0 for to the end. */
  length: number
}

export interface Plan {
  args: string[]
  output: string
  mime: string
  ext: string
  /** For the result panel: "Video copied, sound converted to AAC". */
  summary: string
}

const AUDIO_EXT: Partial<Record<MediaFmt, string>> = { mp3: 'mp3', wav: 'wav', ogg: 'ogg', opus: 'opus', m4a: 'm4a', aac: 'aac', flac: 'flac', wma: 'wma', aiff: 'aiff' }
const VIDEO_EXT: Partial<Record<MediaFmt, string>> = { mp4: 'mp4', mov: 'mov', mkv: 'mkv', webm: 'webm', avi: 'avi', wmv: 'wmv', flv: 'flv', '3gp': '3gp', mpeg: 'mpg', ogv: 'ogv', gif: 'gif' }

export const OUT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  mpg: 'video/mpeg',
  ogv: 'video/ogg',
  gif: 'image/gif',
}

export function isAudioTarget(to: MediaFmt): boolean {
  return to in AUDIO_EXT
}

export function outputExt(to: MediaFmt): string {
  return AUDIO_EXT[to] ?? VIDEO_EXT[to] ?? to
}

/** The audio encoder arguments for an audio target. */
export function audioCodecArgs(to: MediaFmt, s: MediaSettings): { args: string[]; label: string } {
  const br = `${Math.round(s.bitrate)}k`
  switch (to) {
    case 'mp3':
      return { args: ['-c:a', 'libmp3lame', '-b:a', br], label: `MP3 ${s.bitrate} kbps` }
    case 'ogg':
      return { args: ['-c:a', 'libvorbis', '-b:a', br], label: `Vorbis ${s.bitrate} kbps` }
    case 'opus':
      return { args: ['-c:a', 'libopus', '-b:a', br], label: `Opus ${s.bitrate} kbps` }
    case 'm4a':
    case 'aac':
      return { args: ['-c:a', 'aac', '-b:a', br], label: `AAC ${s.bitrate} kbps` }
    case 'wma':
      return { args: ['-c:a', 'wmav2', '-b:a', br], label: `WMA ${s.bitrate} kbps` }
    case 'flac':
      return { args: ['-c:a', 'flac', '-compression_level', String(s.flacLevel)], label: `FLAC level ${s.flacLevel}` }
    case 'aiff':
      return { args: ['-c:a', s.bitDepth === 24 ? 'pcm_s24be' : 'pcm_s16be'], label: `${s.bitDepth}-bit PCM` }
    default:
      return { args: ['-c:a', s.bitDepth === 24 ? 'pcm_s24le' : 'pcm_s16le'], label: `${s.bitDepth}-bit PCM` }
  }
}

/** Copying is possible when the source codec is what the target would encode anyway. */
function audioCopyable(to: MediaFmt, codec: string | null): boolean {
  if (!codec) return false
  if (to === 'm4a' || to === 'aac') return codec === 'aac'
  if (to === 'mp3') return codec === 'mp3'
  if (to === 'opus') return codec === 'opus'
  if (to === 'ogg') return codec === 'vorbis'
  if (to === 'flac') return codec === 'flac'
  return false
}

function audioOptions(s: MediaSettings): string[] {
  const out: string[] = []
  if (s.sampleRate > 0) out.push('-ar', String(s.sampleRate))
  if (s.channels > 0) out.push('-ac', String(s.channels))
  return out
}

function trimArgs(s: MediaSettings): { before: string[]; after: string[] } {
  const before = s.start > 0 ? ['-ss', s.start.toFixed(3)] : []
  const after = s.length > 0 ? ['-t', s.length.toFixed(3)] : []
  return { before, after }
}

const CRF: Record<Quality, number> = { high: 19, balanced: 23, small: 28 }
const VP8_CRF: Record<Quality, number> = { high: 6, balanced: 10, small: 20 }
const QSCALE: Record<Quality, number> = { high: 2, balanced: 4, small: 7 }

function scaleFilter(s: MediaSettings, p: Probe | null): string {
  const limit = s.maxHeight > 0 && (!p || p.height === 0 || p.height > s.maxHeight)
  return limit ? `scale=-2:${s.maxHeight}` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
}

function h264(s: MediaSettings, p: Probe | null, extra: string[] = []): string[] {
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(CRF[s.quality]), '-pix_fmt', 'yuv420p', ...extra, '-vf', scaleFilter(s, p)]
}

function vp8(s: MediaSettings, p: Probe | null): string[] {
  const crf = VP8_CRF[s.quality]
  const cap = crf <= 6 ? '8M' : crf <= 12 ? '4M' : '1500k'
  return ['-c:v', 'libvpx', '-crf', String(crf), '-b:v', cap, '-deadline', 'good', '-cpu-used', '5', '-pix_fmt', 'yuv420p', '-vf', scaleFilter(s, p)]
}

interface VideoRecipe {
  canCopyVideo: (codec: string) => boolean
  canCopyAudio: (codec: string) => boolean
  video: (s: MediaSettings, p: Probe | null) => string[]
  audio: string[]
  videoLabel: string
  audioLabel: string
  extra?: string[]
}

const RECIPES: Partial<Record<MediaFmt, VideoRecipe>> = {
  mp4: {
    canCopyVideo: (c) => ['h264', 'hevc', 'mpeg4', 'av1'].includes(c),
    canCopyAudio: (c) => ['aac', 'mp3', 'alac', 'opus'].includes(c),
    video: (s, p) => h264(s, p),
    audio: ['-c:a', 'aac', '-b:a', '160k'],
    videoLabel: 'H.264',
    audioLabel: 'AAC',
    extra: ['-movflags', '+faststart'],
  },
  mov: {
    canCopyVideo: (c) => ['h264', 'hevc', 'mpeg4', 'prores', 'mjpeg'].includes(c),
    canCopyAudio: (c) => ['aac', 'mp3', 'alac', 'pcm_s16le', 'pcm_s24le'].includes(c),
    video: (s, p) => h264(s, p),
    audio: ['-c:a', 'aac', '-b:a', '160k'],
    videoLabel: 'H.264',
    audioLabel: 'AAC',
    extra: ['-movflags', '+faststart'],
  },
  mkv: {
    canCopyVideo: () => true,
    canCopyAudio: () => true,
    video: (s, p) => h264(s, p),
    audio: ['-c:a', 'aac', '-b:a', '160k'],
    videoLabel: 'H.264',
    audioLabel: 'AAC',
  },
  webm: {
    canCopyVideo: (c) => ['vp8', 'vp9', 'av1'].includes(c),
    canCopyAudio: (c) => ['opus', 'vorbis'].includes(c),
    video: (s, p) => vp8(s, p),
    audio: ['-c:a', 'libopus', '-b:a', '128k'],
    videoLabel: 'VP8',
    audioLabel: 'Opus',
  },
  flv: {
    canCopyVideo: (c) => c === 'h264',
    canCopyAudio: (c) => ['aac', 'mp3'].includes(c),
    video: (s, p) => h264(s, p),
    audio: ['-c:a', 'aac', '-b:a', '160k'],
    videoLabel: 'H.264',
    audioLabel: 'AAC',
  },
  avi: {
    canCopyVideo: (c) => c === 'mpeg4',
    canCopyAudio: (c) => c === 'mp3',
    video: (s, p) => ['-c:v', 'mpeg4', '-vtag', 'xvid', '-q:v', String(QSCALE[s.quality]), '-vf', scaleFilter(s, p)],
    audio: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    videoLabel: 'MPEG-4 Part 2',
    audioLabel: 'MP3',
  },
  wmv: {
    canCopyVideo: (c) => c === 'wmv2',
    canCopyAudio: (c) => c === 'wmav2',
    video: (s, p) => ['-c:v', 'wmv2', '-q:v', String(QSCALE[s.quality]), '-vf', scaleFilter(s, p)],
    audio: ['-c:a', 'wmav2', '-b:a', '192k'],
    videoLabel: 'WMV 8',
    audioLabel: 'WMA',
  },
  '3gp': {
    canCopyVideo: () => false,
    canCopyAudio: () => false,
    video: (s, p) => ['-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0', '-preset', 'veryfast', '-crf', String(CRF[s.quality] + 2), '-pix_fmt', 'yuv420p', '-vf', scaleFilter({ ...s, maxHeight: s.maxHeight > 0 ? Math.min(s.maxHeight, 480) : 480 }, p)],
    audio: ['-c:a', 'aac', '-b:a', '96k', '-ar', '44100'],
    videoLabel: 'H.264 Baseline',
    audioLabel: 'AAC',
  },
  mpeg: {
    canCopyVideo: (c) => c === 'mpeg2video' || c === 'mpeg1video',
    canCopyAudio: (c) => c === 'mp2',
    video: (s, p) => ['-c:v', 'mpeg2video', '-q:v', String(QSCALE[s.quality]), '-vf', scaleFilter(s, p)],
    audio: ['-c:a', 'mp2', '-b:a', '224k'],
    videoLabel: 'MPEG-2',
    audioLabel: 'MP2',
    extra: ['-f', 'mpeg'],
  },
  ogv: {
    canCopyVideo: (c) => c === 'theora',
    canCopyAudio: (c) => c === 'vorbis',
    video: (s, p) => ['-c:v', 'libtheora', '-q:v', String(s.quality === 'high' ? 8 : s.quality === 'balanced' ? 6 : 4), '-vf', scaleFilter(s, p)],
    audio: ['-c:a', 'libvorbis', '-q:a', '5'],
    videoLabel: 'Theora',
    audioLabel: 'Vorbis',
  },
}

export function planFfmpeg(to: MediaFmt, input: string, s: MediaSettings, p: Probe | null): Plan {
  const ext = outputExt(to)
  const output = `output.${ext}`
  const mime = OUT_MIME[ext] ?? 'application/octet-stream'
  const { before, after } = trimArgs(s)

  if (to === 'gif') {
    const fps = Math.max(1, Math.min(50, Math.round(s.gifFps)))
    const width = s.gifWidth > 0 ? `${Math.round(s.gifWidth)}:-1` : 'trunc(iw/2)*2:-1'
    const graph = `[0:v]fps=${fps},scale=${width}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
    return { args: [...before, '-i', input, ...after, '-filter_complex', graph, '-loop', '0', '-an', output], output, mime, ext, summary: `GIF, ${fps} frames per second, two-pass palette` }
  }

  if (isAudioTarget(to)) {
    const copy = !s.forceEncode && s.sampleRate === 0 && s.channels === 0 && audioCopyable(to, p?.audioCodec ?? null)
    const codec = audioCodecArgs(to, s)
    const extra = to === 'mp3' ? ['-id3v2_version', '3'] : to === 'm4a' ? ['-movflags', '+faststart'] : []
    const args = [...before, '-i', input, ...after, '-vn', '-map', '0:a:0', ...(copy ? ['-c:a', 'copy'] : [...codec.args, ...audioOptions(s)]), ...extra, output]
    return { args, output, mime, ext, summary: copy ? 'Sound copied without re-encoding' : `Sound encoded as ${codec.label}` }
  }

  const r = RECIPES[to]
  if (!r) throw new Error(`No recipe for ${to}`)
  const vCopy = !s.forceEncode && s.maxHeight === 0 && !!p?.videoCodec && r.canCopyVideo(p.videoCodec)
  const aCopy = !s.forceEncode && !!p?.audioCodec && r.canCopyAudio(p.audioCodec)
  const args = [
    ...before,
    '-i',
    input,
    ...after,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    ...(vCopy ? ['-c:v', 'copy'] : r.video(s, p)),
    ...(p && !p.audioCodec ? [] : aCopy ? ['-c:a', 'copy'] : r.audio),
    ...(r.extra ?? []),
    output,
  ]
  const vText = vCopy ? 'Video copied' : `Video encoded as ${r.videoLabel}`
  const aText = p && !p.audioCodec ? 'no sound track' : aCopy ? 'sound copied' : `sound encoded as ${r.audioLabel}`
  return { args, output, mime, ext, summary: `${vText}, ${aText}` }
}
