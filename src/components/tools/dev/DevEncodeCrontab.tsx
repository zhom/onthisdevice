import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { EncodeField } from './dev-encode-ui'

/* ------------------------------------------------------------------ */
/* Field model                                                         */
/* ------------------------------------------------------------------ */

interface FieldSpec {
  key: string
  label: string
  min: number
  max: number
  names?: Record<string, number>
  /** Short labels for the chip picker, indexed from `min`. */
  chips?: string[]
  hint: string
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const SECOND_FIELD: FieldSpec = {
  key: 'second',
  label: 'Seconds',
  min: 0,
  max: 59,
  hint: 'Quartz only. Standard Unix cron has no seconds field.',
}

const BASE_FIELDS: FieldSpec[] = [
  { key: 'minute', label: 'Minute', min: 0, max: 59, hint: '0–59' },
  { key: 'hour', label: 'Hour', min: 0, max: 23, hint: '0–23, 24-hour clock' },
  { key: 'dom', label: 'Day of month', min: 1, max: 31, hint: '1–31' },
  {
    key: 'month',
    label: 'Month',
    min: 1,
    max: 12,
    names: Object.fromEntries(MONTH_NAMES.map((name, index) => [name, index + 1])),
    chips: MONTH_NAMES,
    hint: '1–12, or JAN–DEC',
  },
  {
    key: 'dow',
    label: 'Day of week',
    min: 0,
    max: 6,
    names: Object.fromEntries(DOW_NAMES.map((name, index) => [name, index])),
    chips: DOW_NAMES,
    hint: '0–6 with 0 = Sunday (7 is also accepted), or SUN–SAT',
  },
]

/** Expands one cron field to the sorted set of values it matches. */
function expandField(raw: string, spec: FieldSpec): number[] {
  const text = raw.trim()
  if (text.length === 0) throw new Error(`The ${spec.label.toLowerCase()} field is empty.`)
  const out = new Set<number>()
  for (const part of text.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart === undefined ? 1 : Number(stepPart)
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`“/${stepPart}” is not a valid step in the ${spec.label.toLowerCase()} field.`)
    }
    let from: number
    let to: number
    if (rangePart === '*' || rangePart === '?') {
      from = spec.min
      to = spec.max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      from = resolveValue(a, spec)
      to = resolveValue(b, spec)
      if (to < from) {
        throw new Error(
          `${rangePart} counts backwards in the ${spec.label.toLowerCase()} field. Write two entries instead, like ${b}-${spec.max},${spec.min}-${a}.`,
        )
      }
    } else {
      from = resolveValue(rangePart, spec)
      to = stepPart === undefined ? from : spec.max
    }
    for (let value = from; value <= to; value += step) out.add(value)
  }
  return [...out].sort((a, b) => a - b)
}

function resolveValue(token: string, spec: FieldSpec): number {
  const upper = token.trim().toUpperCase()
  if (spec.names && upper in spec.names) return spec.names[upper]
  if (!/^\d+$/.test(upper)) {
    throw new Error(
      `“${token}” is not valid in the ${spec.label.toLowerCase()} field. Allowed: ${spec.hint}.`,
    )
  }
  let value = Number(upper)
  if (spec.key === 'dow' && value === 7) value = 0
  if (value < spec.min || value > spec.max) {
    throw new Error(
      `${value} is out of range for the ${spec.label.toLowerCase()} field (${spec.min}–${spec.max}).`,
    )
  }
  return value
}

/* ------------------------------------------------------------------ */
/* Human description                                                   */
/* ------------------------------------------------------------------ */

function listPhrase(values: number[], spec: FieldSpec, all: number): string {
  if (values.length === all) return 'every ' + spec.label.toLowerCase()
  const render = (value: number) =>
    spec.key === 'dow'
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][value]
      : spec.key === 'month'
        ? [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ][value - 1]
        : String(value)
  if (values.length === 1) return render(values[0])
  const consecutive = values.every((value, index) => index === 0 || value === values[index - 1] + 1)
  if (consecutive && values.length > 2) return `${render(values[0])} through ${render(values[values.length - 1])}`
  return `${values.slice(0, -1).map(render).join(', ')} and ${render(values[values.length - 1])}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function describeExpression(fields: string[], specs: FieldSpec[]): string {
  const sets = specs.map((spec, index) => expandField(fields[index], spec))
  const byKey = Object.fromEntries(specs.map((spec, index) => [spec.key, sets[index]])) as Record<
    string,
    number[]
  >
  const rawByKey = Object.fromEntries(specs.map((spec, index) => [spec.key, fields[index].trim()]))

  const minutes = byKey.minute
  const hours = byKey.hour
  const seconds = byKey.second

  let time: string
  if (minutes.length === 60 && hours.length === 24) {
    time = seconds && seconds.length < 60 ? `At second ${listPhrase(seconds, SECOND_FIELD, 60)} of every minute` : 'Every minute'
  } else if (hours.length === 24 && rawByKey.minute.startsWith('*/')) {
    time = `Every ${rawByKey.minute.slice(2)} minutes`
  } else if (hours.length === 24) {
    time = `At minute ${minutes.join(', ')} of every hour`
  } else if (minutes.length === 60) {
    time = `Every minute of hour ${hours.map(pad).join(', ')}`
  } else if (minutes.length * hours.length <= 12) {
    const stamps: string[] = []
    for (const hour of hours) for (const minute of minutes) stamps.push(`${pad(hour)}:${pad(minute)}`)
    time = `At ${stamps.join(', ')}`
  } else {
    time = `At minute ${minutes.join(', ')} past hour ${hours.map(pad).join(', ')}`
  }

  const parts: string[] = [time]
  const domRestricted = rawByKey.dom !== '*' && rawByKey.dom !== '?'
  const dowRestricted = rawByKey.dow !== '*' && rawByKey.dow !== '?'
  const domSpec = specs.find((spec) => spec.key === 'dom')!
  const dowSpec = specs.find((spec) => spec.key === 'dow')!
  const monthSpec = specs.find((spec) => spec.key === 'month')!

  if (domRestricted && dowRestricted) {
    parts.push(
      `on day-of-month ${listPhrase(byKey.dom, domSpec, 31)} **or** on ${listPhrase(byKey.dow, dowSpec, 7)}`,
    )
  } else if (domRestricted) {
    parts.push(`on day-of-month ${listPhrase(byKey.dom, domSpec, 31)}`)
  } else if (dowRestricted) {
    parts.push(`on ${listPhrase(byKey.dow, dowSpec, 7)}`)
  }

  if (rawByKey.month !== '*' && rawByKey.month !== '?') {
    parts.push(`in ${listPhrase(byKey.month, monthSpec, 12)}`)
  }

  return parts.join(' ').replace(/\*\*/g, '')
}

/* ------------------------------------------------------------------ */
/* Next run times                                                      */
/* ------------------------------------------------------------------ */

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function zoneParts(timestamp: number, timeZone: string): ZonedParts & { second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function zoneOffset(timestamp: number, timeZone: string): number {
  const parts = zoneParts(timestamp, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(timestamp / 1000) * 1000
}

/** Turns a wall-clock time in `timeZone` into a UTC timestamp. */
function wallToUtc(parts: ZonedParts, timeZone: string): number {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  const offset = zoneOffset(guess, timeZone)
  let timestamp = guess - offset
  const corrected = zoneOffset(timestamp, timeZone)
  if (corrected !== offset) timestamp = guess - corrected
  return timestamp
}

function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function nextRuns(
  fields: string[],
  specs: FieldSpec[],
  timeZone: string,
  count: number,
  now: number,
): { timestamp: number; label: string }[] {
  const sets = Object.fromEntries(
    specs.map((spec, index) => [spec.key, new Set(expandField(fields[index], spec))]),
  ) as Record<string, Set<number>>
  const raw = Object.fromEntries(specs.map((spec, index) => [spec.key, fields[index].trim()]))
  const domRestricted = raw.dom !== '*' && raw.dom !== '?'
  const dowRestricted = raw.dow !== '*' && raw.dow !== '?'

  const start = zoneParts(now, timeZone)
  const results: { timestamp: number; label: string }[] = []

  let { year, month, day } = start
  for (let dayIndex = 0; dayIndex < 1500 && results.length < count; dayIndex += 1) {
    const monthOk = sets.month.has(month)
    const dowValue = dayOfWeek(year, month, day)
    const dayOk = monthOk
      ? domRestricted && dowRestricted
        ? sets.dom.has(day) || sets.dow.has(dowValue)
        : domRestricted
          ? sets.dom.has(day)
          : dowRestricted
            ? sets.dow.has(dowValue)
            : true
      : false

    if (dayOk) {
      for (const hour of [...sets.hour].sort((a, b) => a - b)) {
        for (const minute of [...sets.minute].sort((a, b) => a - b)) {
          const timestamp = wallToUtc({ year, month, day, hour, minute }, timeZone)
          if (timestamp <= now) continue
          results.push({
            timestamp,
            label: new Intl.DateTimeFormat('en-GB', {
              timeZone,
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date(timestamp)),
          })
          if (results.length >= count) break
        }
        if (results.length >= count) break
      }
    }

    day += 1
    if (day > daysInMonth(year, month)) {
      day = 1
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }
  }
  return results
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

const PRESETS: { expression: string; label: string }[] = [
  { expression: '* * * * *', label: 'Every minute' },
  { expression: '*/5 * * * *', label: 'Every 5 minutes' },
  { expression: '*/15 * * * *', label: 'Every 15 minutes' },
  { expression: '0 * * * *', label: 'Every hour, on the hour' },
  { expression: '0 0 * * *', label: 'Every day at midnight' },
  { expression: '30 2 * * *', label: 'Daily at 02:30' },
  { expression: '0 9 * * 1-5', label: 'Weekdays at 09:00' },
  { expression: '0 0 * * 0', label: 'Every Sunday at midnight' },
  { expression: '0 0 1 * *', label: 'First of the month' },
  { expression: '0 0 1 1 *', label: 'Once a year, 1 January' },
  { expression: '0 */6 * * *', label: 'Every six hours' },
  { expression: '15 3 * * 6', label: 'Saturdays at 03:15' },
]

const TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

/* ------------------------------------------------------------------ */
/* Field editor                                                        */
/* ------------------------------------------------------------------ */

type FieldMode = 'every' | 'step' | 'specific' | 'range' | 'custom'

function detectMode(value: string): FieldMode {
  const text = value.trim()
  if (text === '*' || text === '?') return 'every'
  if (/^\*\/\d+$/.test(text)) return 'step'
  if (/^[0-9A-Za-z]+-[0-9A-Za-z]+$/.test(text)) return 'range'
  if (/^[0-9A-Za-z]+(,[0-9A-Za-z]+)*$/.test(text)) return 'specific'
  return 'custom'
}

function FieldEditor({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec
  value: string
  onChange: (next: string) => void
}) {
  const mode = detectMode(value)
  const chipValues = spec.chips
    ? spec.chips.map((label, index) => ({ label, value: index + spec.min }))
    : spec.max - spec.min <= 31
      ? Array.from({ length: spec.max - spec.min + 1 }, (_, index) => ({
          label: String(index + spec.min),
          value: index + spec.min,
        }))
      : null

  let selected: number[] = []
  try {
    selected = mode === 'specific' ? expandField(value, spec) : []
  } catch {
    selected = []
  }

  const toggleChip = (chip: number) => {
    const next = selected.includes(chip)
      ? selected.filter((entry) => entry !== chip)
      : [...selected, chip].sort((a, b) => a - b)
    onChange(next.length === 0 ? '*' : next.join(','))
  }

  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`cron-${spec.key}`} className="text-sm font-medium">
          {spec.label}
        </Label>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {value}
        </code>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Select
          value={mode}
          onValueChange={(next) => {
            if (next === 'every') onChange('*')
            else if (next === 'step') onChange('*/5')
            else if (next === 'range') onChange(`${spec.min}-${spec.max}`)
            else if (next === 'specific') onChange(String(spec.min))
          }}
        >
          <SelectTrigger id={`cron-${spec.key}`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="every">Every</SelectItem>
            <SelectItem value="step">Every N</SelectItem>
            <SelectItem value="specific">Specific</SelectItem>
            <SelectItem value="range">Range</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        {mode === 'step' ? (
          <Input
            aria-label={`${spec.label} step`}
            className="w-24 font-mono"
            inputMode="numeric"
            value={value.replace('*/', '')}
            onChange={(event) => onChange(`*/${event.target.value.replace(/\D/g, '') || '1'}`)}
          />
        ) : null}

        {mode === 'range' ? (
          <div className="flex items-center gap-1.5">
            <Input
              aria-label={`${spec.label} range start`}
              className="w-20 font-mono"
              value={value.split('-')[0] ?? ''}
              onChange={(event) => onChange(`${event.target.value}-${value.split('-')[1] ?? spec.max}`)}
            />
            <span className="text-muted-foreground">to</span>
            <Input
              aria-label={`${spec.label} range end`}
              className="w-20 font-mono"
              value={value.split('-')[1] ?? ''}
              onChange={(event) => onChange(`${value.split('-')[0] ?? spec.min}-${event.target.value}`)}
            />
          </div>
        ) : null}

        {mode === 'custom' ? (
          <Input
            aria-label={`${spec.label} expression`}
            className="w-48 font-mono"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </div>

      {mode === 'specific' && chipValues ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chipValues.map((chip) => {
            const active = selected.includes(chip.value)
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleChip(chip.value)}
                className={cn(
                  'min-w-9 cursor-pointer rounded-md px-2 py-1 font-mono text-xs transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {mode === 'specific' && !chipValues ? (
        <Input
          aria-label={`${spec.label} values`}
          className="mt-2 font-mono"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0,15,30,45"
        />
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">{spec.hint}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevEncodeCrontab() {
  /* The raw text is the single source of truth, so typing in the expression box
     is never fought by the builders below it. */
  const [expression, setExpression] = useState('0 9 * * 1-5')
  const [command, setCommand] = useState('/usr/local/bin/backup.sh >> /var/log/backup.log 2>&1')
  // The browser's zone and the next run times depend on the visitor's clock,
  // so they are filled in after mount; the server renders a stable UTC view.
  const [timeZone, setTimeZone] = useState('UTC')
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    } catch {
      /* keep UTC */
    }
    setNow(Date.now())
  }, [])

  const parts = expression.trim().length === 0 ? [] : expression.trim().split(/\s+/)
  const quartz = parts.length >= 6
  const specs = quartz ? [SECOND_FIELD, ...BASE_FIELDS] : BASE_FIELDS
  const allFields = specs.map((_, index) => parts[index] ?? '*')
  const fieldCountOk = parts.length === specs.length

  const setField = useCallback(
    (index: number, next: string) => {
      setExpression((current) => {
        const currentParts = current.trim().split(/\s+/)
        const count = currentParts.length >= 6 ? 6 : 5
        const padded = Array.from({ length: count }, (_, i) => currentParts[i] ?? '*')
        padded[index] = next.trim() || '*'
        return padded.join(' ')
      })
    },
    [],
  )

  const toggleQuartz = useCallback((enabled: boolean) => {
    setExpression((current) => {
      const currentParts = current.trim().split(/\s+/)
      if (enabled) {
        return currentParts.length >= 6 ? current : ['0', ...currentParts.slice(0, 5)].join(' ')
      }
      return currentParts.length >= 6 ? currentParts.slice(1, 6).join(' ') : current
    })
  }, [])

  const analysis = useMemo(() => {
    try {
      if (!fieldCountOk) {
        throw new Error(
          `A ${quartz ? 'Quartz' : 'cron'} expression needs ${specs.length} fields separated by spaces. This one has ${parts.length}. Order: ${specs.map((spec) => spec.label.toLowerCase()).join(', ')}.`,
        )
      }
      return {
        description: describeExpression(allFields, specs),
        runs: now === null ? [] : nextRuns(allFields, specs, timeZone, 10, now),
        error: null as string | null,
      }
    } catch (error) {
      return {
        description: '',
        runs: [],
        error: error instanceof Error ? error.message : 'That expression could not be parsed.',
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, timeZone, fieldCountOk, now])

  const crontabLine = `${expression} ${command}`

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Your expression"
        description="Build it below, or type one in. The builders follow what you paste."
      >
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
          <Label htmlFor="cron-expression" className="text-sm">
            Cron expression
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="cron-expression"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              className="min-w-0 flex-1 font-mono text-lg"
              spellCheck={false}
              aria-invalid={analysis.error ? true : undefined}
            />
            <CopyButton value={expression} label="Copy" />
          </div>
          <p
            className="text-[15px] leading-6 font-medium text-pretty text-foreground"
            role="status"
            aria-live="polite"
          >
            {analysis.error ? '–' : analysis.description}
          </p>
        </div>

        {analysis.error ? <ErrorNote title="Invalid expression" message={analysis.error} /> : null}

        <div className="flex items-center gap-2">
          <Switch
            id="quartz-mode"
            checked={quartz}
            onCheckedChange={toggleQuartz}
          />
          <Label htmlFor="quartz-mode" className="text-sm">
            Quartz mode: add a seconds field (Java, Spring, Jenkins)
          </Label>
        </div>
      </ToolPanel>

      <ToolPanel title="Build it field by field">
        <div className="grid gap-3 sm:grid-cols-2">
          {specs.map((spec, index) => (
            <FieldEditor
              key={spec.key}
              spec={spec}
              value={allFields[index]}
              onChange={(next) => setField(index, next)}
            />
          ))}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Next 10 runs"
        description="Computed from your device clock in the timezone you choose. cron on a server uses that machine's timezone, which is the most common reason a job fires an hour early or late."
        footer={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            Times shown in {timeZone}
          </span>
        }
      >
        <EncodeField label="Timezone" htmlFor="cron-tz" className="max-w-72">
          <Select value={timeZone} onValueChange={setTimeZone}>
            <SelectTrigger id="cron-tz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...new Set([timeZone, ...TIMEZONES])].map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EncodeField>

        {analysis.runs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Local time in {timeZone}</TableHead>
                  <TableHead className="text-right">In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.runs.map((run, index) => {
                  const deltaMinutes = Math.round((run.timestamp - (now ?? run.timestamp)) / 60000)
                  const inText =
                    deltaMinutes < 60
                      ? `${Math.max(0, deltaMinutes)} min`
                      : deltaMinutes < 60 * 48
                        ? `${Math.round(deltaMinutes / 60)} h`
                        : `${Math.round(deltaMinutes / 1440)} days`
                  return (
                    <TableRow key={run.timestamp}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono">{run.label}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{inText}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {analysis.error
              ? 'Fix the expression to see the schedule.'
              : 'This expression has no run times in the next four years. Check the day-of-month and month combination (31 February never happens).'}
          </p>
        )}
      </ToolPanel>

      <ToolPanel
        title="The crontab line"
        description="Paste this under crontab -e. Redirecting output is what stops cron emailing you on every run."
      >
        <EncodeField
          label="Command to run"
          htmlFor="cron-command"
          hint="Use absolute paths. Cron runs with a minimal PATH and no shell profile."
        >
          <Input
            id="cron-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="font-mono text-sm"
          />
        </EncodeField>
        <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-muted px-3 py-2">
          <code className="min-w-0 flex-1 font-mono text-sm break-all text-foreground">
            {crontabLine}
          </code>
          <CopyButton value={crontabLine} label="Copy" variant="ghost" />
        </div>
        {quartz ? (
          <Alert role="note">
            <AlertTitle>Quartz is not Unix cron</AlertTitle>
            <AlertDescription>
              Quartz expressions have six or seven fields and use <code>?</code> in whichever of
              day-of-month or day-of-week you are not constraining. Quartz also numbers days of the
              week 1–7 with 1 = Sunday, unlike Unix cron's 0–6. This page computes the schedule with
              Unix semantics, so treat the run times as a guide when Quartz mode is on.
            </AlertDescription>
          </Alert>
        ) : null}
      </ToolPanel>

      <ToolPanel title="Presets" description="Click to load.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => (
            <Button
              key={preset.expression}
              variant="outline"
              className="h-auto justify-start gap-2 py-2 text-left"
              onClick={() => {
                setExpression(preset.expression)
              }}
            >
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-mono text-xs">{preset.expression}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {preset.label}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </ToolPanel>
    </div>
  )
}
