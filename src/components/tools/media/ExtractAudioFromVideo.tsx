import { useMemo, useState } from 'react'
import { FileAudio } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { stripExtension } from '@/lib/utils'

import { inputName, probeWithEngine } from './_ffmpeg'
import type { JobSpec } from './_shared'
import {
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

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

/** Which container each source codec can be copied into, untouched. */
const COPY_TARGET: Record<string, { ext: string; mime: string; label: string }> = {
  aac: { ext: 'm4a', mime: 'audio/mp4', label: 'AAC' },
  alac: { ext: 'm4a', mime: 'audio/mp4', label: 'ALAC (lossless)' },
  mp3: { ext: 'mp3', mime: 'audio/mpeg', label: 'MP3' },
  opus: { ext: 'ogg', mime: 'audio/ogg', label: 'Opus' },
  vorbis: { ext: 'ogg', mime: 'audio/ogg', label: 'Vorbis' },
  flac: { ext: 'flac', mime: 'audio/flac', label: 'FLAC (lossless)' },
  ac3: { ext: 'ac3', mime: 'audio/ac3', label: 'Dolby AC-3' },
  eac3: { ext: 'eac3', mime: 'audio/eac3', label: 'Dolby Digital Plus' },
}

const TRANSCODE_FORMATS = [
  { value: 'mp3', label: 'MP3 (plays everywhere)' },
  { value: 'm4a', label: 'M4A (AAC, smaller files)' },
  { value: 'wav', label: 'WAV (uncompressed)' },
  { value: 'flac', label: 'FLAC (lossless, compressed)' },
]

const TRANSCODE_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
}

const BITRATES = [
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '128', label: '128 kbps' },
  { value: '96', label: '96 kbps (speech)' },
]

export default function ExtractAudioFromVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()

  const [mode, setMode] = useState('copy')
  const [format, setFormat] = useState('mp3')
  const [bitrate, setBitrate] = useState('192')
  const [note, setNote] = useState<string | null>(null)
  const [detected, setDetected] = useState<string | null>(null)

  const file = source.file
  const duration = source.info?.duration ?? 0

  const baseName = useMemo(() => (file ? stripExtension(file.name) : 'audio'), [file])

  const buildTranscodeSpec = (target: File): JobSpec => {
    const input = inputName(target)
    const args = ['-i', input, '-vn', '-map', 'a:0']
    if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-id3v2_version', '3')
    else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', `${bitrate}k`)
    else if (format === 'wav') args.push('-c:a', 'pcm_s16le')
    else args.push('-c:a', 'flac')
    args.push(`output.${format}`)

    return {
      inputs: [{ name: input, data: target }],
      commands: [args],
      output: `output.${format}`,
      mime: TRANSCODE_MIME[format] ?? 'audio/mpeg',
      filename: `${stripExtension(target.name)}.${format}`,
      durationSec: duration,
      inputBytes: target.size,
    }
  }

  const startJob = () => {
    if (!file) return
    setNote(null)
    setDetected(null)

    if (mode === 'transcode') {
      job.run(buildTranscodeSpec(file))
      return
    }

    job.run(async () => {
      const probe = await probeWithEngine(file)
      setDetected(probe.audioCodec)

      if (!probe.audioCodec) {
        throw new Error(
          'FFmpeg could not find an audio track in this file. If you are sure it has sound, switch to “Convert the audio” mode and try again.',
        )
      }

      const target = COPY_TARGET[probe.audioCodec]
      if (!target) {
        setNote(
          `The soundtrack is encoded with ${probe.audioCodec.toUpperCase()}, which has no standard standalone container. It was converted to ${format.toUpperCase()} instead.`,
        )
        return buildTranscodeSpec(file)
      }

      setNote(
        `Copied the original ${target.label} track without re-encoding. The samples are bit-for-bit identical to the ones in the video.`,
      )

      const input = inputName(file)
      const output = `output.${target.ext}`
      return {
        inputs: [{ name: input, data: file }],
        commands: [['-i', input, '-vn', '-map', 'a:0', '-c:a', 'copy', output]],
        output,
        mime: target.mime,
        filename: `${stripExtension(file.name)}.${target.ext}`,
        durationSec: duration,
        inputBytes: file.size,
      }
    })
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          onFiles={source.select}
          maxSizeMb={1024}
          title="Drop a video to extract its soundtrack"
          hint="MP4, MOV, MKV, WebM or AVI. The audio can be copied out without re-encoding."
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
        title="Extraction settings"
        description="Keeping the original codec is fast and lossless. Nothing is decoded or re-encoded."
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <FileAudio className="size-4" aria-hidden="true" />
            {job.busy ? 'Extracting…' : 'Extract audio'}
          </Button>
        }
      >
        <SelectField
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'copy', label: 'Keep the original codec (lossless, fastest)' },
            { value: 'transcode', label: 'Convert the audio to another format' },
          ]}
          hint={
            mode === 'copy'
              ? `${baseName} will keep the codec the video uses: usually AAC in an .m4a file, or Opus or Vorbis in .ogg.`
              : 'The soundtrack is decoded and re-encoded, so a little quality is lost with lossy targets.'
          }
        />

        {mode === 'transcode' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Output format"
              value={format}
              onChange={setFormat}
              options={TRANSCODE_FORMATS}
            />
            {format === 'mp3' || format === 'm4a' ? (
              <SelectField label="Bitrate" value={bitrate} onChange={setBitrate} options={BITRATES} />
            ) : null}
          </div>
        ) : null}
      </ToolPanel>

      <JobStatus job={job} label={mode === 'copy' ? 'Copying the audio track' : 'Converting audio'} />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="audio"
          downloadLabel="Download audio"
          resetLabel="Extract from another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Source codec"
                value={detected ? detected.toUpperCase() : 'Detected by FFmpeg'}
              />
              <ResultStat
                label="Method"
                value={mode === 'copy' && detected && COPY_TARGET[detected] ? 'Stream copy' : 'Re-encoded'}
              />
            </div>
          }
          note={
            note ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {note}
              </p>
            ) : null
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
