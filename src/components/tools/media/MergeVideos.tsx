import { useMemo, useState } from 'react'
import { Combine, Zap } from 'lucide-react'

import { FileChips } from '@/components/shared/FileChips'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'

import { formatTimecode, probeWithEngine } from './_ffmpeg'
import type { EngineProbe, JobInput } from './_ffmpeg'
import {
  AdvancedOptions,
  EngineNotice,
  JobError,
  JobStatus,
  ResultPanel,
  SelectField,
  useMediaJob,
} from './_shared'
import {
  QUALITY_OPTIONS,
  VIDEO_ACCEPT,
  X264_SPEED_OPTIONS,
  codecLabel,
  crfFor,
  evenClamp,
} from './video-shared'
import type { QualityKey } from './video-shared'

interface ClipInfo extends EngineProbe {
  name: string
}

const MP4_CODECS = new Set(['h264', 'hevc', 'mpeg4', 'av1'])
const WEBM_CODECS = new Set(['vp8', 'vp9'])

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf('.')
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return ext || 'bin'
}

export default function MergeVideos() {
  const job = useMediaJob()

  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<'auto' | 'reencode'>('auto')
  const [quality, setQuality] = useState<QualityKey>('balanced')
  const [preset, setPreset] = useState('veryfast')
  const [clips, setClips] = useState<ClipInfo[] | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [pathNote, setPathNote] = useState<{ headline: string; detail: string; lossless: boolean } | null>(
    null,
  )

  const addFiles = (incoming: File[]) => {
    setClips(null)
    setPathNote(null)
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`))
      return [...current, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))]
    })
  }

  const removeFile = (index: number) => {
    setClips(null)
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  const reorder = (from: number, to: number) => {
    setClips(null)
    setFiles((current) => {
      const next = [...current]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    })
  }

  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])

  const reset = () => {
    job.reset()
    setFiles([])
    setClips(null)
    setPathNote(null)
    setStage(null)
  }

  const start = () => {
    if (files.length < 2) return
    setPathNote(null)
    setStage(null)

    void job.run(async () => {
      // 1. Ask FFmpeg what is in each clip. Concatenating streams that do not
      //    match is the single most common cause of a broken merged file.
      const infos: ClipInfo[] = []
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]
        setStage(`Inspecting clip ${i + 1} of ${files.length}: ${file.name}`)
        const probe = await probeWithEngine(file)
        infos.push({ ...probe, name: file.name })
      }
      setClips(infos)
      setStage(null)

      const withoutVideo = infos.findIndex((info) => info.videoCodec === null)
      if (withoutVideo >= 0)
        throw new Error(
          `“${infos[withoutVideo].name}” has no video stream, so it cannot be joined to the other clips here. ` +
            'Use the audio joiner for sound-only files.',
        )

      const first = infos[0]
      const identical = infos.every(
        (info) =>
          info.videoCodec === first.videoCodec &&
          info.audioCodec === first.audioCodec &&
          info.width === first.width &&
          info.height === first.height &&
          info.width > 0,
      )

      const copyContainer = MP4_CODECS.has(first.videoCodec ?? '')
        ? 'mp4'
        : WEBM_CODECS.has(first.videoCodec ?? '')
          ? 'webm'
          : null

      const totalDuration = infos.reduce((sum, info) => sum + info.duration, 0)
      const inputs: JobInput[] = files.map((file, i) => ({
        name: `clip${i}.${extensionOf(file)}`,
        data: file,
      }))

      /* ---------- Fast path: concat demuxer, streams copied ---------- */
      if (mode === 'auto' && identical && copyContainer) {
        const list = inputs.map((input) => `file '${input.name}'`).join('\n') + '\n'
        setPathNote({
          headline: 'Lossless concatenation: the streams were copied',
          detail:
            `All ${infos.length} clips are ${codecLabel(first.videoCodec)} at ${first.width}×${first.height}` +
            `${first.audioCodec ? ` with ${codecLabel(first.audioCodec)} audio` : ' with no audio'}, so FFmpeg joined ` +
            'them with the concat demuxer and copied every packet across untouched. No frame was re-compressed and ' +
            'nothing was rescaled.',
          lossless: true,
        })
        return {
          inputs: [...inputs, { name: 'list.txt', data: new TextEncoder().encode(list) }],
          commands: [
            [
              '-f',
              'concat',
              '-safe',
              '0',
              '-i',
              'list.txt',
              '-c',
              'copy',
              ...(copyContainer === 'mp4' ? ['-movflags', '+faststart'] : []),
              `output.${copyContainer}`,
            ],
          ],
          output: `output.${copyContainer}`,
          mime: copyContainer === 'mp4' ? 'video/mp4' : 'video/webm',
          filename: `merged.${copyContainer}`,
          durationSec: totalDuration,
          inputBytes: totalBytes,
          temps: ['list.txt'],
        }
      }

      /* ---------- Normalising path: scale, pad, re-encode, concat ---------- */
      const width = evenClamp(Math.max(...infos.map((info) => info.width || 1280)))
      const height = evenClamp(Math.max(...infos.map((info) => info.height || 720)))
      const anyAudio = infos.some((info) => info.audioCodec !== null)
      const allDurationsKnown = infos.every((info) => info.duration > 0)
      const useAudio = anyAudio && (infos.every((info) => info.audioCodec !== null) || allDurationsKnown)

      const args: string[] = []
      for (const input of inputs) args.push('-i', input.name)

      // One silent generator per soundless clip: a filter output pad can only be
      // consumed once, so reusing a single anullsrc input would fail.
      const silenceIndex = new Map<number, number>()
      if (useAudio) {
        let next = inputs.length
        infos.forEach((info, i) => {
          if (info.audioCodec === null) {
            args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
            silenceIndex.set(i, next)
            next += 1
          }
        })
      }

      const parts: string[] = []
      const labels: string[] = []
      infos.forEach((info, i) => {
        parts.push(
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`,
        )
        labels.push(`[v${i}]`)
        if (!useAudio) return
        if (info.audioCodec !== null) {
          parts.push(
            `[${i}:a]aresample=async=1,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`,
          )
        } else {
          const source = silenceIndex.get(i)
          parts.push(
            `[${source}:a]atrim=0:${info.duration.toFixed(3)},asetpts=PTS-STARTPTS,` +
              `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`,
          )
        }
        labels.push(`[a${i}]`)
      })

      parts.push(
        `${labels.join('')}concat=n=${infos.length}:v=1:a=${useAudio ? 1 : 0}[outv]${
          useAudio ? '[outa]' : ''
        }`,
      )

      const command = [
        ...args,
        '-filter_complex',
        parts.join(';'),
        '-map',
        '[outv]',
        ...(useAudio ? ['-map', '[outa]', '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
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
      ]

      const reasons: string[] = []
      if (mode === 'reencode') reasons.push('you asked for a full re-encode')
      else {
        if (new Set(infos.map((info) => info.videoCodec)).size > 1)
          reasons.push('the clips use different video codecs')
        if (new Set(infos.map((info) => `${info.width}x${info.height}`)).size > 1)
          reasons.push('the clips are different resolutions')
        if (new Set(infos.map((info) => info.audioCodec)).size > 1)
          reasons.push('the audio tracks do not match')
        if (!copyContainer && reasons.length === 0)
          reasons.push('that video codec cannot be stored in an MP4 or WebM by stream copy')
        if (reasons.length === 0) reasons.push('the streams were not compatible enough to copy')
      }

      setPathNote({
        headline: `Normalised and re-encoded to ${width}×${height}`,
        detail:
          `Joined by re-encoding because ${reasons.join(', and ')}. Every clip was scaled to fit ` +
          `${width}×${height} with black padding to preserve its shape, set to 30 fps and encoded as H.264` +
          `${useAudio ? ' with a single AAC soundtrack' : ' with no audio'}. This is the slow path, but it is the ` +
          'only way to produce one file that plays end to end.',
        lossless: false,
      })

      return {
        inputs,
        commands: [command],
        output: 'output.mp4',
        mime: 'video/mp4',
        filename: 'merged.mp4',
        durationSec: totalDuration,
        inputBytes: totalBytes,
      }
    })
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={VIDEO_ACCEPT}
        multiple
        onFiles={addFiles}
        maxSizeMb={4096}
        title={files.length ? 'Add more clips' : 'Drop two or more videos here'}
        hint="They are joined in the order shown below. Drag to change the order."
      />

      {files.length > 0 ? (
        <ToolPanel
          title={`${files.length} clip${files.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)}`}
          description="Drag a row, or use the arrow buttons, to change the running order."
          footer={
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button type="button" onClick={start} disabled={job.busy || files.length < 2}>
                <Combine className="size-4" aria-hidden="true" />
                {job.busy ? 'Merging…' : `Merge ${files.length} clips`}
              </Button>
              {!job.busy ? (
                <Button type="button" variant="ghost" onClick={reset}>
                  Start over
                </Button>
              ) : null}
            </div>
          }
        >
          <FileChips files={files} onRemove={removeFile} onReorder={reorder} />

          {files.length < 2 ? (
            <p className="text-sm text-muted-foreground">Add at least one more clip to merge.</p>
          ) : null}

          <SelectField
            label="Method"
            value={mode}
            onChange={(value) => setMode(value as 'auto' | 'reencode')}
            options={[
              { value: 'auto', label: 'Auto: copy the streams when the clips match (recommended)' },
              { value: 'reencode', label: 'Always re-encode to a single H.264 MP4' },
            ]}
            hint="Auto inspects every clip first and only re-encodes when the codecs, resolutions or audio tracks differ."
            disabled={job.busy}
          />

          <AdvancedOptions>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Quality on the re-encode path"
                value={quality}
                onChange={(value) => setQuality(value as QualityKey)}
                options={QUALITY_OPTIONS}
                hint={`CRF ${crfFor('mp4', quality)}.`}
              />
              <SelectField
                label="Encoder speed preset"
                value={preset}
                onChange={setPreset}
                options={X264_SPEED_OPTIONS}
              />
            </div>
          </AdvancedOptions>

          {clips ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">#</th>
                    <th className="py-1 pr-3 font-medium">Clip</th>
                    <th className="py-1 pr-3 font-medium">Video</th>
                    <th className="py-1 pr-3 font-medium">Size</th>
                    <th className="py-1 pr-3 font-medium">Audio</th>
                    <th className="py-1 font-medium">Length</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {clips.map((clip, i) => (
                    <tr key={`${clip.name}-${i}`} className="border-t border-border">
                      <td className="py-1 pr-3 tabular-nums">{i + 1}</td>
                      <td className="max-w-[12rem] truncate py-1 pr-3">{clip.name}</td>
                      <td className="py-1 pr-3">{codecLabel(clip.videoCodec)}</td>
                      <td className="py-1 pr-3 tabular-nums">
                        {clip.width > 0 ? `${clip.width}×${clip.height}` : '–'}
                      </td>
                      <td className="py-1 pr-3">{codecLabel(clip.audioCodec)}</td>
                      <td className="py-1 tabular-nums">
                        {clip.duration > 0 ? formatTimecode(clip.duration) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {stage ? (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {stage}
            </p>
          ) : null}
        </ToolPanel>
      ) : null}

      <JobStatus job={job} label={pathNote?.lossless ? 'Joining (copying streams)' : 'Merging'} />
      <JobError job={job} onRetry={start} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          onReset={reset}
          downloadLabel="Download the merged video"
          resetLabel="Merge another set"
          note={
            pathNote ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {pathNote.lossless ? (
                  <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
                <span>
                  <span className="font-medium text-foreground">{pathNote.headline}.</span>{' '}
                  {pathNote.detail}
                </span>
              </p>
            ) : null
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
