import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlay } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension } from '@/lib/utils'

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
  SwitchField,
  TrimControls,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

const FPS_OPTIONS = [
  { value: '8', label: '8 fps (smallest file)' },
  { value: '10', label: '10 fps' },
  { value: '12', label: '12 fps (recommended)' },
  { value: '15', label: '15 fps (smooth)' },
  { value: '20', label: '20 fps' },
  { value: '24', label: '24 fps (very smooth, large)' },
]

const WIDTHS = [
  { value: '240', label: '240 px (chat sticker)' },
  { value: '320', label: '320 px (small)' },
  { value: '480', label: '480 px (recommended)' },
  { value: '640', label: '640 px (large)' },
  { value: '800', label: '800 px (very large)' },
  { value: 'source', label: 'Keep the original width' },
]

const DITHERS = [
  { value: 'sierra2_4a', label: 'Sierra2 4A: good for most clips (default)' },
  { value: 'bayer', label: 'Bayer: sharp, good for flat colours' },
  { value: 'floyd_steinberg', label: 'Floyd–Steinberg: smooth gradients' },
  { value: 'none', label: 'None: hard colour edges, smallest file' },
]

const LOOPS = [
  { value: '0', label: 'Loop forever' },
  { value: '-1', label: 'Play once' },
]

const DEFAULT_CLIP = 6

export default function VideoToGif() {
  const source = useSourceFile('video')
  const job = useMediaJob()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [fps, setFps] = useState('12')
  const [width, setWidth] = useState('480')
  const [dither, setDither] = useState('sierra2_4a')
  const [loop, setLoop] = useState('0')
  const [twoPass, setTwoPass] = useState(true)
  const [startAt, setStartAt] = useState(0)
  const [endAt, setEndAt] = useState(DEFAULT_CLIP)

  const file = source.file
  const duration = source.info?.duration ?? 0

  useEffect(() => {
    setStartAt(0)
    setEndAt(duration > 0 ? Math.min(duration, DEFAULT_CLIP) : DEFAULT_CLIP)
  }, [duration, file])

  const clipLength = Math.max(0.1, endAt - startAt)
  const frames = Math.round(clipLength * Number(fps))

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.gif` : 'animation.gif'),
    [file],
  )

  const scale = width === 'source' ? 'scale=iw:-2:flags=lanczos' : `scale=${width}:-2:flags=lanczos`
  const chain = `fps=${fps},${scale}`

  const startJob = () => {
    if (!file) return
    const input = inputName(file)
    const seek = duration > 0 ? ['-ss', toFFmpegTime(startAt)] : []
    const length = duration > 0 ? ['-t', toFFmpegTime(clipLength)] : []

    const commands: string[][] = twoPass
      ? [
          [
            ...seek,
            '-i',
            input,
            ...length,
            '-vf',
            `${chain},palettegen=stats_mode=diff`,
            'palette.png',
          ],
          [
            ...seek,
            '-i',
            input,
            ...length,
            '-i',
            'palette.png',
            '-filter_complex',
            `${chain}[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`,
            '-loop',
            loop,
            '-an',
            'output.gif',
          ],
        ]
      : [
          [
            ...seek,
            '-i',
            input,
            ...length,
            '-vf',
            chain,
            '-loop',
            loop,
            '-an',
            'output.gif',
          ],
        ]

    job.run({
      inputs: [{ name: input, data: file }],
      commands,
      output: 'output.gif',
      mime: 'image/gif',
      filename: outputName,
      durationSec: clipLength,
      temps: ['palette.png'],
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
          title="Drop a video to turn into a GIF"
          hint="MP4, MOV, WebM, MKV or AVI"
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
        title="Choose the part to animate"
        description="GIFs get big quickly. A few seconds at 480 px and 12 fps is a good size."
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
            The clip length is unknown, so the whole video will be converted. Read the length with
            FFmpeg above to select a range.
          </p>
        )}
      </ToolPanel>

      <ToolPanel
        title="GIF settings"
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <ImagePlay className="size-4" aria-hidden="true" />
            {job.busy ? 'Rendering…' : 'Create GIF'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Frame rate" value={fps} onChange={setFps} options={FPS_OPTIONS} />
          <SelectField label="Width" value={width} onChange={setWidth} options={WIDTHS} />
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {frames} frames · {formatTimecode(clipLength, 2)} of animation
          {frames > 400
            ? '. That is a lot of frames for a GIF. Expect a file of several megabytes, or use fewer fps or a shorter clip.'
            : '.'}
        </div>

        <AdvancedOptions>
          <SwitchField
            label="Two-pass palette (recommended)"
            checked={twoPass}
            onChange={setTwoPass}
            hint="Pass one builds a 256-colour palette from your clip. Pass two maps the frames onto it. The colour is much better than with the default web-safe palette, and the encode takes about twice as long."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Dithering"
              value={dither}
              onChange={setDither}
              options={DITHERS}
              disabled={!twoPass}
              hint={twoPass ? undefined : 'Dithering is part of the palette pass.'}
            />
            <SelectField label="Looping" value={loop} onChange={setLoop} options={LOOPS} />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label={twoPass ? 'Building palette and rendering' : 'Rendering GIF'} />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="image"
          downloadLabel="Download GIF"
          resetLabel="Make another GIF"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Frames" value={String(frames)} hint={`${fps} fps`} />
              <ResultStat
                label="Width"
                value={width === 'source' ? 'Original' : `${width} px`}
                hint={twoPass ? 'Palette-optimised' : 'Single pass'}
              />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
