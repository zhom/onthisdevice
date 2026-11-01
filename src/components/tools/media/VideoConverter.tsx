import { useMemo, useState } from 'react'
import { Wand2 } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension } from '@/lib/utils'

import { inputName } from './_ffmpeg'
import { vp8Args } from './video-shared'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  ResultPanel,
  SelectField,
  SourceSummary,
  SwitchField,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.ogv,.3gp,video/*'

type Format = 'mp4' | 'webm' | 'gif'
type Quality = 'high' | 'balanced' | 'small'
type Resolution = 'source' | '1080' | '720' | '480' | '360'

const FORMATS: { value: Format; label: string }[] = [
  { value: 'mp4', label: 'MP4: H.264 + AAC (plays everywhere)' },
  { value: 'webm', label: 'WebM: VP8 + Opus (for the web, slower to encode)' },
  { value: 'gif', label: 'Animated GIF (no audio)' },
]

const QUALITIES: { value: Quality; label: string }[] = [
  { value: 'high', label: 'High quality (larger file)' },
  { value: 'balanced', label: 'Balanced (recommended)' },
  { value: 'small', label: 'Small file (visible compression)' },
]

const RESOLUTIONS: { value: Resolution; label: string }[] = [
  { value: 'source', label: 'Keep original resolution' },
  { value: '1080', label: '1080p (max height 1080)' },
  { value: '720', label: '720p (max height 720)' },
  { value: '480', label: '480p (max height 480)' },
  { value: '360', label: '360p (max height 360)' },
]

const SPEEDS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'] as const
type Speed = (typeof SPEEDS)[number]

const CRF: Record<Format, Record<Quality, number>> = {
  mp4: { high: 18, balanced: 23, small: 28 },
  webm: { high: 6, balanced: 10, small: 20 },
  gif: { high: 0, balanced: 0, small: 0 },
}

const MIME: Record<Format, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
}

/**
 * Downscale only — never blow a 480p clip up to 1080p. The trunc(x/2)*2 keeps the
 * height even, which H.264 and VP8 both require for 4:2:0 chroma.
 */
function scaleFilter(resolution: Resolution): string | null {
  if (resolution === 'source') return null
  return `scale=-2:trunc(min(ih\\,${resolution})/2)*2`
}

export default function VideoConverter() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [format, setFormat] = useState<Format>('mp4')
  const [quality, setQuality] = useState<Quality>('balanced')
  const [resolution, setResolution] = useState<Resolution>('source')
  const [speed, setSpeed] = useState<Speed>('veryfast')
  const [keepAudio, setKeepAudio] = useState(true)
  const [gifFps, setGifFps] = useState('12')

  const file = source.file
  const duration = source.info?.duration ?? 0

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.${format}` : `converted.${format}`),
    [file, format],
  )

  const commands = useMemo(() => {
    if (!file) return [] as string[][]
    const input = inputName(file)
    const output = `output.${format}`
    const scale = scaleFilter(resolution)

    if (format === 'gif') {
      const gifScale = scale ? `${scale}:flags=lanczos` : 'scale=480:-2:flags=lanczos'
      const chain = `fps=${gifFps},${gifScale}`
      return [
        [
          '-i',
          input,
          '-vf',
          `${chain},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a`,
          '-loop',
          '0',
          output,
        ],
      ]
    }

    const args = ['-i', input]
    if (scale) args.push('-vf', scale)

    if (format === 'mp4') {
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        speed,
        '-crf',
        String(CRF.mp4[quality]),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      )
      args.push(...(keepAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']))
    } else {
      args.push(...vp8Args(CRF.webm[quality]))
      args.push(...(keepAudio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']))
    }

    args.push(output)
    return [args]
  }, [file, format, gifFps, keepAudio, quality, resolution, speed])

  const start = () => {
    if (!file) return
    job.run({
      inputs: [{ name: inputName(file), data: file }],
      commands,
      output: `output.${format}`,
      mime: MIME[format],
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
          title="Drop a video here"
          hint="MP4, WebM, MKV, MOV, AVI and more"
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

      {source.info?.playable ? <MediaPreview source={file} kind="video" /> : null}

      <ToolPanel
        title="Conversion settings"
        description="The defaults suit most videos. Change them only if you need to."
        footer={
          <Button type="button" onClick={start} disabled={job.busy} className="w-full sm:w-auto">
            <Wand2 className="size-4" aria-hidden="true" />
            {job.busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Output format"
            value={format}
            onChange={(value) => setFormat(value as Format)}
            options={FORMATS}
          />
          {format === 'gif' ? (
            <SelectField
              label="Frame rate"
              value={gifFps}
              onChange={setGifFps}
              options={[
                { value: '8', label: '8 fps (smallest)' },
                { value: '12', label: '12 fps (recommended)' },
                { value: '15', label: '15 fps' },
                { value: '24', label: '24 fps (smoothest)' },
              ]}
            />
          ) : (
            <SelectField
              label="Quality (CRF)"
              value={quality}
              onChange={(value) => setQuality(value as Quality)}
              options={QUALITIES}
              hint={`CRF ${CRF[format][quality]}. Lower means better quality and a bigger file.`}
            />
          )}
          <SelectField
            label="Resolution"
            value={resolution}
            onChange={(value) => setResolution(value as Resolution)}
            options={RESOLUTIONS}
            hint="Videos are only ever scaled down, never up."
          />
          {format !== 'gif' ? (
            <SwitchField
              label="Keep the audio track"
              checked={keepAudio}
              onChange={setKeepAudio}
              hint={format === 'mp4' ? 'Re-encoded as AAC 128 kbps.' : 'Re-encoded as Opus 96 kbps.'}
            />
          ) : null}
        </div>

        {format === 'mp4' ? (
          <AdvancedOptions>
            <SelectField
              label="Encoder speed preset"
              value={speed}
              onChange={(value) => setSpeed(value as Speed)}
              options={SPEEDS.map((value) => ({ value, label: value }))}
              hint="Slower presets squeeze out a smaller file at the same quality. In the browser, 'veryfast' is the sweet spot."
            />
          </AdvancedOptions>
        ) : null}

        {format === 'webm' ? (
          <p className="text-sm text-muted-foreground">
            WebM is encoded to VP8, which is slower than H.264 here. For a long clip, MP4 finishes
            sooner.
          </p>
        ) : null}
      </ToolPanel>

      <JobStatus job={job} label="Converting" />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind={format === 'gif' ? 'image' : 'video'}
          onReset={() => {
            job.reset()
            source.clear()
          }}
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
