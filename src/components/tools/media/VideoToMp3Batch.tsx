import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, Download, Music, X } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { downloadBlob, formatBytes, stripExtension } from '@/lib/utils'

import {
  ENGINE_TOTAL_BYTES,
  JobCancelledError,
  formatTimecode,
  getEngine,
  inputName,
  probeMedia,
  runFFmpeg,
  terminateEngine,
} from './_ffmpeg'
import { EngineNotice, SelectField, SwitchField, useEngineState } from './_shared'
import { VIDEO_ACCEPT } from './video-shared'

export interface VideoToMp3BatchProps {
  /** Container the page is written for, e.g. `mp4` on /mp4-to-mp3. */
  from: string
  hint?: string
}

const BITRATES = [
  { value: '320', label: '320 kbps (highest MP3 quality)' },
  { value: '256', label: '256 kbps (very good)' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '128', label: '128 kbps (small file, fine for speech)' },
  { value: '96', label: '96 kbps (smallest, voice only)' },
]

type RowStatus = 'pending' | 'working' | 'done' | 'error'

interface Row {
  file: File
  duration: number
  status: RowStatus
  percent: number
  blob: Blob | null
  outputName: string
  error: string | null
}

function outputNameFor(file: File): string {
  return `${stripExtension(file.name)}.mp3`
}

export default function VideoToMp3Batch({ from, hint }: VideoToMp3BatchProps) {
  const engine = useEngineState()
  const [rows, setRows] = useState<Row[]>([])
  const [bitrate, setBitrate] = useState('192')
  const [mono, setMono] = useState(false)
  const [running, setRunning] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const cancelled = useRef(false)

  useEffect(
    () => () => {
      cancelled.current = true
    },
    [],
  )

  const addFiles = useCallback((files: File[]) => {
    setFatal(null)
    setRows((current) => {
      const seen = new Set(current.map((row) => `${row.file.name}:${row.file.size}`))
      const additions = files
        .filter((file) => !seen.has(`${file.name}:${file.size}`))
        .map<Row>((file) => ({
          file,
          duration: 0,
          status: 'pending',
          percent: 0,
          blob: null,
          outputName: outputNameFor(file),
          error: null,
        }))
      return [...current, ...additions]
    })

    // Read durations in the background so the progress bars are determinate.
    for (const file of files) {
      void probeMedia(file, 'video').then((info) => {
        if (info.duration <= 0) return
        setRows((current) =>
          current.map((row) =>
            row.file === file ? { ...row, duration: info.duration } : row,
          ),
        )
      })
    }
  }, [])

  const patch = (index: number, changes: Partial<Row>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index))
  }

  const start = async () => {
    if (rows.length === 0 || running) return
    cancelled.current = false
    setRunning(true)
    setFatal(null)
    setRows((current) =>
      current.map((row) =>
        row.status === 'done' ? row : { ...row, status: 'pending', percent: 0, error: null },
      ),
    )

    try {
      await getEngine()
    } catch (error) {
      setFatal(
        error instanceof Error
          ? error.message
          : 'The FFmpeg engine could not start. Reload the page and try again.',
      )
      setRunning(false)
      return
    }

    const snapshot = rows
    for (let i = 0; i < snapshot.length; i += 1) {
      if (cancelled.current) break
      const row = snapshot[i]
      if (row.status === 'done' && row.blob) continue

      patch(i, { status: 'working', percent: 0, error: null })
      const name = inputName(row.file)
      const args = ['-i', name, '-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`]
      if (mono) args.push('-ac', '1')
      args.push('output.mp3')

      try {
        const { blob } = await runFFmpeg({
          inputs: [{ name, data: row.file }],
          commands: [args],
          output: 'output.mp3',
          mime: 'audio/mpeg',
          durationSec: row.duration,
          onProgress: (percent) => patch(i, { percent }),
        })
        if (cancelled.current) break
        patch(i, { status: 'done', percent: 100, blob })
      } catch (error) {
        if (error instanceof JobCancelledError || cancelled.current) break
        patch(i, {
          status: 'error',
          percent: 0,
          error:
            error instanceof Error
              ? error.message
              : 'This file could not be converted. Try a different file.',
        })
      }
    }

    setRunning(false)
  }

  const cancel = () => {
    cancelled.current = true
    terminateEngine()
    setRunning(false)
    setRows((current) =>
      current.map((row) => (row.status === 'working' ? { ...row, status: 'pending', percent: 0 } : row)),
    )
  }

  const done = rows.filter((row) => row.status === 'done' && row.blob)

  const downloadZip = async () => {
    if (done.length === 0) return
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const used = new Set<string>()
      for (const row of done) {
        let name = row.outputName
        let n = 2
        while (used.has(name)) {
          name = `${stripExtension(row.outputName)} (${n}).mp3`
          n += 1
        }
        used.add(name)
        zip.file(name, row.blob as Blob)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `mp3-from-${from}.zip`)
    } catch {
      setFatal('Building the ZIP failed. Download the files one by one instead.')
    } finally {
      setZipping(false)
    }
  }

  const totalIn = rows.reduce((sum, row) => sum + row.file.size, 0)
  const totalOut = done.reduce((sum, row) => sum + (row.blob?.size ?? 0), 0)

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={`.${from},${VIDEO_ACCEPT}`}
        multiple
        onFiles={addFiles}
        maxSizeMb={4096}
        title={rows.length ? 'Add more files' : `Drop your .${from} files here`}
        hint={hint ?? 'Any number of files, of any size'}
      />

      {rows.length > 0 ? (
        <ToolPanel
          title={`${rows.length} file${rows.length === 1 ? '' : 's'} queued`}
          description="Each file is decoded and re-encoded to MP3 one at a time, in this tab."
          footer={
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void start()} disabled={running}>
                <Music className="size-4" aria-hidden="true" />
                {running ? 'Extracting…' : `Extract MP3 from ${rows.length} file${rows.length === 1 ? '' : 's'}`}
              </Button>
              {running ? (
                <Button type="button" variant="ghost" onClick={cancel}>
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
              {done.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadZip()}
                  disabled={zipping}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {zipping ? 'Zipping…' : `Download all ${done.length} as .zip`}
                </Button>
              ) : null}
              {!running && rows.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setRows([])}>
                  Clear the queue
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="MP3 bitrate"
              value={bitrate}
              onChange={setBitrate}
              options={BITRATES}
              hint={`Constant bitrate, LAME encoder. ${bitrate} kbps is about ${(
                (Number(bitrate) * 60) /
                8 /
                1024
              ).toFixed(1)} MB per minute of audio.`}
              disabled={running}
            />
            <SwitchField
              label="Downmix to mono"
              checked={mono}
              onChange={setMono}
              hint="Halves the file size. Good for lectures, interviews and voice notes; bad for music."
              disabled={running}
            />
          </div>

          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={`${row.file.name}-${row.file.size}-${index}`} className="rounded-lg bg-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(row.file.size)}
                      {row.duration > 0 ? ` · ${formatTimecode(row.duration)}` : ''}
                      {row.blob ? ` → ${formatBytes(row.blob.size)} MP3` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.status === 'done' && row.blob ? (
                      <>
                        <span className="flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Done
                        </span>
                        <DownloadButton
                          blob={row.blob}
                          filename={row.outputName}
                          label="Download"
                          variant="outline"
                          size="sm"
                        />
                      </>
                    ) : null}
                    {row.status === 'error' ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <CircleAlert className="size-4" aria-hidden="true" />
                        Failed
                      </span>
                    ) : null}
                    {!running ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.file.name} from the queue`}
                        onClick={() => removeRow(index)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {row.status === 'working' ? (
                  <div className="mt-2" role="status" aria-live="polite">
                    <Progress value={row.percent} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Extracting the soundtrack: {Math.min(99, Math.round(row.percent))}%
                    </p>
                  </div>
                ) : null}

                {row.error ? <p className="mt-2 text-sm text-destructive">{row.error}</p> : null}
              </li>
            ))}
          </ul>

          {done.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {done.length} of {rows.length} converted · {formatBytes(totalIn)} of video in,{' '}
              {formatBytes(totalOut)} of audio out.
            </p>
          ) : null}
        </ToolPanel>
      ) : null}

      {running && engine.stage === 'downloading' ? (
        <ProgressPanel
          label={`Downloading the FFmpeg engine: ${formatBytes(engine.received)} of ${formatBytes(
            ENGINE_TOTAL_BYTES,
          )}`}
          value={engine.percent}
          sublabel="One time only. It is served by this site and cached afterwards, so later runs work offline."
        />
      ) : null}

      {fatal ? <ErrorNote message={fatal} onRetry={() => void start()} /> : null}

      <EngineNotice />
    </div>
  )
}
