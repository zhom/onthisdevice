import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crop, Pause, Play, Scan } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clamp, cn, stripExtension } from '@/lib/utils'

import { formatTimecode, getEngine, inputName, onEngineLog, probeWithEngine } from './_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  ResultPanel,
  SelectField,
  SourceSummary,
  useMediaJob,
  useSourceFile,
} from './_shared'
import { QUALITY_OPTIONS, VIDEO_ACCEPT, X264_SPEED_OPTIONS, crfFor, evenClamp } from './video-shared'
import type { QualityKey } from './video-shared'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const PRESETS = [
  { value: 'free', label: 'Free: drag any shape', ratio: null },
  { value: '9:16', label: '9:16 (TikTok, Reels, Shorts)', ratio: 9 / 16 },
  { value: '1:1', label: '1:1 (Instagram square)', ratio: 1 },
  { value: '4:5', label: '4:5 (Instagram portrait)', ratio: 4 / 5 },
  { value: '16:9', label: '16:9 (YouTube, widescreen)', ratio: 16 / 9 },
  { value: '4:3', label: '4:3 (classic, iPad)', ratio: 4 / 3 },
]

function fitRatio(source: { w: number; h: number }, ratio: number): Rect {
  let w = source.w
  let h = w / ratio
  if (h > source.h) {
    h = source.h
    w = h * ratio
  }
  return {
    x: Math.round((source.w - w) / 2),
    y: Math.round((source.h - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export default function CropVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; rect: Rect } | null>(null)

  const [url, setUrl] = useState('')
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [preset, setPreset] = useState('free')
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [speed, setSpeed] = useState('veryfast')
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [detecting, setDetecting] = useState(false)
  const [detectNote, setDetectNote] = useState<string | null>(null)
  const [displayWidth, setDisplayWidth] = useState(0)

  const file = source.file
  const duration = source.info?.duration ?? 0
  const ratio = PRESETS.find((p) => p.value === preset)?.ratio ?? null

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  useEffect(() => {
    if (!natural) return
    setRect({ x: 0, y: 0, w: natural.w, h: natural.h })
  }, [natural])

  // Track the rendered width so source pixels can be mapped to screen pixels.
  useEffect(() => {
    const node = frameRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setDisplayWidth(node.clientWidth))
    observer.observe(node)
    setDisplayWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [url])

  const scale = natural && displayWidth > 0 ? displayWidth / natural.w : 0

  const applyRect = useCallback(
    (next: Rect) => {
      if (!natural) return
      const w = clamp(Math.round(next.w), 16, natural.w)
      const h = clamp(Math.round(next.h), 16, natural.h)
      setRect({
        x: clamp(Math.round(next.x), 0, natural.w - w),
        y: clamp(Math.round(next.y), 0, natural.h - h),
        w,
        h,
      })
    },
    [natural],
  )

  const onPointerDown = (handle: Handle) => (event: React.PointerEvent<HTMLElement>) => {
    if (!natural || job.busy) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, rect }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || !natural || scale === 0) return
    const dx = (event.clientX - drag.startX) / scale
    const dy = (event.clientY - drag.startY) / scale
    const base = drag.rect

    if (drag.handle === 'move') {
      applyRect({ ...base, x: base.x + dx, y: base.y + dy })
      return
    }

    let { x, y, w, h } = base
    if (drag.handle === 'se') {
      w = base.w + dx
      h = ratio ? w / ratio : base.h + dy
    } else if (drag.handle === 'sw') {
      w = base.w - dx
      h = ratio ? w / ratio : base.h + dy
      x = base.x + (base.w - w)
    } else if (drag.handle === 'ne') {
      w = base.w + dx
      h = ratio ? w / ratio : base.h - dy
      y = base.y + (base.h - h)
    } else {
      w = base.w - dx
      h = ratio ? w / ratio : base.h - dy
      x = base.x + (base.w - w)
      y = base.y + (base.h - h)
    }
    applyRect({ x, y, w, h })
  }

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        /* pointer already released */
      }
      dragRef.current = null
    }
  }

  const onRectKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!natural) return
    const step = event.shiftKey ? 10 : 1
    const resize = event.altKey
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = map[event.key]
    if (!delta) return
    event.preventDefault()
    if (resize) {
      const w = rect.w + delta[0]
      applyRect({ ...rect, w, h: ratio ? w / ratio : rect.h + delta[1] })
    } else {
      applyRect({ ...rect, x: rect.x + delta[0], y: rect.y + delta[1] })
    }
  }

  const choosePreset = (value: string) => {
    setPreset(value)
    const found = PRESETS.find((p) => p.value === value)
    if (found?.ratio && natural) applyRect(fitRatio({ w: natural.w, h: natural.h }, found.ratio))
  }

  /**
   * Ask FFmpeg's `cropdetect` filter where the letterboxing ends. It samples the
   * first few seconds and prints a suggested crop rectangle to the log.
   */
  const detectBars = async () => {
    if (!file || !natural) return
    setDetecting(true)
    setDetectNote(null)
    let found: Rect | null = null
    const off = onEngineLog((line) => {
      const match = /crop=(\d+):(\d+):(\d+):(\d+)/.exec(line)
      if (match)
        found = {
          w: Number(match[1]),
          h: Number(match[2]),
          x: Number(match[3]),
          y: Number(match[4]),
        }
    })
    const name = inputName(file, 'detect')
    try {
      const ffmpeg = await getEngine()
      await ffmpeg.writeFile(name, new Uint8Array(await file.arrayBuffer()))
      await ffmpeg.exec(['-hide_banner', '-t', '6', '-i', name, '-vf', 'cropdetect=24:2:0', '-f', 'null', '-'])
      try {
        await ffmpeg.deleteFile(name)
      } catch {
        /* already gone */
      }
      if (found) {
        const detected = found as Rect
        applyRect(detected)
        setPreset('free')
        setDetectNote(
          detected.w >= natural.w && detected.h >= natural.h
            ? 'No black bars found. This video already fills the frame, so the crop stays at full size.'
            : `Detected content at ${detected.w}×${detected.h}, offset ${detected.x},${detected.y}. Adjust it by hand if the edges look wrong.`,
        )
      } else {
        setDetectNote(
          'FFmpeg could not work out where the black bars end in this clip. Drag the rectangle by hand instead.',
        )
      }
    } catch {
      setDetectNote(
        'Automatic bar detection failed on this file. You can still set the crop rectangle by hand.',
      )
    } finally {
      off()
      setDetecting(false)
    }
  }

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}-cropped.mp4` : 'cropped.mp4'),
    [file],
  )

  const cropArgs = useMemo(() => {
    const w = evenClamp(rect.w)
    const h = evenClamp(rect.h)
    const x = Math.max(0, Math.round(rect.x))
    const y = Math.max(0, Math.round(rect.y))
    return { w, h, x, y, filter: `crop=${w}:${h}:${x}:${y}` }
  }, [rect])

  const start = () => {
    if (!file || !natural) return
    const name = inputName(file)
    void job.run(() => ({
      inputs: [{ name, data: file }],
      commands: [
        [
          '-i',
          name,
          '-vf',
          cropArgs.filter,
          '-c:v',
          'libx264',
          '-preset',
          speed,
          '-crf',
          String(crfFor('mp4', quality)),
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          'output.mp4',
        ],
      ],
      output: 'output.mp4',
      mime: 'video/mp4',
      filename: outputName,
      durationSec: duration,
      inputBytes: file.size,
    }))
  }

  const reset = () => {
    job.reset()
    source.clear()
    setNatural(null)
    setDetectNote(null)
    setPlaying(false)
    setPosition(0)
  }

  const readSizeWithEngine = async () => {
    if (!file) return
    setDetecting(true)
    try {
      const probe = await probeWithEngine(file)
      if (probe.width > 0) {
        setNatural({ w: probe.width, h: probe.height })
        if (probe.duration > 0) source.setDuration(probe.duration)
      } else {
        setDetectNote('FFmpeg could not read the frame size of this file.')
      }
    } catch {
      setDetectNote('FFmpeg could not read this file.')
    } finally {
      setDetecting(false)
    }
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={VIDEO_ACCEPT}
          onFiles={source.select}
          maxSizeMb={4096}
          title="Drop a video here to crop it"
          hint="MP4, MOV, WebM, MKV or AVI, with no length limit"
        />
        <EngineNotice />
      </div>
    )
  }

  const divisor = natural ? gcd(cropArgs.w, cropArgs.h) : 1
  const handleClass =
    'absolute size-4 rounded-sm border-2 border-background bg-primary shadow-sm touch-none'

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={duration}
        width={natural?.w}
        height={natural?.h}
        onClear={reset}
      />

      {url ? (
        <div className="space-y-3">
          <div
            ref={frameRef}
            className="relative mx-auto w-full max-w-full overflow-hidden rounded-lg bg-muted"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <video
              ref={videoRef}
              src={url}
              playsInline
              muted
              preload="metadata"
              className="block h-auto w-full"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget
                if (el.videoWidth > 0) setNatural({ w: el.videoWidth, h: el.videoHeight })
              }}
              onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />

            {natural && scale > 0 ? (
              <>
                {/* Four scrim panels rather than one big shadow, so the dimming
                    respects the theme instead of hardcoding a colour. */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 bg-background/70"
                  style={{ height: rect.y * scale }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/70"
                  style={{ height: (natural.h - rect.y - rect.h) * scale }}
                />
                <div
                  className="pointer-events-none absolute left-0 bg-background/70"
                  style={{ top: rect.y * scale, height: rect.h * scale, width: rect.x * scale }}
                />
                <div
                  className="pointer-events-none absolute right-0 bg-background/70"
                  style={{
                    top: rect.y * scale,
                    height: rect.h * scale,
                    width: (natural.w - rect.x - rect.w) * scale,
                  }}
                />

                <div
                  role="group"
                  tabIndex={0}
                  aria-label={`Crop rectangle, ${cropArgs.w} by ${cropArgs.h} pixels at ${cropArgs.x}, ${cropArgs.y}. Arrow keys move it, Alt with arrow keys resizes it.`}
                  className={cn(
                    'absolute cursor-move touch-none border-2 border-primary outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                  style={{
                    left: rect.x * scale,
                    top: rect.y * scale,
                    width: rect.w * scale,
                    height: rect.h * scale,
                  }}
                  onPointerDown={onPointerDown('move')}
                  onKeyDown={onRectKeyDown}
                >
                  <span className={cn(handleClass, '-left-2 -top-2 cursor-nwse-resize')} onPointerDown={onPointerDown('nw')} />
                  <span className={cn(handleClass, '-right-2 -top-2 cursor-nesw-resize')} onPointerDown={onPointerDown('ne')} />
                  <span className={cn(handleClass, '-bottom-2 -left-2 cursor-nesw-resize')} onPointerDown={onPointerDown('sw')} />
                  <span className={cn(handleClass, '-bottom-2 -right-2 cursor-nwse-resize')} onPointerDown={onPointerDown('se')} />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const el = videoRef.current
                if (!el) return
                if (el.paused) void el.play()
                else el.pause()
              }}
            >
              {playing ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <div className="flex min-w-[12rem] flex-1 items-center gap-2">
              <Label htmlFor="crop-seek" className="sr-only">
                Seek the preview
              </Label>
              <input
                id="crop-seek"
                type="range"
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.05}
                value={position}
                onChange={(event) => {
                  const el = videoRef.current
                  const next = Number(event.target.value)
                  setPosition(next)
                  if (el) el.currentTime = next
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatTimecode(position)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {!natural ? (
        <div className="space-y-3 rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            Your browser cannot decode this container, so it cannot show the frame. FFmpeg can read
            the dimensions. Then you can set the crop rectangle with the numbers below.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void readSizeWithEngine()} disabled={detecting}>
            {detecting ? 'Reading the file…' : 'Read the frame size with FFmpeg'}
          </Button>
        </div>
      ) : null}

      <ToolPanel
        title="Crop area"
        description="Drag the rectangle, pick a social preset, or type exact pixel values. The numbers are always in source pixels."
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button type="button" onClick={start} disabled={job.busy || !natural}>
              <Crop className="size-4" aria-hidden="true" />
              {job.busy ? 'Cropping…' : 'Crop video'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void detectBars()}
              disabled={job.busy || detecting || !natural}
            >
              <Scan className="size-4" aria-hidden="true" />
              {detecting ? 'Scanning…' : 'Remove black bars'}
            </Button>
            {natural ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => applyRect({ x: 0, y: 0, w: natural.w, h: natural.h })}
                disabled={job.busy}
              >
                Reset to full frame
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Aspect ratio"
            value={preset}
            onChange={choosePreset}
            options={PRESETS.map(({ value, label }) => ({ value, label }))}
            hint={ratio ? 'The rectangle keeps this shape while you drag a corner.' : 'Corners drag freely.'}
            disabled={job.busy}
          />
          <div className="grid grid-cols-2 gap-3">
            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`crop-${key}`}>
                  {key === 'x' ? 'Left (px)' : key === 'y' ? 'Top (px)' : key === 'w' ? 'Width (px)' : 'Height (px)'}
                </Label>
                <Input
                  id={`crop-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={job.busy || !natural}
                  value={Math.round(rect[key])}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    applyRect({ ...rect, [key]: value })
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {natural ? (
          <p className="text-sm text-muted-foreground">
            Output: <span className="font-mono text-foreground">{cropArgs.w}×{cropArgs.h}</span> (
            {(cropArgs.w / divisor).toFixed(0)}:{(cropArgs.h / divisor).toFixed(0)}) from a{' '}
            {natural.w}×{natural.h} source, with the FFmpeg filter{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{cropArgs.filter}</code>.
            Width and height are rounded down to even numbers because H.264 requires it.
          </p>
        ) : null}

        {detectNote ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {detectNote}
          </p>
        ) : null}

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Quality"
              value={quality}
              onChange={(value) => setQuality(value as QualityKey)}
              options={QUALITY_OPTIONS}
              hint={`CRF ${crfFor('mp4', quality)}. Cropping always re-encodes the picture, so this controls how much detail survives.`}
            />
            <SelectField
              label="Encoder speed preset"
              value={speed}
              onChange={setSpeed}
              options={X264_SPEED_OPTIONS}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            The soundtrack is re-encoded to AAC 192 kbps so the result is a clean, universally
            playable MP4 whatever the source was.
          </p>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Cropping" />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel="Download cropped MP4"
          resetLabel="Crop another video"
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
