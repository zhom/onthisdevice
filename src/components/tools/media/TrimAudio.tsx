import { useEffect, useMemo, useRef, useState } from 'react'
import { Scissors } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { fileExtension, stripExtension } from '@/lib/utils'

import { formatTimecode, inputName, toFFmpegTime } from './_ffmpeg'
import {
  AdvancedOptions,
  DetectDurationPanel,
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  NumberField,
  ResultPanel,
  SelectField,
  SourceSummary,
  TrimControls,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.wma,.aiff,.aif,audio/*'

const COPY_CONTAINERS = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus'])

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
}

const ENCODE_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A (AAC)' },
  { value: 'wav', label: 'WAV (lossless PCM)' },
  { value: 'flac', label: 'FLAC (lossless)' },
]

const BITRATES = [
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '128', label: '128 kbps' },
  { value: '96', label: '96 kbps (speech)' },
]

export default function TrimAudio() {
  const source = useSourceFile('audio')
  const job = useMediaJob()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [mode, setMode] = useState('copy')
  const [startAt, setStartAt] = useState(0)
  const [endAt, setEndAt] = useState(0)
  const [encodeFormat, setEncodeFormat] = useState('mp3')
  const [bitrate, setBitrate] = useState('192')
  const [fadeIn, setFadeIn] = useState<number | ''>(0)
  const [fadeOut, setFadeOut] = useState<number | ''>(0)

  const file = source.file
  const duration = source.info?.duration ?? 0
  const ext = file ? fileExtension(file.name) : ''
  const copyPossible = COPY_CONTAINERS.has(ext)

  useEffect(() => {
    setStartAt(0)
    setEndAt(duration)
  }, [duration, file])

  useEffect(() => {
    if (!copyPossible) setMode('encode')
  }, [copyPossible])

  const fadeInSec = typeof fadeIn === 'number' ? Math.max(0, fadeIn) : 0
  const fadeOutSec = typeof fadeOut === 'number' ? Math.max(0, fadeOut) : 0
  const hasFade = fadeInSec > 0 || fadeOutSec > 0
  const useCopy = mode === 'copy' && copyPossible && !hasFade
  const outExt = useCopy ? ext : encodeFormat
  const clipLength = Math.max(0, endAt - startAt)

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}-trimmed.${outExt}` : `trimmed.${outExt}`),
    [file, outExt],
  )

  const startJob = () => {
    if (!file || clipLength <= 0) return
    const input = inputName(file)
    const output = `output.${outExt}`
    const args = ['-ss', toFFmpegTime(startAt), '-i', input, '-t', toFFmpegTime(clipLength), '-vn']

    if (useCopy) {
      args.push('-c:a', 'copy')
    } else {
      if (encodeFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`)
      else if (encodeFormat === 'm4a') args.push('-c:a', 'aac', '-b:a', `${bitrate}k`)
      else if (encodeFormat === 'wav') args.push('-c:a', 'pcm_s16le')
      else args.push('-c:a', 'flac')

      const filters: string[] = []
      if (fadeInSec > 0) filters.push(`afade=t=in:st=0:d=${fadeInSec}`)
      if (fadeOutSec > 0)
        filters.push(`afade=t=out:st=${Math.max(0, clipLength - fadeOutSec).toFixed(3)}:d=${fadeOutSec}`)
      if (filters.length) args.push('-af', filters.join(','))
    }

    args.push(output)

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output,
      mime: MIME_BY_EXT[outExt] ?? 'audio/mpeg',
      filename: outputName,
      durationSec: clipLength,
      inputBytes: file.size,
    })
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          onFiles={source.select}
          maxSizeMb={1024}
          title="Drop an audio file to trim"
          hint="MP3, WAV, M4A, FLAC or OGG. Cut to the second."
        />
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={source.info?.duration}
        onClear={() => {
          job.reset()
          source.clear()
        }}
      />

      {source.info?.playable ? (
        <MediaPreview source={file} kind="audio" mediaRef={audioRef} />
      ) : source.probing ? null : (
        <DetectDurationPanel file={file} onDuration={source.setDuration} />
      )}

      <ToolPanel
        title="Select the part to keep"
        description="Play the track, stop where you want the cut, then press “Set here” to snap the handle to the playhead."
        footer={
          <Button
            type="button"
            onClick={startJob}
            disabled={job.busy || clipLength <= 0}
            className="w-full sm:w-auto"
          >
            <Scissors className="size-4" aria-hidden="true" />
            {job.busy ? 'Trimming…' : 'Trim audio'}
          </Button>
        }
      >
        {duration > 0 ? (
          <TrimControls
            duration={duration}
            start={startAt}
            end={endAt}
            mediaRef={audioRef}
            onChange={(nextStart, nextEnd) => {
              setStartAt(nextStart)
              setEndAt(nextEnd)
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            The tool needs the track length first. Use “Read length with FFmpeg” above.
          </p>
        )}

        <SelectField
          label="Trim mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'copy', label: 'Lossless: copy the audio stream' },
            { value: 'encode', label: 'Re-encode: exact cut, fades, format change' },
          ]}
          disabled={!copyPossible}
          hint={
            !copyPossible
              ? 'This format cannot be cut without re-encoding.'
              : useCopy
                ? 'The samples are copied untouched, so there is zero generation loss. MP3 cuts land on a frame boundary (about 26 ms).'
                : 'Re-encoding is needed for fades or a format change.'
          }
        />

        {!useCopy ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Output format"
              value={encodeFormat}
              onChange={setEncodeFormat}
              options={ENCODE_FORMATS}
            />
            {encodeFormat === 'mp3' || encodeFormat === 'm4a' ? (
              <SelectField label="Bitrate" value={bitrate} onChange={setBitrate} options={BITRATES} />
            ) : null}
          </div>
        ) : null}

        <AdvancedOptions label="Fade in / fade out">
          <p className="text-sm text-muted-foreground">
            Fades require re-encoding, so setting either one above zero switches the mode
            automatically.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Fade in"
              value={fadeIn}
              min={0}
              max={30}
              step={0.5}
              suffix="s"
              onChange={setFadeIn}
            />
            <NumberField
              label="Fade out"
              value={fadeOut}
              min={0}
              max={30}
              step={0.5}
              suffix="s"
              onChange={setFadeOut}
            />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label={useCopy ? 'Copying the selected range' : 'Re-encoding the clip'} />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="audio"
          downloadLabel="Download the clip"
          resetLabel="Trim another file"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Clip length" value={formatTimecode(clipLength, 2)} />
              <ResultStat
                label="Mode"
                value={useCopy ? 'Lossless stream copy' : `Re-encoded ${outExt.toUpperCase()}`}
                hint={`${formatTimecode(startAt, 2)} → ${formatTimecode(endAt, 2)}`}
              />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
