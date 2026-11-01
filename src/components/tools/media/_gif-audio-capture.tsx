/**
 * Camera and microphone plumbing shared by the round-2 `gif-audio` batch
 * (voice recorder, microphone test, webcam test).
 *
 * Nothing here touches the network. `getUserMedia` hands us a live
 * `MediaStream` that stays inside the tab; the analyser, the canvas and the
 * `MediaRecorder` all run on the same device. There is no signalling channel,
 * no peer connection and no upload path anywhere in this file.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Browser-only values that hydrate cleanly
 * ------------------------------------------------------------------ */

const noSubscribe = () => () => {}

/**
 * Reads a browser-only value without a hydration mismatch: the server render
 * and the hydration pass both use `fallback`, then React re-renders with the
 * real value. `read` must return a primitive (or the same object each call).
 */
export function useClientValue<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noSubscribe, read, () => fallback)
}

const canCapture = () =>
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

/** True when getUserMedia exists. Assumed true on the server. */
export function useCaptureSupport(): boolean {
  return useClientValue(canCapture, true)
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export type CaptureKind = 'microphone' | 'camera'

/** Turn a DOMException from getUserMedia into something a person can act on. */
export function describeCaptureError(error: unknown, kind: CaptureKind): string {
  const device = kind === 'microphone' ? 'microphone' : 'camera'
  const name = error instanceof DOMException ? error.name : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Your browser blocked access to the ${device}. Click the padlock or camera icon in the address bar, set ${device} access to “Allow”, then reload this page. The permission is granted to this site only and nothing is recorded until you press record.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `No ${device} was found. Check that it is plugged in and enabled. On a laptop, also check for a hardware mute switch or a privacy shutter. Then press “Try again”.`
    case 'NotReadableError':
    case 'AbortError':
      return `The ${device} was found but another program is holding it. Close Zoom, Teams, Discord, OBS or any other tab using the ${device}, then try again.`
    case 'TypeError':
      return `This page needs a secure connection (HTTPS) to use the ${device}. Open it over https:// and try again.`
    default:
      break
  }

  if (typeof navigator !== 'undefined' && !navigator.mediaDevices)
    return `This browser does not expose the ${device} API. Use a current version of Chrome, Edge, Firefox or Safari.`

  return `Could not open the ${device}. ${error instanceof Error ? error.message : 'Unknown error.'}`
}

/* ------------------------------------------------------------------ *
 * Device enumeration
 * ------------------------------------------------------------------ */

export interface DeviceListState {
  devices: MediaDeviceInfo[]
  /** Browsers hide device labels until a permission has been granted once. */
  hasLabels: boolean
  refresh: () => Promise<void>
  supported: boolean
}

export function useDeviceList(kind: MediaDeviceKind): DeviceListState {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const supported = useClientValue(
    () =>
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.enumerateDevices === 'function',
    true,
  )

  const refresh = useCallback(async () => {
    if (!supported) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((device) => device.kind === kind))
    } catch {
      setDevices([])
    }
  }, [kind, supported])

  useEffect(() => {
    void refresh()
    if (!supported) return
    const handler = () => void refresh()
    navigator.mediaDevices.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', handler)
  }, [refresh, supported])

  return {
    devices,
    hasLabels: devices.some((device) => device.label.length > 0),
    refresh,
    supported,
  }
}

/* ------------------------------------------------------------------ *
 * Live audio visualiser
 * ------------------------------------------------------------------ */

export interface LevelSample {
  /** 0..1 root-mean-square level over the last analysis window. */
  rms: number
  /** 0..1 highest absolute sample in the window. */
  peak: number
}

/**
 * Draws a live waveform plus a level bar straight to the DOM in a rAF loop.
 * Deliberately does not use React state for the 60 fps path — re-rendering an
 * island sixty times a second would fight every other control on the page.
 */
export function AudioVisualiser({
  stream,
  onLevel,
  height = 96,
  className,
  paused = false,
}: {
  stream: MediaStream | null
  /** Throttled to about ten calls a second. */
  onLevel?: (sample: LevelSample) => void
  height?: number
  className?: string
  paused?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const readoutRef = useRef<HTMLSpanElement | null>(null)
  const levelCallback = useRef(onLevel)
  levelCallback.current = onLevel
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (!stream) return
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    // Safari and Chrome can hand back a suspended context; an analyser attached
    // to a suspended context reports pure silence, which would read as a broken
    // microphone.
    void context.resume().catch(() => {})
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)

    const samples = new Float32Array(analyser.fftSize)
    let frame = 0
    let lastReport = 0
    let disposed = false

    const draw = () => {
      if (disposed) return
      frame = requestAnimationFrame(draw)

      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      let peak = 0
      for (let i = 0; i < samples.length; i += 1) {
        const value = samples[i] ?? 0
        sum += value * value
        const absolute = Math.abs(value)
        if (absolute > peak) peak = absolute
      }
      const rms = Math.sqrt(sum / samples.length)

      const bar = barRef.current
      if (bar) {
        // Perceptual scale: raw RMS of speech sits around 0.05 and would look dead.
        const shown = Math.min(100, Math.round(Math.sqrt(rms) * 145))
        bar.style.width = `${shown}%`
      }
      const readout = readoutRef.current
      if (readout) {
        const db = rms > 0 ? 20 * Math.log10(rms) : -100
        readout.textContent = db <= -99 ? 'silent' : `${db.toFixed(0)} dB`
      }

      const canvas = canvasRef.current
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const width = canvas.clientWidth || 320
        if (canvas.width !== Math.round(width * dpr)) {
          canvas.width = Math.round(width * dpr)
          canvas.height = Math.round(height * dpr)
        }
        const ctx2d = canvas.getContext('2d')
        if (ctx2d) {
          ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx2d.clearRect(0, 0, width, height)
          const styles = getComputedStyle(canvas)
          ctx2d.strokeStyle = styles.color
          ctx2d.lineWidth = 1.5
          ctx2d.beginPath()
          const stepSize = Math.max(1, Math.floor(samples.length / width))
          for (let x = 0, i = 0; x < width; x += 1, i += stepSize) {
            const value = samples[i] ?? 0
            const y = height / 2 - value * (height / 2 - 2)
            if (x === 0) ctx2d.moveTo(x, y)
            else ctx2d.lineTo(x, y)
          }
          ctx2d.stroke()
        }
      }

      const now = performance.now()
      if (now - lastReport > 100) {
        lastReport = now
        if (!pausedRef.current) levelCallback.current?.({ rms, peak })
      }
    }

    frame = requestAnimationFrame(draw)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      try {
        source.disconnect()
        analyser.disconnect()
      } catch {
        /* already torn down */
      }
      void context.close()
    }
  }, [height, stream])

  return (
    <div className={cn('space-y-2', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Live waveform of your microphone input"
        style={{ height }}
        className="w-full rounded-lg bg-muted text-primary"
      />
      <div className="flex items-center gap-3">
        <div
          className="h-3 flex-1 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Input level"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            ref={barRef}
            className="h-full rounded-full bg-primary transition-[width] duration-75"
            style={{ width: '0%' }}
          />
        </div>
        <span
          ref={readoutRef}
          className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
        >
          silent
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MediaRecorder helpers
 * ------------------------------------------------------------------ */

const AUDIO_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
]

/** The best audio container this browser can actually record to. */
export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const candidate of AUDIO_CANDIDATES)
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  return ''
}

export function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('wav')) return 'wav'
  return 'bin'
}

/** mm:ss, or h:mm:ss past an hour. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hrs > 0)
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${mins}:${String(secs).padStart(2, '0')}`
}
