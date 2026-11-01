import { useCallback, useMemo, useRef, useState } from 'react'
import { AudioLines, Check, Download, FileAudio, Trash2, X, CircleX } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'

import { getEngine, probeMedia } from './_ffmpeg'
import { AdvancedOptions, SelectField, SwitchField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  cleanupFs,
  execFFmpeg,
  fileBytes,
  formatElapsed,
  fsName,
  readOutput,
  useTask,
  zipBlobs,
} from './_gif-audio-core'

export type AudioTarget = 'mp3' | 'wav'

export interface GifAudioToMp3Props {
  /** Comma-separated dropzone accept list. */
  accept: string
  /** Short name of the input format, e.g. "M4A". */
  sourceLabel: string
  /** One line under the dropzone title. */
  sourceHint: string
  target?: AudioTarget
  defaultBitrate?: string
  /** Extra sentence shown above the settings, specific to the source format. */
  formatNote?: string
  /** Shows a prominent "shrunk to X% of the original" stat (WAV sources). */
  emphasiseRatio?: boolean
}

type ItemStatus = 'pending' | 'working' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  status: ItemStatus
  percent: number
  durationSec: number
  outName: string
  blob: Blob | null
  error: string | null
}

interface Summary {
  converted: number
  failed: number
  inputBytes: number
  outputBytes: number
  elapsedMs: number
}

const BITRATES = [
  { value: '320', label: '320 kbps (maximum MP3 quality)' },
  { value: '256', label: '256 kbps (very good)' },
  { value: '192', label: '192 kbps (recommended default)' },
  { value: '160', label: '160 kbps' },
  { value: '128', label: '128 kbps (compact, good for speech)' },
  { value: '96', label: '96 kbps (voice notes)' },
  { value: '64', label: '64 kbps (smallest usable for speech)' },
]

const BIT_DEPTHS = [
  { value: 'pcm_s16le', label: '16-bit PCM (CD standard, plays everywhere)' },
  { value: 'pcm_s24le', label: '24-bit PCM (studio masters)' },
  { value: 'pcm_f32le', label: '32-bit float (editing and mixing)' },
]

const SAMPLE_RATES = [
  { value: 'source', label: 'Keep the source sample rate' },
  { value: '48000', label: '48 000 Hz (video and broadcast)' },
  { value: '44100', label: '44 100 Hz (CD and music)' },
  { value: '32000', label: '32 000 Hz' },
  { value: '22050', label: '22 050 Hz (voice)' },
  { value: '16000', label: '16 000 Hz (telephony and transcription)' },
]

const CHANNELS = [
  { value: 'source', label: 'Keep the source channels' },
  { value: '2', label: 'Force stereo' },
  { value: '1', label: 'Force mono (halves the size of a voice file)' },
]

const MAX_FILES = 50

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let n = 2
  let candidate = `${stem} (${n})${ext}`
  while (used.has(candidate)) {
    n += 1
    candidate = `${stem} (${n})${ext}`
  }
  used.add(candidate)
  return candidate
}

export default function GifAudioToMp3({
  accept,
  sourceLabel,
  sourceHint,
  target = 'mp3',
  defaultBitrate = '192',
  formatNote,
  emphasiseRatio = false,
}: GifAudioToMp3Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [bitrate, setBitrate] = useState(defaultBitrate)
  const [bitDepth, setBitDepth] = useState('pcm_s16le')
  const [sampleRate, setSampleRate] = useState('source')
  const [channels, setChannels] = useState('source')
  const [normalise, setNormalise] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const task = useTask<Summary>()
  const itemsRef = useRef<QueueItem[]>([])
  itemsRef.current = items

  const extension = target === 'mp3' ? 'mp3' : 'wav'
  const mime = target === 'mp3' ? 'audio/mpeg' : 'audio/wav'

  const add = useCallback(
    async (files: File[]) => {
      setAddError(null)
      const room = MAX_FILES - itemsRef.current.length
      if (room <= 0) {
        setAddError(`The queue holds ${MAX_FILES} files at a time. Convert or clear these first.`)
        return
      }
      const accepted = files.slice(0, room)
      if (files.length > accepted.length)
        setAddError(`Added the first ${room} files. The queue holds ${MAX_FILES} at a time.`)

      const used = new Set(itemsRef.current.map((item) => item.outName))
      const next: QueueItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: 'pending' as const,
        percent: 0,
        durationSec: 0,
        outName: uniqueName(`${stripExtension(file.name)}.${extension}`, used),
        blob: null,
        error: null,
      }))

      setItems((current) => [...current, ...next])
      task.reset()

      // Read durations in the background so progress is determinate.
      for (const item of next) {
        const info = await probeMedia(item.file, 'audio')
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, durationSec: info.duration } : row,
          ),
        )
      }
    },
    [extension, task],
  )

  const remove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
    task.reset()
  }

  const patch = (id: string, changes: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  const buildArgs = (input: string, output: string): string[] => {
    const args = ['-i', input, '-vn', '-map', 'a:0']
    if (target === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-id3v2_version', '3')
    else args.push('-c:a', bitDepth)
    if (sampleRate !== 'source') args.push('-ar', sampleRate)
    if (channels !== 'source') args.push('-ac', channels)
    if (normalise) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11')
    args.push('-y', output)
    return args
  }

  const convert = () => {
    const queue = itemsRef.current.filter((item) => item.status !== 'done')
    if (queue.length === 0) return

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()
      let converted = 0
      let failed = 0
      let inputBytes = 0
      let outputBytes = 0

      for (let i = 0; i < queue.length; i += 1) {
        ctx.throwIfCancelled()
        const item = queue[i]
        if (!item) continue

        patch(item.id, { status: 'working', percent: 0, error: null })
        ctx.setStatus(`Converting ${i + 1} of ${queue.length}: ${item.file.name}`)

        const input = fsName(item.file, `src${i}`)
        const output = `out${i}.${extension}`

        try {
          await ffmpeg.writeFile(input, await fileBytes(item.file))
          await execFFmpeg(ffmpeg, buildArgs(input, output), {
            totalSeconds: item.durationSec,
            onProgress: (fraction) => {
              patch(item.id, { percent: fraction * 100 })
              ctx.setPercent(((i + fraction) / queue.length) * 100)
            },
          })
          const blob = await readOutput(ffmpeg, output, mime)
          patch(item.id, { status: 'done', percent: 100, blob })
          converted += 1
          inputBytes += item.file.size
          outputBytes += blob.size
        } catch (error) {
          if (error instanceof Error && error.name === 'TaskCancelled') throw error
          const message =
            error instanceof Error
              ? error.message
              : 'This file could not be converted. It may be corrupt or in a format this build cannot decode.'
          patch(item.id, { status: 'error', percent: 0, error: message })
          failed += 1
        } finally {
          await cleanupFs(ffmpeg, [input, output])
        }

        ctx.setPercent(((i + 1) / queue.length) * 100)
      }

      if (converted === 0)
        throw new Error(
          failed === 1
            ? (itemsRef.current.find((item) => item.error)?.error ??
              'That file could not be converted.')
            : 'None of these files could be converted. Check that they really are audio files.',
        )

      return {
        converted,
        failed,
        inputBytes,
        outputBytes,
        elapsedMs: performance.now() - started,
      }
    })
  }

  const done = items.filter((item) => item.status === 'done' && item.blob)

  const downloadAll = async () => {
    if (done.length === 0) return
    setZipping(true)
    try {
      const zip = await zipBlobs(
        done.map((item) => ({ name: item.outName, blob: item.blob as Blob })),
      )
      downloadBlob(zip, `converted-${extension}.zip`)
    } finally {
      setZipping(false)
    }
  }

  const totals = useMemo(() => {
    const input = done.reduce((sum, item) => sum + item.file.size, 0)
    const output = done.reduce((sum, item) => sum + (item.blob?.size ?? 0), 0)
    return { input, output, ratio: input > 0 ? output / input : 0 }
  }, [done])

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={accept}
          multiple
          onFiles={(files) => void add(files)}
          maxSizeMb={2048}
          title={`Drop your ${sourceLabel} files here`}
          hint={sourceHint}
          icon={FileAudio}
        />
        <Note>
          The queue converts the files one after another, up to {MAX_FILES} at a time. There is no
          daily limit. The size limit is your device’s memory.
        </Note>
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title={`${items.length} file${items.length === 1 ? '' : 's'} queued`}
        description={
          formatNote ??
          `Every file is decoded and re-encoded locally, then handed straight back to you as ${target.toUpperCase()}.`
        }
        footer={
          <div className="flex w-full flex-wrap gap-2">
            <Button type="button" onClick={convert} disabled={task.busy}>
              <AudioLines className="size-4" aria-hidden="true" />
              {task.busy
                ? 'Converting…'
                : `Convert ${items.filter((i) => i.status !== 'done').length || items.length} file${items.length === 1 ? '' : 's'} to ${target.toUpperCase()}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setItems([])
                task.reset()
              }}
              disabled={task.busy}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear queue
            </Button>
          </div>
        }
      >
        <ul className="divide-y divide-border overflow-hidden rounded-lg bg-muted">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                    {item.durationSec > 0
                      ? ` · ${Math.floor(item.durationSec / 60)}:${String(Math.round(item.durationSec % 60)).padStart(2, '0')}`
                      : ''}
                    {item.blob
                      ? ` → ${formatBytes(item.blob.size)} (${((item.blob.size / item.file.size) * 100).toFixed(0)}% of the original)`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.status === 'done' && item.blob ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Check className="size-3.5" aria-hidden="true" />
                        Done
                      </span>
                      <DownloadButton
                        blob={item.blob}
                        filename={item.outName}
                        label="Save"
                        variant="outline"
                        size="sm"
                      />
                    </>
                  ) : null}
                  {item.status === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                      <CircleX className="size-3.5" aria-hidden="true" />
                      Failed
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove ${item.file.name} from the queue`}
                    disabled={task.busy}
                    onClick={() => remove(item.id)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {item.status === 'working' ? (
                <div role="status" aria-live="polite">
                  <Progress value={item.percent} className="h-1.5" />
                  <span className="sr-only">
                    Converting {item.file.name}, {Math.round(item.percent)} percent
                  </span>
                </div>
              ) : null}
              {item.status === 'error' && item.error ? (
                <p className="text-xs text-destructive">{item.error}</p>
              ) : null}
            </li>
          ))}
        </ul>

        <FileDropzone
          accept={accept}
          multiple
          onFiles={(files) => void add(files)}
          maxSizeMb={2048}
          title="Add more files"
          hint={`${MAX_FILES - items.length} more can be queued`}
          className="py-6"
          disabled={task.busy}
        />
        {addError ? <ErrorNote message={addError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {target === 'mp3' ? (
            <SelectField
              label="MP3 bitrate"
              value={bitrate}
              onChange={setBitrate}
              options={BITRATES}
              hint="192 kbps is transparent for most listeners. Speech is fine at 96–128 kbps."
              disabled={task.busy}
            />
          ) : (
            <SelectField
              label="WAV bit depth"
              value={bitDepth}
              onChange={setBitDepth}
              options={BIT_DEPTHS}
              hint="WAV is uncompressed, so the depth and sample rate decide the file size exactly."
              disabled={task.busy}
            />
          )}
          <SelectField
            label="Channels"
            value={channels}
            onChange={setChannels}
            options={CHANNELS}
            disabled={task.busy}
          />
        </div>

        <AdvancedOptions>
          <SelectField
            label="Sample rate"
            value={sampleRate}
            onChange={setSampleRate}
            options={SAMPLE_RATES}
            hint="Resampling below the source rate removes high frequencies permanently. Use it only to shrink speech recordings."
            disabled={task.busy}
          />
          <SwitchField
            label="Normalise loudness to −16 LUFS"
            checked={normalise}
            onChange={setNormalise}
            hint="Applies FFmpeg’s EBU R128 loudnorm filter. Use it for interviews and voice memos recorded at different levels. Leave it off for mastered music."
            disabled={task.busy}
          />
        </AdvancedOptions>
      </ToolPanel>

      <TaskStatus task={task} label="Converting your files" />
      {task.phase === 'error' && task.error ? (
        <ErrorNote message={task.error} onRetry={convert} />
      ) : null}

      {done.length > 0 ? (
        <ToolPanel title={`${done.length} file${done.length === 1 ? '' : 's'} ready`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label={emphasiseRatio ? 'Size after conversion' : 'Total output'}
              value={formatBytes(totals.output)}
              emphasis
              hint={`From ${formatBytes(totals.input)}`}
            />
            <ResultStat
              label={emphasiseRatio ? 'Shrunk to' : 'Size change'}
              value={`${(totals.ratio * 100).toFixed(1)}%`}
              hint={
                totals.ratio < 1
                  ? `${formatBytes(totals.input - totals.output)} smaller`
                  : `${formatBytes(totals.output - totals.input)} larger: ${target.toUpperCase()} is the larger format here`
              }
            />
            <ResultStat
              label="Time taken"
              value={task.result ? formatElapsed(task.result.elapsedMs) : '–'}
              hint={task.result ? `${task.result.converted} converted, ${task.result.failed} failed` : undefined}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {done.length > 1 ? (
              <Button type="button" onClick={() => void downloadAll()} disabled={zipping}>
                <Download className="size-4" aria-hidden="true" />
                {zipping ? 'Building ZIP…' : `Download all ${done.length} as .zip`}
              </Button>
            ) : done[0] && done[0].blob ? (
              <DownloadButton
                blob={done[0].blob}
                filename={done[0].outName}
                label={`Download ${target.toUpperCase()}`}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItems([])
                task.reset()
              }}
            >
              Convert more files
            </Button>
          </div>
        </ToolPanel>
      ) : null}

      <EngineNotice />
    </div>
  )
}
