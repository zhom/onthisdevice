import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileImage, Gauge, Scaling } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBytes, stripExtension } from '@/lib/utils'

import { getEngine } from './_ffmpeg'
import { AdvancedOptions, SelectField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  cleanupFs,
  execFFmpeg,
  fileBytes,
  formatElapsed,
  parseGifMeta,
  readOutput,
  useObjectUrl,
  useTask,
} from './_gif-audio-core'
import type { GifMeta } from './_gif-audio-core'

export type GifMode = 'compress' | 'resize'

interface Attempt {
  index: number
  bytes: number
  label: string
}

interface GifOutcome {
  blob: Blob
  filename: string
  width: number
  height: number
  fps: number
  colors: number
  attempts: Attempt[]
  hitTarget: boolean
  targetBytes: number
  sourceBytes: number
  elapsedMs: number
  /** Re-encoding came out larger, so this is the untouched original. */
  kept?: boolean
}

interface Step {
  scale: number
  /** 0 = leave the frame rate alone. */
  fpsCap: number
  colors: number
}

/**
 * A quality ladder, best first. Binary-searching an ordered ladder finds the
 * best step that fits the target in about four local encodes — the loop an
 * upload-based compressor would have to charge for four times over.
 */
const LADDER: Step[] = [
  { scale: 1, fpsCap: 0, colors: 256 },
  { scale: 1, fpsCap: 0, colors: 128 },
  { scale: 0.85, fpsCap: 0, colors: 128 },
  { scale: 0.75, fpsCap: 15, colors: 128 },
  { scale: 0.66, fpsCap: 12, colors: 128 },
  { scale: 0.6, fpsCap: 12, colors: 96 },
  { scale: 0.5, fpsCap: 12, colors: 64 },
  { scale: 0.45, fpsCap: 10, colors: 64 },
  { scale: 0.4, fpsCap: 10, colors: 48 },
  { scale: 0.33, fpsCap: 8, colors: 32 },
  { scale: 0.28, fpsCap: 8, colors: 32 },
  { scale: 0.22, fpsCap: 6, colors: 24 },
  { scale: 0.18, fpsCap: 5, colors: 16 },
]

const TARGETS = [
  { value: '0', label: 'No target (optimise only)' },
  { value: '262144', label: '256 KB: forum avatars and signatures' },
  { value: '524288', label: '512 KB: most wikis and CMS uploads' },
  { value: '1048576', label: '1 MB' },
  { value: '2097152', label: '2 MB: email attachments' },
  { value: '8388608', label: '8 MB: Discord free upload' },
  { value: 'custom', label: 'Custom size…' },
]

const DITHER_OPTIONS = [
  { value: 'sierra2_4a', label: 'Sierra 2-4A: natural grain (default)' },
  { value: 'bayer:bayer_scale=3', label: 'Bayer: ordered pattern, compresses best' },
  { value: 'floyd_steinberg', label: 'Floyd–Steinberg: smoothest gradients' },
  { value: 'none', label: 'None: hard edges, smallest file' },
]

const RESIZE_PRESETS = [
  { value: 'custom', label: 'Custom width' },
  { value: '128', label: '128 px: Discord or Slack emoji' },
  { value: '160', label: '160 px' },
  { value: '256', label: '256 px: sticker or small avatar' },
  { value: '320', label: '320 px: inline in a chat' },
  { value: '480', label: '480 px: README and docs' },
  { value: '640', label: '640 px: full-width blog image' },
]

function evenish(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2)
}

export default function GifAudioCompressGif({ mode = 'compress' }: { mode?: GifMode }) {
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<GifMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  const [target, setTarget] = useState('2097152')
  const [customKb, setCustomKb] = useState(500)
  const [dither, setDither] = useState('sierra2_4a')
  const [keepLoop, setKeepLoop] = useState(true)

  const [preset, setPreset] = useState('256')
  const [resizeWidth, setResizeWidth] = useState<number | ''>('')
  const [resizeHeight, setResizeHeight] = useState<number | ''>('')
  const [resizeColors, setResizeColors] = useState('256')

  const task = useTask<GifOutcome>()
  const sourceUrl = useObjectUrl(file)
  const resultUrl = useObjectUrl(task.result?.blob ?? null)

  const select = useCallback(
    async (files: File[]) => {
      const next = files[0]
      if (!next) return
      task.reset()
      setMetaError(null)
      setFile(next)
      try {
        const parsed = parseGifMeta(await fileBytes(next))
        if (!parsed) {
          setMeta(null)
          setMetaError(
            'That file does not look like a GIF. The header does not have the GIF signature. If the file was renamed from a PNG or WebP, convert it first.',
          )
          return
        }
        setMeta(parsed)
        setResizeWidth(Math.min(256, parsed.width))
        setResizeHeight(
          Math.max(1, Math.round((Math.min(256, parsed.width) * parsed.height) / parsed.width)),
        )
      } catch {
        setMeta(null)
        setMetaError('This file could not be read. Try picking it again.')
      }
    },
    [task],
  )

  useEffect(() => {
    if (preset !== 'custom' && meta) {
      const width = Number(preset)
      setResizeWidth(width)
      setResizeHeight(Math.max(1, Math.round((width * meta.height) / meta.width)))
    }
  }, [meta, preset])

  const targetBytes =
    target === 'custom' ? Math.max(1, Math.round(customKb)) * 1024 : Number(target)

  const outWidth = typeof resizeWidth === 'number' ? evenish(resizeWidth) : 0
  const outHeight = typeof resizeHeight === 'number' ? evenish(resizeHeight) : 0

  const sourceSummary = useMemo(() => {
    if (!meta) return null
    return {
      dimensions: `${meta.width} × ${meta.height}`,
      frames: meta.frameCount,
      fps: meta.fps,
      duration: meta.durationSec,
      loops: meta.loopCount === 0 ? 'Forever' : meta.loopCount < 0 ? 'Once' : `${meta.loopCount + 1}×`,
    }
  }, [meta])

  /** One palettegen + paletteuse round trip at the given settings. */
  const encodeOnce = useCallback(
    async (
      ffmpeg: Awaited<ReturnType<typeof getEngine>>,
      source: GifMeta,
      step: { width: number; height: number; fpsCap: number; colors: number },
      onFraction: (fraction: number) => void,
    ): Promise<Blob> => {
      const parts: string[] = []
      // Only ever cut the frame rate — asking for more than the source has just
      // duplicates frames and makes the file bigger. A still GIF is left alone:
      // the fps filter drops its only frame, and palettegen then writes nothing.
      if (
        source.frameCount > 1 &&
        step.fpsCap > 0 &&
        source.fps > 0 &&
        step.fpsCap < source.fps - 0.01
      )
        parts.push(`fps=${step.fpsCap}`)
      parts.push(`scale=${step.width}:${step.height}:flags=lanczos`)
      const pre = parts.join(',')

      await execFFmpeg(
        ffmpeg,
        [
          '-i',
          'in.gif',
          '-vf',
          `${pre},palettegen=max_colors=${step.colors}:stats_mode=diff`,
          '-y',
          'palette.png',
        ],
        {
          totalFrames: source.frameCount,
          onProgress: (fraction) => onFraction(fraction * 0.35),
        },
      )

      const loopArg = keepLoop
        ? source.loopCount < 0
          ? ['-loop', '-1']
          : ['-loop', String(source.loopCount)]
        : ['-loop', '0']

      await execFFmpeg(
        ffmpeg,
        [
          '-i',
          'in.gif',
          '-i',
          'palette.png',
          '-lavfi',
          `${pre}[x];[x][1:v]paletteuse=dither=${dither}`,
          ...loopArg,
          '-y',
          'out.gif',
        ],
        {
          totalFrames: source.frameCount,
          onProgress: (fraction) => onFraction(0.35 + fraction * 0.65),
        },
      )

      return readOutput(ffmpeg, 'out.gif', 'image/gif')
    },
    [dither, keepLoop],
  )

  const runCompress = () => {
    if (!file || !meta) return
    const source = meta
    const baseName = stripExtension(file.name)
    const sourceBytes = file.size
    const wanted = targetBytes
    // A compressor never hands back a bigger file: keep the original instead.
    const finish = (outcome: GifOutcome): GifOutcome =>
      outcome.blob.size < sourceBytes
        ? outcome
        : {
            ...outcome,
            blob: file,
            filename: file.name,
            width: source.width,
            height: source.height,
            fps: source.fps,
            hitTarget: wanted <= 0 || sourceBytes <= wanted,
            kept: true,
          }

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()
      const attempts: Attempt[] = []

      try {
        await ffmpeg.writeFile('in.gif', await fileBytes(file))
        ctx.throwIfCancelled()

        const stepFor = (index: number) => {
          const rung = LADDER[index] ?? LADDER[LADDER.length - 1]!
          return {
            width: evenish(source.width * rung.scale),
            height: evenish(source.height * rung.scale),
            fpsCap: rung.fpsCap,
            colors: rung.colors,
          }
        }

        // No target: a single pass with a per-clip palette is already a solid
        // win over most GIFs, which ship a generic 256-colour table.
        if (wanted <= 0) {
          ctx.setStatus('Re-encoding with a palette built from this GIF…')
          ctx.setPercent(1)
          const blob = await encodeOnce(ffmpeg, source, stepFor(1), (fraction) =>
            ctx.setPercent(fraction * 100),
          )
          const step = stepFor(1)
          attempts.push({ index: 1, bytes: blob.size, label: describe(step, source) })
          return finish({
            blob,
            filename: `${baseName}-optimised.gif`,
            width: step.width,
            height: step.height,
            fps: step.fpsCap || source.fps,
            colors: step.colors,
            attempts,
            hitTarget: true,
            targetBytes: 0,
            sourceBytes,
            elapsedMs: performance.now() - started,
          } satisfies GifOutcome)
        }

        let low = 0
        let high = LADDER.length - 1
        let best: { blob: Blob; index: number } | null = null
        // log2(13) ≈ 4 encodes; the bar advances one slot per probe.
        const budget = Math.ceil(Math.log2(LADDER.length)) + 1
        let done = 0

        while (low <= high) {
          ctx.throwIfCancelled()
          const mid = Math.floor((low + high) / 2)
          const step = stepFor(mid)
          const attemptNumber = done + 1
          ctx.setStatus(
            `Attempt ${attemptNumber} of about ${budget}: trying ${step.width}×${step.height}, ${step.colors} colours`,
          )
          const slot = done / budget
          ctx.setPercent(Math.min(99, slot * 100))
          const blob = await encodeOnce(ffmpeg, source, step, (fraction) =>
            ctx.setPercent(Math.min(99, (slot + fraction / budget) * 100)),
          )
          attempts.push({ index: mid, bytes: blob.size, label: describe(step, source) })
          done += 1

          if (blob.size <= wanted) {
            best = { blob, index: mid }
            high = mid - 1
          } else {
            low = mid + 1
          }
        }

        if (!best) {
          // Even the bottom rung missed. Hand back the smallest we produced so
          // the user still gets a file, and say so plainly.
          ctx.setStatus('Target missed. Encoding the smallest option…')
          const step = stepFor(LADDER.length - 1)
          const blob = await encodeOnce(ffmpeg, source, step, (fraction) =>
            ctx.setPercent(Math.min(99, 90 + fraction * 9)),
          )
          attempts.push({
            index: LADDER.length - 1,
            bytes: blob.size,
            label: describe(step, source),
          })
          return finish({
            blob,
            filename: `${baseName}-smallest.gif`,
            width: step.width,
            height: step.height,
            fps: step.fpsCap || source.fps,
            colors: step.colors,
            attempts,
            hitTarget: false,
            targetBytes: wanted,
            sourceBytes,
            elapsedMs: performance.now() - started,
          } satisfies GifOutcome)
        }

        const step = stepFor(best.index)
        return finish({
          blob: best.blob,
          filename: `${baseName}-compressed.gif`,
          width: step.width,
          height: step.height,
          fps: step.fpsCap || source.fps,
          colors: step.colors,
          attempts,
          hitTarget: true,
          targetBytes: wanted,
          sourceBytes,
          elapsedMs: performance.now() - started,
        } satisfies GifOutcome)
      } finally {
        await cleanupFs(ffmpeg, ['in.gif', 'palette.png', 'out.gif'])
      }
    })
  }

  const runResize = () => {
    if (!file || !meta) return
    if (outWidth < 2 || outHeight < 2) {
      task.fail('Enter a width and height of at least 2 pixels.')
      return
    }
    const source = meta
    const baseName = stripExtension(file.name)
    const sourceBytes = file.size

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()
      try {
        await ffmpeg.writeFile('in.gif', await fileBytes(file))
        ctx.setStatus(`Resizing to ${outWidth} × ${outHeight}…`)
        const blob = await encodeOnce(
          ffmpeg,
          source,
          { width: outWidth, height: outHeight, fpsCap: 0, colors: Number(resizeColors) },
          (fraction) => ctx.setPercent(fraction * 100),
        )
        return {
          blob,
          filename: `${baseName}-${outWidth}px.gif`,
          width: outWidth,
          height: outHeight,
          fps: source.fps,
          colors: Number(resizeColors),
          attempts: [],
          hitTarget: true,
          targetBytes: 0,
          sourceBytes,
          elapsedMs: performance.now() - started,
        } satisfies GifOutcome
      } finally {
        await cleanupFs(ffmpeg, ['in.gif', 'palette.png', 'out.gif'])
      }
    })
  }

  const start = mode === 'compress' ? runCompress : runResize

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".gif,image/gif"
          onFiles={(files) => void select(files)}
          maxSizeMb={512}
          title="Drop a GIF here"
          hint="or click to browse"
          icon={mode === 'compress' ? Gauge : Scaling}
        />
        <Note>
          {mode === 'compress'
            ? 'Hitting an exact size takes several encodes. Each attempt is an FFmpeg run on your device.'
            : 'Resizing a GIF means re-quantising every frame. This tool builds a new palette from your clip and does not reuse the source table, so small sizes stay much cleaner than with a simple scale.'}
        </Note>
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
            {sourceSummary
              ? ` · ${sourceSummary.dimensions} · ${sourceSummary.frames} frames · ${sourceSummary.fps.toFixed(1)} fps · ${sourceSummary.duration.toFixed(2)} s · loops ${sourceSummary.loops.toLowerCase()}`
              : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFile(null)
            setMeta(null)
            task.reset()
          }}
        >
          Choose a different GIF
        </Button>
      </div>

      {metaError ? <ErrorNote message={metaError} /> : null}

      {sourceUrl ? (
        <img
          src={sourceUrl}
          alt="The GIF you selected"
          className="mx-auto max-h-64 w-auto max-w-full rounded-lg border border-border"
        />
      ) : null}

      {meta ? (
        <ToolPanel
          title={mode === 'compress' ? 'Target size' : 'New size'}
          description={
            mode === 'compress'
              ? 'The tool searches a quality ladder (resolution, frame rate and palette size together) for the best-looking version that fits.'
              : 'Width and height are kept even, so every player can play the result. The aspect ratio follows the width unless you set the height.'
          }
          footer={
            <Button
              type="button"
              onClick={start}
              disabled={task.busy}
              className="w-full sm:w-auto"
            >
              {mode === 'compress' ? (
                <Gauge className="size-4" aria-hidden="true" />
              ) : (
                <Scaling className="size-4" aria-hidden="true" />
              )}
              {task.busy
                ? 'Working…'
                : mode === 'compress'
                  ? targetBytes > 0
                    ? `Compress to ${formatBytes(targetBytes)}`
                    : 'Optimise this GIF'
                  : `Resize to ${outWidth || '–'} px`}
            </Button>
          }
        >
          {mode === 'compress' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Maximum file size"
                value={target}
                onChange={setTarget}
                options={TARGETS}
                hint="Pick the limit that the destination enforces."
              />
              {target === 'custom' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="gif-target-kb">Custom target (KB)</Label>
                  <Input
                    id="gif-target-kb"
                    type="number"
                    inputMode="numeric"
                    min={8}
                    step={8}
                    value={customKb}
                    onChange={(event) => setCustomKb(Number(event.target.value) || 8)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(Math.max(1, customKb) * 1024)}. 1 KB is 1024 bytes here, as in your file
                    manager.
                  </p>
                </div>
              ) : (
                <ResultStat
                  label="Current size"
                  value={formatBytes(file.size)}
                  hint={
                    targetBytes > 0
                      ? `Needs a ${Math.max(0, 100 - (targetBytes / file.size) * 100).toFixed(0)}% reduction`
                      : 'No target set'
                  }
                />
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Preset"
                value={preset}
                onChange={setPreset}
                options={RESIZE_PRESETS}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gif-w">Width (px)</Label>
                  <Input
                    id="gif-w"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    value={resizeWidth}
                    onChange={(event) => {
                      const value = event.target.value === '' ? '' : Number(event.target.value)
                      setPreset('custom')
                      setResizeWidth(value)
                      if (typeof value === 'number' && value > 0)
                        setResizeHeight(Math.max(1, Math.round((value * meta.height) / meta.width)))
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gif-h">Height (px)</Label>
                  <Input
                    id="gif-h"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    value={resizeHeight}
                    onChange={(event) => {
                      setPreset('custom')
                      setResizeHeight(
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }}
                  />
                </div>
              </div>
              <ResultStat
                label="Scale"
                value={
                  outWidth > 0 ? `${((outWidth / meta.width) * 100).toFixed(0)}%` : '–'
                }
                hint={`From ${meta.width} × ${meta.height}`}
              />
              <SelectField
                label="Colours per frame"
                value={resizeColors}
                onChange={setResizeColors}
                options={[
                  { value: '256', label: '256 (maximum quality)' },
                  { value: '128', label: '128 (smaller, still clean)' },
                  { value: '64', label: '64 (emoji-sized files)' },
                  { value: '32', label: '32 (flat graphics only)' },
                ]}
              />
            </div>
          )}

          <AdvancedOptions>
            <SelectField
              label="Dithering"
              value={dither}
              onChange={setDither}
              options={DITHER_OPTIONS}
              hint="Bayer patterns compress better than error diffusion. This matters most when you aim for a byte target."
            />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={keepLoop}
                onChange={(event) => setKeepLoop(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                Keep the original loop setting
                {meta.loopCount === 0
                  ? ' (this GIF loops forever)'
                  : meta.loopCount < 0
                    ? ' (this GIF plays once)'
                    : ` (this GIF plays ${meta.loopCount + 1} times)`}
              </span>
            </label>
          </AdvancedOptions>
        </ToolPanel>
      ) : null}

      <TaskStatus task={task} label={mode === 'compress' ? 'Searching for the best fit' : 'Resizing'} />
      {task.phase === 'error' && task.error ? (
        <ErrorNote message={task.error} onRetry={start} />
      ) : null}

      {task.result ? (
        <ToolPanel
          title={
            task.result.kept
              ? 'Already as small as it gets'
              : task.result.hitTarget
                ? 'Done'
                : 'As small as this GIF goes'
          }
        >
          {resultUrl ? (
            <img
              src={resultUrl}
              alt="The processed GIF"
              className="mx-auto max-h-[420px] w-auto max-w-full rounded-lg border border-border"
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="New size"
              value={formatBytes(task.result.blob.size)}
              emphasis
              hint={
                task.result.targetBytes > 0
                  ? `Target was ${formatBytes(task.result.targetBytes)}`
                  : undefined
              }
            />
            <ResultStat
              label="Saved"
              value={`${Math.max(0, 100 - (task.result.blob.size / task.result.sourceBytes) * 100).toFixed(1)}%`}
              hint={`Down from ${formatBytes(task.result.sourceBytes)}`}
            />
            <ResultStat
              label="Settings used"
              value={`${task.result.width}×${task.result.height}`}
              hint={`${task.result.colors} colours${task.result.fps > 0 ? ` · ${task.result.fps.toFixed(0)} fps` : ''}`}
            />
          </div>

          {task.result.kept ? (
            <Note>
              Re-encoding made this GIF larger, so you get the original back, unchanged.
            </Note>
          ) : null}

          {!task.result.hitTarget ? (
            <Note tone="warning">
              The smallest setting on the ladder still comes out at{' '}
              {formatBytes(task.result.blob.size)}, above your{' '}
              {formatBytes(task.result.targetBytes)} target. A long or very detailed GIF has a
              minimum size. Trim it shorter first, or convert it with{' '}
              <a href="/gif-to-mp4" className="underline">
                GIF to MP4
              </a>
              , which is typically five to twenty times smaller at better quality.
            </Note>
          ) : null}

          {task.result.attempts.length > 1 ? (
            <details className="rounded-lg bg-muted">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Show the {task.result.attempts.length} encodes it tried
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Settings</th>
                      <th className="px-3 py-2 text-right font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.result.attempts.map((attempt, i) => (
                      <tr key={`${attempt.index}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">{attempt.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatBytes(attempt.bytes)}
                          {task.result && task.result.targetBytes > 0 ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {attempt.bytes <= task.result.targetBytes ? 'fits' : 'too big'}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Finished in {formatElapsed(task.result.elapsedMs)} on this device.
          </p>

          <div className="flex flex-wrap gap-2">
            <DownloadButton
              blob={task.result.blob}
              filename={task.result.filename}
              label={task.result.kept ? 'Download original GIF' : 'Download GIF'}
            />
            <Button type="button" variant="outline" onClick={() => task.reset()}>
              <FileImage className="size-4" aria-hidden="true" />
              Try different settings
            </Button>
          </div>
        </ToolPanel>
      ) : null}

      <EngineNotice />
    </div>
  )
}

function describe(
  step: { width: number; height: number; fpsCap: number; colors: number },
  source: GifMeta,
): string {
  const fps =
    step.fpsCap > 0 && source.fps > 0 && step.fpsCap < source.fps
      ? `${step.fpsCap} fps`
      : `${source.fps.toFixed(0)} fps (unchanged)`
  return `${step.width}×${step.height} · ${step.colors} colours · ${fps}`
}
