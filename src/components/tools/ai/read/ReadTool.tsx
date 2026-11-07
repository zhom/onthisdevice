/**
 * Image to text: Tesseract reads the text of photos, scans and screenshots on this device, in
 * one or two of 19 languages. The text can be edited, copied and downloaded.
 */
import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ImagePreview } from '@/components/shared/ImagePreview'
import { ProgressPanel } from '@/components/shared/ProgressPanel'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { decodeImage } from '@/components/tools/image-edit/image-utils'
import { readDownloadBytes, readText } from '@/lib/ml/read/read'
import { stripExtension } from '@/lib/utils'
import { textBlob } from '../common/files'
import { DownloadNote } from '../common/model'
import { LanguagePick } from './LanguagePick'
import { prepareForOcr } from './prepare'
import { PRESETS } from './presets'
import type { ReadSlug } from './presets'

interface Item {
  file: File
  text: string | null
  confidence: number
  error?: string
}

const SEEN = 'otd:ocr-langs'

export default function ReadTool({ slug }: { slug: ReadSlug }) {
  const preset = PRESETS[slug]
  const [langs, setLangs] = useState<string[]>(['eng'])
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState<{ label: string; value?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [known, setKnown] = useState<boolean | null>(null)

  useEffect(() => {
    setKnown(localStorage.getItem(SEEN) !== null)
  }, [])

  async function run(list: Item[], languages: string[]) {
    setError(null)
    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i].text !== null) continue
        const label = list.length > 1 ? `Reading image ${i + 1} of ${list.length}` : 'Reading the text'
        setStatus({ label })
        try {
          const { bitmap } = await decodeImage(list[i].file)
          const { canvas } = prepareForOcr(bitmap)
          bitmap.close()
          const page = await readText(canvas, languages, (stage, done) =>
            setStatus(stage === 'download' ? { label: 'Downloading the language data (once)', value: done * 100 } : { label, value: done * 100 }),
          )
          list[i] = { ...list[i], text: page.text, confidence: page.confidence }
        } catch (err) {
          list[i] = { ...list[i], text: '', confidence: 0, error: err instanceof Error ? err.message : 'This image could not be read.' }
        }
        setItems([...list])
      }
      localStorage.setItem(SEEN, '1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The text reader could not start.')
    } finally {
      setStatus(null)
    }
  }

  function onFiles(files: File[]) {
    const next = [...items, ...files.map((file) => ({ file, text: null, confidence: 0 }))]
    setSelected(items.length)
    setItems(next)
    void run(next, langs)
  }

  function changeLangs(next: string[]) {
    setLangs(next)
    if (!items.length) return
    const again = items.map((it) => ({ ...it, text: null, confidence: 0, error: undefined }))
    setItems(again)
    void run(again, next)
  }

  function edit(text: string) {
    setItems((prev) => prev.map((it, i) => (i === selected ? { ...it, text } : it)))
  }

  const current = items[selected]
  const all = items
    .filter((it) => it.text)
    .map((it) => (items.length > 1 ? `${it.file.name}\n\n${it.text}` : it.text))
    .join('\n\n\n')

  return (
    <div className="space-y-6">
      <ToolPanel>
        <LanguagePick id={slug} langs={langs} onChange={changeLangs} />
        {!items.length && <FileDropzone accept={preset.accept} multiple onFiles={onFiles} maxSizeMb={60} title={preset.title} hint={preset.hint} />}
        {!items.length && <DownloadNote bytes={readDownloadBytes(langs)} cached={known === null ? null : known} what="the text reader" />}
        {status && <ProgressPanel label={status.label} value={status.value} />}
      </ToolPanel>

      {current && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ToolPanel title={current.file.name} description={items.length > 1 ? `Image ${selected + 1} of ${items.length}` : undefined}>
            <ImagePreview file={current.file} alt={`The image ${current.file.name}`} className="max-h-[60vh] w-full" />
            {items.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {items.map((it, i) => (
                  <Button key={`${it.file.name}-${i}`} size="sm" variant={i === selected ? 'default' : 'secondary'} onClick={() => setSelected(i)} aria-pressed={i === selected}>
                    {i + 1}
                  </Button>
                ))}
              </div>
            )}
          </ToolPanel>
          <ToolPanel
            title="Text"
            description={
              current.text === null
                ? 'Reading.'
                : current.text
                  ? `${current.text.split(/\s+/).filter(Boolean).length} words. Confidence ${Math.round(current.confidence)}%. You can edit the text.`
                  : 'No text was found in this image.'
            }
            footer={
              <>
                <CopyButton value={current.text ?? ''} label="Copy text" />
                <DownloadButton blob={all ? textBlob(all) : null} filename={items.length > 1 ? 'text.txt' : `${stripExtension(current.file.name)}.txt`} label={items.length > 1 ? 'Download all (TXT)' : 'Download TXT'} variant="secondary" />
                <Button variant="ghost" onClick={() => setItems([])}>
                  <RotateCcw aria-hidden="true" /> Other images
                </Button>
              </>
            }
          >
            {current.error && <ErrorNote message={current.error} />}
            <Label htmlFor={`${slug}-text`} className="sr-only">
              Text found in the image
            </Label>
            <Textarea id={`${slug}-text`} value={current.text ?? ''} onChange={(e) => edit(e.target.value)} rows={16} className="font-mono text-sm" />
          </ToolPanel>
        </div>
      )}
      {items.length > 0 && !status && (
        <FileDropzone accept={preset.accept} multiple onFiles={onFiles} maxSizeMb={60} title="Add more images" hint="They are read with the same languages." />
      )}
      {error && <ErrorNote message={error} onRetry={() => setError(null)} />}
    </div>
  )
}
