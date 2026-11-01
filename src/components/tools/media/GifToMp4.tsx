import { useEffect, useMemo, useState } from 'react'
import { Film } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ResultStat } from '@/components/shared/ResultStat'
import { Button } from '@/components/ui/button'
import { formatBytes, stripExtension } from '@/lib/utils'

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
import { crfFor } from './video-shared'
import type { QualityKey } from './video-shared'

const FPS_OPTIONS = [
  { value: 'source', label: 'Keep the GIF’s own timing (recommended)' },
  { value: '30', label: '30 fps (smoothest, largest)' },
  { value: '24', label: '24 fps' },
  { value: '15', label: '15 fps (smaller file)' },
  { value: '12', label: '12 fps (classic GIF look)' },
]

const WIDTH_OPTIONS = [
  { value: 'source', label: 'Keep the original width' },
  { value: '1280', label: 'Max 1280 px wide' },
  { value: '720', label: 'Max 720 px wide' },
  { value: '480', label: 'Max 480 px wide' },
]

const QUALITY: { value: QualityKey; label: string }[] = [
  { value: 'high', label: 'High quality: sharp edges and text' },
  { value: 'balanced', label: 'Balanced (recommended)' },
  { value: 'small', label: 'Smallest file' },
]

export default function GifToMp4() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [url, setUrl] = useState('')
  const [silentTrack, setSilentTrack] = useState(true)
  const [fps, setFps] = useState('source')
  const [width, setWidth] = useState('source')
  const [loops, setLoops] = useState('1')
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [gifDuration, setGifDuration] = useState(0)

  const file = source.file

  useEffect(() => {
    if (!file) {
      setUrl('')
      setGifDuration(0)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.mp4` : 'animation.mp4'),
    [file],
  )

  const filters = useMemo(() => {
    const chain: string[] = []
    if (fps !== 'source') chain.push(`fps=${fps}`)
    chain.push(
      width === 'source'
        ? 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
        : // The backslash escapes the comma inside min(): arguments go straight
          // to FFmpeg with no shell, so an unescaped comma would be read as the
          // start of the next filter in the chain.
          `scale=trunc(min(${width}\\,iw)/2)*2:-2:flags=lanczos`,
    )
    return chain.join(',')
  }, [fps, width])

  const start = () => {
    if (!file) return
    const name = inputName(file)
    const repeats = Math.max(1, Number(loops) || 1)

    void job.run(async () => {
      const probe = await probeWithEngine(file)
      if (probe.duration > 0) setGifDuration(probe.duration)

      const args: string[] = []
      if (repeats > 1) args.push('-stream_loop', String(repeats - 1))
      args.push('-i', name)
      if (silentTrack) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')

      args.push(
        '-vf',
        filters,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        String(crfFor('mp4', quality)),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      )

      if (silentTrack) args.push('-c:a', 'aac', '-b:a', '32k', '-shortest')
      else args.push('-an')

      args.push('output.mp4')

      return {
        inputs: [{ name, data: file }],
        commands: [args],
        output: 'output.mp4',
        mime: 'video/mp4',
        filename: outputName,
        durationSec: probe.duration > 0 ? probe.duration * repeats : 0,
        inputBytes: file.size,
      }
    })
  }

  const reset = () => {
    job.reset()
    source.clear()
    setGifDuration(0)
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept=".gif,image/gif"
          onFiles={source.select}
          maxSizeMb={2048}
          title="Drop a GIF here"
          hint="A GIF of 200 MB or more works"
        />
        <EngineNotice />
      </div>
    )
  }

  const savings =
    job.result && file.size > 0
      ? Math.max(0, Math.round((1 - job.result.blob.size / file.size) * 100))
      : null

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={gifDuration}
        onClear={reset}
        extra="animated GIF"
      />

      {url ? (
        <img
          src={url}
          alt="The GIF you selected"
          className="mx-auto max-h-[320px] w-auto max-w-full rounded-lg border border-border"
        />
      ) : null}

      <ToolPanel
        title="Conversion settings"
        description="H.264 stores motion much more efficiently than a 256-colour GIF, so the MP4 is usually a fraction of the size."
        footer={
          <Button type="button" onClick={start} disabled={job.busy}>
            <Film className="size-4" aria-hidden="true" />
            {job.busy ? 'Converting…' : 'Convert GIF to MP4'}
          </Button>
        }
      >
        <SwitchField
          label="Add a silent audio track"
          checked={silentTrack}
          onChange={setSilentTrack}
          hint="iOS Safari and several chat apps refuse to autoplay a video with no audio stream at all. A silent AAC track costs a few kilobytes and fixes it."
          disabled={job.busy}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Frame rate"
            value={fps}
            onChange={setFps}
            options={FPS_OPTIONS}
            hint="A GIF stores a delay for each frame. Keep the source timing to keep the original pacing."
            disabled={job.busy}
          />
          <SelectField
            label="Width"
            value={width}
            onChange={setWidth}
            options={WIDTH_OPTIONS}
            hint="Only ever scaled down. Odd sizes are rounded to even numbers, which H.264 requires."
            disabled={job.busy}
          />
        </div>

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Quality"
              value={quality}
              onChange={(value) => setQuality(value as QualityKey)}
              options={QUALITY}
              hint={`CRF ${crfFor('mp4', quality)}. Flat-colour animation and screen recordings look good even at the small setting.`}
            />
            <SelectField
              label="Repeat the animation"
              value={loops}
              onChange={setLoops}
              options={[
                { value: '1', label: 'Once (the MP4 length matches the GIF)' },
                { value: '2', label: 'Twice' },
                { value: '3', label: '3 times' },
                { value: '5', label: '5 times' },
                { value: '10', label: '10 times' },
              ]}
              hint="An MP4 has no loop flag as a GIF has. Repeat the animation to get a longer loop for a platform that plays a video once."
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Filter chain:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">-vf {filters}</code>
          </p>
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Converting GIF" />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel="Download MP4"
          resetLabel="Convert another GIF"
          stats={
            savings !== null ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultStat
                  label="Size reduction"
                  value={`${savings}% smaller`}
                  hint={`${formatBytes(file.size)} GIF → ${formatBytes(job.result.blob.size)} MP4`}
                  emphasis
                />
                <ResultStat
                  label="Length"
                  value={gifDuration > 0 ? formatTimecode(gifDuration * (Number(loops) || 1)) : '–'}
                  hint={Number(loops) > 1 ? `${loops} repeats of the animation` : 'One pass of the animation'}
                />
              </div>
            ) : null
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
