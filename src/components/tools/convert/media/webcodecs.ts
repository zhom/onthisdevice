/**
 * The fast path for MP4, MOV, MKV and WebM output: streams are copied when the target can
 * hold them, and otherwise re-encoded with the browser's own WebCodecs encoders, which are
 * often hardware accelerated. Returns null when this path cannot do the whole job, so the
 * caller falls back to FFmpeg; a track is never dropped silently.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  WebMOutputFormat,
} from 'mediabunny'
import type { MediaFmt } from '@/lib/convert/media/formats'
import type { MediaSettings } from '@/lib/convert/media/plan'

export const WEBCODECS_TARGETS = new Set<MediaFmt>(['mp4', 'mov', 'mkv', 'webm'])

export interface FastResult {
  blob: Blob
  summary: string
}

function outputFormat(to: MediaFmt) {
  if (to === 'webm') return new WebMOutputFormat()
  if (to === 'mkv') return new MkvOutputFormat()
  if (to === 'mov') return new MovOutputFormat({ fastStart: 'in-memory' })
  return new Mp4OutputFormat({ fastStart: 'in-memory' })
}

export async function convertWithWebCodecs(
  file: File,
  to: MediaFmt,
  s: MediaSettings,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<FastResult | null> {
  if (!WEBCODECS_TARGETS.has(to) || typeof VideoEncoder === 'undefined') return null
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    try {
      await input.getFormat()
    } catch {
      return null
    }
    const quality = s.quality === 'high' ? QUALITY_HIGH : s.quality === 'balanced' ? QUALITY_MEDIUM : QUALITY_LOW
    const videoTrack = await input.getPrimaryVideoTrack()
    if (!videoTrack) return null
    const height = await videoTrack.getDisplayHeight()
    const resize = s.maxHeight > 0 && height > s.maxHeight
    const output = new Output({ format: outputFormat(to), target: new BufferTarget() })
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      video: { bitrate: quality, forceTranscode: s.forceEncode || resize, ...(resize ? { height: s.maxHeight } : {}) },
      audio: { bitrate: quality, forceTranscode: s.forceEncode },
      ...(s.start > 0 || s.length > 0 ? { trim: { start: s.start, ...(s.length > 0 ? { end: s.start + s.length } : {}) } } : {}),
    })
    if (!conversion.isValid || conversion.discardedTracks.length > 0) return null

    const hasAudio = (await input.getPrimaryAudioTrack()) !== null
    conversion.onProgress = onProgress
    const abort = () => void conversion.cancel()
    signal.addEventListener('abort', abort)
    try {
      await conversion.execute()
    } finally {
      signal.removeEventListener('abort', abort)
    }
    const buffer = output.target.buffer
    if (!buffer || buffer.byteLength === 0) return null
    const summary = `Converted with the browser's own media engine${hasAudio ? '' : ', no sound track'}. Streams are copied where ${to.toUpperCase()} can hold them.`
    return { blob: new Blob([buffer], { type: output.format.mimeType }), summary }
  } catch (err) {
    if (signal.aborted) throw err
    return null
  } finally {
    input.dispose()
  }
}
