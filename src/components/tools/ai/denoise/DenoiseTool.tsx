/**
 * Speech noise removal: DTLN cleans a recording on this device (fans, traffic, hum, room
 * noise). The strength mixes the cleaned and the original sound, and the result downloads as
 * WAV or MP3.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { runFFmpeg } from '@/components/tools/media/_ffmpeg'
import { decodeSound, speechAudio } from '@/components/tools/redact/audio/decode'
import { denoiser } from '@/lib/ml/denoise/client'
import { RATE, mix } from '@/lib/ml/denoise/dtln'
import { DTLN_MODELS, denoiseDownloadBytes } from '@/lib/ml/denoise/models'
import { runtimeFiles } from '@/lib/ml/runtime/runtime'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { clock } from '@/lib/ml/transcribe/captions'
import { downloadBlob, stripExtension } from '@/lib/utils'
import { Range } from '../common/controls'
import { wavBlob } from '../common/files'
import { DownloadNote, DownloadProgress, useCached } from '../common/model'
import type { Download as DownloadState } from '../common/model'

const FILES = [...runtimeFiles('wasm'), ...DTLN_MODELS]
const ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm,.mp4,.mov,.mkv,audio/*,video/*'

function useUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export default function DenoiseTool() {
  const [cached, markCached] = useCached(FILES)
  const [file, setFile] = useState<File | null>(null)
  const [original, setOriginal] = useState<Float32Array | null>(null)
  const [cleaned, setCleaned] = useState<Float32Array | null>(null)
  const [strength, setStrength] = useState(100)
  const [download, setDownload] = useState<DownloadState | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [encoding, setEncoding] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function onFiles(list: File[]) {
    const f = list[0]
    if (!f) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setError(null)
    setCleaned(null)
    setFile(f)
    setProgress(0)
    try {
      const audio = await speechAudio((await decodeSound(f)).buffer)
      setOriginal(audio)
      if (!cached) setDownload({ loaded: 0, total: denoiseDownloadBytes() })
      await denoiser.call('load', {}, { signal: abort.signal, onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      const copy = audio.slice()
      const out = await denoiser.call('clean', { audio: copy }, { signal: abort.signal, transfer: [copy.buffer], onProgress: (d, t) => setProgress((d / t) * 100) })
      setCleaned(out)
    } catch (err) {
      if (!isAbort(err)) setError(err instanceof Error ? err.message : 'This file could not be cleaned.')
    } finally {
      if (abortRef.current === abort) {
        setDownload(null)
        setProgress(null)
      }
    }
  }

  const result = useMemo(() => (original && cleaned ? wavBlob(mix(original, cleaned, strength / 100), RATE) : null), [original, cleaned, strength])
  const before = useMemo(() => (original ? wavBlob(original, RATE) : null), [original])
  const resultUrl = useUrl(result)
  const beforeUrl = useUrl(before)
  const base = file ? stripExtension(file.name) : 'audio'

  async function saveMp3() {
    if (!result || !original) return
    setEncoding(0)
    try {
      const { blob } = await runFFmpeg({
        inputs: [{ name: 'clean.wav', data: result }],
        commands: [['-i', 'clean.wav', '-c:a', 'libmp3lame', '-b:a', '96k', 'clean.mp3']],
        output: 'clean.mp3',
        mime: 'audio/mpeg',
        durationSec: original.length / RATE,
        onProgress: (pct: number) => setEncoding(pct),
      })
      downloadBlob(blob, `${base}-clean.mp3`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The MP3 could not be made. Download the WAV instead.')
    } finally {
      setEncoding(null)
    }
  }

  function reset() {
    abortRef.current?.abort()
    denoiser.terminate()
    setFile(null)
    setOriginal(null)
    setCleaned(null)
    setError(null)
  }

  if (!file) {
    return (
      <div className="space-y-3">
        <FileDropzone accept={ACCEPT} onFiles={(f) => void onFiles(f)} maxSizeMb={1000} title="Drop a recording" hint="MP3, WAV, M4A, OGG, FLAC, or a video. Speech works best." />
        <DownloadNote bytes={denoiseDownloadBytes()} cached={cached} what="the noise model" />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ToolPanel title={file.name} description={original ? `${clock(original.length / RATE)} of sound, cleaned at 16 kHz mono.` : 'Reading the sound'}>
        {download && <DownloadProgress download={download} what="the noise model" />}
        {progress !== null && !download && <ProgressPanel label="Removing noise" value={progress} />}
        {progress !== null && (
          <Button variant="secondary" onClick={reset}>
            <Square aria-hidden="true" /> Stop
          </Button>
        )}
        {resultUrl && beforeUrl && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-[600]">Before</p>
              <audio src={beforeUrl} controls className="w-full" aria-label="Before" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-[600]">After</p>
              <audio src={resultUrl} controls className="w-full" aria-label="After" />
            </div>
          </div>
        )}
        {cleaned && <Range label="Strength" value={strength} min={0} max={100} step={5} onChange={setStrength} format={(v) => `${v}%`} />}
        {encoding !== null && <ProgressPanel label="Making the MP3" value={encoding} />}
      </ToolPanel>
      {result && (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => downloadBlob(result, `${base}-clean.wav`)}>
            <Download aria-hidden="true" /> Download WAV
          </Button>
          <Button size="lg" variant="secondary" disabled={encoding !== null} onClick={() => void saveMp3()}>
            <Download aria-hidden="true" /> Download MP3
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Other file
          </Button>
        </div>
      )}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
