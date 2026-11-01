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
  ResultPanel,
  SelectField,
  SourceSummary,
  TrimControls,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

const COPY_CONTAINERS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi'])

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
}

const MODES = [
  { value: 'copy', label: 'Lossless: copy the streams (fast)' },
  { value: 'encode', label: 'Frame-exact: re-encode (slower)' },
]

export default function TrimVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [mode, setMode] = useState('copy')
  const [startAt, setStartAt] = useState(0)
  const [endAt, setEndAt] = useState(0)
  const [crf, setCrf] = useState('20')

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

  const clipLength = Math.max(0, endAt - startAt)
  const useCopy = mode === 'copy' && copyPossible
  const outExt = useCopy ? ext : 'mp4'

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}-trimmed.${outExt}` : `trimmed.${outExt}`),
    [file, outExt],
  )

  const startJob = () => {
    if (!file || clipLength <= 0) return
    const input = inputName(file)
    const output = `output.${outExt}`
    const args = ['-ss', toFFmpegTime(startAt), '-i', input, '-t', toFFmpegTime(clipLength)]

    if (useCopy) {
      args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero', output)
    } else {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        crf,
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        output,
      )
    }

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output,
      mime: MIME_BY_EXT[outExt] ?? 'video/mp4',
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
          title="Drop a video to trim"
          hint="Scrub, set the in and out points, then export"
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
        width={source.info?.width}
        height={source.info?.height}
        onClear={() => {
          job.reset()
          source.clear()
        }}
      />

      {source.info?.playable ? (
        <MediaPreview source={file} kind="video" mediaRef={videoRef} />
      ) : source.probing ? null : (
        <DetectDurationPanel file={file} onDuration={source.setDuration} />
      )}

      <ToolPanel
        title="Select the part to keep"
        description="Play the video, park the playhead where you want the cut, then press “Set here”."
        footer={
          <Button
            type="button"
            onClick={startJob}
            disabled={job.busy || clipLength <= 0}
            className="w-full sm:w-auto"
          >
            <Scissors className="size-4" aria-hidden="true" />
            {job.busy ? 'Trimming…' : 'Trim video'}
          </Button>
        }
      >
        {duration > 0 ? (
          <TrimControls
            duration={duration}
            start={startAt}
            end={endAt}
            mediaRef={videoRef}
            onChange={(nextStart, nextEnd) => {
              setStartAt(nextStart)
              setEndAt(nextEnd)
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            The clip length has to be known before you can pick a range. Use “Read length with
            FFmpeg” above.
          </p>
        )}

        <SelectField
          label="Trim mode"
          value={mode}
          onChange={setMode}
          options={MODES}
          disabled={!copyPossible}
          hint={
            !copyPossible
              ? 'This container cannot be cut without re-encoding, so frame-exact mode is used.'
              : useCopy
                ? 'Nothing is re-encoded, so quality is untouched and the export takes seconds. The cut snaps to the nearest keyframe before your start point, so it can begin up to a few seconds early.'
                : 'Re-encodes with H.264, so the cut lands exactly on the chosen frame. Output is always MP4.'
          }
        />

        {!useCopy ? (
          <AdvancedOptions>
            <SelectField
              label="Re-encode quality (CRF)"
              value={crf}
              onChange={setCrf}
              options={[
                { value: '17', label: 'CRF 17 (visually lossless, big file)' },
                { value: '20', label: 'CRF 20 (recommended)' },
                { value: '23', label: 'CRF 23 (x264 default)' },
                { value: '26', label: 'CRF 26 (smaller)' },
              ]}
            />
          </AdvancedOptions>
        ) : null}
      </ToolPanel>

      <JobStatus job={job} label={useCopy ? 'Copying the selected range' : 'Re-encoding the clip'} />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          downloadLabel="Download the clip"
          resetLabel="Trim another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Clip length" value={formatTimecode(clipLength, 2)} />
              <ResultStat
                label="Mode"
                value={useCopy ? 'Lossless stream copy' : 'Re-encoded H.264'}
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
