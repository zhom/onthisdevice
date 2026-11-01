import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { allPages, parsePageRanges } from './pdf-shared'

interface PageSelectionBarProps {
  pageCount: number
  selected: Set<number>
  onChange: (next: Set<number>) => void
  /** Unique prefix so the label/input pair stays unique on the page. */
  idPrefix: string
  /** Wording for the range field, e.g. "Pages to delete". */
  rangeLabel?: string
}

/** All / none / odd / even / invert shortcuts plus a free-text range field. */
export function PageSelectionBar({
  pageCount,
  selected,
  onChange,
  idPrefix,
  rangeLabel = 'Select pages',
}: PageSelectionBarProps) {
  const [range, setRange] = useState('')
  const [error, setError] = useState<string | null>(null)

  const apply = () => {
    try {
      const pages = parsePageRanges(range, pageCount)
      onChange(new Set(pages))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const set = (pages: number[]) => {
    onChange(new Set(pages))
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Quick select
        </span>
        <Button variant="outline" size="sm" onClick={() => set(allPages(pageCount))}>
          All
        </Button>
        <Button variant="outline" size="sm" onClick={() => set([])}>
          None
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set(allPages(pageCount).filter((p) => p % 2 === 1))}
        >
          Odd
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set(allPages(pageCount).filter((p) => p % 2 === 0))}
        >
          Even
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set(allPages(pageCount).filter((p) => !selected.has(p)))}
        >
          Invert
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-range`} className="text-xs text-muted-foreground">
            {rangeLabel}
          </Label>
          <Input
            id={`${idPrefix}-range`}
            value={range}
            onChange={(e) => setRange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
            }}
            placeholder="1-3, 7, 10-"
            className="w-44 font-mono"
          />
        </div>
        <Button variant="secondary" onClick={apply} disabled={!range.trim()}>
          Apply range
        </Button>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {selected.size} of {pageCount} page{pageCount === 1 ? '' : 's'} selected
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
