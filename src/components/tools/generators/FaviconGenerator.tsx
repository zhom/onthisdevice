import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { ImagePlus, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { downloadBlob, formatBytes, nextFrame } from '@/lib/utils'
import { CheckerSurface, CodeBlock, ColorField, Field, NumberSlider } from './GenUi'
import { parseColor, toHex } from './colorlib'

/** Every raster size the pack ships, with the file it becomes. */
const OUTPUTS: { size: number; filename: string; purpose: string }[] = [
  { size: 16, filename: 'favicon-16x16.png', purpose: 'Browser tab, bookmarks bar' },
  { size: 32, filename: 'favicon-32x32.png', purpose: 'Retina tab, Windows taskbar shortcut' },
  { size: 48, filename: 'favicon-48x48.png', purpose: 'Windows site shortcut' },
  { size: 64, filename: 'favicon-64x64.png', purpose: 'High-DPI tab, Safari pinned fallback' },
  { size: 128, filename: 'favicon-128x128.png', purpose: 'Chrome Web Store, extension icon' },
  { size: 180, filename: 'apple-touch-icon.png', purpose: 'iOS and iPadOS home screen' },
  { size: 192, filename: 'android-chrome-192x192.png', purpose: 'Android home screen' },
  { size: 512, filename: 'android-chrome-512x512.png', purpose: 'Android splash screen, PWA install' },
]

/** The sizes folded into favicon.ico. */
const ICO_SIZES = [16, 32, 48]

const MASTER = 1024

interface GeneratedIcon {
  size: number
  filename: string
  purpose: string
  blob: Blob
  url: string
}

interface Source {
  image: HTMLImageElement
  name: string
  width: number
  height: number
  /** Object URL kept alive for the on-screen preview. */
  url: string
}

/** Thrown to unwind a build whose inputs changed while it was running. */
class CancelledBuild extends Error {
  constructor() {
    super('cancelled')
    this.name = 'CancelledBuild'
  }
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser would not give this page a 2D canvas, which it needs to redraw the icon.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

function roundedPath(ctx: CanvasRenderingContext2D, size: number, radius: number): void {
  const r = Math.min(radius, size / 2)
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(size, 0, size, size, r)
  ctx.arcTo(size, size, 0, size, r)
  ctx.arcTo(0, size, 0, 0, r)
  ctx.arcTo(0, 0, size, 0, r)
  ctx.closePath()
}

interface MasterOptions {
  background: string | null
  paddingPercent: number
  radiusPercent: number
}

/** Compose the source image into a square master bitmap at {@link MASTER} px. */
function buildMaster(source: Source, options: MasterOptions): HTMLCanvasElement {
  const canvas = makeCanvas(MASTER)
  const ctx = context(canvas)
  const radius = (options.radiusPercent / 100) * (MASTER / 2)

  if (options.background) {
    ctx.save()
    roundedPath(ctx, MASTER, radius)
    ctx.clip()
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, MASTER, MASTER)
    ctx.restore()
  }

  const inset = (options.paddingPercent / 100) * MASTER
  const box = MASTER - inset * 2
  const width = source.width || MASTER
  const height = source.height || MASTER
  const scale = Math.min(box / width, box / height)
  const drawW = width * scale
  const drawH = height * scale

  ctx.save()
  if (options.radiusPercent > 0) {
    roundedPath(ctx, MASTER, radius)
    ctx.clip()
  }
  ctx.drawImage(source.image, (MASTER - drawW) / 2, (MASTER - drawH) / 2, drawW, drawH)
  ctx.restore()

  return canvas
}

/** Halve repeatedly before the final draw — a single big downscale looks mushy. */
function downscale(master: HTMLCanvasElement, target: number): HTMLCanvasElement {
  let current = master
  let size = master.width
  while (size / 2 > target) {
    size = Math.max(target, Math.floor(size / 2))
    const next = makeCanvas(size)
    context(next).drawImage(current, 0, 0, size, size)
    current = next
  }
  const out = makeCanvas(target)
  context(out).drawImage(current, 0, 0, target, target)
  return out
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not encode one of the PNG sizes.'))
    }, 'image/png')
  })
}

function buildManifest(name: string, shortName: string, themeColor: string, backgroundColor: string): string {
  return `${JSON.stringify(
    {
      name,
      short_name: shortName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: themeColor,
      background_color: backgroundColor,
      display: 'standalone',
      start_url: '/',
    },
    null,
    2,
  )}\n`
}

function buildSnippet(themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join('\n')
}

export default function FaviconGenerator() {
  const [source, setSource] = useState<Source | null>(null)
  const [icons, setIcons] = useState<GeneratedIcon[]>([])
  const [icoBlob, setIcoBlob] = useState<Blob | null>(null)
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [useBackground, setUseBackground] = useState(false)
  const [background, setBackground] = useState('#ffffff')
  const [padding, setPadding] = useState(0)
  const [radius, setRadius] = useState(0)
  const [appName, setAppName] = useState('My site')
  const [shortName, setShortName] = useState('My site')
  const [themeColor, setThemeColor] = useState('#0f172a')

  const urlsRef = useRef<string[]>([])
  const runRef = useRef(0)

  const releaseUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current = []
  }, [])

  const sourceUrlRef = useRef<string | null>(null)
  sourceUrlRef.current = source?.url ?? null

  useEffect(() => {
    return () => {
      releaseUrls()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    }
  }, [releaseUrls])

  const backgroundHex = useMemo(
    () => (useBackground ? toHex(parseColor(background) ?? { r: 255, g: 255, b: 255, a: 1 }) : null),
    [useBackground, background],
  )
  const themeHex = useMemo(
    () => toHex(parseColor(themeColor) ?? { r: 15, g: 23, b: 42, a: 1 }),
    [themeColor],
  )

  const snippet = useMemo(() => buildSnippet(themeHex), [themeHex])

  const onFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setError(null)
    const url = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () =>
          reject(new Error(`“${file.name}” could not be decoded. PNG, JPG, WebP, GIF and SVG all work.`))
        img.src = url
      })
      const width = image.naturalWidth || MASTER
      const height = image.naturalHeight || MASTER
      setSource((previous) => {
        if (previous) URL.revokeObjectURL(previous.url)
        return { image, name: file.name, width, height, url }
      })
    } catch (err) {
      URL.revokeObjectURL(url)
      setError(err instanceof Error ? err.message : 'That image could not be read.')
    }
  }, [])

  const clearSource = useCallback(() => {
    setSource((previous) => {
      if (previous) URL.revokeObjectURL(previous.url)
      return null
    })
    setError(null)
  }, [])

  // Re-render every raster whenever the source or its composition changes.
  useEffect(() => {
    if (!source) {
      releaseUrls()
      setIcons([])
      setIcoBlob(null)
      return
    }

    const run = ++runRef.current
    let cancelled = false
    const stale = () => cancelled || run !== runRef.current

    const build = async () => {
      setError(null)
      setProgress({ value: 0, label: 'Preparing the master image…' })
      const produced: GeneratedIcon[] = []
      try {
        const master = buildMaster(source, {
          background: backgroundHex,
          paddingPercent: padding,
          radiusPercent: radius,
        })
        await nextFrame()
        if (stale()) return

        const pngBytes = new Map<number, Uint8Array>()

        for (let i = 0; i < OUTPUTS.length; i++) {
          const output = OUTPUTS[i]
          const blob = await toPng(downscale(master, output.size))
          produced.push({ ...output, blob, url: URL.createObjectURL(blob) })
          if (ICO_SIZES.includes(output.size)) {
            pngBytes.set(output.size, new Uint8Array(await blob.arrayBuffer()))
          }
          setProgress({
            value: ((i + 1) / (OUTPUTS.length + 1)) * 100,
            label: `Rendering ${output.size} × ${output.size}…`,
          })
          await nextFrame()
          if (stale()) throw new CancelledBuild()
        }

        setProgress({ value: 95, label: 'Writing favicon.ico…' })
        const { buildIco } = await import('./ico')
        const icoEntries = ICO_SIZES.map((size) => {
          const png = pngBytes.get(size)
          if (!png) throw new Error(`The ${size} px image is missing from the ICO build.`)
          return { size, png }
        })
        const ico = new Blob([buildIco(icoEntries) as BlobPart], { type: 'image/x-icon' })
        if (stale()) throw new CancelledBuild()

        releaseUrls()
        urlsRef.current = produced.map((icon) => icon.url)
        setIcons(produced)
        setIcoBlob(ico)
        setProgress(null)
      } catch (err) {
        for (const icon of produced) {
          if (!urlsRef.current.includes(icon.url)) URL.revokeObjectURL(icon.url)
        }
        if (stale() || err instanceof CancelledBuild) return
        setProgress(null)
        setError(err instanceof Error ? err.message : 'The favicon pack could not be generated.')
      }
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [source, backgroundHex, padding, radius, releaseUrls])

  // Repackage the ZIP when the icons or the manifest text change. Cheap enough
  // to redo on a keystroke because nothing is re-rendered.
  useEffect(() => {
    if (icons.length === 0 || !icoBlob) {
      setZipBlob(null)
      return
    }
    let cancelled = false

    const pack = async () => {
      const zip = new JSZip()
      zip.file('favicon.ico', icoBlob)
      for (const icon of icons) zip.file(icon.filename, icon.blob)
      zip.file('site.webmanifest', buildManifest(appName, shortName, themeHex, backgroundHex ?? '#ffffff'))
      zip.file(
        'README.txt',
        [
          'Favicon pack generated in the browser with onthisdevice.com.',
          '',
          'Copy every file into the root of your site (next to index.html), then paste',
          'this into the <head> of every page:',
          '',
          buildSnippet(themeHex),
          '',
          'Notes',
          '-----',
          '* favicon.ico contains the 16, 32 and 48 pixel images in one file.',
          '* apple-touch-icon.png is 180x180 and must not be transparent on iOS.',
          '  Give it a solid background if your logo has one.',
          '* site.webmanifest points at /android-chrome-192x192.png and',
          '  /android-chrome-512x512.png. Edit the name fields to match your site.',
          '',
        ].join('\n'),
      )
      const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      if (!cancelled) setZipBlob(archive)
    }

    void pack()
    return () => {
      cancelled = true
    }
  }, [icons, icoBlob, appName, shortName, themeHex, backgroundHex])

  const small = source !== null && Math.min(source.width, source.height) < 256

  if (!source) {
    return (
      <div className="flex flex-col gap-6">
        <FileDropzone
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,.png,.jpg,.jpeg,.svg,.webp,.gif"
          onFiles={(files) => void onFiles(files)}
          maxSizeMb={25}
          icon={ImagePlus}
          title="Drop your logo or icon"
          hint="PNG, SVG, JPG, WebP or GIF. A square image of 512 px or more gives the best result"
        />
        {error ? <ErrorNote message={error} /> : null}
        <ToolPanel title="What you get">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 text-left font-semibold">File</th>
                  <th className="border-b border-border px-3 py-2 text-left font-semibold">Size</th>
                  <th className="border-b border-border px-3 py-2 text-left font-semibold">Used by</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-border px-3 py-2 font-mono text-[13px]">favicon.ico</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">16, 32, 48</td>
                  <td className="border-b border-border px-3 py-2 text-muted-foreground">
                    Legacy browsers, Windows shortcuts, the default lookup at /favicon.ico
                  </td>
                </tr>
                {OUTPUTS.map((output) => (
                  <tr key={output.filename}>
                    <td className="border-b border-border px-3 py-2 font-mono text-[13px]">{output.filename}</td>
                    <td className="border-b border-border px-3 py-2 tabular-nums">{output.size}</td>
                    <td className="border-b border-border px-3 py-2 text-muted-foreground">{output.purpose}</td>
                  </tr>
                ))}
                <tr>
                  <td className="border-b border-border px-3 py-2 font-mono text-[13px]">site.webmanifest</td>
                  <td className="border-b border-border px-3 py-2">–</td>
                  <td className="border-b border-border px-3 py-2 text-muted-foreground">
                    Android install prompt, PWA name, theme colour
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ToolPanel>
      </div>
    )
  }

  const tab16 = icons.find((icon) => icon.size === 16)
  const touch = icons.find((icon) => icon.size === 180)

  return (
    <div className="flex flex-col gap-6">
      <ToolPanel
        title="Source image"
        footer={
          <Button type="button" variant="outline" className="gap-2" onClick={clearSource}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Use a different image
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <CheckerSurface className="shrink-0 p-2">
            <img src={source.url} alt="" className="size-16 object-contain" />
          </CheckerSurface>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {source.width} × {source.height} px
            </p>
            {small ? (
              <p className="flex items-start gap-1.5 mt-1 text-xs text-pretty text-foreground">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  This image is smaller than 256 px, so the 512 px icon will be upscaled and look soft.
                  Re-export the logo at 512 px or larger, or supply an SVG.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </ToolPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ToolPanel title="Composition">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
            <div className="min-w-0">
              <Label htmlFor="fav-bg-toggle" className="text-sm">
                Add a background
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                iOS ignores transparency on the home-screen icon and paints it black, so a solid
                background is usually the right choice.
              </p>
            </div>
            <Switch id="fav-bg-toggle" checked={useBackground} onCheckedChange={setUseBackground} />
          </div>

          {useBackground ? (
            <ColorField label="Background colour" value={background} onChange={setBackground} />
          ) : null}

          <NumberSlider
            label="Padding"
            value={padding}
            onChange={setPadding}
            min={0}
            max={30}
            unit="%"
            hint="Breathing room around the logo. Around 10% looks right for a wordmark or a dense glyph."
          />

          <NumberSlider
            label="Corner radius"
            value={radius}
            onChange={setRadius}
            min={0}
            max={100}
            unit="%"
            hint="100% is a perfect circle. iOS and Android apply their own mask on top, so keep this at 0 unless you want rounded corners inside the browser tab too."
          />
        </ToolPanel>

        <ToolPanel title="Manifest">
          <Field label="Site name" htmlFor="fav-name">
            <Input id="fav-name" value={appName} onChange={(event) => setAppName(event.target.value)} />
          </Field>
          <Field
            label="Short name"
            htmlFor="fav-short"
            hint="What appears under the icon on an Android home screen. Twelve characters or fewer avoids truncation."
          >
            <Input id="fav-short" value={shortName} onChange={(event) => setShortName(event.target.value)} />
          </Field>
          <ColorField
            label="Theme colour"
            value={themeColor}
            onChange={setThemeColor}
            hint="Tints the Android address bar and the PWA title bar."
          />
        </ToolPanel>
      </div>

      {progress ? <ProgressPanel label={progress.label} value={progress.value} /> : null}
      {error ? <ErrorNote message={error} /> : null}

      {icons.length > 0 ? (
        <>
          <ToolPanel title="How it will look">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-card p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Browser tab</p>
                <div className="flex items-center gap-2 rounded-t-lg bg-muted px-3 py-2">
                  {tab16 ? <img src={tab16.url} alt="" width={16} height={16} className="size-4 shrink-0" /> : null}
                  <span className="truncate text-xs text-foreground">{appName || 'My site'}</span>
                </div>
              </div>
              <div className="rounded-lg bg-card p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">iOS home screen</p>
                <div className="flex items-center gap-3">
                  {touch ? (
                    <img
                      src={touch.url}
                      alt=""
                      className="size-14 rounded-[22%] border border-border object-contain"
                    />
                  ) : null}
                  <span className="truncate text-xs text-foreground">{shortName || 'My site'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 rounded-lg bg-muted p-4">
              {[16, 32, 48, 64].map((size) => {
                const icon = icons.find((item) => item.size === size)
                if (!icon) return null
                return (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <img
                      src={icon.url}
                      alt={`${size} pixel favicon`}
                      width={size}
                      height={size}
                      style={{ width: size, height: size }}
                      className="border border-border"
                    />
                    <span className="text-[10px] tabular-nums text-muted-foreground">{size}px</span>
                  </div>
                )
              })}
              <p className="min-w-0 flex-1 text-xs text-pretty text-muted-foreground">
                These are shown at their real pixel size. If the 16 px version is an unreadable
                smudge, simplify the mark: at that size only a bold letter or a single shape reads.
              </p>
            </div>
          </ToolPanel>

          <ToolPanel
            title="Download"
            footer={
              <>
                <Button
                  type="button"
                  disabled={!zipBlob}
                  onClick={() => {
                    if (zipBlob) downloadBlob(zipBlob, 'favicon-pack.zip')
                  }}
                >
                  Download the pack ({zipBlob ? formatBytes(zipBlob.size) : '…'})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!icoBlob}
                  onClick={() => {
                    if (icoBlob) downloadBlob(icoBlob, 'favicon.ico')
                  }}
                >
                  favicon.ico only
                </Button>
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border px-3 py-2 text-left font-semibold">File</th>
                    <th className="border-b border-border px-3 py-2 text-right font-semibold">Size</th>
                    <th className="border-b border-border px-3 py-2 text-left font-semibold">Used by</th>
                    <th className="border-b border-border px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-b border-border px-3 py-2 font-mono text-[13px]">favicon.ico</td>
                    <td className="border-b border-border px-3 py-2 text-right tabular-nums">
                      {icoBlob ? formatBytes(icoBlob.size) : '–'}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-muted-foreground">
                      16, 32 and 48 px in one legacy container
                    </td>
                    <td className="border-b border-border px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!icoBlob}
                        onClick={() => {
                          if (icoBlob) downloadBlob(icoBlob, 'favicon.ico')
                        }}
                      >
                        Save
                      </Button>
                    </td>
                  </tr>
                  {icons.map((icon) => (
                    <tr key={icon.filename}>
                      <td className="border-b border-border px-3 py-2 font-mono text-[13px]">{icon.filename}</td>
                      <td className="border-b border-border px-3 py-2 text-right tabular-nums">
                        {formatBytes(icon.blob.size)}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-muted-foreground">{icon.purpose}</td>
                      <td className="border-b border-border px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBlob(icon.blob, icon.filename)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ToolPanel>

          <ToolPanel
            title="Paste this into your <head>"
            description="Every path assumes the files sit in your site root. Adjust the prefix if you serve them from a sub-folder."
            footer={<CopyButton value={snippet} label="Copy the HTML" />}
          >
            <CodeBlock code={snippet} />
          </ToolPanel>

          <ToolPanel
            title="site.webmanifest"
            footer={
              <CopyButton
                value={buildManifest(appName, shortName, themeHex, backgroundHex ?? '#ffffff')}
                label="Copy the manifest"
              />
            }
          >
            <CodeBlock code={buildManifest(appName, shortName, themeHex, backgroundHex ?? '#ffffff')} />
          </ToolPanel>
        </>
      ) : null}
    </div>
  )
}
