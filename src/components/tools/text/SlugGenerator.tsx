import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { clamp, formatNumber } from '@/lib/utils'
import { BusyNote, OutputBox, Segmented, StatTile, TextEditor, ToggleRow, useComputed } from './common'
import { forEachLineChunked, makeSlug, type SlugOptions } from './text-core'

const SAMPLE = `10 Café Crème Recipes You Should Try in Zürich
The Beginner's Guide to Kubernetes: Part 1
Кофе и чай: что выбрать?
How to Fix a "404 Not Found" Error (Fast!)`

const SEPARATORS = [
  { value: '-', label: 'Hyphen -' },
  { value: '_', label: 'Underscore _' },
  { value: '.', label: 'Dot .' },
  { value: '', label: 'None' },
] as const

type Separator = (typeof SEPARATORS)[number]['value']

const FORMATS = [
  { value: 'slugs', label: 'Slugs only' },
  { value: 'pairs', label: 'Title → slug' },
  { value: 'csv', label: 'CSV' },
] as const

type Format = (typeof FORMATS)[number]['value']

interface Row {
  title: string
  slug: string
  duplicate: boolean
}

interface Result {
  rows: Row[]
  output: string
  duplicates: number
  longest: number
}

const EMPTY: Result = { rows: [], output: '', duplicates: 0, longest: 0 }

const MAX_PREVIEW_ROWS = 60

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export default function SlugGenerator() {
  const [text, setText] = useState('')
  const [separator, setSeparator] = useState<Separator>('-')
  const [lowercase, setLowercase] = useState(true)
  const [translit, setTranslit] = useState(true)
  const [removeStopWords, setRemoveStopWords] = useState(false)
  const [stripLeadingNumbers, setStripLeadingNumbers] = useState(false)
  const [enforceUnique, setEnforceUnique] = useState(true)
  const [maxLength, setMaxLength] = useState(0)
  const [format, setFormat] = useState<Format>('slugs')

  const { value: result, busy, progress } = useComputed<Result>(
    EMPTY,
    async (ctx) => {
      if (text.trim() === '') return EMPTY

      const options: SlugOptions = {
        separator,
        lowercase,
        transliterate: translit,
        removeStopWords,
        maxLength: clamp(maxLength, 0, 200),
        stripLeadingNumbers,
      }

      const rows: Row[] = []
      const seen = new Map<string, number>()
      let duplicates = 0
      let longest = 0

      await forEachLineChunked(
        text,
        (line) => {
          if (line.trim() === '') return
          let slug = makeSlug(line, options)
          let duplicate = false
          if (slug !== '') {
            const count = seen.get(slug) ?? 0
            if (count > 0) {
              duplicate = true
              duplicates++
              if (enforceUnique) {
                const base = slug
                let suffix = count + 1
                while (seen.has(`${base}${separator || '-'}${suffix}`)) suffix++
                slug = `${base}${separator || '-'}${suffix}`
                seen.set(base, count + 1)
              }
            }
            seen.set(slug, (seen.get(slug) ?? 0) + 1)
          }
          if (slug.length > longest) longest = slug.length
          rows.push({ title: line.trim(), slug, duplicate })
        },
        { progress: ctx.progress, cancelled: ctx.cancelled },
      )

      const output =
        format === 'slugs'
          ? rows.map((row) => row.slug).join('\n')
          : format === 'pairs'
            ? rows.map((row) => `${row.title} → ${row.slug}`).join('\n')
            : ['title,slug', ...rows.map((row) => `${csvEscape(row.title)},${csvEscape(row.slug)}`)].join('\n')

      return { rows, output, duplicates, longest }
    },
    [text, separator, lowercase, translit, removeStopWords, stripLeadingNumbers, enforceUnique, maxLength, format],
  )

  const preview = result.rows.slice(0, MAX_PREVIEW_ROWS)
  const empties = result.rows.filter((row) => row.slug === '').length

  return (
    <div className="space-y-6">
      <ToolPanel>
        <TextEditor
          label="Title, headline or list of titles"
          value={text}
          onChange={setText}
          rows={8}
          sample={SAMPLE}
          hint="One title per line. Each line becomes its own slug, so you can convert a whole content plan at once."
        />
        <BusyNote busy={busy} progress={progress} label="Building slugs…" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented label="Word separator" value={separator} options={SEPARATORS} onChange={setSeparator} />
          <div className="space-y-1.5">
            <Label htmlFor="slug-max" className="text-sm font-medium">
              Maximum length (0 = no limit)
            </Label>
            <Input
              id="slug-max"
              type="number"
              min={0}
              max={200}
              inputMode="numeric"
              value={maxLength}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                setMaxLength(Number.isFinite(parsed) ? clamp(parsed, 0, 200) : 0)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Truncation happens on a word boundary, never mid-word.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToggleRow
            label="Lowercase"
            description="Recommended, because URLs are case sensitive on most servers."
            checked={lowercase}
            onChange={setLowercase}
          />
          <ToggleRow
            label="Transliterate accents"
            description="Café → cafe, Zürich → zuerich, Кофе → kofe."
            checked={translit}
            onChange={setTranslit}
          />
          <ToggleRow
            label="Remove stop words"
            description="Drops “the”, “a”, “of” and similar filler words."
            checked={removeStopWords}
            onChange={setRemoveStopWords}
          />
          <ToggleRow
            label="Strip leading numbers"
            description="“10 Café Recipes” becomes “cafe-recipes”."
            checked={stripLeadingNumbers}
            onChange={setStripLeadingNumbers}
          />
          <ToggleRow
            label="Make duplicates unique"
            description="Adds -2, -3 to repeated slugs so URLs never collide."
            checked={enforceUnique}
            onChange={setEnforceUnique}
          />
          <div className="sm:col-span-2 lg:col-span-1">
            <Segmented label="Output format" value={format} options={FORMATS} onChange={setFormat} />
          </div>
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Slugs" value={formatNumber(result.rows.length, 0)} accent />
          <StatTile label="Duplicates found" value={formatNumber(result.duplicates, 0)} />
          <StatTile label="Longest slug" value={formatNumber(result.longest, 0)} hint="characters" />
          <StatTile label="Empty results" value={formatNumber(empties, 0)} hint="lines with no usable characters" />
        </div>

        {preview.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse text-sm">
              <caption className="sr-only">Generated slugs</caption>
              <thead>
                <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Title</th>
                  <th scope="col" className="px-3 py-2 font-medium">Slug</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Copy</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-1.5 text-muted-foreground">{row.title}</td>
                    <td className="px-3 py-1.5 font-mono text-xs break-all text-foreground">
                      {row.slug === '' ? (
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                          no usable characters
                        </span>
                      ) : (
                        <>
                          {row.slug}
                          {row.duplicate && (
                            <span className="ml-2 font-sans text-xs text-muted-foreground">
                              was a duplicate
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-1 text-right">
                      <CopyButton value={row.slug} label="Copy" variant="ghost" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.rows.length > MAX_PREVIEW_ROWS && (
          <p className="text-xs text-muted-foreground">
            Showing the first {MAX_PREVIEW_ROWS} of {formatNumber(result.rows.length, 0)} slugs. The
            full list is in the box below.
          </p>
        )}

        <OutputBox
          label="Slugs"
          value={result.output}
          filename={format === 'csv' ? 'slugs.csv' : 'slugs.txt'}
          rows={10}
          empty="Enter one or more titles above to generate URL-safe slugs."
        />
      </ToolPanel>
    </div>
  )
}
