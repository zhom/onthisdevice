import { useEffect, useMemo, useRef, useState } from 'react'
import { Music } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes, stripExtension } from '@/lib/utils'

import { estimateSize, formatTimecode, inputName, toFFmpegTime } from './_ffmpeg'
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
  SwitchField,
  TrimControls,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

const BITRATES = [
  { value: '320', label: '320 kbps (highest MP3 quality)' },
  { value: '256', label: '256 kbps (very good)' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '160', label: '160 kbps' },
  { value: '128', label: '128 kbps (small file)' },
  { value: '96', label: '96 kbps (speech, podcasts)' },
]

const SAMPLE_RATES = [
  { value: 'source', label: 'Keep the source sample rate' },
  { value: '48000', label: '48 000 Hz (video standard)' },
  { value: '44100', label: '44 100 Hz (CD standard)' },
  { value: '32000', label: '32 000 Hz' },
  { value: '22050', label: '22 050 Hz (voice only)' },
]

const CHANNELS = [
  { value: 'source', label: 'Keep source channels' },
  { value: '2', label: 'Stereo' },
  { value: '1', label: 'Mono (about half the size)' },
]

export default function VideoToMp3() {
  const source = useSourceFile('video')
  const job = useMediaJob()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [bitrate, setBitrate] = useState('192')
  const [sampleRate, setSampleRate] = useState('source')
  const [channels, setChannels] = useState('source')
  const [trim, setTrim] = useState(false)
  const [startAt, setStartAt] = useState(0)
  const [endAt, setEndAt] = useState(0)

  const file = source.file
  const duration = source.info?.duration ?? 0

  useEffect(() => {
    setStartAt(0)
    setEndAt(duration)
    setTrim(false)
  }, [duration, file])

  const clipLength = trim && duration > 0 ? Math.max(0, endAt - startAt) : duration
  const estimate = clipLength > 0 ? estimateSize(Number(bitrate), clipLength) : 0

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.mp3` : 'audio.mp3'),
    [file],
  )

  const startJob = () => {
    if (!file) return
    const input = inputName(file)
    const args: string[] = []
    if (trim && duration > 0) {
      args.push('-ss', toFFmpegTime(startAt))
    }
    args.push('-i', input)
    if (trim && duration > 0) {
      args.push('-t', toFFmpegTime(Math.max(0.05, endAt - startAt)))
    }
    args.push('-vn', '-map', 'a:0', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`)
    if (sampleRate !== 'source') args.push('-ar', sampleRate)
    if (channels !== 'source') args.push('-ac', channels)
    args.push('-id3v2_version', '3', 'output.mp3')

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output: 'output.mp3',
      mime: 'audio/mpeg',
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
          title="Drop a video to pull the audio out of it"
          hint="MP4, MOV, MKV, WebM or AVI"
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
        title="MP3 settings"
        description="192 kbps is transparent for most music. 96 kbps is enough for speech."
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <Music className="size-4" aria-hidden="true" />
            {job.busy ? 'Extracting…' : 'Extract MP3'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Bitrate" value={bitrate} onChange={setBitrate} options={BITRATES} />
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Estimated size</span>
            <p className="text-sm text-muted-foreground">
              {estimate > 0
                ? `≈ ${formatBytes(estimate)} for ${formatTimecode(clipLength)} of audio`
                : 'Pick a clip length to see an estimate.'}
            </p>
          </div>
        </div>

        <SwitchField
          label="Trim before extracting"
          checked={trim}
          onChange={setTrim}
          disabled={duration <= 0}
          hint={
            duration > 0
              ? 'Export only part of the soundtrack.'
              : 'Available once the clip length is known.'
          }
        />

        {trim && duration > 0 ? (
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
        ) : null}

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sample rate"
              value={sampleRate}
              onChange={setSampleRate}
              options={SAMPLE_RATES}
            />
            <SelectField
              label="Channels"
              value={channels}
              onChange={setChannels}
              options={CHANNELS}
            />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Encoding MP3" />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="audio"
          downloadLabel="Download MP3"
          resetLabel="Extract from another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Bitrate" value={`${bitrate} kbps`} />
              <ResultStat label="Audio length" value={formatTimecode(clipLength)} />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
