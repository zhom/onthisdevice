/**
 * Island for the audio utility pages: reverse, speed, volume, loudness, fades, pitch and
 * ringtones. One file in, FFmpeg applies the filter chain from effects.ts, one file out.
 */
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { stripExtension } from '@/lib/utils'
import { inputName, probeWithEngine } from '@/components/tools/media/_ffmpeg'
import {
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
} from '@/components/tools/media/_shared'
import { effectArgs, type AudioEffect as Effect, type EffectSettings } from './effects'

const ACCEPT = '.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.aiff,.aif,.wma,.amr,.mp4,.mov,.webm,.mkv,audio/*'

const FORMATS: { value: EffectSettings['format']; label: string }[] = [
  { value: 'same', label: 'Same as the input' },
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'm4a', label: 'M4A (AAC)' },
  { value: 'ogg', label: 'OGG (Vorbis)' },
  { value: 'flac', label: 'FLAC' },
]

const ACTION: Record<Effect, string> = {
  reverse: 'Reverse the audio',
  speed: 'Change the speed',
  volume: 'Change the volume',
  normalize: 'Normalize',
  fade: 'Apply the fades',
  pitch: 'Change the pitch',
  ringtone: 'Make the ringtone',
}

export default function AudioEffect({ effect }: { effect: Effect }) {
  const source = useSourceFile('audio')
  const job = useMediaJob()
  const [s, setS] = useState<EffectSettings>({
    speed: 1.25,
    keepPitch: true,
    gainDb: 6,
    limiter: true,
    lufs: -14,
    fadeIn: effect === 'ringtone' ? 1 : 3,
    fadeOut: effect === 'ringtone' ? 2 : 3,
    semitones: 2,
    start: 0,
    length: effect === 'ringtone' ? 30 : 0,
    format: effect === 'ringtone' ? 'm4r' : 'same',
  })
  const set = <K extends keyof EffectSettings>(k: K, v: EffectSettings[K]) => setS((o) => ({ ...o, [k]: v }))
  const num = (v: number | '') => (v === '' ? 0 : v)
  const file = source.file

  const start = () => {
    if (!file) return
    const input = inputName(file)
    const ext = file.name.split('.').pop() ?? ''
    void job.run(async () => {
      const probe = await probeWithEngine(file)
      const plan = effectArgs(effect, s, { ext, duration: probe.duration || source.info?.duration || 0, sampleRate: probe.audioSampleRate ?? 44100 }, input)
      return {
        inputs: [{ name: input, data: file }],
        commands: [plan.args],
        output: plan.output,
        mime: plan.mime,
        filename: `${stripExtension(file.name)}-${effect}.${plan.ext}`,
        durationSec: plan.duration || undefined,
        inputBytes: file.size,
      }
    })
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={ACCEPT} onFiles={source.select} maxSizeMb={1024} title="Drop an audio file" hint="MP3, WAV, M4A, OGG, FLAC and more, or a video to take the sound from" />
        <EngineNotice />
      </div>
    )
  }

  const reset = () => {
    job.reset()
    source.clear()
  }

  return (
    <div className="space-y-4">
      <SourceSummary file={file} duration={source.info?.duration} onClear={reset} />
      {source.info?.playable ? <MediaPreview source={file} kind="audio" /> : null}

      <ToolPanel
        title="Settings"
        footer={
          <Button type="button" onClick={start} disabled={job.busy} className="w-full sm:w-auto">
            <Wand2 className="size-4" aria-hidden="true" />
            {job.busy ? 'Working…' : ACTION[effect]}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {effect === 'speed' ? (
            <>
              <SelectField
                label="Speed"
                value={String(s.speed)}
                onChange={(v) => set('speed', Number(v))}
                options={[0.5, 0.75, 0.8, 0.9, 1.1, 1.25, 1.5, 1.75, 2, 3].map((v) => ({ value: String(v), label: `${v}×${v < 1 ? ' (slower)' : ' (faster)'}` }))}
              />
              <SwitchField label="Keep the pitch" checked={s.keepPitch} onChange={(v) => set('keepPitch', v)} hint="Off: faster audio sounds higher, like a tape played fast." />
            </>
          ) : null}
          {effect === 'volume' ? (
            <>
              <SelectField
                label="Change"
                value={String(s.gainDb)}
                onChange={(v) => set('gainDb', Number(v))}
                options={[-12, -6, -3, 3, 6, 9, 12, 18, 24].map((v) => ({ value: String(v), label: `${v > 0 ? '+' : ''}${v} dB (${(10 ** (v / 20)).toFixed(2)}× amplitude)` }))}
              />
              <SwitchField label="Limit peaks" checked={s.limiter} onChange={(v) => set('limiter', v)} hint="Stops loud parts from clipping after a boost." />
            </>
          ) : null}
          {effect === 'normalize' ? (
            <SelectField
              label="Target loudness"
              value={String(s.lufs)}
              onChange={(v) => set('lufs', Number(v))}
              options={[
                { value: '-14', label: '−14 LUFS (music streaming)' },
                { value: '-16', label: '−16 LUFS (podcasts)' },
                { value: '-19', label: '−19 LUFS (speech, quieter)' },
                { value: '-23', label: '−23 LUFS (EU broadcast)' },
              ]}
            />
          ) : null}
          {effect === 'fade' || effect === 'ringtone' ? (
            <>
              <NumberField label="Fade in (seconds)" value={s.fadeIn} min={0} step={0.5} onChange={(v) => set('fadeIn', num(v))} />
              <NumberField label="Fade out (seconds)" value={s.fadeOut} min={0} step={0.5} onChange={(v) => set('fadeOut', num(v))} />
            </>
          ) : null}
          {effect === 'pitch' ? (
            <SelectField
              label="Pitch"
              value={String(s.semitones)}
              onChange={(v) => set('semitones', Number(v))}
              options={[-12, -7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 12].map((v) => ({ value: String(v), label: `${v > 0 ? '+' : ''}${v} semitone${Math.abs(v) === 1 ? '' : 's'}${Math.abs(v) === 12 ? ' (one octave)' : ''}` }))}
            />
          ) : null}
          {effect === 'ringtone' ? (
            <>
              <NumberField label="Start (seconds)" value={s.start} min={0} step={1} onChange={(v) => set('start', num(v))} />
              <NumberField label="Length (seconds)" value={s.length} min={1} max={40} step={1} onChange={(v) => set('length', num(v))} hint="Phones accept up to 30 or 40 seconds." />
              <SelectField
                label="Format"
                value={s.format}
                onChange={(v) => set('format', v as EffectSettings['format'])}
                options={[
                  { value: 'm4r', label: 'M4R (iPhone ringtone)' },
                  { value: 'mp3', label: 'MP3 (Android ringtone)' },
                ]}
              />
            </>
          ) : (
            <SelectField label="Save as" value={s.format} onChange={(v) => set('format', v as EffectSettings['format'])} options={FORMATS} />
          )}
        </div>
      </ToolPanel>

      <JobStatus job={job} label={ACTION[effect]} />
      <JobError job={job} onRetry={start} />
      {job.result ? <ResultPanel result={job.result} kind="audio" downloadLabel="Download" resetLabel="Use another file" onReset={reset} /> : <EngineNotice />}
    </div>
  )
}
