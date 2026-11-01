import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Combine, ListMusic, Trash2, X } from 'lucide-react'

import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes, stripExtension } from '@/lib/utils'

import { formatTimecode, getEngine, probeMedia } from './_ffmpeg'
import { AdvancedOptions, DualRangeSlider, MediaPreview, SelectField } from './_shared'
import {
  EngineNotice,
  Note,
  TaskStatus,
  cleanupFs,
  execFFmpeg,
  fileBytes,
  formatElapsed,
  readOutput,
  useTask,
} from './_gif-audio-core'

const ACCEPT =
  '.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.wma,.aiff,.aif,.amr,.webm,.mp4,audio/*'
const MAX_TRACKS = 30
const WAVEFORM_LIMIT_MB = 150
const PEAK_BUCKETS = 480

interface Track {
  id: string
  file: File
  duration: number
  start: number
  end: number
  peaks: number[] | null
  peakState: 'pending' | 'ready' | 'skipped'
}

interface JoinResult {
  blob: Blob
  filename: string
  durationSec: number
  path: 'copy' | 'filter'
  trackCount: number
  elapsedMs: number
  inputBytes: number
}

const FORMATS = [
  { value: 'mp3', label: 'MP3: plays on almost every device' },
  { value: 'm4a', label: 'M4A (AAC): better quality per kilobyte' },
  { value: 'wav', label: 'WAV: uncompressed, for further editing' },
]

const BITRATES = [
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '128', label: '128 kbps' },
  { value: '96', label: '96 kbps (speech)' },
]

const CROSSFADES = [
  { value: '0', label: 'No crossfade (hard cut between tracks)' },
  { value: '0.5', label: '0.5 s (tight)' },
  { value: '1', label: '1 second' },
  { value: '2', label: '2 seconds (classic mix)' },
  { value: '4', label: '4 seconds (long blend)' },
]

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
}

/** Reduce a decoded buffer to a fixed number of absolute peaks for drawing. */
function peaksFrom(buffer: AudioBuffer, buckets: number): number[] {
  const channel = buffer.getChannelData(0)
  const size = Math.max(1, Math.floor(channel.length / buckets))
  const peaks: number[] = []
  for (let i = 0; i < buckets; i += 1) {
    let max = 0
    const from = i * size
    const to = Math.min(channel.length, from + size)
    for (let j = from; j < to; j += 1) {
      const value = Math.abs(channel[j] ?? 0)
      if (value > max) max = value
    }
    peaks.push(max)
  }
  return peaks
}

function Waveform({
  peaks,
  start,
  end,
  duration,
  label,
}: {
  peaks: number[] | null
  start: number
  end: number
  duration: number
  label: string
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [tick, setTick] = useState(0)

  // Redraw when the theme flips so the waveform never renders in the old palette.
  useEffect(() => {
    const observer = new MutationObserver(() => setTick((value) => value + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !peaks) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = canvas.clientWidth || 320
    const height = 56
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(dpr, dpr)
    context.clearRect(0, 0, width, height)

    const styles = getComputedStyle(canvas)
    const active = styles.color
    const inactive = styles.borderColor

    const middle = height / 2
    const barWidth = width / peaks.length
    const fromX = duration > 0 ? (start / duration) * width : 0
    const toX = duration > 0 ? (end / duration) * width : width

    peaks.forEach((peak, i) => {
      const x = i * barWidth
      const amplitude = Math.max(1, peak * (height - 6))
      context.fillStyle = x + barWidth >= fromX && x <= toX ? active : inactive
      context.fillRect(x, middle - amplitude / 2, Math.max(1, barWidth - 0.5), amplitude)
    })
  }, [duration, end, peaks, start, tick])

  if (!peaks)
    return (
      <div className="flex h-14 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        No waveform for this format. Trimming still works.
      </div>
    )

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className="h-14 w-full rounded-md bg-muted text-primary"
    />
  )
}

export default function GifAudioJoiner() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [format, setFormat] = useState('mp3')
  const [bitrate, setBitrate] = useState('192')
  const [crossfade, setCrossfade] = useState('0')
  const [addError, setAddError] = useState<string | null>(null)

  const task = useTask<JoinResult>()
  const tracksRef = useRef<Track[]>([])
  tracksRef.current = tracks
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
    }
  }, [])

  const loadPeaks = useCallback(async (track: Track) => {
    if (track.file.size > WAVEFORM_LIMIT_MB * 1024 * 1024) {
      setTracks((current) =>
        current.map((row) => (row.id === track.id ? { ...row, peakState: 'skipped' } : row)),
      )
      return
    }
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) throw new Error('no audio context')
      audioContextRef.current ??= new AudioContextClass()
      const buffer = await audioContextRef.current.decodeAudioData(await track.file.arrayBuffer())
      const peaks = peaksFrom(buffer, PEAK_BUCKETS)
      setTracks((current) =>
        current.map((row) =>
          row.id === track.id
            ? {
                ...row,
                peaks,
                peakState: 'ready',
                duration: row.duration > 0 ? row.duration : buffer.duration,
                end: row.end > 0 ? row.end : buffer.duration,
              }
            : row,
        ),
      )
    } catch {
      setTracks((current) =>
        current.map((row) => (row.id === track.id ? { ...row, peakState: 'skipped' } : row)),
      )
    }
  }, [])

  const add = useCallback(
    async (files: File[]) => {
      setAddError(null)
      const room = MAX_TRACKS - tracksRef.current.length
      if (room <= 0) {
        setAddError(`This joiner takes ${MAX_TRACKS} tracks at a time.`)
        return
      }
      const accepted = files.slice(0, room)
      if (files.length > accepted.length)
        setAddError(`Added the first ${room} files. The limit is ${MAX_TRACKS} tracks.`)

      const next: Track[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        duration: 0,
        start: 0,
        end: 0,
        peaks: null,
        peakState: 'pending' as const,
      }))
      setTracks((current) => [...current, ...next])
      task.reset()

      for (const track of next) {
        const info = await probeMedia(track.file, 'audio')
        if (info.duration > 0)
          setTracks((current) =>
            current.map((row) =>
              row.id === track.id
                ? { ...row, duration: info.duration, end: row.end > 0 ? row.end : info.duration }
                : row,
            ),
          )
        void loadPeaks(track)
      }
    },
    [loadPeaks, task],
  )

  const move = (index: number, delta: number) => {
    setTracks((current) => {
      const to = index + delta
      if (to < 0 || to >= current.length) return current
      const copy = [...current]
      const [moved] = copy.splice(index, 1)
      if (moved) copy.splice(to, 0, moved)
      return copy
    })
    task.reset()
  }

  const remove = (id: string) => {
    setTracks((current) => current.filter((track) => track.id !== id))
    task.reset()
  }

  const setRange = (id: string, start: number, end: number) => {
    setTracks((current) =>
      current.map((track) => (track.id === id ? { ...track, start, end } : track)),
    )
  }

  const crossfadeSec = Number(crossfade)
  const trimmed = tracks.map((track) =>
    track.duration > 0 ? Math.max(0, track.end - track.start) : 0,
  )
  const rawTotal = trimmed.reduce((sum, value) => sum + value, 0)
  const overlaps = Math.max(0, tracks.length - 1) * crossfadeSec
  const totalDuration = Math.max(0, rawTotal - overlaps)
  const anyTrimmed = tracks.some(
    (track) => track.duration > 0 && (track.start > 0.01 || track.end < track.duration - 0.01),
  )
  const sameExtension =
    tracks.length > 1 &&
    new Set(
      tracks.map((track) => track.file.name.slice(track.file.name.lastIndexOf('.')).toLowerCase()),
    ).size === 1
  const canStreamCopy = sameExtension && !anyTrimmed && crossfadeSec === 0

  const join = () => {
    if (tracks.length < 2) {
      task.fail('Add at least two audio files.')
      return
    }
    if (crossfadeSec > 0 && trimmed.some((value) => value > 0 && value <= crossfadeSec)) {
      task.fail(
        `One of your tracks is shorter than the ${crossfadeSec} s crossfade. Shorten the crossfade or trim less.`,
      )
      return
    }

    const snapshot = tracks.map((track) => ({ ...track }))
    const outExtension = canStreamCopy
      ? (snapshot[0]?.file.name.split('.').pop() ?? 'mp3').toLowerCase()
      : format
    const output = `joined.${outExtension}`
    const inputBytes = snapshot.reduce((sum, track) => sum + track.file.size, 0)

    void task.run(async (ctx) => {
      const started = performance.now()
      const ffmpeg = await getEngine()
      const names: string[] = []
      const temps = ['list.txt', output]

      try {
        for (let i = 0; i < snapshot.length; i += 1) {
          const track = snapshot[i]
          if (!track) continue
          ctx.throwIfCancelled()
          ctx.setStatus(`Loading ${i + 1} of ${snapshot.length}: ${track.file.name}`)
          ctx.setPercent((i / snapshot.length) * 15)
          const extension = (track.file.name.split('.').pop() ?? 'bin')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
          const name = `t${i}.${extension || 'bin'}`
          await ffmpeg.writeFile(name, await fileBytes(track.file))
          names.push(name)
        }

        ctx.throwIfCancelled()

        if (canStreamCopy) {
          ctx.setStatus('Joining without re-encoding…')
          const list = names.map((name) => `file '${name}'`).join('\n')
          await ffmpeg.writeFile('list.txt', new TextEncoder().encode(`${list}\n`))
          await execFFmpeg(
            ffmpeg,
            ['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', output],
            {
              totalSeconds: totalDuration,
              onProgress: (fraction) => ctx.setPercent(15 + fraction * 84),
            },
          )
        } else {
          ctx.setStatus('Mixing and encoding…')
          const args: string[] = []
          for (const name of names) args.push('-i', name)

          const chains: string[] = []
          snapshot.forEach((track, i) => {
            const parts: string[] = []
            if (track.duration > 0 && (track.start > 0.01 || track.end < track.duration - 0.01))
              parts.push(`atrim=start=${track.start.toFixed(3)}:end=${track.end.toFixed(3)}`)
            parts.push('asetpts=PTS-STARTPTS')
            // Every branch must agree on layout and rate before concat/crossfade.
            parts.push('aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo')
            chains.push(`[${i}:a]${parts.join(',')}[a${i}]`)
          })

          if (crossfadeSec > 0) {
            let current = 'a0'
            for (let i = 1; i < snapshot.length; i += 1) {
              const next = i === snapshot.length - 1 ? 'out' : `x${i}`
              chains.push(
                `[${current}][a${i}]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[${next}]`,
              )
              current = next
            }
          } else {
            const labels = snapshot.map((_track, i) => `[a${i}]`).join('')
            chains.push(`${labels}concat=n=${snapshot.length}:v=0:a=1[out]`)
          }

          args.push('-filter_complex', chains.join(';'), '-map', '[out]')
          if (format === 'mp3')
            args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-id3v2_version', '3')
          else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', `${bitrate}k`)
          else args.push('-c:a', 'pcm_s16le')
          args.push('-y', output)

          await execFFmpeg(ffmpeg, args, {
            totalSeconds: totalDuration,
            onProgress: (fraction) => ctx.setPercent(15 + fraction * 84),
          })
        }

        const blob = await readOutput(ffmpeg, output, MIME[outExtension] ?? 'audio/mpeg')
        return {
          blob,
          filename: `${stripExtension(snapshot[0]?.file.name ?? 'joined')}-joined.${outExtension}`,
          durationSec: totalDuration,
          path: canStreamCopy ? ('copy' as const) : ('filter' as const),
          trackCount: snapshot.length,
          elapsedMs: performance.now() - started,
          inputBytes,
        }
      } finally {
        await cleanupFs(ffmpeg, [...names, ...temps])
      }
    })
  }

  const summary = useMemo(
    () => ({
      count: tracks.length,
      total: totalDuration,
    }),
    [totalDuration, tracks.length],
  )

  if (tracks.length === 0) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          multiple
          onFiles={(files) => void add(files)}
          maxSizeMb={2048}
          title="Drop the audio files you want to join"
          hint="MP3, WAV, M4A, FLAC, OGG, Opus or AMR. You can mix formats."
          icon={ListMusic}
        />
        <Note>
          The browser’s Web Audio decoder draws the waveforms, so you can trim before you join.
          FFmpeg joins up to {MAX_TRACKS} tracks in this tab, with no length limit.
        </Note>
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ToolPanel
        title={`${summary.count} track${summary.count === 1 ? '' : 's'} · ${formatTimecode(summary.total)} total`}
        description="Tracks play in the order below. Use the arrows to reorder and the handles to trim each one."
        footer={
          <div className="flex w-full flex-wrap gap-2">
            <Button type="button" onClick={join} disabled={task.busy || tracks.length < 2}>
              <Combine className="size-4" aria-hidden="true" />
              {task.busy ? 'Joining…' : `Join ${tracks.length} tracks`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={task.busy}
              onClick={() => {
                setTracks([])
                task.reset()
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear all
            </Button>
          </div>
        }
      >
        <ol className="space-y-3">
          {tracks.map((track, index) => (
            <li key={track.id} className="space-y-3 rounded-lg bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}.</span>
                    {track.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(track.file.size)}
                    {track.duration > 0 ? ` · ${formatTimecode(track.duration)}` : ' · reading…'}
                    {track.duration > 0 && (track.start > 0.01 || track.end < track.duration - 0.01)
                      ? ` · using ${formatTimecode(Math.max(0, track.end - track.start))}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label={`Move ${track.file.name} up`}
                    disabled={index === 0 || task.busy}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label={`Move ${track.file.name} down`}
                    disabled={index === tracks.length - 1 || task.busy}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove ${track.file.name}`}
                    disabled={task.busy}
                    onClick={() => remove(track.id)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {track.peakState === 'pending' ? (
                <div className="h-14 animate-pulse rounded-md bg-muted" />
              ) : (
                <Waveform
                  peaks={track.peaks}
                  start={track.start}
                  end={track.duration > 0 ? track.end : 0}
                  duration={track.duration}
                  label={`Waveform of ${track.file.name}`}
                />
              )}

              {track.duration > 0 ? (
                <DualRangeSlider
                  min={0}
                  max={track.duration}
                  step={track.duration > 600 ? 0.5 : 0.05}
                  start={track.start}
                  end={track.end}
                  disabled={task.busy}
                  startLabel={`Start of ${track.file.name}`}
                  endLabel={`End of ${track.file.name}`}
                  onChange={(start, end) => setRange(track.id, start, end)}
                />
              ) : null}
            </li>
          ))}
        </ol>

        <FileDropzone
          accept={ACCEPT}
          multiple
          onFiles={(files) => void add(files)}
          maxSizeMb={2048}
          title="Add more tracks"
          hint={`${MAX_TRACKS - tracks.length} more can be added`}
          className="py-6"
          disabled={task.busy}
        />
        {addError ? <ErrorNote message={addError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Crossfade between tracks"
            value={crossfade}
            onChange={setCrossfade}
            options={CROSSFADES}
            hint="A crossfade overlaps neighbouring tracks, so the total gets shorter by the fade length each time."
            disabled={task.busy}
          />
          <SelectField
            label="Output format"
            value={format}
            onChange={setFormat}
            options={FORMATS}
            disabled={task.busy || canStreamCopy}
            hint={
              canStreamCopy
                ? 'Your files share one format and need no trimming, so they are joined without re-encoding. The audio stays bit-identical.'
                : undefined
            }
          />
        </div>

        {format !== 'wav' && !canStreamCopy ? (
          <AdvancedOptions>
            <SelectField
              label="Bitrate"
              value={bitrate}
              onChange={setBitrate}
              options={BITRATES}
              disabled={task.busy}
            />
          </AdvancedOptions>
        ) : null}

        <Note>
          {canStreamCopy
            ? 'Lossless path: with identical containers, no trims and no crossfade, FFmpeg copies the audio packets as they are. Nothing is re-encoded.'
            : 'Re-encode path: mixed formats, a trim or a crossfade need decoding, so all tracks are converted to 44.1 kHz stereo and encoded once.'}
        </Note>
      </ToolPanel>

      <TaskStatus task={task} label="Joining your audio" />
      {task.phase === 'error' && task.error ? (
        <ErrorNote message={task.error} onRetry={join} />
      ) : null}

      {task.result ? (
        <ToolPanel title="Your joined track">
          <MediaPreview source={task.result.blob} kind="audio" />
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat
              label="Length"
              value={formatTimecode(task.result.durationSec)}
              emphasis
              hint={`${task.result.trackCount} tracks joined`}
            />
            <ResultStat
              label="File size"
              value={formatBytes(task.result.blob.size)}
              hint={`Inputs totalled ${formatBytes(task.result.inputBytes)}`}
            />
            <ResultStat
              label="Method"
              value={task.result.path === 'copy' ? 'Lossless copy' : 'Re-encoded'}
              hint={`Took ${formatElapsed(task.result.elapsedMs)}`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton
              blob={task.result.blob}
              filename={task.result.filename}
              label="Download the joined file"
            />
            <Button type="button" variant="outline" onClick={() => task.reset()}>
              Adjust and re-join
            </Button>
          </div>
        </ToolPanel>
      ) : null}

      <EngineNotice />
    </div>
  )
}
