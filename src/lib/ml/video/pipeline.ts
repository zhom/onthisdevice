/**
 * Decode, scan and re-encode a video in the browser with WebCodecs
 * (mediabunny). Works in a Web Worker (preferred) and on the main thread.
 *
 *   webCodecsGap()                   null, or a message when the browser lacks WebCodecs
 *   probeVideo(file)                 { duration, width, height, fps, frames, hasAudio }
 *   outputSize(width, height)        the export size: at most 1920 x 1080 (either way), even
 *   scanVideo(file, { fps, maxSide, onFrame, signal })
 *       calls onFrame(canvas, t, index, total) for frames about 1/fps apart, each drawn at
 *       most maxSide pixels on the long side; finish with the canvas before returning
 *   renderVideo(file, { paint, onProgress, signal })
 *       re-encodes every frame at outputSize(); `paint(ctx, t, width, height)` draws over
 *       the frame (already on ctx) before it is encoded. Output: H.264 MP4 when the
 *       browser can encode it, else VP9/VP8 WebM. Audio is copied or re-encoded (AAC or
 *       Opus) when possible. Metadata tags (location, device) are not copied.
 *       Resolves to { blob, extension, mimeType, audio: 'kept' | 'none' | 'dropped', width, height }
 *
 * Cancel with an AbortSignal; the promise then rejects with an AbortError.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny'
import type { AudioCodec, InputVideoTrack, VideoCodec } from 'mediabunny'

export interface VideoInfo {
  duration: number
  width: number
  height: number
  fps: number
  frames: number
  hasAudio: boolean
}

export interface RenderProgress {
  frame: number
  frames: number
  /** 0..1 */
  fraction: number
  /** Estimate, null until a few frames are done. */
  secondsLeft: number | null
}

export interface RenderResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  mimeType: string
  audio: 'kept' | 'none' | 'dropped'
  width: number
  height: number
}

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

export function webCodecsGap(): string | null {
  if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
    return 'This browser cannot decode and encode video inside a web page. Use a current version of Chrome, Edge, Firefox or Safari.'
  }
  return null
}

function abortError(): DOMException {
  return new DOMException('Canceled.', 'AbortError')
}

function open(file: Blob): Input {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
}

async function videoTrack(input: Input): Promise<InputVideoTrack> {
  const track = await input.getPrimaryVideoTrack().catch(() => null)
  if (!track) throw new Error('This file has no video track, or its format is not supported.')
  if (!(await track.canDecode())) {
    const codec = (await track.getCodec()) ?? 'unknown'
    throw new Error(`This browser cannot decode the ${codec.toUpperCase()} video in this file. Try Chrome or Edge, or convert it to MP4 first.`)
  }
  return track
}

async function describe(input: Input, track: InputVideoTrack): Promise<VideoInfo> {
  const duration = (await input.getDurationFromMetadata().catch(() => null)) ?? (await input.computeDuration())
  const width = await track.getDisplayWidth()
  const height = await track.getDisplayHeight()
  const stats = await track.computePacketStats(120)
  const fps = stats.averagePacketRate > 0 ? stats.averagePacketRate : 30
  const audio = await input.getPrimaryAudioTrack().catch(() => null)
  return { duration, width, height, fps, frames: Math.max(1, Math.round(duration * fps)), hasAudio: !!audio }
}

export async function probeVideo(file: Blob): Promise<VideoInfo> {
  const input = open(file)
  try {
    return await describe(input, await videoTrack(input))
  } finally {
    input.dispose()
  }
}

export function outputSize(width: number, height: number, maxLong = 1920, maxShort = 1080): { width: number; height: number } {
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  const k = Math.min(1, maxLong / long, maxShort / short)
  const even = (v: number) => Math.max(2, Math.round((v * k) / 2) * 2)
  return { width: even(width), height: even(height) }
}

export interface ScanOptions {
  fps: number
  maxSide: number
  signal?: AbortSignal
  onFrame: (canvas: OffscreenCanvas | HTMLCanvasElement, t: number, index: number, total: number) => unknown
}

export async function scanVideo(file: Blob, opts: ScanOptions): Promise<VideoInfo> {
  const input = open(file)
  try {
    const track = await videoTrack(input)
    const info = await describe(input, track)
    const k = Math.min(1, opts.maxSide / Math.max(info.width, info.height))
    const sink = new CanvasSink(track, {
      width: Math.max(2, Math.round(info.width * k)),
      height: Math.max(2, Math.round(info.height * k)),
      fit: 'fill',
      poolSize: 2,
    })
    const start = await track.getFirstTimestamp()
    const step = 1 / opts.fps
    const times: number[] = []
    for (let t = start; t < start + info.duration; t += step) times.push(t)
    let index = 0
    let last = Number.NEGATIVE_INFINITY
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      if (opts.signal?.aborted) throw abortError()
      if (frame && frame.timestamp > last) {
        last = frame.timestamp
        await opts.onFrame(frame.canvas, frame.timestamp, index, times.length)
      }
      index++
    }
    return info
  } finally {
    input.dispose()
  }
}

interface Plan {
  extension: 'mp4' | 'webm'
  video: VideoCodec[]
  audio: AudioCodec[]
}

const PLANS: Plan[] = [
  { extension: 'mp4', video: ['avc'], audio: ['aac', 'opus'] },
  { extension: 'webm', video: ['vp9', 'vp8'], audio: ['opus'] },
]

async function pickCodecs(width: number, height: number, fps: number, audio: { channels: number; rate: number } | null) {
  for (const plan of PLANS) {
    for (const v of plan.video) {
      if (!(await canEncodeVideo(v, { width, height, frameRate: fps, quality: QUALITY_HIGH }).catch(() => false))) continue
      let a: AudioCodec | null = null
      if (audio) {
        for (const c of plan.audio) {
          if (await canEncodeAudio(c, { numberOfChannels: audio.channels, sampleRate: audio.rate }).catch(() => false)) {
            a = c
            break
          }
        }
      }
      return { plan, video: v, audio: a }
    }
  }
  return null
}

export interface RenderOptions {
  paint: (ctx: Ctx, t: number, width: number, height: number) => unknown
  onProgress?: (p: RenderProgress) => void
  signal?: AbortSignal
  maxLong?: number
  maxShort?: number
}

export async function renderVideo(file: Blob, opts: RenderOptions): Promise<RenderResult> {
  const gap = webCodecsGap()
  if (gap) throw new Error(gap)
  const input = open(file)
  try {
    const track = await videoTrack(input)
    const info = await describe(input, track)
    const { width, height } = outputSize(info.width, info.height, opts.maxLong, opts.maxShort)
    const audioTrack = await input.getPrimaryAudioTrack().catch(() => null)
    const audioShape = audioTrack
      ? { channels: await audioTrack.getNumberOfChannels(), rate: await audioTrack.getSampleRate() }
      : null
    const codecs = await pickCodecs(width, height, info.fps, audioShape)
    if (!codecs) throw new Error('This browser cannot encode H.264, VP9 or VP8 video at this size.')

    const output = new Output({
      format: codecs.plan.extension === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    })
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height })
    const ctx = canvas.getContext('2d') as Ctx | null
    if (!ctx) throw new Error('This browser blocked canvas access.')

    let frame = 0
    const began = performance.now()
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      tags: {},
      showWarnings: false,
      video: {
        codec: codecs.video,
        quality: QUALITY_HIGH,
        forceTranscode: true,
        allowTransformationMetadata: false,
        processedWidth: width,
        processedHeight: height,
        process: async (sample) => {
          if (opts.signal?.aborted) return null
          sample.draw(ctx, 0, 0, width, height)
          await opts.paint(ctx, sample.timestamp, width, height)
          frame++
          if (opts.onProgress) {
            const fraction = Math.min(1, frame / info.frames)
            const spent = (performance.now() - began) / 1000
            opts.onProgress({
              frame,
              frames: Math.max(frame, info.frames),
              fraction,
              secondsLeft: frame >= 10 ? (spent / frame) * Math.max(0, info.frames - frame) : null,
            })
          }
          return canvas
        },
      },
      audio: codecs.audio ? { codec: codecs.audio } : { discard: true },
    })
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ')
      throw new Error(`This video cannot be converted in this browser (${why || 'unsupported tracks'}).`)
    }
    const audioKept = conversion.utilizedTracks.some((t) => t.type === 'audio')

    const onAbort = () => void conversion.cancel()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      await conversion.execute()
    } catch (err) {
      if (opts.signal?.aborted) throw abortError()
      throw err
    } finally {
      opts.signal?.removeEventListener('abort', onAbort)
    }
    if (opts.signal?.aborted) throw abortError()
    const buffer = output.target.buffer
    if (!buffer) throw new Error('The encoder produced no data.')
    const mimeType = output.format.mimeType
    return {
      blob: new Blob([buffer], { type: mimeType }),
      extension: codecs.plan.extension,
      mimeType,
      audio: !audioTrack ? 'none' : audioKept ? 'kept' : 'dropped',
      width,
      height,
    }
  } finally {
    input.dispose()
  }
}
