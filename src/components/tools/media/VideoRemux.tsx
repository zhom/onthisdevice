import { useMemo, useState } from 'react'
import { Wand2, Zap, Search, TriangleAlert } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension, formatBytes } from '@/lib/utils'

import { inputName, probeWithEngine } from './_ffmpeg'
import type { EngineProbe } from './_ffmpeg'
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
import {
  CONTAINER_LABEL,
  CONTAINER_MIME,
  QUALITY_OPTIONS,
  VIDEO_ACCEPT,
  X264_SPEED_OPTIONS,
  codecLabel,
  crfFor,
  estimateSeconds,
  humanizeSeconds,
  planConversion,
} from './video-shared'
import type { ContainerTarget, ConversionPlan, QualityKey } from './video-shared'

export interface VideoRemuxProps {
  /** The extension the page is about, e.g. `mov` on /mov-to-mp4. */
  from: string
  target: ContainerTarget
  /** Extra hint under the dropzone, written per page. */
  hint?: string
}

const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto: copy the streams when possible (recommended)' },
  { value: 'encode', label: 'Always re-encode (H.264/VP8)' },
]

function acceptFor(from: string): string {
  return `.${from},${VIDEO_ACCEPT}`
}

export default function VideoRemux({ from, target, hint }: VideoRemuxProps) {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [mode, setMode] = useState<'auto' | 'encode'>('auto')
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [preset, setPreset] = useState('veryfast')
  const [probe, setProbe] = useState<EngineProbe | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ConversionPlan | null>(null)

  const file = source.file
  const label = CONTAINER_LABEL[target]
  const duration = probe?.duration || source.info?.duration || 0

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.${target}` : `converted.${target}`),
    [file, target],
  )

  const predicted = useMemo(() => {
    if (!probe) return null
    return planConversion({
      probe,
      target,
      input: 'input',
      output: `output.${target}`,
      forceEncode: mode === 'encode',
      crf: crfFor(target, quality),
      preset,
    })
  }, [mode, preset, probe, quality, target])

  const reset = () => {
    job.reset()
    source.clear()
    setProbe(null)
    setPlan(null)
    setInspectError(null)
  }

  const inspect = async () => {
    if (!file) return
    setInspecting(true)
    setInspectError(null)
    try {
      const result = await probeWithEngine(file)
      setProbe(result)
      if (!result.videoCodec && !result.audioCodec)
        setInspectError(
          'FFmpeg could not identify any audio or video stream in this file. It may be corrupt, or not a media file at all.',
        )
    } catch (error) {
      setInspectError(
        error instanceof Error
          ? error.message
          : 'Reading the file failed. Reload the page and try again.',
      )
    } finally {
      setInspecting(false)
    }
  }

  const start = () => {
    if (!file) return
    const name = inputName(file)
    const output = `output.${target}`
    setPlan(null)

    void job.run(async () => {
      const info = probe ?? (await probeWithEngine(file))
      setProbe(info)

      if (!info.videoCodec && !info.audioCodec)
        throw new Error(
          'FFmpeg found no audio or video stream in this file, so there is nothing to convert. ' +
            'The file is most likely corrupt or incomplete.',
        )

      const next = planConversion({
        probe: info,
        target,
        input: name,
        output,
        forceEncode: mode === 'encode',
        crf: crfFor(target, quality),
        preset,
      })
      setPlan(next)

      return {
        inputs: [{ name, data: file }],
        commands: [next.args],
        output,
        mime: CONTAINER_MIME[target],
        filename: outputName,
        durationSec: info.duration || source.info?.duration || 0,
        inputBytes: file.size,
      }
    })
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={acceptFor(from)}
          onFiles={source.select}
          maxSizeMb={4096}
          title={`Drop a .${from} file here`}
          hint={hint ?? 'or click to browse'}
        />
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={source.info?.duration || probe?.duration}
        width={source.info?.width || probe?.width}
        height={source.info?.height || probe?.height}
        onClear={reset}
      />

      {source.info?.playable ? <MediaPreview source={file} kind="video" /> : null}

      <ToolPanel
        title={`Convert to ${label}`}
        description={
          mode === 'auto'
            ? 'Auto mode inspects the streams first and copies them across untouched whenever the target container can hold them.'
            : 'Every frame will be decoded and re-compressed, even if a straight copy was possible.'
        }
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button type="button" onClick={start} disabled={job.busy || inspecting}>
              <Wand2 className="size-4" aria-hidden="true" />
              {job.busy ? 'Converting…' : `Convert to ${label}`}
            </Button>
            {!probe ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void inspect()}
                disabled={job.busy || inspecting}
              >
                <Search className="size-4" aria-hidden="true" />
                {inspecting ? 'Reading the streams…' : 'Check what is inside first'}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Conversion method"
            value={mode}
            onChange={(value) => setMode(value as 'auto' | 'encode')}
            options={MODE_OPTIONS}
            hint={
              mode === 'auto'
                ? 'A copy is instant and lossless. Re-encoding only happens when it has to.'
                : 'Use this if a player still refuses the copied file.'
            }
          />
          <SelectField
            label="Quality if it has to re-encode"
            value={quality}
            onChange={(value) => setQuality(value as QualityKey)}
            options={QUALITY_OPTIONS}
            hint={`CRF ${crfFor(target, quality)}. Lower means better quality and a bigger file.`}
          />
        </div>

        {target !== 'webm' ? (
          <AdvancedOptions>
            <SelectField
              label="Encoder speed preset"
              value={preset}
              onChange={setPreset}
              options={X264_SPEED_OPTIONS}
              hint="Only used on the re-encode path. Slower presets give a smaller file at the same quality."
            />
          </AdvancedOptions>
        ) : (
          <p className="text-sm text-muted-foreground">
            WebM output is re-encoded to VP8, which runs at roughly real time for 720p here. Long
            clips take about as long as they play.
          </p>
        )}

        {inspectError ? (
          <p role="status" className="text-sm text-destructive">
            {inspectError}
          </p>
        ) : null}

        {inspecting ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Asking FFmpeg what is inside the file…
          </p>
        ) : null}

        {probe && predicted ? (
          <div className="space-y-3 rounded-lg bg-muted p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {predicted.lossless ? (
                <Zap className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : null}
              {predicted.headline}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Stream</th>
                    <th className="py-1 pr-3 font-medium">Found</th>
                    <th className="py-1 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  <tr>
                    <td className="py-1 pr-3">Video</td>
                    <td className="py-1 pr-3">
                      {codecLabel(probe.videoCodec)}
                      {probe.width > 0 ? ` · ${probe.width}×${probe.height}` : ''}
                    </td>
                    <td className="py-1">
                      {predicted.video === 'copy'
                        ? 'Copied, no quality loss'
                        : predicted.video === 'encode'
                          ? 'Re-encoded'
                          : 'No video stream'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-3">Audio</td>
                    <td className="py-1 pr-3">
                      {codecLabel(probe.audioCodec)}
                      {probe.audioSampleRate ? ` · ${probe.audioSampleRate} Hz` : ''}
                      {probe.audioChannels ? ` · ${probe.audioChannels}` : ''}
                    </td>
                    <td className="py-1">
                      {predicted.audio === 'copy'
                        ? 'Copied, no quality loss'
                        : predicted.audio === 'encode'
                          ? 'Re-encoded'
                          : 'No audio stream'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">{predicted.detail}</p>
            {duration > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · roughly{' '}
                {humanizeSeconds(estimateSeconds(duration, predicted.lossless))} on a typical laptop.
              </p>
            ) : null}
          </div>
        ) : null}

        {file.size > 700 * 1024 * 1024 ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              This file is {formatBytes(file.size)}. The browser gives WebAssembly about 2 GB of
              working memory and both the input and the output live in it, so very large files need
              desktop Chrome or Edge with plenty of free RAM. A stream copy is far more forgiving than
              a re-encode here.
            </span>
          </p>
        ) : null}
      </ToolPanel>

      <JobStatus job={job} label={plan?.lossless ? 'Copying streams' : 'Converting'} />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel={`Download ${label}`}
          resetLabel="Convert another file"
          note={
            plan ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{plan.headline}.</span> {plan.detail}
              </p>
            ) : null
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
