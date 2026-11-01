import { useId, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { DfProofPanel } from './dev-format-ui'
import { HTTP_STATUSES, STATUS_CLASSES } from './dev-format-http-data'
import { HTML_ENTITIES, MIME_TYPES, buildAsciiTable, entityHex } from './dev-format-ref-data'
import { cn } from '@/lib/utils'

export type ReferenceDataset = 'http' | 'mime' | 'ascii' | 'entities'

export interface DevFormatReferenceProps {
  dataset: ReferenceDataset
}

interface FilterChip {
  id: string
  label: string
}

function Chips({
  chips,
  active,
  onChange,
  label,
}: {
  chips: FilterChip[]
  active: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const selected = chip.id === active
        return (
          <button
            key={chip.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(chip.id)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

export default function DevFormatReference({ dataset }: DevFormatReferenceProps) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const searchId = useId()

  const ascii = useMemo(() => (dataset === 'ascii' ? buildAsciiTable() : []), [dataset])

  const chips: FilterChip[] = useMemo(() => {
    if (dataset === 'http') {
      return [
        { id: 'all', label: 'All codes' },
        ...STATUS_CLASSES.map((klass) => ({ id: klass.id, label: klass.title })),
      ]
    }
    if (dataset === 'mime') {
      const groups = Array.from(new Set(MIME_TYPES.map((m) => m.group)))
      return [
        { id: 'all', label: 'All types' },
        ...groups.map((g) => ({ id: g, label: g.charAt(0).toUpperCase() + g.slice(1) })),
      ]
    }
    if (dataset === 'ascii') {
      return [
        { id: 'all', label: 'All 256' },
        { id: 'control', label: 'Control (0–31)' },
        { id: 'printable', label: 'Printable (32–126)' },
        { id: 'extended', label: 'Extended (128–255)' },
      ]
    }
    const groups = Array.from(new Set(HTML_ENTITIES.map((e) => e.group)))
    return [
      { id: 'all', label: 'All entities' },
      ...groups.map((g) => ({ id: g, label: g.charAt(0).toUpperCase() + g.slice(1) })),
    ]
  }, [dataset])

  const needle = query.trim().toLowerCase()

  const httpRows = useMemo(() => {
    if (dataset !== 'http') return []
    return HTTP_STATUSES.filter((status) => {
      if (group !== 'all' && status.klass !== group) return false
      if (needle === '') return true
      return (
        String(status.code).includes(needle) ||
        status.title.toLowerCase().includes(needle) ||
        status.summary.toLowerCase().includes(needle) ||
        status.causes.some((cause) => cause.toLowerCase().includes(needle))
      )
    })
  }, [dataset, group, needle])

  const mimeRows = useMemo(() => {
    if (dataset !== 'mime') return []
    return MIME_TYPES.filter((entry) => {
      if (group !== 'all' && entry.group !== group) return false
      if (needle === '') return true
      return (
        entry.mime.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.extensions.some((ext) => ext.includes(needle.replace(/^\./, '')))
      )
    })
  }, [dataset, group, needle])

  const asciiRows = useMemo(() => {
    if (dataset !== 'ascii') return []
    return ascii.filter((row) => {
      if (group !== 'all' && row.group !== group) return false
      if (needle === '') return true
      return (
        String(row.dec) === needle ||
        row.hex.toLowerCase() === needle.replace(/^0x/, '') ||
        row.char.toLowerCase() === needle ||
        (row.abbr ?? '').toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle)
      )
    })
  }, [ascii, dataset, group, needle])

  const entityRows = useMemo(() => {
    if (dataset !== 'entities') return []
    return HTML_ENTITIES.filter((row) => {
      if (group !== 'all' && row.group !== group) return false
      if (needle === '') return true
      return (
        row.char === query.trim() ||
        row.names.some((name) => name.includes(needle.replace(/[&;]/g, ''))) ||
        String(row.dec) === needle ||
        row.description.toLowerCase().includes(needle)
      )
    })
  }, [dataset, group, needle, query])

  const count =
    dataset === 'http'
      ? httpRows.length
      : dataset === 'mime'
        ? mimeRows.length
        : dataset === 'ascii'
          ? asciiRows.length
          : entityRows.length

  const placeholder =
    dataset === 'http'
      ? 'Search 404, gateway, rate limit…'
      : dataset === 'mime'
        ? 'Search .docx, image/webp, font…'
        : dataset === 'ascii'
          ? 'Search 65, 0x41, A, escape…'
          : 'Search nbsp, arrow, ©, 8212…'

  return (
    <div className="space-y-6">
      <ToolPanel>
        <div className="flex flex-col gap-3">
          <Label htmlFor={searchId} className="text-sm">
            Filter the table
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="pl-9"
              type="search"
              autoComplete="off"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear the filter"
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                onClick={() => setQuery('')}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <Chips chips={chips} active={group} onChange={setGroup} label="Filter by group" />
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Showing {count} {count === 1 ? 'entry' : 'entries'}.
          </p>
        </div>

        {count === 0 ? (
          <div className="rounded-lg bg-muted px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches “{query}”. Try a shorter term, or clear the group filter.
            </p>
          </div>
        ) : null}

        {dataset === 'http' && httpRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">HTTP status codes with their meaning</caption>
              <thead>
                <tr className="bg-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody>
                {httpRows.map((status) => (
                  <tr key={status.code} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 text-left">
                      <a
                        href={`/http-status-codes/${status.code}`}
                        className="font-mono text-base font-semibold text-primary underline decoration-muted-foreground underline-offset-4 hover:decoration-primary"
                      >
                        {status.code}
                      </a>
                      {!status.standard ? (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          non-standard
                        </span>
                      ) : null}
                    </th>
                    <td className="px-3 py-2 font-medium text-foreground">{status.title}</td>
                    <td className="px-3 py-2 text-pretty text-muted-foreground">
                      {status.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {dataset === 'mime' && mimeRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">MIME types and their file extensions</caption>
              <thead>
                <tr className="bg-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Extension
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    MIME type
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Notes
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Copy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mimeRows.map((entry) => (
                  <tr key={entry.mime + entry.extensions.join()} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 text-left font-mono text-[13px] font-semibold">
                      {entry.extensions.length > 0
                        ? entry.extensions.map((ext) => `.${ext}`).join(' ')
                        : '–'}
                    </th>
                    <td className="px-3 py-2 font-mono text-[13px] break-all text-foreground">
                      {entry.mime}
                    </td>
                    <td className="px-3 py-2 text-pretty text-muted-foreground">
                      <span className="block text-foreground">{entry.name}</span>
                      {entry.note ? <span className="block text-xs">{entry.note}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CopyButton value={entry.mime} label="Copy" size="sm" variant="ghost" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {dataset === 'ascii' && asciiRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <caption className="sr-only">
                ASCII and Latin-1 characters in decimal, hex, octal and binary
              </caption>
              <thead>
                <tr className="bg-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Dec
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Hex
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Oct
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Binary
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Char
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {asciiRows.map((row) => (
                  <tr key={row.dec} className="border-t border-border">
                    <th scope="row" className="px-3 py-1.5 text-left font-semibold tabular-nums">
                      {row.dec}
                    </th>
                    <td className="px-3 py-1.5 tabular-nums">0x{row.hex}</td>
                    <td className="px-3 py-1.5 tabular-nums">{row.oct}</td>
                    <td className="px-3 py-1.5 tabular-nums">{row.bin}</td>
                    <td className="px-3 py-1.5 text-base">
                      {row.abbr ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.abbr}</span>
                      ) : (
                        row.char
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-sans text-pretty text-muted-foreground">
                      {row.description}
                      {row.escape ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {row.escape}
                        </span>
                      ) : null}
                      {row.htmlEntity ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {row.htmlEntity}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {dataset === 'entities' && entityRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">
                HTML entities with their named, decimal and hexadecimal references
              </caption>
              <thead>
                <tr className="bg-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Char
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Named
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Decimal
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Hex
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Description
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Copy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entityRows.map((row) => (
                  <tr key={row.names[0]} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 text-left text-lg">
                      {row.char}
                    </th>
                    <td className="px-3 py-2 font-mono text-[13px]">
                      {row.names
                        .filter((name) => !name.startsWith('#'))
                        .map((name) => `&${name};`)
                        .join(' ') || '–'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[13px]">&amp;#{row.dec};</td>
                    <td className="px-3 py-2 font-mono text-[13px]">&amp;#x{entityHex(row)};</td>
                    <td className="px-3 py-2 text-pretty text-muted-foreground">
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CopyButton
                        value={
                          row.names[0].startsWith('#') ? `&${row.names[0]};` : `&${row.names[0]};`
                        }
                        label="Copy"
                        size="sm"
                        variant="ghost"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ToolPanel>

      <DfProofPanel subject="lookup" />
    </div>
  )
}
