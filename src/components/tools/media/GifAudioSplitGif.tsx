import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Grid2x2, LayoutGrid } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'

import { getEngine } from './_ffmpeg'
import { SelectField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  cleanupFs,
  execFFmpeg,
  fileBytes,
  formatElapsed,
  parseGifMeta,
  useObjectUrl,
  useTask,
  zipBlobs,
} from './_gif-audio-core'
import type { GifMeta } from './_gif-audio-core'

const MAX_FRAMES = 600
const PREVIEW_LIMIT = 60

interface ExtractedFrame {
  index: number
  /** 1-based number as it appears in the source GIF. */
  sourceIndex: number
  name: string
  blob: Blob
  url: string
  delayMs: number
  cumulativeMs: number
}

interface SplitResult {
  frames: ExtractedFrame[]
  totalBytes: number
  width: number
  height: number
  elapsedMs: number
  truncated: boolean
}

const FORMATS = [
  { value: 'png', label: 'PNG: lossless, keeps transparency' },
  { value: 'jpg', label: 'JPEG: smaller, no transparency' },
]

const EVERY = [
  { value: '1', label: 'Every frame' },
  { value: '2', label: 'Every 2nd frame' },
  { value: '3', label: 'Every 3rd frame' },
  { value: '5', label: 'Every 5th frame' },
  { value: '10', label: 'Every 10th frame' },
]

export default function GifAudioSplitGif() {
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<GifMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [format, setFormat] = useState('png')
  const [every, setEvery] = useState('1')
  const [scalePercent, setScalePercent] = useState(100)
  const [showAll, setShowAll] = useState(false)
  const [zipping, setZipping] = useState(false)

  const task = useTask<SplitResult>()
  const sourceUrl = useObjectUrl(file)
  const framesRef = useRef<ExtractedFrame[]>([])

  useEffect(() => {
    framesRef.current = task.result?.frames ?? []
  }, [task.result])

  useEffect(() => {
    return () => {
      for (const frame of framesRef.current) URL.revokeObjectURL(frame.url)
    }
  }, [])

  const select = useCallback(
    async (files: File[]) => {
      const next = files[0]
      if (!next) return
      for (const frame of framesRef.current) URL.revokeObjectURL(frame.url)
      framesRef.current = []
      task.reset()
      setShowAll(false)
      setMetaError(null)
      setFile(next)
      const parsed = parseGifMeta(await fileBytes(next))
      if (!parsed) {
        setMeta(null)
        setMetaError(
          'This file is not a GIF: the header signature is missing. If it came from a chat app, it may be an MP4 or WebP with a .gif name.',
        )
        return
      }
      setMeta(parsed)
    },
    [task],
  )

  const step = Math.max(1, Number(every))
  const expected = meta ? Math.min(MAX_FRAMES, Math.ceil(meta.frameCount / step)) : 0
  const willTruncate = meta ? Math.ceil(meta.frameCount / step) > MAX_FRAMES : false

  const outWidth = useMemo(() => {
    if (!meta) return 0
    return Math.max(1, Math.round((meta.width * scalePercent) / 100))
  }, [meta, scalePercent])

  const extract = () => {
    if (!file || !meta) return
    const source = meta
    const ext = format === 'png' ? 'png' : 'jpg'
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()
      const written: string[] = []

      try {
        await ffmpeg.writeFile('in.gif', await fileBytes(file))
        ctx.throwIfCancelled()
        ctx.setStatus('Decoding every frame…')

        const filters: string[] = []
        // `n` is the zero-based decoded-frame index, so this keeps frames
        // 0, N, 2N… which are the 1st, (N+1)th… frames the user sees.
        if (step > 1) filters.push(`select='not(mod(n\\,${step}))'`)
        if (scalePercent !== 100) filters.push(`scale=${outWidth}:-1:flags=lanczos`)

        const args = ['-i', 'in.gif']
        if (filters.length > 0) args.push('-vf', filters.join(','))
        // Passthrough timing: exactly one PNG per decoded frame, no duplicates
        // inserted to reach a constant frame rate.
        args.push('-vsync', '0')
        if (ext === 'jpg') args.push('-q:v', '2')
        args.push('-frames:v', String(MAX_FRAMES), '-y', `frame_%04d.${ext}`)

        await execFFmpeg(ffmpeg, args, {
          totalFrames: expected,
          onProgress: (fraction) => ctx.setPercent(fraction * 70),
        })

        ctx.throwIfCancelled()
        ctx.setStatus('Collecting frames…')

        const frames: ExtractedFrame[] = []
        let totalBytes = 0
        let cumulative = 0
        let cursor = 0

        // Ask the virtual FS what actually got written rather than guessing how
        // many files the muxer produced.
        const pattern = new RegExp(`^frame_(\\d+)\\.${ext}$`)
        let names: string[] = []
        try {
          const entries = await ffmpeg.listDir('/')
          names = entries
            .filter((entry) => !entry.isDir && pattern.test(entry.name))
            .map((entry) => entry.name)
            .sort()
        } catch {
          names = Array.from(
            { length: expected },
            (_unused, i) => `frame_${String(i + 1).padStart(4, '0')}.${ext}`,
          )
        }

        for (let i = 0; i < names.length; i += 1) {
          const name = names[i]
          if (!name) break
          let data: Uint8Array<ArrayBuffer>
          try {
            const raw = await ffmpeg.readFile(name)
            if (typeof raw === 'string') break
            data = new Uint8Array(raw.buffer as ArrayBuffer, raw.byteOffset, raw.byteLength)
          } catch {
            break
          }
          if (data.byteLength === 0) break
          written.push(name)

          const sourceIndex = cursor + 1
          const delayMs = source.delaysMs[cursor] ?? 100
          const blob = new Blob([data], { type: mime })
          frames.push({
            index: frames.length,
            sourceIndex,
            name,
            blob,
            url: URL.createObjectURL(blob),
            delayMs,
            cumulativeMs: cumulative,
          })
          totalBytes += blob.size
          cumulative += delayMs
          cursor += step

          if (i % 10 === 0) {
            ctx.throwIfCancelled()
            ctx.setPercent(70 + Math.min(29, ((i + 1) / Math.max(1, names.length)) * 29))
          }
        }

        if (frames.length === 0)
          throw new Error(
            'FFmpeg decoded no frames from this GIF. The file may be truncated. Download it again.',
          )

        framesRef.current = frames

        return {
          frames,
          totalBytes,
          width: outWidth || source.width,
          height:
            scalePercent === 100
              ? source.height
              : Math.max(1, Math.round((outWidth * source.height) / source.width)),
          elapsedMs: performance.now() - started,
          truncated: willTruncate,
        }
      } finally {
        await cleanupFs(ffmpeg, ['in.gif', ...written])
      }
    })
  }

  const downloadZip = async () => {
    const result = task.result
    if (!result || !file) return
    setZipping(true)
    try {
      const csv = [
        'frame,source_frame,delay_ms,cumulative_ms,bytes',
        ...result.frames.map(
          (frame) =>
            `${frame.index + 1},${frame.sourceIndex},${frame.delayMs},${frame.cumulativeMs},${frame.blob.size}`,
        ),
      ].join('\n')

      const zip = await zipBlobs([
        ...result.frames.map((frame) => ({ name: frame.name, blob: frame.blob })),
        { name: 'frame-delays.csv', blob: new Blob([csv], { type: 'text/csv' }) },
      ])
      downloadBlob(zip, `${stripExtension(file.name)}-frames.zip`)
    } finally {
      setZipping(false)
    }
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".gif,image/gif"
          onFiles={(files) => void select(files)}
          maxSizeMb={512}
          title="Drop a GIF here"
          hint="Each frame comes out as a numbered image"
          icon={LayoutGrid}
        />
        <Note>
          The tool reads the frame delays from the GIF header before FFmpeg loads, so the timing
          table below shows what the file specifies. It is not an estimate from a fixed frame rate.
        </Note>
        <EngineNotice />
      </div>
    )
  }

  const visible = task.result
    ? showAll
      ? task.result.frames
      : task.result.frames.slice(0, PREVIEW_LIMIT)
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
            {meta
              ? ` · ${meta.width} × ${meta.height} · ${meta.frameCount} frames · ${meta.durationSec.toFixed(2)} s`
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

      {sourceUrl && !task.result ? (
        <img
          src={sourceUrl}
          alt="The GIF you selected"
          className="mx-auto max-h-56 w-auto max-w-full rounded-lg border border-border"
        />
      ) : null}

      {meta ? (
        <ToolPanel
          title="Extraction settings"
          footer={
            <Button type="button" onClick={extract} disabled={task.busy} className="w-full sm:w-auto">
              <Grid2x2 className="size-4" aria-hidden="true" />
              {task.busy ? 'Extracting…' : `Extract ${expected} frame${expected === 1 ? '' : 's'}`}
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Image format"
              value={format}
              onChange={setFormat}
              options={FORMATS}
              hint={
                format === 'png'
                  ? 'GIF transparency survives as a real alpha channel.'
                  : 'Transparent pixels become black. Use PNG if the GIF has transparent areas.'
              }
            />
            <SelectField
              label="Which frames"
              value={every}
              onChange={setEvery}
              options={EVERY}
              hint="Useful for long screen recordings where consecutive frames barely differ."
            />
            <div className="space-y-1.5">
              <Label htmlFor="split-scale">Scale (%)</Label>
              <Input
                id="split-scale"
                type="number"
                inputMode="numeric"
                min={5}
                max={400}
                step={5}
                value={scalePercent}
                onChange={(event) =>
                  setScalePercent(Math.max(5, Math.min(400, Number(event.target.value) || 100)))
                }
              />
              <p className="text-xs text-muted-foreground">
                {outWidth} px wide{scalePercent === 100 ? ' (original)' : ''}
              </p>
            </div>
          </div>

          {willTruncate ? (
            <Note tone="warning">
              This GIF has {meta.frameCount} frames. To keep your browser responsive the tool stops
              at {MAX_FRAMES}. Choose “every 2nd frame” or higher to cover the whole animation.
            </Note>
          ) : null}
        </ToolPanel>
      ) : null}

      <TaskStatus task={task} label="Extracting frames" />
      {task.phase === 'error' && task.error ? (
        <ErrorNote message={task.error} onRetry={extract} />
      ) : null}

      {task.result ? (
        <ToolPanel title={`${task.result.frames.length} frames extracted`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Frames" value={String(task.result.frames.length)} emphasis />
            <ResultStat
              label="Combined size"
              value={formatBytes(task.result.totalBytes)}
              hint={`${task.result.width} × ${task.result.height} each`}
            />
            <ResultStat
              label="Extracted in"
              value={formatElapsed(task.result.elapsedMs)}
              hint="On this device"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void downloadZip()} disabled={zipping}>
              <Download className="size-4" aria-hidden="true" />
              {zipping
                ? 'Building ZIP…'
                : `Download all ${task.result.frames.length} frames (.zip)`}
            </Button>
            <Button type="button" variant="outline" onClick={() => task.reset()}>
              Change settings
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The ZIP also contains <code className="font-mono">frame-delays.csv</code> with each
            frame’s delay and its running timestamp, so you can rebuild the exact timing later.
          </p>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Contact sheet</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {visible.map((frame) => (
                <li
                  key={frame.name}
                  className="overflow-hidden rounded-lg bg-card"
                >
                  <div className="aspect-square bg-muted">
                    <img
                      src={frame.url}
                      alt={`Frame ${frame.sourceIndex}`}
                      loading="lazy"
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="text-[11px] font-medium tabular-nums text-foreground">
                      #{frame.sourceIndex}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {frame.delayMs} ms · {(frame.cumulativeMs / 1000).toFixed(2)} s
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-[11px]"
                      onClick={() => downloadBlob(frame.blob, frame.name)}
                    >
                      Save
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {!showAll && task.result.frames.length > PREVIEW_LIMIT ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowAll(true)}
              >
                Show all {task.result.frames.length} frames
              </Button>
            ) : null}
          </div>

          <DownloadButton
            blob={task.result.frames[0]?.blob ?? null}
            filename={task.result.frames[0]?.name ?? 'frame_0001.png'}
            variant="outline"
            label="Download the first frame only"
          />
        </ToolPanel>
      ) : null}

      <EngineNotice />
    </div>
  )
}
