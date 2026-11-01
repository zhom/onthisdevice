import { useEffect, useMemo, useRef, useState } from 'react'
import { Gauge } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn, stripExtension } from '@/lib/utils'

import { formatTimecode, inputName, probeWithEngine } from './_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  ResultPanel,
  SelectField,
  SourceSummary,
  SwitchField,
  useMediaJob,
  useSourceFile,
} from './_shared'
import {
  QUALITY_OPTIONS,
  VIDEO_ACCEPT,
  X264_SPEED_OPTIONS,
  atempoChain,
  crfFor,
} from './video-shared'
import type { QualityKey } from './video-shared'

const PRESETS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4]

export default function VideoSpeed() {
  const source = useSourceFile('video')
  const job = useMediaJob()
  const videoRef = useRef<HTMLVideoElement>(null)

  const [url, setUrl] = useState('')
  const [speed, setSpeed] = useState(2)
  const [dropAudio, setDropAudio] = useState(false)
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [preset, setPreset] = useState('veryfast')

  const file = source.file
  const duration = source.info?.duration ?? 0

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  // Live preview: the browser can change playback rate without touching the file.
  useEffect(() => {
    const el = videoRef.current
    if (el) el.playbackRate = Math.min(4, Math.max(0.25, speed))
  }, [speed, url])

  const chain = useMemo(() => atempoChain(speed), [speed])
  const newDuration = duration > 0 ? duration / speed : 0

  const outputName = useMemo(() => {
    if (!file) return 'speed-changed.mp4'
    const tag = `${String(speed).replace('.', '-')}x`
    return `${stripExtension(file.name)}-${tag}.mp4`
  }, [file, speed])

  const setpts = (1 / speed).toFixed(6)

  const start = () => {
    if (!file) return
    const name = inputName(file)

    void job.run(async () => {
      const probe = await probeWithEngine(file)
      const hasAudio = probe.audioCodec !== null && !dropAudio
      const clipDuration = probe.duration || duration

      const args = ['-i', name]
      if (hasAudio) {
        const filter =
          `[0:v]setpts=${setpts}*PTS[v];` +
          `[0:a]${chain.map((factor) => `atempo=${factor}`).join(',')}[a]`
        args.push('-filter_complex', filter, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k')
      } else {
        args.push('-filter:v', `setpts=${setpts}*PTS`, '-an')
      }

      args.push(
        '-c:v',
        'libx264',
        '-preset',
        preset,
        '-crf',
        String(crfFor('mp4', quality)),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        'output.mp4',
      )

      return {
        inputs: [{ name, data: file }],
        commands: [args],
        output: 'output.mp4',
        mime: 'video/mp4',
        filename: outputName,
        durationSec: clipDuration > 0 ? clipDuration / speed : 0,
        inputBytes: file.size,
      }
    })
  }

  const reset = () => {
    job.reset()
    source.clear()
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={VIDEO_ACCEPT}
          onFiles={source.select}
          maxSizeMb={4096}
          title="Drop a video to speed up or slow down"
          hint="0.25× to 4×, with no length limit"
        />
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={duration}
        width={source.info?.width}
        height={source.info?.height}
        onClear={reset}
      />

      {source.info?.playable && url ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-full rounded-lg bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Press play to hear and see {speed}× before you render. The preview uses the browser’s
            own playback rate and does not change the file.
          </p>
        </div>
      ) : null}

      <ToolPanel
        title="Speed"
        description="Below 1× the clip gets longer and slower; above 1× it gets shorter and faster."
        footer={
          <div className="flex w-full flex-wrap items-center gap-3">
            <Button type="button" onClick={start} disabled={job.busy || speed === 1}>
              <Gauge className="size-4" aria-hidden="true" />
              {job.busy ? 'Rendering…' : `Render at ${speed}×`}
            </Button>
            {speed === 1 ? (
              <span className="text-sm text-muted-foreground">
                1× is the original speed. Pick another value to enable the render.
              </span>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={speed === value ? 'default' : 'outline'}
              aria-pressed={speed === value}
              disabled={job.busy}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </Button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="speed-range">Custom speed: {speed}×</Label>
          <input
            id="speed-range"
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={speed}
            disabled={job.busy}
            onChange={(event) => setSpeed(Number(Number(event.target.value).toFixed(2)))}
            className={cn(
              'h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary',
              job.busy && 'opacity-50',
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.25× (4× longer)</span>
            <span>1× (unchanged)</span>
            <span>4× (4× shorter)</span>
          </div>
        </div>

        <SwitchField
          label="Remove the audio track"
          checked={dropAudio}
          onChange={setDropAudio}
          hint="Slowed-down speech sounds unnatural even with pitch correction. Muting is often the better choice for slow motion."
          disabled={job.busy}
        />

        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium text-foreground">How the new length is worked out</p>
          <p className="font-mono text-xs text-muted-foreground">
            new length = original ÷ speed = {duration > 0 ? formatTimecode(duration, 2) : '–'} ÷{' '}
            {speed} = {newDuration > 0 ? formatTimecode(newDuration, 2) : '–'}
          </p>
          <p className="text-muted-foreground">
            The video filter is{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              setpts={setpts}*PTS
            </code>
            . Every frame’s presentation timestamp is multiplied by 1 ÷ {speed}, so no frames are
            invented or thrown away.{' '}
            {dropAudio
              ? 'The audio is dropped.'
              : `The audio runs through ${
                  chain.length > 1 ? `${chain.length} chained atempo stages` : 'one atempo stage'
                } (${chain
                  .map((factor) => `atempo=${factor}`)
                  .join(', ')}) because the filter only accepts 0.5× to 2× at a time. atempo keeps the pitch, so voices stay in tune.`}
          </p>
        </div>

        {speed < 1 ? (
          <p className="text-sm text-muted-foreground">
            Slowing footage down does not add frames, so 0.25× of a 30 fps clip plays at an
            effective 7.5 fps and will look stuttery. Source footage shot at 60 fps or higher slows
            down far more smoothly.
          </p>
        ) : null}

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Quality"
              value={quality}
              onChange={(value) => setQuality(value as QualityKey)}
              options={QUALITY_OPTIONS}
              hint={`CRF ${crfFor('mp4', quality)}. Changing speed always re-encodes the picture.`}
            />
            <SelectField
              label="Encoder speed preset"
              value={preset}
              onChange={setPreset}
              options={X264_SPEED_OPTIONS}
            />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label={`Rendering at ${speed}×`} />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel="Download the new MP4"
          resetLabel="Change another video"
          note={
            newDuration > 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {formatTimecode(duration, 2)} at {speed}× is {formatTimecode(newDuration, 2)}.
              </p>
            ) : null
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
