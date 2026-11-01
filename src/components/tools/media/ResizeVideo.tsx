import { useEffect, useMemo, useState } from 'react'
import { Maximize2 } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension } from '@/lib/utils'

import { evenNumber, inputName } from './_ffmpeg'
import { vp8Args } from './video-shared'
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
  SwitchField,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

const PRESETS = [
  { value: '2160', label: '4K UHD (2160p)' },
  { value: '1440', label: 'QHD (1440p)' },
  { value: '1080', label: 'Full HD (1080p)' },
  { value: '720', label: 'HD (720p)' },
  { value: '480', label: 'SD (480p)' },
  { value: '360', label: 'Mobile (360p)' },
  { value: 'custom', label: 'Custom size…' },
]

const FITS = [
  { value: 'scale', label: 'Stretch to the exact size' },
  { value: 'pad', label: 'Fit inside and pad (letterbox)' },
  { value: 'crop', label: 'Fill and crop the overflow' },
]

const QUALITIES = [
  { value: '18', label: 'CRF 18 (visually lossless)' },
  { value: '21', label: 'CRF 21 (high)' },
  { value: '23', label: 'CRF 23 (recommended)' },
  { value: '26', label: 'CRF 26 (smaller file)' },
  { value: '30', label: 'CRF 30 (smallest)' },
]

export default function ResizeVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [preset, setPreset] = useState('720')
  const [customWidth, setCustomWidth] = useState<number | ''>(1280)
  const [customHeight, setCustomHeight] = useState<number | ''>(720)
  const [lockAspect, setLockAspect] = useState(true)
  const [fit, setFit] = useState('pad')
  const [padColour, setPadColour] = useState('black')
  const [format, setFormat] = useState('mp4')
  const [crf, setCrf] = useState('23')
  const [keepAudio, setKeepAudio] = useState(true)

  const file = source.file
  const info = source.info
  const duration = info?.duration ?? 0
  const srcWidth = info?.width ?? 0
  const srcHeight = info?.height ?? 0
  const knowsSize = srcWidth > 0 && srcHeight > 0
  const aspect = knowsSize ? srcWidth / srcHeight : 16 / 9

  useEffect(() => {
    if (!knowsSize) return
    setCustomWidth(evenNumber(srcWidth))
    setCustomHeight(evenNumber(srcHeight))
  }, [knowsSize, srcHeight, srcWidth])

  const target = useMemo(() => {
    if (preset === 'custom') {
      const width = typeof customWidth === 'number' && customWidth > 0 ? evenNumber(customWidth) : 0
      const height =
        typeof customHeight === 'number' && customHeight > 0 ? evenNumber(customHeight) : 0
      return { width, height }
    }
    const height = evenNumber(Number(preset))
    const width = knowsSize ? evenNumber((height * srcWidth) / srcHeight) : 0
    return { width, height }
  }, [customHeight, customWidth, knowsSize, preset, srcHeight, srcWidth])

  const exactSizeKnown = target.width > 0 && target.height > 0
  const effectiveFit = exactSizeKnown ? fit : 'scale'

  const filter = useMemo(() => {
    if (!exactSizeKnown) return `scale=-2:${target.height}`
    const { width, height } = target
    if (effectiveFit === 'pad')
      return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${padColour}`
    if (effectiveFit === 'crop')
      return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
    return `scale=${width}:${height}`
  }, [effectiveFit, exactSizeKnown, padColour, target])

  const outputName = useMemo(
    () =>
      file
        ? `${stripExtension(file.name)}-${target.height || 'resized'}p.${format}`
        : `resized.${format}`,
    [file, format, target.height],
  )

  const startJob = () => {
    if (!file) return
    const input = inputName(file)
    const output = `output.${format}`
    const args = ['-i', input, '-vf', filter]

    if (format === 'mp4') {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        crf,
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      )
      args.push(...(keepAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']))
    } else {
      // x264 CRF 18-30 maps onto VP8 CRF 4-28.
      args.push(...vp8Args(Math.max(4, (Number(crf) - 18) * 2 + 4)))
      args.push(...(keepAudio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']))
    }
    args.push(output)

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output,
      mime: format === 'mp4' ? 'video/mp4' : 'video/webm',
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
          title="Drop a video to resize"
          hint="Scale to 1080p, 720p, 480p or any custom size"
        />
        <EngineNotice />
      </div>
    )
  }

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
        title="Target size"
        description="Presets keep the original aspect ratio. Custom sizes let you letterbox or crop to fit an exact frame."
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <Maximize2 className="size-4" aria-hidden="true" />
            {job.busy ? 'Resizing…' : 'Resize video'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Resolution"
            value={preset}
            onChange={setPreset}
            options={PRESETS}
            hint={
              exactSizeKnown
                ? `Output ${target.width}×${target.height}`
                : 'Width is derived from the source once FFmpeg reads it.'
            }
          />
          <SelectField
            label="How to fit"
            value={effectiveFit}
            onChange={setFit}
            options={FITS}
            disabled={!exactSizeKnown || preset !== 'custom'}
            hint={
              preset !== 'custom'
                ? 'Presets always preserve the aspect ratio, so no padding or cropping is needed.'
                : effectiveFit === 'pad'
                  ? 'The whole frame stays visible; bars fill the rest.'
                  : effectiveFit === 'crop'
                    ? 'The frame fills the output; the edges that stick out are cut off.'
                    : 'The picture is stretched, which distorts it if the aspect ratio differs.'
            }
          />
        </div>

        {preset === 'custom' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Width"
                value={customWidth}
                min={16}
                max={7680}
                step={2}
                suffix="px"
                onChange={(value) => {
                  setCustomWidth(value)
                  if (lockAspect && typeof value === 'number' && value > 0) {
                    setCustomHeight(evenNumber(value / aspect))
                  }
                }}
              />
              <NumberField
                label="Height"
                value={customHeight}
                min={16}
                max={4320}
                step={2}
                suffix="px"
                onChange={(value) => {
                  setCustomHeight(value)
                  if (lockAspect && typeof value === 'number' && value > 0) {
                    setCustomWidth(evenNumber(value * aspect))
                  }
                }}
              />
            </div>
            <SwitchField
              label="Lock the aspect ratio"
              checked={lockAspect}
              onChange={setLockAspect}
              hint={
                knowsSize
                  ? `Source ratio ${srcWidth}:${srcHeight} (${aspect.toFixed(2)}:1)`
                  : 'Assuming 16:9 until the source size is known.'
              }
            />
            {effectiveFit === 'pad' ? (
              <SelectField
                label="Padding colour"
                value={padColour}
                onChange={setPadColour}
                options={[
                  { value: 'black', label: 'Black' },
                  { value: 'white', label: 'White' },
                  { value: 'gray', label: 'Grey' },
                ]}
              />
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Filter chain: <span className="font-mono break-all text-foreground">{filter}</span>
        </p>

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Output format"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'mp4', label: 'MP4: H.264 (fast, universal)' },
                { value: 'webm', label: 'WebM: VP8 (slower to encode)' },
              ]}
            />
            <SelectField label="Quality" value={crf} onChange={setCrf} options={QUALITIES} />
          </div>
          <SwitchField label="Keep the audio track" checked={keepAudio} onChange={setKeepAudio} />
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Resizing" />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          downloadLabel="Download resized video"
          resetLabel="Resize another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Resolution"
                value={exactSizeKnown ? `${target.width}×${target.height}` : `${target.height}p`}
                hint={knowsSize ? `from ${srcWidth}×${srcHeight}` : undefined}
              />
              <ResultStat label="Fit mode" value={effectiveFit === 'scale' ? 'Stretch' : effectiveFit === 'pad' ? 'Letterbox' : 'Crop'} />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
