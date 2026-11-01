/**
 * Round-2 `video` batch helpers.
 *
 * Private to this batch (prefixed `video-`), imported only by the islands in
 * this folder. The FFmpeg engine itself is NOT re-implemented here — every job
 * goes through the single shared engine in `./_ffmpeg`, which is the only place
 * allowed to call `ffmpeg.load()`.
 *
 * What lives here is the "remux first" decision logic: given what FFmpeg found
 * inside a file, work out whether the streams can be copied bit-for-bit into
 * the target container (seconds, zero quality loss) or have to be re-encoded,
 * and produce the argv plus the sentence we show the user explaining which of
 * the two actually happened.
 */
import type { EngineProbe } from './_ffmpeg'

export type ContainerTarget = 'mp4' | 'mov' | 'webm'

/** Codecs each container can legally hold, using FFmpeg's own codec names. */
const ISOBMFF_VIDEO = new Set(['h264', 'avc1', 'hevc', 'h265', 'mpeg4', 'av1', 'prores'])
const ISOBMFF_AUDIO = new Set(['aac', 'mp3', 'ac3', 'eac3', 'alac', 'mp2'])
const WEBM_VIDEO = new Set(['vp8', 'vp9', 'av1'])
const WEBM_AUDIO = new Set(['opus', 'vorbis'])

/** MOV additionally carries ProRes and PCM, which MP4 does not. */
const MOV_ONLY_VIDEO = new Set(['prores', 'dnxhd'])
const MOV_ONLY_AUDIO = new Set(['pcm_s16le', 'pcm_s24le'])

export const CONTAINER_MIME: Record<ContainerTarget, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export const CONTAINER_LABEL: Record<ContainerTarget, string> = {
  mp4: 'MP4',
  mov: 'MOV',
  webm: 'WebM',
}

/** Friendly names so the stream readout is not a pile of FFmpeg identifiers. */
const CODEC_LABELS: Record<string, string> = {
  h264: 'H.264 / AVC',
  avc1: 'H.264 / AVC',
  hevc: 'HEVC / H.265',
  h265: 'HEVC / H.265',
  mpeg4: 'MPEG-4 Part 2 (DivX/Xvid)',
  av1: 'AV1',
  vp8: 'VP8',
  vp9: 'VP9',
  prores: 'Apple ProRes',
  dnxhd: 'Avid DNxHD',
  mjpeg: 'Motion JPEG',
  aac: 'AAC',
  mp3: 'MP3',
  ac3: 'Dolby Digital (AC-3)',
  eac3: 'Dolby Digital Plus',
  opus: 'Opus',
  vorbis: 'Vorbis',
  alac: 'Apple Lossless',
  pcm_s16le: 'Uncompressed PCM',
  pcm_s24le: 'Uncompressed PCM 24-bit',
  flac: 'FLAC',
  amr_nb: 'AMR narrowband',
}

export function codecLabel(codec: string | null): string {
  if (!codec) return 'none'
  return CODEC_LABELS[codec] ?? codec.toUpperCase()
}

function canCopyVideo(codec: string, target: ContainerTarget): boolean {
  if (target === 'webm') return WEBM_VIDEO.has(codec)
  if (target === 'mov') return ISOBMFF_VIDEO.has(codec) || MOV_ONLY_VIDEO.has(codec)
  // MP4 refuses ProRes/DNxHD in practice — keep those on the MOV path only.
  return ISOBMFF_VIDEO.has(codec) && !MOV_ONLY_VIDEO.has(codec)
}

function canCopyAudio(codec: string, target: ContainerTarget): boolean {
  if (target === 'webm') return WEBM_AUDIO.has(codec)
  if (target === 'mov') return ISOBMFF_AUDIO.has(codec) || MOV_ONLY_AUDIO.has(codec)
  return ISOBMFF_AUDIO.has(codec)
}

export type StreamMode = 'copy' | 'encode' | 'none'

export interface ConversionPlan {
  video: StreamMode
  audio: StreamMode
  /** The full FFmpeg argv, ready for `runFFmpeg`. */
  args: string[]
  /** One-line summary shown before and after the run. */
  headline: string
  /** A sentence of detail: what was copied, what was re-encoded and why. */
  detail: string
  /** True when no picture data was re-encoded (so: fast, lossless). */
  lossless: boolean
}

export interface PlanOptions {
  probe: EngineProbe
  target: ContainerTarget
  input: string
  output: string
  /** Skip the copy path entirely — the user asked for a full re-encode. */
  forceEncode: boolean
  /** x264 CRF or VP8 CRF, depending on target. */
  crf: number
  /** x264 speed preset (ignored for WebM). */
  preset: string
}

/**
 * VP8 arguments for WebM output. VP9 (libvpx-vp9) traps with "memory access
 * out of bounds" in the single-thread WebAssembly core on anything longer than
 * a fraction of a second, so WebM is VP8. `crf` 4-63 (lower is better); the
 * bitrate is only a ceiling for constrained-quality mode.
 */
export function vp8Args(crf: number): string[] {
  const cap = crf <= 6 ? '8M' : crf <= 12 ? '4M' : '1500k'
  return [
    '-c:v',
    'libvpx',
    '-crf',
    String(crf),
    '-b:v',
    cap,
    '-deadline',
    'good',
    '-cpu-used',
    '5',
    '-pix_fmt',
    'yuv420p',
  ]
}

function videoEncodeArgs(target: ContainerTarget, crf: number, preset: string): string[] {
  if (target === 'webm') return vp8Args(crf)
  return [
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    // Odd dimensions are legal in some sources but illegal for 4:2:0 H.264.
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  ]
}

function audioEncodeArgs(target: ContainerTarget): string[] {
  if (target === 'webm') return ['-c:a', 'libopus', '-b:a', '128k']
  return ['-c:a', 'aac', '-b:a', '160k']
}

/**
 * Decide between remux and transcode, and build the command for it.
 *
 * The three real outcomes, in order of how much we prefer them:
 *   1. copy + copy      — a container swap. Seconds, byte-identical picture.
 *   2. copy + encode    — the picture is copied, only the soundtrack is redone.
 *   3. encode + encode  — a genuine transcode, minutes, some quality lost.
 */
export function planConversion(options: PlanOptions): ConversionPlan {
  const { probe, target, input, output, forceEncode, crf, preset } = options

  const hasVideo = probe.videoCodec !== null
  const hasAudio = probe.audioCodec !== null

  const videoCopyable = !forceEncode && hasVideo && canCopyVideo(probe.videoCodec ?? '', target)
  const audioCopyable = !forceEncode && hasAudio && canCopyAudio(probe.audioCodec ?? '', target)

  const video: StreamMode = !hasVideo ? 'none' : videoCopyable ? 'copy' : 'encode'
  const audio: StreamMode = !hasAudio ? 'none' : audioCopyable ? 'copy' : 'encode'

  const args = ['-i', input]

  if (video === 'copy') args.push('-c:v', 'copy')
  else if (video === 'encode') args.push(...videoEncodeArgs(target, crf, preset))
  else args.push('-vn')

  if (audio === 'copy') args.push('-c:a', 'copy')
  else if (audio === 'encode') args.push(...audioEncodeArgs(target))
  else args.push('-an')

  if (target !== 'webm') args.push('-movflags', '+faststart')
  args.push(output)

  const label = CONTAINER_LABEL[target]
  const vName = codecLabel(probe.videoCodec)
  const aName = codecLabel(probe.audioCodec)

  let headline: string
  let detail: string

  if (video === 'copy' && audio !== 'encode') {
    headline = `Remux: copying the streams into ${label}`
    detail =
      `The video is already ${vName}` +
      (hasAudio ? ` and the audio is already ${aName}` : ' and there is no audio track') +
      `, both of which ${label} accepts. The compressed data is copied across untouched, so this ` +
      'finishes in seconds and the picture is bit-for-bit identical to the original. Nothing is re-compressed.'
  } else if (video === 'copy' && audio === 'encode') {
    headline = `Remux the video, re-encode the audio`
    detail =
      `The ${vName} video is copied across untouched, with no quality loss, but ${label} cannot carry ` +
      `${aName} audio, so only the soundtrack is re-encoded (to ${target === 'webm' ? 'Opus 128 kbps' : 'AAC 160 kbps'}). ` +
      'That is fast and inaudible in practice.'
  } else if (video === 'encode') {
    headline = `Transcode: re-encoding the video to ${target === 'webm' ? 'VP8' : 'H.264'}`
    detail = forceEncode
      ? `You asked for a full re-encode, so every frame is decoded and re-compressed at CRF ${crf}${
          target === 'webm' ? '' : ` with the “${preset}” speed preset`
        }.`
      : `${vName} cannot be stored in a ${label} file, so every frame has to be decoded and re-compressed ` +
        `(CRF ${crf}${target === 'webm' ? '' : `, preset “${preset}”`}). This is the slow path: expect roughly ` +
        'real-time on a laptop, and a small, unavoidable loss of quality.'
  } else {
    headline = 'Audio-only file'
    detail = 'This file has no video stream, so only the audio track is written to the output.'
  }

  return { video, audio, args, headline, detail, lossless: video === 'copy' }
}

/** Rough guide for the "how long will this take" line. */
export function estimateSeconds(durationSec: number, lossless: boolean): number {
  if (durationSec <= 0) return 0
  // Stream copy runs at roughly 30-60x real time; software H.264 nearer 1x.
  return lossless ? Math.max(1, durationSec / 40) : Math.max(2, durationSec * 1.1)
}

/** "about 4 seconds" / "about 3 minutes" — deliberately vague, never a promise. */
export function humanizeSeconds(seconds: number): string {
  if (seconds <= 0) return 'a moment'
  if (seconds < 60) return `about ${Math.max(1, Math.round(seconds))} seconds`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = (minutes / 60).toFixed(1)
  return `about ${hours} hours`
}

/** Even integer, clamped to at least 2 — H.264 and VP8 both require it. */
export function evenClamp(value: number, min = 2): number {
  const n = Math.max(min, Math.round(value))
  return n % 2 === 0 ? n : n - 1
}

/** atempo only accepts 0.5-2.0, so a 4x change is two chained stages. */
export function atempoChain(speed: number): number[] {
  const stages: number[] = []
  let remaining = speed
  while (remaining > 2.0001) {
    stages.push(2)
    remaining /= 2
  }
  while (remaining < 0.4999) {
    stages.push(0.5)
    remaining /= 0.5
  }
  stages.push(Number(remaining.toFixed(6)))
  return stages
}

export const VIDEO_ACCEPT = '.mp4,.mov,.m4v,.mkv,.webm,.avi,.mpg,.mpeg,.3gp,.ogv,.ts,.flv,video/*'

export const X264_SPEED_OPTIONS = [
  { value: 'ultrafast', label: 'ultrafast (quickest, biggest file)' },
  { value: 'superfast', label: 'superfast' },
  { value: 'veryfast', label: 'veryfast (recommended in the browser)' },
  { value: 'faster', label: 'faster' },
  { value: 'fast', label: 'fast' },
  { value: 'medium', label: 'medium (slowest, smallest file)' },
]

export const QUALITY_OPTIONS = [
  { value: 'high', label: 'High quality (larger file)' },
  { value: 'balanced', label: 'Balanced (recommended)' },
  { value: 'small', label: 'Small file (visible compression)' },
]

export type QualityKey = 'high' | 'balanced' | 'small'

export function crfFor(target: ContainerTarget, quality: QualityKey): number {
  if (target === 'webm') return quality === 'high' ? 6 : quality === 'balanced' ? 10 : 20
  return quality === 'high' ? 18 : quality === 'balanced' ? 23 : 28
}
