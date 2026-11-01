import { useMemo, useState } from 'react'
import { Shrink } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes, stripExtension } from '@/lib/utils'

import { estimateSize, inputName } from './_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  NumberField,
  ResultPanel,
  SelectField,
  SourceSummary,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

type Preset = 'high' | 'balanced' | 'small' | 'tiny' | 'custom'

const PRESET_CRF: Record<Exclude<Preset, 'custom'>, number> = {
  high: 20,
  balanced: 24,
  small: 28,
  tiny: 32,
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'high', label: 'Barely visible loss: CRF 20' },
  { value: 'balanced', label: 'Balanced: CRF 24 (recommended)' },
  { value: 'small', label: 'Small file: CRF 28' },
  { value: 'tiny', label: 'Smallest: CRF 32, soft detail' },
  { value: 'custom', label: 'Custom CRF…' },
]

const SPEEDS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'] as const

const RESOLUTIONS = [
  { value: 'source', label: 'Keep original resolution' },
  { value: '1080', label: 'Downscale to max 1080p' },
  { value: '720', label: 'Downscale to max 720p' },
  { value: '480', label: 'Downscale to max 480p' },
]

const AUDIO_OPTIONS = [
  { value: '128', label: 'AAC 128 kbps (recommended)' },
  { value: '96', label: 'AAC 96 kbps' },
  { value: '64', label: 'AAC 64 kbps (speech)' },
  { value: 'copy', label: 'Copy the original audio (only if it is AAC/MP3)' },
  { value: 'none', label: 'Remove the audio' },
]

/**
 * Rough x264 rate model: bits-per-pixel doubles for every 6 CRF steps down.
 * Only ever presented as an estimate.
 */
function estimateVideoKbps(crf: number, width: number, height: number, fps: number): number {
  const bpp = 0.05 * 2 ** ((28 - crf) / 6)
  return (bpp * width * height * fps) / 1000
}

export default function CompressVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [preset, setPreset] = useState<Preset>('balanced')
  const [customCrf, setCustomCrf] = useState<number | ''>(26)
  const [speed, setSpeed] = useState<string>('veryfast')
  const [resolution, setResolution] = useState('source')
  const [audio, setAudio] = useState('128')

  const file = source.file
  const info = source.info
  const duration = info?.duration ?? 0

  const crf = preset === 'custom' ? (typeof customCrf === 'number' ? customCrf : 26) : PRESET_CRF[preset]

  const targetHeight = resolution === 'source' ? (info?.height ?? 0) : Number(resolution)
  const sourceWidth = info?.width || 1280
  const sourceHeight = info?.height || 720
  const scaleRatio =
    resolution === 'source' || sourceHeight === 0
      ? 1
      : Math.min(1, targetHeight / sourceHeight)
  const outWidth = Math.round(sourceWidth * scaleRatio)
  const outHeight = Math.round(sourceHeight * scaleRatio)

  const audioKbps = audio === 'none' ? 0 : audio === 'copy' ? 128 : Number(audio)
  const estimatedBytes = useMemo(() => {
    if (duration <= 0) return 0
    const videoKbps = estimateVideoKbps(crf, outWidth, outHeight, 30)
    return estimateSize(videoKbps + audioKbps, duration)
  }, [audioKbps, crf, duration, outHeight, outWidth])

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}-compressed.mp4` : 'compressed.mp4'),
    [file],
  )

  const startJob = () => {
    if (!file) return
    const input = inputName(file)
    const args = ['-i', input]
    // trunc(x/2)*2 keeps the height even, which H.264 requires for 4:2:0 chroma.
    if (resolution !== 'source')
      args.push('-vf', `scale=-2:trunc(min(ih\\,${resolution})/2)*2`)
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      speed,
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
    )
    if (audio === 'none') args.push('-an')
    else if (audio === 'copy') args.push('-c:a', 'copy')
    else args.push('-c:a', 'aac', '-b:a', `${audio}k`)
    args.push('output.mp4')

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output: 'output.mp4',
      mime: 'video/mp4',
      filename: outputName,
      durationSec: duration,
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
          title="Drop a video to compress"
          hint="The video is re-encoded with H.264."
        />
        <EngineNotice />
      </div>
    )
  }

  const savings =
    estimatedBytes > 0 && file.size > 0
      ? Math.round((1 - estimatedBytes / file.size) * 100)
      : null

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={info?.duration}
        width={info?.width}
        height={info?.height}
        onClear={() => {
          job.reset()
          source.clear()
        }}
      />

      {info?.playable ? <MediaPreview source={file} kind="video" /> : null}

      <ToolPanel
        title="Compression settings"
        description="CRF is a constant-quality target: every frame gets exactly as many bits as it needs."
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <Shrink className="size-4" aria-hidden="true" />
            {job.busy ? 'Compressing…' : 'Compress video'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Quality target"
            value={preset}
            onChange={(value) => setPreset(value as Preset)}
            options={PRESETS}
            hint={`Encoding at CRF ${crf}.`}
          />
          <SelectField
            label="Resolution"
            value={resolution}
            onChange={setResolution}
            options={RESOLUTIONS}
            hint={
              resolution === 'source'
                ? 'Halving the resolution saves far more than any CRF change.'
                : `Output ≈ ${outWidth}×${outHeight}`
            }
          />
        </div>

        {preset === 'custom' ? (
          <NumberField
            label="Custom CRF (0 = lossless, 51 = worst)"
            value={customCrf}
            min={16}
            max={40}
            onChange={setCustomCrf}
            hint="18 is visually lossless, 23 is the x264 default, above 30 gets blocky."
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat label="Current size" value={formatBytes(file.size)} />
          <ResultStat
            label="Estimated output"
            value={estimatedBytes > 0 ? `≈ ${formatBytes(estimatedBytes)}` : '–'}
            hint="Estimate only. The real size depends on how much motion the video has."
            emphasis
          />
          <ResultStat
            label="Estimated saving"
            value={savings !== null ? `${savings > 0 ? savings : 0}%` : '–'}
          />
        </div>

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Encoder speed preset"
              value={speed}
              onChange={setSpeed}
              options={SPEEDS.map((value) => ({ value, label: value }))}
              hint="Slower = smaller file at the same quality, but browser encoding is already CPU-bound."
            />
            <SelectField label="Audio" value={audio} onChange={setAudio} options={AUDIO_OPTIONS} />
          </div>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Compressing" />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          downloadLabel="Download compressed video"
          resetLabel="Compress another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat label="Encoder" value={`H.264 · CRF ${crf} · ${speed}`} />
              <ResultStat
                label="Actual saving"
                value={`${Math.max(0, Math.round((1 - job.result.blob.size / file.size) * 100))}%`}
                hint={`${formatBytes(file.size)} → ${formatBytes(job.result.blob.size)}`}
              />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
