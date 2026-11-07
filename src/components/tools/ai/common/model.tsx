/**
 * Model download state shared by the AI tool islands: the hardware probe, the "Downloads N MB
 * once" note, and the progress of the first download.
 */
import { useEffect, useState } from 'react'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { isCached } from '@/lib/ml/assets'
import { detectHardware } from '@/lib/ml/runtime/backend'
import type { Hardware } from '@/lib/ml/runtime/backend'

export function mb(bytes: number): string {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`
}

/** null until the probe answers (a few milliseconds). */
export function useHardware(): Hardware | null {
  const [hw, setHw] = useState<Hardware | null>(null)
  useEffect(() => {
    let live = true
    void detectHardware().then((h) => live && setHw(h))
    return () => {
      live = false
    }
  }, [])
  return hw
}

/** True when every file is in Cache Storage; null while unknown. */
export function useCached(paths: string[] | null): [boolean | null, () => void] {
  const [cached, setCached] = useState<boolean | null>(null)
  const key = paths?.join('|') ?? ''
  useEffect(() => {
    if (!paths) return
    let live = true
    void isCached(paths)
      .catch(() => false)
      .then((c) => live && setCached(c))
    return () => {
      live = false
    }
  }, [key])
  return [cached, () => setCached(true)]
}

export function DownloadNote({ bytes, cached, what = 'the model' }: { bytes: number; cached: boolean | null; what?: string }) {
  if (cached !== false || bytes <= 0) return null
  return (
    <p className="text-sm text-muted-foreground">
      The first run downloads {what} ({mb(bytes)}) once. After that it works offline.
    </p>
  )
}

export interface Download {
  loaded: number
  total: number
}

export function DownloadProgress({ download, what = 'the model' }: { download: Download; what?: string }) {
  return (
    <ProgressPanel
      label={`Downloading ${what} (once): ${mb(download.loaded)} of ${mb(download.total)}`}
      value={download.total > 0 ? (download.loaded / download.total) * 100 : undefined}
    />
  )
}

export function hardwareNote(hw: Hardware | null): string {
  if (!hw) return ''
  return hw.backend === 'webgpu' ? 'Runs on your graphics card.' : 'Runs on your processor. A browser with WebGPU runs it faster.'
}
