import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceStrict, formatDistanceToNowStrict } from 'date-fns'
import { AlarmClock, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { Field, StatChips } from './DevUi'
import type { ParsedCron } from './cronlib'
import { CronError, FIELD_HELP, PRESETS, describeCron, nextRuns, parseCron } from './cronlib'

const SIX_LABELS = ['Second', 'Minute', 'Hour', 'Day of month', 'Month', 'Day of week']
const FIVE_LABELS = SIX_LABELS.slice(1)

export default function CronExpressionParser() {
  const [expression, setExpression] = useState('0 9 * * 1-5')
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const parts = useMemo(() => expression.trim().split(/\s+/).filter(Boolean), [expression])
  const hasSeconds = parts.length === 6
  const labels = hasSeconds ? SIX_LABELS : FIVE_LABELS

  const parsed = useMemo<{ cron: ParsedCron | null; error: string | null; field: string | null }>(() => {
    try {
      return { cron: parseCron(expression), error: null, field: null }
    } catch (error) {
      if (error instanceof CronError) return { cron: null, error: error.message, field: error.field ?? null }
      return { cron: null, error: error instanceof Error ? error.message : String(error), field: null }
    }
  }, [expression])

  const description = useMemo(
    () => (parsed.cron ? describeCron(parsed.cron) : ''),
    [parsed.cron],
  )

  const runs = useMemo(
    () => (parsed.cron && now ? nextRuns(parsed.cron, now, 10) : []),
    [parsed.cron, now],
  )

  const setPart = useCallback(
    (index: number, value: string) => {
      const next = [...parts]
      while (next.length <= index) next.push('*')
      next[index] = value.trim() || '*'
      setExpression(next.join(' '))
    },
    [parts],
  )

  const toggleSeconds = useCallback(
    (on: boolean) => {
      const current = expression.trim().split(/\s+/).filter(Boolean)
      if (on && current.length === 5) setExpression(['0', ...current].join(' '))
      if (!on && current.length === 6) setExpression(current.slice(1).join(' '))
    },
    [expression],
  )

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'your local timezone'
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="Cron expression"
        description="Type an expression, edit a single field, or start from a preset. Five fields is standard crontab; six adds seconds."
      >
        <Field
          label="Expression"
          htmlFor="cron-expression"
          hint="Shortcuts such as @daily, @hourly and @weekly are expanded automatically."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="cron-expression"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="0 9 * * 1-5"
              className="flex-1 font-mono text-base"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={parsed.error !== null}
            />
            <CopyButton value={expression} label="Copy" size="default" />
          </div>
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Presets" htmlFor="cron-preset" className="sm:max-w-xs sm:flex-1">
            <Select
              onValueChange={(value) => {
                const preset = PRESETS.find((p) => p.label === value)
                if (preset) setExpression(preset.expression)
              }}
            >
              <SelectTrigger id="cron-preset">
                <SelectValue placeholder="Choose a common schedule…" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="cron-seconds" checked={hasSeconds} onCheckedChange={toggleSeconds} />
            <Label htmlFor="cron-seconds" className="text-sm">
              Include a seconds field
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {labels.map((label, index) => (
            <Field key={label} label={label} htmlFor={`cron-field-${index}`}>
              <Input
                id={`cron-field-${index}`}
                value={parts[index] ?? '*'}
                onChange={(event) => setPart(index, event.target.value)}
                className="text-center font-mono"
                spellCheck={false}
                aria-invalid={parsed.field === label}
              />
            </Field>
          ))}
        </div>

        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          {parsed.error ? (
            <ErrorNote title="This expression is not valid" message={parsed.error} />
          ) : (
            <>
              <p className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Valid {hasSeconds ? '6-field' : '5-field'} expression
              </p>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-lg font-medium text-pretty">{description}</p>
              </div>
            </>
          )}
        </div>
      </ToolPanel>

      {parsed.cron ? (
        <ToolPanel
          title="Next 10 run times"
          description={`Calculated in ${timezone}. A real cron daemon uses the server timezone or CRON_TZ, so confirm that before relying on these.`}
        >
          {runs.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted p-6 text-sm text-muted-foreground">
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
              {now
                ? 'This schedule has no run time in the next eight years. The day-of-month and month combination can never occur (30 February, for example).'
                : 'Calculating…'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="min-w-[14rem]">Local date and time</TableHead>
                      <TableHead className="min-w-[8rem]">From now</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run, index) => (
                      <TableRow key={run.toISOString()}>
                        <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-mono text-[13px]">
                          {format(run, 'EEE d MMM yyyy, HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNowStrict(run, { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatChips
                  items={[
                    { label: 'Next run', value: format(runs[0], 'HH:mm:ss') },
                    {
                      label: 'Interval',
                      value: runs.length > 1 ? formatDistanceStrict(runs[1], runs[0]) : '–',
                    },
                    { label: 'Timezone', value: timezone },
                  ]}
                />
                <CopyButton
                  value={runs.map((r) => format(r, "yyyy-MM-dd'T'HH:mm:ssXXX")).join('\n')}
                  label="Copy run times"
                />
              </div>
            </>
          )}
        </ToolPanel>
      ) : null}

      <ToolPanel
        title="Field reference"
        description="What each position means and which values it accepts."
      >
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[8rem]">Field</TableHead>
                <TableHead className="w-24">Range</TableHead>
                <TableHead className="min-w-[14rem]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELD_HELP.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="font-mono text-[13px]">{row.range}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.note || '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Syntax</TableHead>
                <TableHead>Meaning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ['*', 'Every value the field allows'],
                  ['5', 'Exactly that value'],
                  ['1,15,30', 'A list: any of these values'],
                  ['1-5', 'An inclusive range'],
                  ['*/15', 'A step: every 15th value, starting from the lowest'],
                  ['10-40/5', 'A step inside a range: 10, 15, 20 … 40'],
                  ['MON-FRI', 'Three-letter day names, in the day-of-week field'],
                  ['JAN,JUL', 'Three-letter month names, in the month field'],
                  ['?', 'Treated as * in the two day fields'],
                ] as [string, string][]
              ).map(([syntax, meaning]) => (
                <TableRow key={syntax}>
                  <TableCell className="font-mono text-[13px]">{syntax}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{meaning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground text-pretty">
          <AlarmClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {/* The prose needs its own span: as direct children of a flex box the
              text runs and the <strong>/<code>/<em> elements each become a
              separate flex item laid out in a non-wrapping row, which pushed
              the page sideways at 360 px. */}
          <span className="min-w-0">
            When both the day-of-month and the day-of-week field are restricted, classic Vixie cron runs
            the job when <strong>either</strong> matches, not both.{' '}
            <code className="font-mono">0 0 1 * MON</code> therefore fires on the 1st of the month{' '}
            <em>and</em> on every Monday.
          </span>
        </p>
      </ToolPanel>
    </div>
  )
}
