/**
 * Plays the original file with the bleeps applied live, so the user hears the
 * result before exporting. The media element's sound goes through Web Audio;
 * a gain on the original sound drops to zero inside each cut while the tone or
 * noise comes up. The schedule is renewed on every play, seek and time update,
 * so it follows the element's clock.
 */
import { FADE_S, TONE_HZ } from './bleep'
import type { BleepSound, Cut } from './bleep'

/** Seconds ahead that are scheduled at a time. */
const HORIZON = 2

export class BleepPreview {
  private ctx: AudioContext | null = null
  private dry: GainNode | null = null
  private fx: GainNode | null = null
  private source: AudioScheduledSourceNode | null = null
  private cuts: readonly Cut[] = []
  private sound: BleepSound = { kind: 'tone', level: 0.3 }
  private readonly onEvent = () => this.schedule()

  constructor(private readonly el: HTMLMediaElement) {
    for (const type of ['play', 'playing', 'pause', 'seeked', 'seeking', 'ratechange', 'timeupdate']) el.addEventListener(type, this.onEvent)
  }

  set(cuts: readonly Cut[], sound: BleepSound) {
    const kindChanged = sound.kind !== this.sound.kind
    this.cuts = cuts
    this.sound = sound
    if (kindChanged && this.ctx) this.connectEffect()
    this.schedule()
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    const media = ctx.createMediaElementSource(this.el)
    this.dry = ctx.createGain()
    this.fx = ctx.createGain()
    this.fx.gain.value = 0
    media.connect(this.dry).connect(ctx.destination)
    this.fx.connect(ctx.destination)
    this.ctx = ctx
    this.connectEffect()
    return ctx
  }

  private connectEffect() {
    const ctx = this.ctx
    if (!ctx || !this.fx) return
    this.source?.stop()
    this.source?.disconnect()
    this.source = null
    if (this.sound.kind === 'tone') {
      const osc = ctx.createOscillator()
      osc.frequency.value = TONE_HZ
      this.source = osc
    } else if (this.sound.kind === 'noise') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      noise.loop = true
      this.source = noise
    }
    this.source?.connect(this.fx)
    this.source?.start()
  }

  private schedule() {
    if (this.el.paused && !this.ctx) return
    const ctx = this.ensure()
    if (!this.el.paused && ctx.state === 'suspended') void ctx.resume()
    const dry = this.dry!.gain
    const fx = this.fx!.gain
    const now = ctx.currentTime
    const t0 = this.el.currentTime
    const rate = this.el.playbackRate || 1
    const level = this.sound.kind === 'silence' ? 0 : this.sound.level
    dry.cancelScheduledValues(now)
    fx.cancelScheduledValues(now)
    const inside = this.cuts.some((c) => t0 >= c.start && t0 < c.end)
    dry.setValueAtTime(inside ? 0 : 1, now)
    fx.setValueAtTime(inside ? level : 0, now)
    if (this.el.paused) return
    for (const c of this.cuts) {
      if (c.end <= t0 || c.start > t0 + HORIZON) continue
      if (c.start > t0) {
        const a = now + (c.start - t0) / rate
        dry.setValueAtTime(1, a)
        dry.linearRampToValueAtTime(0, a + FADE_S)
        fx.setValueAtTime(0, a)
        fx.linearRampToValueAtTime(level, a + FADE_S)
      }
      const b = now + (c.end - t0) / rate
      dry.setValueAtTime(0, b - FADE_S)
      dry.linearRampToValueAtTime(1, b)
      fx.setValueAtTime(level, b - FADE_S)
      fx.linearRampToValueAtTime(0, b)
    }
  }

  dispose() {
    for (const type of ['play', 'playing', 'pause', 'seeked', 'seeking', 'ratechange', 'timeupdate']) this.el.removeEventListener(type, this.onEvent)
    this.source?.stop()
    void this.ctx?.close()
    this.ctx = null
  }
}
