import { useMemo, useState } from 'react'
import { FlipHorizontal, RotateCw, Zap, TriangleAlert } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension } from '@/lib/utils'

import { inputName } from './_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  ResultPanel,
  SelectField,
  SourceSummary,
  useMediaJob,
  useSourceFile,
} from './_shared'
import { QUALITY_OPTIONS, VIDEO_ACCEPT, X264_SPEED_OPTIONS, crfFor, evenClamp } from './video-shared'
import type { QualityKey } from './video-shared'

export interface RotateVideoProps {
  /** `rotate` on /rotate-video, `flip` on /flip-video. */
  mode: 'rotate' | 'flip'
}

type Turn = '90' | '270' | '180'
type Flip = 'h' | 'v' | 'both'

const TURNS: { value: Turn; label: string; transpose: string[]; degrees: number }[] = [
  { value: '90', label: '90° clockwise (for a phone held on its left side)', transpose: ['transpose=1'], degrees: 90 },
  {
    value: '270',
    label: '90° counter-clockwise (for a phone held on its right side)',
    transpose: ['transpose=2'],
    degrees: -90,
  },
  { value: '180', label: '180° (upside-down footage)', transpose: ['transpose=1', 'transpose=1'], degrees: 180 },
]

const FLIPS: { value: Flip; label: string; filter: string; transform: string }[] = [
  {
    value: 'h',
    label: 'Mirror horizontally (un-mirror a selfie or webcam clip)',
    filter: 'hflip',
    transform: 'scaleX(-1)',
  },
  { value: 'v', label: 'Flip vertically (top becomes bottom)', filter: 'vflip', transform: 'scaleY(-1)' },
  {
    value: 'both',
    label: 'Both (the same result as a 180° rotation)',
    filter: 'hflip,vflip',
    transform: 'scale(-1, -1)',
  },
]

/** Containers whose muxers honour a rotation flag. */
const METADATA_CONTAINERS = ['mp4', 'mov', 'm4v', '3gp']

export default function RotateVideo({ mode }: RotateVideoProps) {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [turn, setTurn] = useState<Turn>('90')
  const [flip, setFlip] = useState<Flip>('h')
  const [method, setMethod] = useState<'metadata' | 'bake'>(mode === 'rotate' ? 'metadata' : 'bake')
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [speed, setSpeed] = useState('veryfast')

  const file = source.file
  const duration = source.info?.duration ?? 0
  const extension = file ? file.name.split('.').pop()?.toLowerCase() ?? '' : ''
  const metadataPossible = mode === 'rotate' && METADATA_CONTAINERS.includes(extension)
  const usingMetadata = mode === 'rotate' && method === 'metadata' && metadataPossible

  const turnSpec = TURNS.find((t) => t.value === turn) ?? TURNS[0]
  const flipSpec = FLIPS.find((f) => f.value === flip) ?? FLIPS[0]

  /**
   * A quarter turn makes the element's bounding box taller than its container,
   * so scale it back by the source aspect ratio to keep the preview inside the
   * card instead of being clipped.
   */
  const previewTransform = (() => {
    if (mode === 'flip') return flipSpec.transform
    const quarter = turnSpec.degrees === 90 || turnSpec.degrees === -90
    const w = source.info?.width ?? 0
    const h = source.info?.height ?? 0
    const shrink = quarter && w > 0 && h > 0 ? Math.min(1, h / w) : 1
    return `rotate(${turnSpec.degrees}deg) scale(${shrink.toFixed(4)})`
  })()

  const outputName = useMemo(() => {
    if (!file) return mode === 'rotate' ? 'rotated.mp4' : 'flipped.mp4'
    const suffix = mode === 'rotate' ? 'rotated' : 'flipped'
    const ext = usingMetadata ? extension || 'mp4' : 'mp4'
    return `${stripExtension(file.name)}-${suffix}.${ext}`
  }, [extension, file, mode, usingMetadata])

  const command = useMemo(() => {
    if (!file) return null
    const name = inputName(file)
    const output = usingMetadata ? `output.${extension || 'mp4'}` : 'output.mp4'

    if (usingMetadata) {
      return {
        output,
        args: ['-i', name, '-c', 'copy', '-metadata:s:v:0', `rotate=${turn}`, output],
        mime: extension === 'mov' ? 'video/quicktime' : 'video/mp4',
      }
    }

    const filters = mode === 'rotate' ? turnSpec.transpose : [flipSpec.filter]
    return {
      output,
      args: [
        '-i',
        name,
        '-vf',
        filters.join(','),
        '-c:v',
        'libx264',
        '-preset',
        speed,
        '-crf',
        String(crfFor('mp4', quality)),
        '-pix_fmt',
        'yuv420p',
        '-metadata:s:v:0',
        'rotate=0',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        output,
      ],
      mime: 'video/mp4',
    }
  }, [extension, file, flipSpec, mode, quality, speed, turn, turnSpec, usingMetadata])

  const start = () => {
    if (!file || !command) return
    void job.run(() => ({
      inputs: [{ name: inputName(file), data: file }],
      commands: [command.args],
      output: command.output,
      mime: command.mime,
      filename: outputName,
      durationSec: usingMetadata ? 0 : duration,
      inputBytes: file.size,
    }))
  }

  const reset = () => {
    job.reset()
    source.clear()
  }

  const newSize =
    source.info && source.info.width > 0 && mode === 'rotate' && turn !== '180'
      ? `${evenClamp(source.info.height)}×${evenClamp(source.info.width)}`
      : source.info && source.info.width > 0
        ? `${evenClamp(source.info.width)}×${evenClamp(source.info.height)}`
        : null

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={VIDEO_ACCEPT}
          onFiles={source.select}
          maxSizeMb={4096}
          title={mode === 'rotate' ? 'Drop a sideways video here' : 'Drop a video to flip'}
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
        duration={duration}
        width={source.info?.width}
        height={source.info?.height}
        onClear={reset}
      />

      {source.info?.playable ? (
        <div className="space-y-2">
          <div className="mx-auto max-w-md overflow-hidden rounded-lg bg-muted p-4">
            <div
              className="origin-center transition-transform duration-200 motion-reduce:transition-none"
              style={{ transform: previewTransform }}
            >
              <MediaPreview source={file} kind="video" className="max-h-[280px]" />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Live preview on the player only. Press the button below to write the change into the
            video.
          </p>
        </div>
      ) : null}

      <ToolPanel
        title={mode === 'rotate' ? 'Rotation' : 'Mirror and flip'}
        description={
          mode === 'rotate'
            ? 'Phones record every clip in landscape and add a rotation flag. Sometimes an app ignores that flag. There are two ways to fix it.'
            : 'Flipping always redraws every frame, so the result is a new H.264 MP4.'
        }
        footer={
          <Button type="button" onClick={start} disabled={job.busy}>
            {mode === 'rotate' ? (
              <RotateCw className="size-4" aria-hidden="true" />
            ) : (
              <FlipHorizontal className="size-4" aria-hidden="true" />
            )}
            {job.busy ? 'Working…' : mode === 'rotate' ? 'Rotate video' : 'Flip video'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === 'rotate' ? (
            <SelectField
              label="Direction"
              value={turn}
              onChange={(value) => setTurn(value as Turn)}
              options={TURNS.map(({ value, label }) => ({ value, label }))}
              disabled={job.busy}
            />
          ) : (
            <SelectField
              label="Flip"
              value={flip}
              onChange={(value) => setFlip(value as Flip)}
              options={FLIPS.map(({ value, label }) => ({ value, label }))}
              disabled={job.busy}
            />
          )}

          {mode === 'rotate' ? (
            <SelectField
              label="Method"
              value={method}
              onChange={(value) => setMethod(value as 'metadata' | 'bake')}
              options={[
                {
                  value: 'metadata',
                  label: metadataPossible
                    ? 'Rotate the flag (fast, lossless)'
                    : 'Rotate the flag (not supported by this container)',
                },
                { value: 'bake', label: 'Bake it into the pixels (slower, works everywhere)' },
              ]}
              hint={
                usingMetadata
                  ? 'The streams are copied bit-for-bit and only the display flag changes. Seconds, even for a 2 GB file.'
                  : 'Every frame is decoded, turned and re-encoded as H.264.'
              }
              disabled={job.busy}
            />
          ) : null}
        </div>

        {mode === 'rotate' && method === 'metadata' && !metadataPossible ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              A rotation flag only exists in MP4, MOV and 3GP files. This is a{' '}
              <span className="font-mono">.{extension || 'unknown'}</span> file, so the rotation will
              be baked into the pixels instead and the result will be an MP4.
            </span>
          </p>
        ) : null}

        {usingMetadata ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Stream copy: no frame is re-compressed, so the file is ready in seconds and the picture
              quality does not change. Some old players and upload forms ignore the flag. If that
              happens, switch to “bake it into the pixels”.
            </span>
          </p>
        ) : null}

        {newSize ? (
          <p className="text-sm text-muted-foreground">
            Result: <span className="font-mono text-foreground">{newSize}</span>
            {mode === 'rotate' && turn !== '180'
              ? '. A quarter turn swaps width and height.'
              : '. The frame size is unchanged.'}{' '}
            FFmpeg filter:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {usingMetadata
                ? `-c copy -metadata:s:v:0 rotate=${turn}`
                : `-vf ${(mode === 'rotate' ? turnSpec.transpose : [flipSpec.filter]).join(',')}`}
            </code>
          </p>
        ) : null}

        {!usingMetadata ? (
          <AdvancedOptions>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Quality"
                value={quality}
                onChange={(value) => setQuality(value as QualityKey)}
                options={QUALITY_OPTIONS}
                hint={`CRF ${crfFor('mp4', quality)}. Lower keeps more detail.`}
              />
              <SelectField
                label="Encoder speed preset"
                value={speed}
                onChange={setSpeed}
                options={X264_SPEED_OPTIONS}
              />
            </div>
          </AdvancedOptions>
        ) : null}
      </ToolPanel>

      <JobStatus job={job} label={usingMetadata ? 'Rewriting the container' : 'Re-encoding'} />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel="Download the fixed video"
          resetLabel={mode === 'rotate' ? 'Rotate another video' : 'Flip another video'}
          note={
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {usingMetadata
                ? 'Only the rotation flag changed. The audio and video data are byte-for-byte the originals. If a player still shows it sideways, run it again with “bake it into the pixels”.'
                : 'The rotation is now part of the picture itself, so every player and every upload form will show it the right way up.'}
            </p>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
