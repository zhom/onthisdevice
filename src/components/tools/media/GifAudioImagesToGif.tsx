import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Clapperboard,
  GripVertical,
  ImagePlus,
  Pause,
  Play,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBytes } from '@/lib/utils'

import { getEngine } from './_ffmpeg'
import { AdvancedOptions, SelectField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  canvasToPngBytes,
  cleanupFs,
  decodeImage,
  execFFmpeg,
  formatElapsed,
  imageSize,
  parseGifMeta,
  readOutput,
  useObjectUrl,
  useTask,
} from './_gif-audio-core'

const ACCEPT = '.png,.jpg,.jpeg,.webp,.bmp,.gif,.avif,image/*'
const MAX_FRAMES = 200
const MIN_DELAY_MS = 20

interface Frame {
  id: string
  file: File
  url: string
  width: number
  height: number
  delayMs: number
}

interface GifResult {
  blob: Blob
  filename: string
  width: number
  height: number
  frames: number
  durationSec: number
  elapsedMs: number
}

const DITHER_OPTIONS = [
  { value: 'sierra2_4a', label: 'Sierra 2-4A: natural grain (default)' },
  { value: 'floyd_steinberg', label: 'Floyd–Steinberg: smoothest gradients' },
  { value: 'bayer:bayer_scale=3', label: 'Bayer: ordered pattern, smaller file' },
  { value: 'none', label: 'None: hard edges, smallest file' },
]

const COLOR_OPTIONS = [
  { value: '256', label: '256 colours (maximum quality)' },
  { value: '128', label: '128 colours' },
  { value: '64', label: '64 colours (much smaller)' },
  { value: '32', label: '32 colours (poster or pixel-art look)' },
]

const LOOP_OPTIONS = [
  { value: '0', label: 'Loop forever' },
  { value: '3', label: 'Play 4 times, then stop' },
  { value: '1', label: 'Play twice, then stop' },
  { value: '-1', label: 'Play once, no loop' },
]

const FIT_OPTIONS = [
  { value: 'contain', label: 'Fit inside: whole image, padded edges' },
  { value: 'cover', label: 'Fill the frame: crops the overflow' },
  { value: 'stretch', label: 'Stretch: distorts to fit exactly' },
]

const BACKGROUNDS = [
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
  { value: '#f1f5f9', label: 'Light grey' },
  { value: '#1e293b', label: 'Dark slate' },
]

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Snap to whole centiseconds — the only precision the GIF format stores. */
function snapDelay(ms: number): number {
  return Math.max(MIN_DELAY_MS, Math.round(ms / 10) * 10)
}

export default function GifAudioImagesToGif() {
  const [frames, setFrames] = useState<Frame[]>([])
  const [defaultDelay, setDefaultDelay] = useState(100)
  const [width, setWidth] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [linked, setLinked] = useState(true)
  const [fit, setFit] = useState('contain')
  const [background, setBackground] = useState('#ffffff')
  const [dither, setDither] = useState('sierra2_4a')
  const [colors, setColors] = useState('256')
  const [loop, setLoop] = useState('0')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [previewIndex, setPreviewIndex] = useState(0)

  const task = useTask<GifResult>()
  const resultUrl = useObjectUrl(task.result?.blob ?? null)
  const framesRef = useRef<Frame[]>([])
  framesRef.current = frames

  // Revoke every thumbnail URL when the island unmounts.
  useEffect(() => {
    return () => {
      for (const frame of framesRef.current) URL.revokeObjectURL(frame.url)
    }
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      setAddError(null)
      const room = MAX_FRAMES - framesRef.current.length
      if (room <= 0) {
        setAddError(`This tool holds ${MAX_FRAMES} frames at a time. Remove some first.`)
        return
      }
      const accepted = files.slice(0, room)
      const next: Frame[] = []
      const failed: string[] = []

      for (const file of accepted) {
        try {
          const decoded = await decodeImage(file)
          const size = imageSize(decoded)
          if (decoded instanceof ImageBitmap) decoded.close()
          if (size.width === 0 || size.height === 0) throw new Error('empty')
          next.push({
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            url: URL.createObjectURL(file),
            width: size.width,
            height: size.height,
            delayMs: snapDelay(defaultDelay),
          })
        } catch {
          failed.push(file.name)
        }
      }

      if (failed.length > 0)
        setAddError(
          `Could not read ${failed.length === 1 ? failed[0] : `${failed.length} files`}. Animated GIFs, PNG, JPEG, WebP and BMP still images all work.`,
        )
      else if (files.length > accepted.length)
        setAddError(`Only the first ${room} images were added. The limit is ${MAX_FRAMES} frames.`)

      if (next.length === 0) return

      // Seed the output size from the first image, before the state update —
      // a setState updater must stay pure.
      const first = next[0]
      if (framesRef.current.length === 0 && first) {
        const target = Math.min(480, first.width)
        setWidth(target)
        setHeight(Math.max(1, Math.round((target * first.height) / first.width)))
      }
      setFrames((current) => [...current, ...next])
      task.reset()
    },
    [defaultDelay, task],
  )

  const removeFrame = (index: number) => {
    setFrames((current) => {
      const frame = current[index]
      if (frame) URL.revokeObjectURL(frame.url)
      return current.filter((_, i) => i !== index)
    })
    task.reset()
  }

  const moveFrame = (from: number, to: number) => {
    setFrames((current) => {
      if (to < 0 || to >= current.length || from === to) return current
      const copy = [...current]
      const [moved] = copy.splice(from, 1)
      if (moved) copy.splice(to, 0, moved)
      return copy
    })
    task.reset()
  }

  const setFrameDelay = (index: number, ms: number) => {
    setFrames((current) =>
      current.map((frame, i) => (i === index ? { ...frame, delayMs: snapDelay(ms) } : frame)),
    )
  }

  const applyDelayToAll = () => {
    const ms = snapDelay(defaultDelay)
    setFrames((current) => current.map((frame) => ({ ...frame, delayMs: ms })))
  }

  const outWidth = typeof width === 'number' && width > 0 ? Math.round(width) : 0
  const outHeight = typeof height === 'number' && height > 0 ? Math.round(height) : 0
  const firstFrame = frames[0]

  const onWidthChange = (value: number | '') => {
    setWidth(value)
    if (linked && typeof value === 'number' && value > 0 && firstFrame)
      setHeight(Math.max(1, Math.round((value * firstFrame.height) / firstFrame.width)))
  }
  const onHeightChange = (value: number | '') => {
    setHeight(value)
    if (linked && typeof value === 'number' && value > 0 && firstFrame)
      setWidth(Math.max(1, Math.round((value * firstFrame.width) / firstFrame.height)))
  }

  const totalMs = frames.reduce((sum, frame) => sum + frame.delayMs, 0)
  const averageFps = totalMs > 0 ? (frames.length / totalMs) * 1000 : 0
  const uniformDelay = frames.length > 0 && frames.every((f) => f.delayMs === frames[0]?.delayMs)

  /* Rough uncompressed budget — GIF is ~1 byte/pixel/frame before LZW. */
  const estimate = useMemo(() => {
    if (outWidth === 0 || outHeight === 0 || frames.length === 0) return 0
    const perFrame = outWidth * outHeight
    const factor = Number(colors) / 256
    return perFrame * frames.length * 0.45 * (0.55 + 0.45 * factor)
  }, [colors, frames.length, outHeight, outWidth])

  /* ---------------- live preview ---------------- */

  useEffect(() => {
    if (!playing || frames.length < 2) return
    const current = frames[previewIndex % frames.length]
    const wait = current ? current.delayMs : 100
    const timer = window.setTimeout(() => {
      setPreviewIndex((index) => (index + 1) % frames.length)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [frames, playing, previewIndex])

  useEffect(() => {
    if (previewIndex >= frames.length) setPreviewIndex(0)
  }, [frames.length, previewIndex])

  const previewFrame = frames[Math.min(previewIndex, Math.max(0, frames.length - 1))]

  /* ---------------- build ---------------- */

  const build = () => {
    if (frames.length === 0) return
    if (outWidth < 2 || outHeight < 2) {
      task.fail('Set an output width and height of at least 2 pixels.')
      return
    }
    if (outWidth * outHeight > 4_000_000) {
      task.fail(
        'That output size is over 4 megapixels per frame. GIF stores every frame in full, so a GIF this large will be very big. Use 800 px wide or less.',
      )
      return
    }

    const snapshot = frames.map((frame) => ({ ...frame }))

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()

      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('This browser did not give us a 2D canvas to draw frames on.')

      const written: string[] = []
      const temps = ['palette.png', 'list.txt', 'out.gif']

      try {
        // 1. Normalise every source image to identical dimensions. GIF frames
        //    must share one canvas size, and doing it here means FFmpeg never
        //    has to scale mixed inputs.
        for (let i = 0; i < snapshot.length; i += 1) {
          ctx.throwIfCancelled()
          const frame = snapshot[i]
          if (!frame) continue
          ctx.setStatus(`Preparing frame ${i + 1} of ${snapshot.length}…`)
          ctx.setPercent((i / snapshot.length) * 35)

          const decoded = await decodeImage(frame.file)
          const size = imageSize(decoded)
          context.fillStyle = background
          context.fillRect(0, 0, outWidth, outHeight)

          if (fit === 'stretch') {
            context.drawImage(decoded, 0, 0, outWidth, outHeight)
          } else {
            const scale =
              fit === 'cover'
                ? Math.max(outWidth / size.width, outHeight / size.height)
                : Math.min(outWidth / size.width, outHeight / size.height)
            const drawWidth = size.width * scale
            const drawHeight = size.height * scale
            context.drawImage(
              decoded,
              (outWidth - drawWidth) / 2,
              (outHeight - drawHeight) / 2,
              drawWidth,
              drawHeight,
            )
          }
          if (decoded instanceof ImageBitmap) decoded.close()

          const name = `f${String(i).padStart(4, '0')}.png`
          await ffmpeg.writeFile(name, await canvasToPngBytes(canvas))
          written.push(name)
        }

        ctx.throwIfCancelled()
        ctx.setStatus('Building the colour palette…')

        // 2. Work out the timing. Delays are whole centiseconds, so the base
        //    tick is their GCD and every frame is an exact multiple of it.
        const delaysCs = snapshot.map((frame) => Math.max(2, Math.round(frame.delayMs / 10)))
        let baseCs = delaysCs.reduce((a, b) => gcd(a, b), delaysCs[0] ?? 10)
        if (baseCs < 2) baseCs = 2
        const uniform = delaysCs.every((cs) => cs === delaysCs[0])
        const fpsExpr = `100/${baseCs}`

        const inputArgs = uniform
          ? ['-framerate', fpsExpr, '-start_number', '0', '-i', 'f%04d.png']
          : ['-f', 'concat', '-safe', '0', '-i', 'list.txt']

        let totalTicks = snapshot.length
        if (!uniform) {
          // The concat demuxer repeats a *reference*, not the bytes, so holding
          // a frame costs nothing in memory.
          const lines: string[] = []
          const seconds = (baseCs / 100).toFixed(4)
          let ticks = 0
          snapshot.forEach((frame, i) => {
            const repeats = Math.max(1, Math.round(delaysCs[i]! / baseCs))
            for (let r = 0; r < repeats; r += 1) {
              lines.push(`file 'f${String(i).padStart(4, '0')}.png'`)
              lines.push(`duration ${seconds}`)
              ticks += 1
            }
          })
          // The concat demuxer ignores the final entry's duration unless the
          // file is listed once more.
          const lastIndex = snapshot.length - 1
          lines.push(`file 'f${String(lastIndex).padStart(4, '0')}.png'`)
          totalTicks = ticks
          await ffmpeg.writeFile('list.txt', new TextEncoder().encode(`${lines.join('\n')}\n`))
        }

        const paletteFilter = `fps=${fpsExpr},palettegen=max_colors=${colors}:stats_mode=full`
        await execFFmpeg(
          ffmpeg,
          [...inputArgs, '-vf', paletteFilter, '-y', 'palette.png'],
          {
            totalFrames: totalTicks,
            onProgress: (fraction) => ctx.setPercent(35 + fraction * 20),
          },
        )

        ctx.throwIfCancelled()
        ctx.setStatus('Encoding the GIF…')

        await execFFmpeg(
          ffmpeg,
          [
            ...inputArgs,
            '-i',
            'palette.png',
            '-lavfi',
            `fps=${fpsExpr}[x];[x][1:v]paletteuse=dither=${dither}`,
            '-loop',
            loop,
            '-y',
            'out.gif',
          ],
          {
            totalFrames: totalTicks,
            onProgress: (fraction) => ctx.setPercent(55 + fraction * 44),
          },
        )

        ctx.throwIfCancelled()
        const blob = await readOutput(ffmpeg, 'out.gif', 'image/gif')
        const meta = parseGifMeta(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()))

        return {
          blob,
          filename: 'animation.gif',
          width: meta?.width || outWidth,
          height: meta?.height || outHeight,
          frames: totalTicks,
          durationSec: snapshot.reduce((sum, frame) => sum + frame.delayMs, 0) / 1000,
          elapsedMs: performance.now() - started,
        }
      } finally {
        await cleanupFs(ffmpeg, [...written, ...temps])
      }
    })
  }

  if (frames.length === 0) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          multiple
          onFiles={(files) => void addFiles(files)}
          maxSizeMb={200}
          title="Drop your images here"
          hint="PNG, JPEG, WebP or BMP. Select them all at once, then drag to reorder"
          icon={ImagePlus}
        />
        {addError ? <ErrorNote message={addError} /> : null}
        <Note>
          Frames are laid out and timed in this tab, then encoded by FFmpeg compiled to WebAssembly.
          You can add up to {MAX_FRAMES} images.
        </Note>
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title={`${frames.length} frame${frames.length === 1 ? '' : 's'}`}
        description="Drag a card to reorder, or use the arrow buttons. Each card holds its own delay in milliseconds."
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFrames((current) => [...current].reverse())}
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Reverse order
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={applyDelayToAll}>
              <Shuffle className="size-4" aria-hidden="true" />
              Apply {snapDelay(defaultDelay)} ms to every frame
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                for (const frame of frames) URL.revokeObjectURL(frame.url)
                setFrames([])
                task.reset()
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove all
            </Button>
          </div>
        }
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {frames.map((frame, index) => (
            <li
              key={frame.id}
              draggable
              onDragStart={(event) => {
                setDragIndex(index)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(index))
              }}
              onDragOver={(event) => {
                if (dragIndex === null) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (dragIndex === null) return
                event.preventDefault()
                moveFrame(dragIndex, index)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className="group relative overflow-hidden rounded-lg bg-card"
            >
              <div className="relative aspect-square bg-muted">
                <img
                  src={frame.url}
                  alt={`Frame ${index + 1}: ${frame.file.name}`}
                  className="size-full object-contain"
                />
                <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                  {index + 1}
                </span>
                <span
                  className="absolute right-1.5 top-1.5 rounded bg-background/85 p-1 text-muted-foreground"
                  aria-hidden="true"
                >
                  <GripVertical className="size-3.5" />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove frame ${index + 1}`}
                  className="absolute bottom-1.5 right-1.5 size-7 bg-background/85"
                  onClick={() => removeFrame(index)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
              <div className="space-y-1.5 p-2">
                <p className="truncate text-[11px] text-muted-foreground" title={frame.file.name}>
                  {frame.file.name}
                </p>
                <div className="flex items-center gap-1">
                  <Label htmlFor={`delay-${frame.id}`} className="sr-only">
                    Delay for frame {index + 1} in milliseconds
                  </Label>
                  <Input
                    id={`delay-${frame.id}`}
                    type="number"
                    inputMode="numeric"
                    min={MIN_DELAY_MS}
                    step={10}
                    value={frame.delayMs}
                    onChange={(event) => setFrameDelay(index, Number(event.target.value))}
                    className="h-8 px-2 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">ms</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-0 text-xs"
                    disabled={index === 0}
                    aria-label={`Move frame ${index + 1} earlier`}
                    onClick={() => moveFrame(index, index - 1)}
                  >
                    ←
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-0 text-xs"
                    disabled={index === frames.length - 1}
                    aria-label={`Move frame ${index + 1} later`}
                    onClick={() => moveFrame(index, index + 1)}
                  >
                    →
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <FileDropzone
          accept={ACCEPT}
          multiple
          onFiles={(files) => void addFiles(files)}
          maxSizeMb={200}
          title="Add more images"
          hint={`${MAX_FRAMES - frames.length} more frames can be added`}
          icon={ImagePlus}
          className="py-6"
        />
        {addError ? <ErrorNote message={addError} /> : null}
      </ToolPanel>

      <ToolPanel
        title="Preview and settings"
        description="The preview runs at the exact delays below, so what you see here is what the GIF will do."
        footer={
          <Button
            type="button"
            onClick={build}
            disabled={task.busy || frames.length === 0}
            className="w-full sm:w-auto"
          >
            <Clapperboard className="size-4" aria-hidden="true" />
            {task.busy ? 'Building GIF…' : 'Create GIF'}
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div
              className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border"
              style={{
                aspectRatio: outWidth && outHeight ? `${outWidth} / ${outHeight}` : '1 / 1',
                background,
              }}
            >
              {previewFrame ? (
                <img
                  src={previewFrame.url}
                  alt={`Preview frame ${previewIndex + 1} of ${frames.length}`}
                  className="size-full"
                  style={{ objectFit: fit === 'stretch' ? 'fill' : (fit as 'contain' | 'cover') }}
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlaying((value) => !value)}
                disabled={frames.length < 2}
              >
                {playing ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {playing ? 'Pause preview' : 'Play preview'}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Frame {Math.min(previewIndex + 1, frames.length)} / {frames.length}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gif-width">Output width (px)</Label>
                <Input
                  id="gif-width"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={2000}
                  value={width}
                  onChange={(event) =>
                    onWidthChange(event.target.value === '' ? '' : Number(event.target.value))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gif-height">Output height (px)</Label>
                <Input
                  id="gif-height"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={2000}
                  value={height}
                  onChange={(event) =>
                    onHeightChange(event.target.value === '' ? '' : Number(event.target.value))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={linked}
                onChange={(event) => setLinked(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Keep the first image’s aspect ratio
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="gif-default-delay">Default frame delay (ms)</Label>
              <Input
                id="gif-default-delay"
                type="number"
                inputMode="numeric"
                min={MIN_DELAY_MS}
                step={10}
                value={defaultDelay}
                onChange={(event) => setDefaultDelay(Number(event.target.value) || MIN_DELAY_MS)}
              />
              <p className="text-xs text-muted-foreground">
                New frames get this delay. {snapDelay(defaultDelay)} ms ={' '}
                {(1000 / snapDelay(defaultDelay)).toFixed(1)} fps.
              </p>
            </div>

            <SelectField
              label="How images fit the frame"
              value={fit}
              onChange={setFit}
              options={FIT_OPTIONS}
              hint="Applies when your images are not all the same shape."
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat
            label="Animation length"
            value={`${(totalMs / 1000).toFixed(2)} s`}
            hint={
              uniformDelay
                ? `${averageFps.toFixed(1)} fps, even timing`
                : `${averageFps.toFixed(1)} fps average, mixed delays`
            }
          />
          <ResultStat
            label="Output size"
            value={outWidth && outHeight ? `${outWidth} × ${outHeight}` : '–'}
            hint={`${frames.length} frames`}
          />
          <ResultStat
            label="Rough file size"
            value={estimate > 0 ? `≈ ${formatBytes(estimate)}` : '–'}
            hint="Before LZW compression. Flat colours come out well under this"
          />
        </div>

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Colours per frame"
              value={colors}
              onChange={setColors}
              options={COLOR_OPTIONS}
              hint="GIF stores at most 256 colours. Fewer means a smaller file and visible banding."
            />
            <SelectField
              label="Dithering"
              value={dither}
              onChange={setDither}
              options={DITHER_OPTIONS}
              hint="Dithering hides colour banding as fine noise, at the cost of file size."
            />
            <SelectField label="Looping" value={loop} onChange={setLoop} options={LOOP_OPTIONS} />
            <SelectField
              label="Padding colour"
              value={background}
              onChange={setBackground}
              options={BACKGROUNDS}
              hint="Fills the gaps when a portrait image sits in a landscape frame."
            />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <TaskStatus task={task} label="Building your GIF" />
      {task.phase === 'error' && task.error ? (
        <ErrorNote message={task.error} onRetry={build} />
      ) : null}

      {task.result ? (
        <ToolPanel title="Your GIF is ready">
          {resultUrl ? (
            <img
              src={resultUrl}
              alt="The generated animated GIF"
              className="mx-auto max-h-[420px] w-auto max-w-full rounded-lg border border-border"
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="File size" value={formatBytes(task.result.blob.size)} emphasis />
            <ResultStat
              label="Dimensions"
              value={`${task.result.width} × ${task.result.height}`}
              hint={`${task.result.durationSec.toFixed(2)} s long`}
            />
            <ResultStat
              label="Encoded in"
              value={formatElapsed(task.result.elapsedMs)}
              hint="On this device"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton
              blob={task.result.blob}
              filename={task.result.filename}
              label="Download GIF"
            />
            <Button type="button" variant="outline" onClick={() => task.reset()}>
              Change settings
            </Button>
          </div>
          {task.result.blob.size > 8 * 1024 * 1024 ? (
            <Note tone="warning">
              At {formatBytes(task.result.blob.size)} this is too big for most chat apps. Drop the
              width, cut the colours to 128, or convert it with{' '}
              <a href="/compress-gif" className="underline">
                Compress GIF
              </a>
              .
            </Note>
          ) : null}
        </ToolPanel>
      ) : null}

      <EngineNotice />
    </div>
  )
}
