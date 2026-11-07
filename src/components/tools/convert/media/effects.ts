/**
 * FFmpeg filter chains for the audio utility pages. Pure: settings and what FFmpeg found
 * in the file go in, the arguments come out.
 */
import { atempoChain } from '@/components/tools/media/video-shared'
import { audioCodecArgs, type MediaSettings } from '@/lib/convert/media/plan'
import type { MediaFmt } from '@/lib/convert/media/formats'

export type AudioEffect = 'reverse' | 'speed' | 'volume' | 'normalize' | 'fade' | 'pitch' | 'ringtone'

export interface EffectSettings {
  speed: number
  keepPitch: boolean
  gainDb: number
  limiter: boolean
  lufs: number
  fadeIn: number
  fadeOut: number
  semitones: number
  start: number
  length: number
  /** 'same' keeps the input format where it can be written. */
  format: 'same' | 'mp3' | 'wav' | 'm4a' | 'ogg' | 'flac' | 'm4r'
}

export interface SourceInfo {
  ext: string
  duration: number
  sampleRate: number
}

const SAME: Record<string, MediaFmt> = {
  mp3: 'mp3',
  wav: 'wav',
  wave: 'wav',
  ogg: 'ogg',
  oga: 'ogg',
  opus: 'opus',
  m4a: 'm4a',
  aac: 'm4a',
  mp4: 'm4a',
  flac: 'flac',
  aiff: 'aiff',
  aif: 'aiff',
}

export function outputFormat(s: EffectSettings, ext: string): { fmt: MediaFmt | 'm4r'; ext: string; mime: string } {
  if (s.format === 'm4r') return { fmt: 'm4r', ext: 'm4r', mime: 'audio/mp4' }
  const fmt: MediaFmt = s.format === 'same' ? (SAME[ext.toLowerCase()] ?? 'mp3') : s.format
  const mime: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', aiff: 'audio/aiff' }
  return { fmt, ext: fmt, mime: mime[fmt] ?? 'audio/mpeg' }
}

const r3 = (n: number) => Number(n.toFixed(3))

/** The -af chain and the output length in seconds. */
export function effectFilter(effect: AudioEffect, s: EffectSettings, src: SourceInfo): { filter: string; duration: number } {
  const d = src.duration
  switch (effect) {
    case 'reverse':
      return { filter: 'areverse', duration: d }
    case 'speed': {
      const f = Math.max(0.25, Math.min(4, s.speed))
      if (s.keepPitch) return { filter: atempoChain(f).map((t) => `atempo=${t}`).join(','), duration: d / f }
      const rate = src.sampleRate || 44100
      return { filter: `asetrate=${Math.round(rate * f)},aresample=${rate}`, duration: d / f }
    }
    case 'volume': {
      const gain = `volume=${r3(s.gainDb)}dB`
      return { filter: s.limiter ? `${gain},alimiter=limit=0.966:level=disabled` : gain, duration: d }
    }
    case 'normalize':
      return { filter: `loudnorm=I=${s.lufs}:TP=-1.5:LRA=11`, duration: d }
    case 'fade': {
      const parts: string[] = []
      if (s.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${r3(s.fadeIn)}`)
      if (s.fadeOut > 0 && d > 0) parts.push(`afade=t=out:st=${r3(Math.max(0, d - s.fadeOut))}:d=${r3(s.fadeOut)}`)
      return { filter: parts.join(',') || 'anull', duration: d }
    }
    case 'pitch': {
      const rate = src.sampleRate || 44100
      const ratio = 2 ** (s.semitones / 12)
      const tempo = atempoChain(1 / ratio).map((t) => `atempo=${t}`).join(',')
      return { filter: `asetrate=${Math.round(rate * ratio)},aresample=${rate},${tempo}`, duration: d }
    }
    case 'ringtone': {
      const len = s.length > 0 ? Math.min(s.length, Math.max(0, d - s.start)) : Math.max(0, d - s.start)
      const parts: string[] = []
      if (s.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${r3(s.fadeIn)}`)
      if (s.fadeOut > 0 && len > 0) parts.push(`afade=t=out:st=${r3(Math.max(0, len - s.fadeOut))}:d=${r3(s.fadeOut)}`)
      return { filter: parts.join(',') || 'anull', duration: len }
    }
  }
}

const ENCODE: MediaSettings = {
  bitrate: 192,
  bitDepth: 16,
  flacLevel: 5,
  sampleRate: 0,
  channels: 0,
  quality: 'balanced',
  maxHeight: 0,
  forceEncode: true,
  gifFps: 12,
  gifWidth: 480,
  start: 0,
  length: 0,
}

export function effectArgs(effect: AudioEffect, s: EffectSettings, src: SourceInfo, input: string): { args: string[]; output: string; mime: string; ext: string; duration: number } {
  const { filter, duration } = effectFilter(effect, s, src)
  const out = outputFormat(s, src.ext)
  const output = `output.${out.ext}`
  const trim = effect === 'ringtone' ? [...(s.start > 0 ? ['-ss', r3(s.start).toString()] : []), ...(s.length > 0 ? ['-t', r3(s.length).toString()] : [])] : []
  const codec = out.fmt === 'm4r' ? ['-c:a', 'aac', '-b:a', '192k', '-f', 'ipod'] : audioCodecArgs(out.fmt, ENCODE).args
  return { args: [...trim, '-i', input, '-vn', '-map', '0:a:0', '-af', filter, ...codec, output], output, mime: out.mime, ext: out.ext, duration }
}
