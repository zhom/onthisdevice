import { useId, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Eraser, FileUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatBytes, formatNumber } from '@/lib/utils'

interface Props {
  value: string
  onChange: (text: string, fileName?: string) => void
  /** Accepted file extensions, for example ".txt,.log". */
  accept: string
  label?: string
  placeholder?: string
  sample?: string
  mono?: boolean
  /** Turns a dropped file into text, for formats that are not plain text. */
  readFile?: (file: File) => Promise<string>
}

const MAX_BYTES = 50 * 1024 * 1024

/** A text area that also takes a dropped or opened file. */
export function TextInput({ value, onChange, accept, label = 'Text', placeholder, sample, mono, readFile }: Props) {
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const take = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setNote(`${file.name} is ${formatBytes(file.size)}. The limit for text is ${formatBytes(MAX_BYTES)}.`)
      return
    }
    try {
      const text = readFile ? await readFile(file) : await file.text()
      setNote(`Opened ${file.name}, ${formatBytes(file.size)}.`)
      onChange(text, file.name)
    } catch (err) {
      setNote(err instanceof Error ? err.message : `${file.name} could not be read.`)
    }
  }

  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    if (!e.dataTransfer.files.length) return
    e.preventDefault()
    setOver(false)
    void take(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-[600]">
          {label}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {sample && !value ? (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onChange(sample)}>
              <Sparkles className="size-4" aria-hidden="true" />
              Sample
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            Open file
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => {
                onChange('')
                setNote(null)
              }}
            >
              <Eraser className="size-4" aria-hidden="true" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        placeholder={placeholder ?? 'Paste text here, or drop a file'}
        spellCheck={false}
        className={cn(
          'max-h-[28rem] min-h-44 resize-y [field-sizing:fixed]',
          mono && 'font-mono text-[0.8125rem] leading-6',
          over && 'ring-2 ring-foreground',
        )}
      />
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="num text-xs text-muted-foreground" aria-live="polite">
        {note ? `${note} ` : ''}
        {value ? `${formatNumber(value.length)} characters` : ''}
      </p>
    </div>
  )
}
