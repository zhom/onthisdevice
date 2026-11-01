/**
 * Reads the sound of an audio or video file into memory.
 *
 *   decodeSound(file) -> { buffer, hasVideo }   full rate, all channels
 *   speechAudio(buffer) -> Float32Array         mono 16 kHz for the speech model
 *
 * The browser's own decoder (Web Audio) reads most files. For a container it
 * cannot read (MKV, some MOV), the file is decoded with WebCodecs through
 * mediabunny instead. mediabunny also reports the sample rate first, so
 * Web Audio decodes at that rate and the export keeps it.
 */
import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny'

export interface Sound {
  buffer: AudioBuffer
  hasVideo: boolean
}

interface Probe {
  rate: number
  channels: number
  hasAudio: boolean
  hasVideo: boolean
}

async function probe(input: Input): Promise<Probe | null> {
  try {
    const [audio, video] = await Promise.all([input.getPrimaryAudioTrack(), input.getPrimaryVideoTrack()])
    if (!audio) return { rate: 0, channels: 0, hasAudio: false, hasVideo: Boolean(video) }
    return { rate: audio.sampleRate, channels: audio.numberOfChannels, hasAudio: true, hasVideo: Boolean(video) }
  } catch {
    return null
  }
}

async function decodeWithWebAudio(file: File, rate: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, rate || 48000)
  return ctx.decodeAudioData(await file.arrayBuffer())
}

async function decodeWithWebCodecs(input: Input): Promise<AudioBuffer> {
  const track = await input.getPrimaryAudioTrack()
  if (!track) throw new Error('This file has no sound.')
  if (!(await track.canDecode())) throw new Error('This browser cannot decode the sound in this file.')
  const pieces: AudioBuffer[] = []
  for await (const { buffer } of new AudioBufferSink(track).buffers()) pieces.push(buffer)
  if (pieces.length === 0) throw new Error('This file has no sound.')
  const rate = pieces[0].sampleRate
  const channels = Math.max(...pieces.map((p) => p.numberOfChannels))
  const length = pieces.reduce((n, p) => n + p.length, 0)
  const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: rate })
  let at = 0
  for (const p of pieces) {
    for (let c = 0; c < channels; c++) out.copyToChannel(p.getChannelData(Math.min(c, p.numberOfChannels - 1)), c, at)
    at += p.length
  }
  return out
}

export async function decodeSound(file: File): Promise<Sound> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    const info = await probe(input)
    if (info && !info.hasAudio) throw new Error(info.hasVideo ? 'This video has no sound track.' : 'This file has no sound.')
    const hasVideo = info?.hasVideo ?? file.type.startsWith('video/')
    try {
      return { buffer: await decodeWithWebAudio(file, info?.rate ?? 0), hasVideo }
    } catch (first) {
      if (!info) throw new Error('This file could not be read as audio or video. Try MP3, WAV, M4A or MP4.', { cause: first })
      return { buffer: await decodeWithWebCodecs(input), hasVideo }
    }
  } finally {
    input.dispose()
  }
}

/** Mono at 16 kHz, the input of the speech model. */
export async function speechAudio(buffer: AudioBuffer): Promise<Float32Array> {
  const rate = 16000
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * rate)), rate)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start()
  const out = await ctx.startRendering()
  return out.getChannelData(0)
}
