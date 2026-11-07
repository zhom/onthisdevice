/**
 * Text to speech: Kokoro reads English text aloud in one of 11 voices on this device. The
 * result plays in the page and downloads as WAV or MP3.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { runFFmpeg } from '@/components/tools/media/_ffmpeg'
import { FFMPEG_CORE_BYTES } from '@/lib/ffmpeg-core'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { speaker } from '@/lib/ml/voice/client'
import { SAMPLE_RATE, VOICES, voiceDownloadBytes, voiceFiles } from '@/lib/ml/voice/voices'
import { downloadBlob } from '@/lib/utils'
import { Range } from '../common/controls'
import { joinSamples, wavBlob } from '../common/files'
import { DownloadNote, DownloadProgress, mb, useCached } from '../common/model'
import type { Download as DownloadState } from '../common/model'

export type VoiceSlug = 'text-to-speech' | 'text-to-mp3'

const SAMPLE =
  'Welcome. This voice is made by a model that runs in your browser, so the text you type never leaves your device. Paste an article, a story or a script, choose a voice, and press Read aloud.'
const LIMIT = 20000

export default function VoiceTool({ slug }: { slug: VoiceSlug }) {
  const [text, setText] = useState(SAMPLE)
  const [voiceId, setVoiceId] = useState('af_heart')
  const voice = VOICES.find((v) => v.id === voiceId) ?? VOICES[0]
  const files = useMemo(() => voiceFiles(voice), [voice])
  const [cached, markCached] = useCached(files)
  const [speed, setSpeed] = useState(1)
  const [download, setDownload] = useState<DownloadState | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [audio, setAudio] = useState<Float32Array | null>(null)
  const [encoding, setEncoding] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const wav = useMemo(() => (audio ? wavBlob(audio, SAMPLE_RATE) : null), [audio])
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!wav) return setUrl(null)
    const u = URL.createObjectURL(wav)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [wav])

  async function speak() {
    const body = text.trim().slice(0, LIMIT)
    if (!body) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setError(null)
    setAudio(null)
    const parts: Float32Array[] = []
    try {
      if (!cached) setDownload({ loaded: 0, total: voiceDownloadBytes(voice) })
      await speaker.call('load', { voice: voice.id }, { signal: abort.signal, onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      setProgress({ done: 0, total: body.length })
      await speaker.call(
        'speak',
        { text: body, voice: voice.id, speed },
        {
          signal: abort.signal,
          onEvent: (piece) => {
            parts.push(piece.audio)
            setProgress({ done: piece.done, total: piece.total })
          },
        },
      )
      setAudio(joinSamples(parts))
    } catch (err) {
      if (isAbort(err)) {
        if (parts.length) setAudio(joinSamples(parts))
      } else setError(err instanceof Error ? err.message : 'The voice model stopped.')
    } finally {
      if (abortRef.current === abort) {
        setDownload(null)
        setProgress(null)
      }
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  async function saveMp3() {
    if (!wav || !audio) return
    setError(null)
    setEncoding(0)
    try {
      const { blob } = await runFFmpeg({
        inputs: [{ name: 'speech.wav', data: wav }],
        commands: [['-i', 'speech.wav', '-c:a', 'libmp3lame', '-b:a', '128k', 'speech.mp3']],
        output: 'speech.mp3',
        mime: 'audio/mpeg',
        durationSec: audio.length / SAMPLE_RATE,
        onProgress: (pct: number) => setEncoding(pct),
      })
      downloadBlob(blob, 'speech.mp3')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The MP3 could not be made. Download the WAV instead.')
    } finally {
      setEncoding(null)
    }
  }

  const busy = download !== null || progress !== null
  const seconds = audio ? audio.length / SAMPLE_RATE : 0
  const mp3First = slug === 'text-to-mp3'
  const wavButton = (
    <Button size="lg" variant={mp3First ? 'secondary' : 'default'} disabled={!wav} onClick={() => wav && downloadBlob(wav, 'speech.wav')}>
      <Download aria-hidden="true" /> Download WAV
    </Button>
  )
  const mp3Button = (
    <Button size="lg" variant={mp3First ? 'default' : 'secondary'} disabled={!wav || encoding !== null} onClick={() => void saveMp3()}>
      <Download aria-hidden="true" /> Download MP3
    </Button>
  )

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="space-y-2">
          <Label htmlFor={`${slug}-text`}>Text in English</Label>
          <Textarea id={`${slug}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={LIMIT} />
          <p className="num text-[0.8125rem] text-muted-foreground">
            {text.length.toLocaleString()} of {LIMIT.toLocaleString()} characters
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${slug}-voice`}>Voice</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger id={`${slug}-voice`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['us', 'gb'] as const).map((accent) => (
                  <SelectGroup key={accent}>
                    <SelectLabel>{accent === 'us' ? 'American English' : 'British English'}</SelectLabel>
                    {VOICES.filter((v) => v.accent === accent).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}, {v.gender}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Range label="Speed" value={speed} min={0.6} max={1.6} step={0.05} onChange={setSpeed} format={(v) => `${v.toFixed(2)}x`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {busy ? (
            <Button size="lg" variant="secondary" onClick={stop}>
              <Square aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button size="lg" disabled={!text.trim()} onClick={() => void speak()}>
              Read aloud
            </Button>
          )}
        </div>
        <DownloadNote bytes={voiceDownloadBytes(voice)} cached={cached} what="the voice model" />
        {download && <DownloadProgress download={download} what="the voice model" />}
        {progress && !download && <ProgressPanel label="Making the speech" value={(progress.done / Math.max(1, progress.total)) * 100} />}
      </ToolPanel>

      {url && (
        <ToolPanel
          title={`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')} of speech`}
          description={`Voice ${voice.name}. MP3 uses the audio engine (${mb(FFMPEG_CORE_BYTES)} once).`}
          footer={
            <>
              {mp3First ? mp3Button : wavButton}
              {mp3First ? wavButton : mp3Button}
            </>
          }
        >
          <audio src={url} controls className="w-full" aria-label="The speech" />
          {encoding !== null && <ProgressPanel label="Making the MP3" value={encoding} />}
        </ToolPanel>
      )}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
