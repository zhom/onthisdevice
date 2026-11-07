/**
 * Depth map: Depth Anything V2 estimates how far each part of a photo is from the camera, on
 * this device. The map is a greyscale picture at the size of the photo.
 */
import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { IMAGE_ACCEPT, decodeImage } from '@/components/tools/image-edit/image-utils'
import { depthModel } from '@/lib/ml/depth/client'
import { DEPTH_MODEL, depthDownloadBytes } from '@/lib/ml/depth/model'
import { runtimeFiles } from '@/lib/ml/runtime/runtime'
import { isAbort } from '@/lib/ml/runtime/rpc'
import { stripExtension } from '@/lib/utils'
import { Compare } from '../common/compare'
import { Choice } from '../common/controls'
import { canvasBlob } from '../common/files'
import { DownloadNote, DownloadProgress, useCached } from '../common/model'
import type { Download } from '../common/model'

const FILES = [...runtimeFiles('wasm'), DEPTH_MODEL]

interface Map {
  depth: Uint8ClampedArray
  width: number
  height: number
}

/** The depth map drawn at the photo size, near white (or near black when inverted). */
function drawMap(map: Map, w: number, h: number, invert: boolean): HTMLCanvasElement {
  const small = document.createElement('canvas')
  small.width = map.width
  small.height = map.height
  const img = new ImageData(map.width, map.height)
  for (let i = 0; i < map.depth.length; i++) {
    const v = invert ? 255 - map.depth[i] : map.depth[i]
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  small.getContext('2d')?.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Your browser blocked canvas drawing.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, w, h)
  return out
}

export default function DepthTool() {
  const [cached, markCached] = useCached(FILES)
  const [file, setFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<ImageBitmap | null>(null)
  const [base, setBase] = useState('518')
  const [invert, setInvert] = useState(false)
  const [map, setMap] = useState<Map | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [download, setDownload] = useState<Download | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runRef = useRef(0)

  async function onFiles(list: File[]) {
    const f = list[0]
    if (!f) return
    setError(null)
    try {
      const { bitmap } = await decodeImage(f)
      setFile(f)
      setPhoto(bitmap)
      void run(bitmap, base)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This image could not be read.')
    }
  }

  async function run(image: ImageBitmap, detail: string) {
    const run = ++runRef.current
    setError(null)
    setMap(null)
    setBusy(true)
    try {
      if (!cached) setDownload({ loaded: 0, total: depthDownloadBytes() })
      await depthModel.call('load', {}, { onProgress: (loaded, total) => setDownload({ loaded, total }) })
      setDownload(null)
      markCached()
      const copy = await createImageBitmap(image)
      const out = await depthModel.call('depth', { image: copy, base: Number(detail) }, { transfer: [copy] })
      if (run === runRef.current) setMap(out)
    } catch (err) {
      if (!isAbort(err) && run === runRef.current) setError(err instanceof Error ? err.message : 'The model stopped.')
    } finally {
      if (run === runRef.current) {
        setBusy(false)
        setDownload(null)
      }
    }
  }

  useEffect(() => {
    let live = true
    setBlob(null)
    if (!map || !photo) return
    void canvasBlob(drawMap(map, photo.width, photo.height, invert), 'png').then((b) => live && setBlob(b))
    return () => {
      live = false
    }
  }, [map, photo, invert])

  function reset() {
    runRef.current++
    setFile(null)
    setPhoto(null)
    setMap(null)
    setError(null)
  }

  if (!file || !photo) {
    return (
      <div className="space-y-3">
        <FileDropzone accept={IMAGE_ACCEPT} onFiles={(f) => void onFiles(f)} maxSizeMb={60} title="Drop a photo here" hint="JPG, PNG, WebP or AVIF." />
        <DownloadNote bytes={depthDownloadBytes()} cached={cached} />
        {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ToolPanel title={file.name} description={`${photo.width} x ${photo.height} px. White is near, black is far${invert ? ' (inverted)' : ''}.`}>
          {download && <DownloadProgress download={download} />}
          {busy && !download && <ProgressPanel label="Estimating depth" />}
          <Compare before={file} after={blob} width={photo.width} height={photo.height} />
        </ToolPanel>
        <ToolPanel
          title="Options"
          footer={
            <div className="flex w-full flex-col gap-2">
              <DownloadButton blob={blob} filename={`${stripExtension(file.name)}-depth.png`} label="Download PNG" size="lg" className="w-full" />
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Other photo
              </Button>
            </div>
          }
        >
          <Choice
            label="Detail"
            value={base}
            options={[
              { value: '518', label: 'Standard' },
              { value: '798', label: 'High' },
            ]}
            onChange={(v) => {
              setBase(v)
              void run(photo, v)
            }}
          />
          <div className="flex items-center gap-2.5">
            <Checkbox id="depth-invert" checked={invert} onCheckedChange={(v) => setInvert(v === true)} />
            <Label htmlFor="depth-invert" className="font-normal">
              Invert (near is black)
            </Label>
          </div>
        </ToolPanel>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
