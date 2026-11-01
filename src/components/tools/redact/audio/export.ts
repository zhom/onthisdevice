/**
 * Exports of the bleeped sound.
 *
 *   bleepedWav(buffer, cuts, sound)                  WAV at the source rate and channels
 *   bleepedMp3(wav, duration, onProgress)            MP3 from that WAV with the site's FFmpeg engine
 *   bleepedVideo(file, cuts, sound, onProgress, signal)
 *       the same container with the video packets copied as they are and the sound
 *       re-encoded with the bleeps (WebCodecs through mediabunny)
 */
import {
  ALL_FORMATS,
  AudioSample,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MatroskaInputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
} from 'mediabunny'
import type { AudioCodec } from 'mediabunny'
import { runFFmpeg } from '@/components/tools/media/_ffmpeg'
import { applyCuts } from './bleep'
import type { BleepSound, Cut } from './bleep'
import { encodeWav } from './wav'

export function bleepedWav(buffer: AudioBuffer, cuts: readonly Cut[], sound: BleepSound): Blob {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  const rate = buffer.sampleRate
  return encodeWav(channels, rate, (start, slices) => {
    for (const s of slices) applyCuts(s, rate, start / rate, cuts, sound)
  })
}

export async function bleepedMp3(wav: Blob, duration: number, onProgress: (pct: number) => void): Promise<Blob> {
  const { blob } = await runFFmpeg({
    inputs: [{ name: 'bleeped.wav', data: wav }],
    commands: [['-i', 'bleeped.wav', '-c:a', 'libmp3lame', '-q:a', '2', 'bleeped.mp3']],
    output: 'bleeped.mp3',
    mime: 'audio/mpeg',
    durationSec: duration,
    onProgress,
  })
  return blob
}

export interface VideoExport {
  blob: Blob
  extension: 'mp4' | 'webm'
}

function bleepSample(sample: AudioSample, cuts: readonly Cut[], sound: BleepSound): AudioSample {
  const t0 = sample.timestamp
  const t1 = t0 + sample.duration
  if (!cuts.some((c) => c.start < t1 && c.end > t0)) return sample
  const n = sample.numberOfChannels
  const len = sample.numberOfFrames
  const data = new Float32Array(n * len)
  for (let c = 0; c < n; c++) {
    const plane = data.subarray(c * len, (c + 1) * len)
    sample.copyTo(plane, { planeIndex: c, format: 'f32-planar' })
    applyCuts(plane, sample.sampleRate, t0, cuts, sound)
  }
  return new AudioSample({ data, format: 'f32-planar', numberOfChannels: n, sampleRate: sample.sampleRate, timestamp: t0 })
}

export async function bleepedVideo(
  file: File,
  cuts: readonly Cut[],
  sound: BleepSound,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<VideoExport> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    const webm = (await input.getFormat()) instanceof MatroskaInputFormat
    const format = webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' })
    const prefer: AudioCodec[] = webm ? ['opus', 'vorbis'] : ['aac', 'opus']
    let codec: AudioCodec | null = null
    for (const c of prefer) {
      if (format.getSupportedAudioCodecs().includes(c) && (await canEncodeAudio(c))) {
        codec = c
        break
      }
    }
    if (!codec) throw new Error('This browser cannot encode sound for a video file. Download the WAV and add it to the video in an editor.')
    const output = new Output({ format, target: new BufferTarget() })
    const conversion = await Conversion.init({
      input,
      output,
      tags: {},
      audio: { codec, quality: QUALITY_HIGH, forceTranscode: true, process: (s) => bleepSample(s, cuts, sound) },
    })
    if (!conversion.isValid) {
      const reason = conversion.discardedTracks.map((d) => d.reason).join(', ')
      throw new Error(`This video cannot be rewritten in this browser (${reason}). Download the WAV instead.`)
    }
    conversion.onProgress = onProgress
    const abort = () => void conversion.cancel()
    signal?.addEventListener('abort', abort)
    try {
      await conversion.execute()
    } finally {
      signal?.removeEventListener('abort', abort)
    }
    const buffer = output.target.buffer
    if (!buffer) throw new Error('The video came out empty.')
    return {
      blob: new Blob([buffer], { type: webm ? 'video/webm' : 'video/mp4' }),
      extension: webm ? 'webm' : 'mp4',
    }
  } finally {
    input.dispose()
  }
}
