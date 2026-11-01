import { useMemo, useState } from 'react'
import { AudioLines } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { formatBytes, stripExtension } from '@/lib/utils'

import { estimateSize, formatTimecode, inputName } from './_ffmpeg'
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

const ACCEPT =
  '.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.wma,.aiff,.aif,.mp4,.mov,.mkv,.webm,audio/*'

type Format = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac'

const FORMATS: { value: Format; label: string }[] = [
  { value: 'mp3', label: 'MP3: plays on almost every device' },
  { value: 'm4a', label: 'M4A (AAC): better than MP3 at the same bitrate' },
  { value: 'ogg', label: 'OGG (Vorbis): open format, good quality' },
  { value: 'wav', label: 'WAV: uncompressed PCM, lossless and large' },
  { value: 'flac', label: 'FLAC: lossless, about half the size of WAV' },
]

const LOSSY = new Set<Format>(['mp3', 'm4a', 'ogg'])

const BITRATES = [
  { value: '320', label: '320 kbps (maximum)' },
  { value: '256', label: '256 kbps (very good)' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '128', label: '128 kbps (compact)' },
  { value: '96', label: '96 kbps (speech)' },
  { value: '64', label: '64 kbps (voice memo)' },
]

const SAMPLE_RATES = [
  { value: 'source', label: 'Keep the source sample rate' },
  { value: '48000', label: '48 000 Hz (video, broadcast)' },
  { value: '44100', label: '44 100 Hz (CD)' },
  { value: '32000', label: '32 000 Hz' },
  { value: '22050', label: '22 050 Hz (voice)' },
  { value: '16000', label: '16 000 Hz (telephony)' },
]

const CHANNELS = [
  { value: 'source', label: 'Keep source channels' },
  { value: '2', label: 'Stereo' },
  { value: '1', label: 'Mono' },
]

const BIT_DEPTHS = [
  { value: 'pcm_s16le', label: '16-bit PCM (CD standard)' },
  { value: 'pcm_s24le', label: '24-bit PCM (studio)' },
  { value: 'pcm_f32le', label: '32-bit float (editing masters)' },
]

const FLAC_LEVELS = [
  { value: '0', label: '0 (fastest, largest)' },
  { value: '5', label: '5 (default balance)' },
  { value: '8', label: '8 (slowest, smallest)' },
]

const MIME: Record<Format, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
}

export default function AudioConverter() {
  const source = useSourceFile('audio')
  const job = useMediaJob()

  const [format, setFormat] = useState<Format>('mp3')
  const [bitrate, setBitrate] = useState('192')
  const [sampleRate, setSampleRate] = useState('source')
  const [channels, setChannels] = useState('source')
  const [bitDepth, setBitDepth] = useState('pcm_s16le')
  const [flacLevel, setFlacLevel] = useState('5')
  const [normalise, setNormalise] = useState(false)

  const file = source.file
  const duration = source.info?.duration ?? 0

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}.${format}` : `audio.${format}`),
    [file, format],
  )

  const estimate = useMemo(() => {
    if (duration <= 0) return 0
    const rate = Number(sampleRate === 'source' ? 44100 : sampleRate)
    const chans = channels === 'source' ? 2 : Number(channels)
    if (format === 'wav') {
      const bytesPerSample = bitDepth === 'pcm_s16le' ? 2 : bitDepth === 'pcm_s24le' ? 3 : 4
      return rate * chans * bytesPerSample * duration
    }
    if (format === 'flac') return rate * chans * 2 * duration * 0.6
    return estimateSize(Number(bitrate), duration)
  }, [bitDepth, bitrate, channels, duration, format, sampleRate])

  const startJob = () => {
    if (!file) return
    const input = inputName(file)
    const output = `output.${format}`
    const args = ['-i', input, '-vn', '-map', 'a:0']

    if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-id3v2_version', '3')
    else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', `${bitrate}k`)
    else if (format === 'ogg') args.push('-c:a', 'libvorbis', '-b:a', `${bitrate}k`)
    else if (format === 'wav') args.push('-c:a', bitDepth)
    else args.push('-c:a', 'flac', '-compression_level', flacLevel)

    if (sampleRate !== 'source') args.push('-ar', sampleRate)
    if (channels !== 'source') args.push('-ac', channels)
    if (normalise) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11')
    args.push(output)

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output,
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
          title="Drop an audio file"
          hint="MP3, WAV, OGG, M4A, FLAC, AAC or Opus, or a video to take the audio from"
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
        onClear={() => {
          job.reset()
          source.clear()
        }}
      />

      {source.info?.playable ? <MediaPreview source={file} kind="audio" /> : null}

      <ToolPanel
        title="Conversion settings"
        description="Converting between two lossy formats always loses a little quality. Convert to FLAC or WAV if you plan to keep editing."
        footer={
          <Button type="button" onClick={startJob} disabled={job.busy} className="w-full sm:w-auto">
            <AudioLines className="size-4" aria-hidden="true" />
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
          {LOSSY.has(format) ? (
            <SelectField label="Bitrate" value={bitrate} onChange={setBitrate} options={BITRATES} />
          ) : format === 'wav' ? (
            <SelectField
              label="Bit depth"
              value={bitDepth}
              onChange={setBitDepth}
              options={BIT_DEPTHS}
            />
          ) : (
            <SelectField
              label="FLAC compression level"
              value={flacLevel}
              onChange={setFlacLevel}
              options={FLAC_LEVELS}
              hint="Every level is lossless. A higher level uses more CPU time to save space."
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ResultStat
            label="Estimated output size"
            value={estimate > 0 ? `≈ ${formatBytes(estimate)}` : '–'}
            hint={duration > 0 ? `${formatTimecode(duration)} of audio` : undefined}
          />
          <ResultStat label="Current size" value={formatBytes(file.size)} />
        </div>

        <AdvancedOptions>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sample rate"
              value={sampleRate}
              onChange={setSampleRate}
              options={SAMPLE_RATES}
            />
            <SelectField
              label="Channels"
              value={channels}
              onChange={setChannels}
              options={CHANNELS}
            />
          </div>
          <SwitchField
            label="Normalise loudness to −16 LUFS"
            checked={normalise}
            onChange={setNormalise}
            hint="Applies the EBU R128 loudnorm filter. Use it for podcasts and voice recordings. Leave it off for music that is already mastered."
          />
        </AdvancedOptions>
      </ToolPanel>

      <JobStatus job={job} label="Converting audio" />
      <JobError job={job} onRetry={startJob} />

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="audio"
          downloadLabel={`Download ${format.toUpperCase()}`}
          resetLabel="Convert another file"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Codec"
                value={
                  format === 'mp3'
                    ? `MP3 · ${bitrate} kbps`
                    : format === 'm4a'
                      ? `AAC · ${bitrate} kbps`
                      : format === 'ogg'
                        ? `Vorbis · ${bitrate} kbps`
                        : format === 'wav'
                          ? bitDepth.replace('pcm_', '').toUpperCase()
                          : `FLAC · level ${flacLevel}`
                }
              />
              <ResultStat
                label="Loudness"
                value={normalise ? 'Normalised to −16 LUFS' : 'Unchanged'}
              />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
