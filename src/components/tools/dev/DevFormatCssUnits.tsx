import { useCallback, useMemo, useState } from 'react'
import { ArrowLeftRight, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Formula } from '@/components/shared/Formula'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ResultStat } from '@/components/shared/ResultStat'
import { DfCodePane, DfField, DfProofPanel, DfStatChips, DfStatus } from './dev-format-ui'
import {
  CSS_BULK_SAMPLE,
  CSS_UNITS,
  DEFAULT_BULK,
  convertUnit,
  referenceRows,
  rewriteCss,
  tidy,
  unitFormula,
  type CssUnit,
  type UnitContext,
} from './dev-format-cssunits'

export interface DevFormatCssUnitsProps {
  from: CssUnit
  to: CssUnit
}

export default function DevFormatCssUnits({ from, to }: DevFormatCssUnitsProps) {
  const [source, setSource] = useState<CssUnit>(from)
  const [target, setTarget] = useState<CssUnit>(to)
  const [value, setValue] = useState('16')
  const [rootPx, setRootPx] = useState('16')
  const [parentPx, setParentPx] = useState('16')
  const [decimals, setDecimals] = useState(4)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [css, setCss] = useState('')
  const [skipZero, setSkipZero] = useState(true)
  const [skipHairlines, setSkipHairlines] = useState(true)
  const [skipMedia, setSkipMedia] = useState(true)
  const [properties, setProperties] = useState('')

  const context: UnitContext = useMemo(
    () => ({
      rootPx: Number(rootPx) > 0 ? Number(rootPx) : 16,
      parentPx: Number(parentPx) > 0 ? Number(parentPx) : 16,
    }),
    [parentPx, rootPx],
  )

  const numeric = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(numeric)
  const converted = valid ? convertUnit(numeric, source, target, context) : Number.NaN

  const swap = useCallback(() => {
    setSource(target)
    setTarget(source)
    if (valid) setValue(tidy(converted, decimals))
  }, [converted, decimals, source, target, valid])

  const rows = useMemo(() => referenceRows(context, decimals), [context, decimals])

  const bulk = useMemo(() => {
    if (css.trim() === '') return null
    return rewriteCss(css, {
      ...DEFAULT_BULK,
      from: source,
      to: target,
      context,
      decimals,
      skipZero,
      skipHairlines,
      skipMediaQueries: skipMedia,
      propertyFilter: properties.split(',').map((p) => p.trim()).filter(Boolean),
    })
  }, [context, css, decimals, properties, skipHairlines, skipMedia, skipZero, source, target])

  const bulkBlob = useMemo(
    () => (bulk ? new Blob([bulk.css], { type: 'text/css' }) : null),
    [bulk],
  )

  const resultText = valid ? `${tidy(converted, decimals)}${CSS_UNITS[target].suffix}` : '–'

  return (
    <div className="space-y-6">
      <ToolPanel
        title={`${CSS_UNITS[source].label} to ${CSS_UNITS[target].label}`}
        description="Convert a single value, or paste a whole stylesheet and rewrite every length at once. The root and parent font sizes below drive every number on this page."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <DfField
            label={`Value in ${CSS_UNITS[source].suffix}`}
            htmlFor="unit-value"
            hint={CSS_UNITS[source].basis}
          >
            <Input
              id="unit-value"
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="font-mono text-lg"
            />
          </DfField>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label={`Swap: convert ${CSS_UNITS[target].label} to ${CSS_UNITS[source].label}`}
            className="mb-1"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </Button>

          <DfField
            label={`Result in ${CSS_UNITS[target].suffix}`}
            htmlFor="unit-result"
            hint={CSS_UNITS[target].basis}
          >
            <div className="flex gap-2">
              <Input
                id="unit-result"
                value={valid ? tidy(converted, decimals) : ''}
                readOnly
                className="bg-muted font-mono text-lg"
              />
              <CopyButton value={resultText} label="Copy" />
            </div>
          </DfField>
        </div>

        {!valid && value.trim() !== '' ? (
          <DfStatus ok={false}>
            “{value}” is not a number. Enter a plain decimal such as 24 or 1.5.
          </DfStatus>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <DfField
            label="Root font size (px)"
            htmlFor="unit-root"
            hint="The rem basis. 16 px unless you changed the html font-size."
          >
            <Input
              id="unit-root"
              type="number"
              min={1}
              step="any"
              value={rootPx}
              onChange={(event) => setRootPx(event.target.value)}
            />
          </DfField>
          <DfField
            label="Parent font size (px)"
            htmlFor="unit-parent"
            hint="The em and % basis: the computed font size of the element's parent."
          >
            <Input
              id="unit-parent"
              type="number"
              min={1}
              step="any"
              value={parentPx}
              onChange={(event) => setParentPx(event.target.value)}
            />
          </DfField>
          <DfField label="Decimal places" htmlFor="unit-decimals">
            <Input
              id="unit-decimals"
              type="number"
              min={0}
              max={8}
              value={decimals}
              onChange={(event) =>
                setDecimals(Math.max(0, Math.min(8, Number(event.target.value) || 0)))
              }
            />
          </DfField>
        </div>

        {valid ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultStat
              label={`${tidy(numeric, 4)}${CSS_UNITS[source].suffix} equals`}
              value={resultText}
              hint={`At a ${tidy(context.rootPx, 4)} px root and a ${tidy(context.parentPx, 4)} px parent.`}
              emphasis
            />
            <div className="grid gap-2">
              <DfStatChips
                items={[
                  { label: 'px', value: tidy(convertUnit(numeric, source, 'px', context), decimals) },
                  { label: 'rem', value: tidy(convertUnit(numeric, source, 'rem', context), decimals) },
                  { label: 'em', value: tidy(convertUnit(numeric, source, 'em', context), decimals) },
                  { label: 'pt', value: tidy(convertUnit(numeric, source, 'pt', context), decimals) },
                  {
                    label: '%',
                    value: tidy(convertUnit(numeric, source, 'percent', context), decimals),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}

        {valid ? (
          <Formula caption="The conversion with your own numbers substituted in.">
            {unitFormula(numeric, source, target, context, decimals)}
          </Formula>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Bulk rewrite a stylesheet"
        description="Paste CSS and every matching length is converted at once. Strings, comments and url() bodies are copied through untouched, and each category of value can be left alone."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={bulkOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setBulkOpen((open) => !open)}
            aria-expanded={bulkOpen}
          >
            {bulkOpen ? 'Hide bulk mode' : 'Open bulk mode'}
          </Button>
          {bulkOpen ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCss(CSS_BULK_SAMPLE)}
              >
                <Wand2 className="size-4" aria-hidden="true" />
                Load sample CSS
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={css === ''}
                onClick={() => setCss('')}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Clear
              </Button>
            </>
          ) : null}
        </div>

        {bulkOpen ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <Switch id="bulk-zero" checked={skipZero} onCheckedChange={setSkipZero} />
                <Label htmlFor="bulk-zero" className="text-sm">
                  Leave 0 alone
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="bulk-hairline"
                  checked={skipHairlines}
                  onCheckedChange={setSkipHairlines}
                />
                <Label htmlFor="bulk-hairline" className="text-sm">
                  Leave 1–2 px hairlines alone
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="bulk-media" checked={skipMedia} onCheckedChange={setSkipMedia} />
                <Label htmlFor="bulk-media" className="text-sm">
                  Leave media queries alone
                </Label>
              </div>
            </div>

            <DfField
              label="Only these properties"
              htmlFor="bulk-props"
              hint="Comma-separated, e.g. font-size, line-height, letter-spacing. Leave blank for all."
            >
              <Input
                id="bulk-props"
                value={properties}
                onChange={(event) => setProperties(event.target.value)}
                placeholder="font-size, line-height"
                className="font-mono"
              />
            </DfField>

            <div className="grid gap-4 lg:grid-cols-2">
              <DfCodePane
                label="Your CSS"
                value={css}
                onChange={setCss}
                rows={16}
                wrap={false}
                placeholder={'.card {\n  padding: 24px;\n  font-size: 14px;\n}'}
              />
              <DfCodePane
                label="Rewritten CSS"
                value={bulk?.css ?? ''}
                readOnly
                rows={16}
                wrap={false}
                actions={
                  bulk ? (
                    <DownloadButton
                      blob={bulkBlob}
                      filename="rewritten.css"
                      label="Download"
                      variant="outline"
                      size="sm"
                    />
                  ) : null
                }
                placeholder="The rewritten stylesheet appears here."
              />
            </div>

            {bulk ? (
              <DfStatChips
                items={[
                  { label: 'Converted', value: String(bulk.converted) },
                  { label: 'Left alone', value: String(bulk.skipped) },
                  ...Object.entries(bulk.skippedReasons).map(([reason, count]) => ({
                    label: reason,
                    value: String(count),
                  })),
                ]}
              />
            ) : null}
          </>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Reference table"
        description={`Every common size at a ${tidy(context.rootPx, 4)} px root font size. Change the root above and the whole table re-computes.`}
      >
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">
              Pixel values converted to rem, em, points and percent
            </caption>
            <thead>
              <tr className="bg-muted">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  px
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  rem
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  em
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  pt
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px] tabular-nums">
              {rows.map((row) => (
                <tr key={row.px} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-semibold text-foreground">
                    {row.px}px
                  </th>
                  <td className="px-3 py-1.5">{row.rem}rem</td>
                  <td className="px-3 py-1.5">{row.em}em</td>
                  <td className="px-3 py-1.5">{row.pt}pt</td>
                  <td className="px-3 py-1.5">{row.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CopyButton
          value={rows.map((row) => `${row.px}px = ${row.rem}rem = ${row.pt}pt`).join('\n')}
          label="Copy table as text"
        />
      </ToolPanel>

      <DfProofPanel subject="CSS" />
    </div>
  )
}
