import { useMemo, useState } from 'react'
import { Bed, Moon, Sunrise } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'
import { useMounted, useNow } from './common'
import { pad2, parseTimeInput } from './tz'

const CYCLES = [6, 5, 4, 3]
const WAKE_CYCLES = [3, 4, 5, 6, 7]

interface Option {
  cycles: number
  at: Date
  sleepMinutes: number
}

function formatClock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function dayLabel(target: Date, from: Date): string {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const diff = Math.round((b - a) / 86_400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return target.toLocaleDateString('en-US', { weekday: 'long' })
}

function humanDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** The next time the clock reads `hour:minute`, starting from `from`. */
function nextOccurrence(from: Date, hour: number, minute: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute, 0, 0)
  if (candidate.getTime() <= from.getTime()) candidate.setDate(candidate.getDate() + 1)
  return candidate
}

export default function SleepCalculator() {
  const mounted = useMounted()
  const now = useNow(30_000)
  const [wakeTime, setWakeTime] = useState('07:00')
  const [bedTime, setBedTime] = useState('23:00')
  const [cycleLength, setCycleLength] = useState('90')
  const [fallAsleep, setFallAsleep] = useState('15')

  const cycleMinutes = Math.min(180, Math.max(30, Number(cycleLength) || 90))
  const latency = Math.min(120, Math.max(0, Number(fallAsleep) || 0))
  const reference = mounted && now.getTime() > 0 ? now : new Date()

  const wakeParsed = parseTimeInput(wakeTime)
  const bedParsed = parseTimeInput(bedTime)

  const bedtimeOptions = useMemo<Option[]>(() => {
    if (!wakeParsed) return []
    const wake = nextOccurrence(reference, wakeParsed.hour, wakeParsed.minute)
    return CYCLES.map((cycles) => {
      const sleepMinutes = cycles * cycleMinutes
      const at = new Date(wake.getTime() - (sleepMinutes + latency) * 60_000)
      return { cycles, at, sleepMinutes }
    })
  }, [wakeParsed, reference, cycleMinutes, latency])

  const wakeOptions = useMemo<Option[]>(() => {
    if (!bedParsed) return []
    const bed = nextOccurrence(reference, bedParsed.hour, bedParsed.minute)
    return WAKE_CYCLES.map((cycles) => {
      const sleepMinutes = cycles * cycleMinutes
      const at = new Date(bed.getTime() + (latency + sleepMinutes) * 60_000)
      return { cycles, at, sleepMinutes }
    })
  }, [bedParsed, reference, cycleMinutes, latency])

  const sleepNowOptions = useMemo<Option[]>(() => {
    return WAKE_CYCLES.map((cycles) => {
      const sleepMinutes = cycles * cycleMinutes
      const at = new Date(reference.getTime() + (latency + sleepMinutes) * 60_000)
      return { cycles, at, sleepMinutes }
    })
  }, [reference, cycleMinutes, latency])

  if (!mounted) {
    return (
      <div className="rounded-xl bg-muted p-10 text-center">
        <Moon className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">Reading your device clock…</p>
      </div>
    )
  }

  const settings = (
    <div className="mt-4 grid gap-4 rounded-lg bg-muted p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="sc-latency">Minutes to fall asleep</Label>
        <Input
          id="sc-latency"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          value={fallAsleep}
          onChange={(e) => setFallAsleep(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">10–20 minutes is typical for a healthy adult.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sc-cycle">Sleep cycle length (minutes)</Label>
        <Input
          id="sc-cycle"
          type="number"
          inputMode="numeric"
          min={30}
          max={180}
          step={5}
          value={cycleLength}
          onChange={(e) => setCycleLength(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">90 minutes is the adult average; real cycles run 70–120.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Tabs defaultValue="wake" className="w-full">
        {/* The three labels do not fit on one 360 px row at the default tab
            size, and TabsTrigger is `whitespace-nowrap`, so the row widened the
            page. Dropping a step of type below `sm` keeps all three readable
            and on one line. */}
        <TabsList className="w-full">
          <TabsTrigger value="wake" className="flex-1 text-xs sm:text-sm">
            I must wake up at…
          </TabsTrigger>
          <TabsTrigger value="bed" className="flex-1 text-xs sm:text-sm">
            I go to bed at…
          </TabsTrigger>
          <TabsTrigger value="now" className="flex-1 text-xs sm:text-sm">
            If I sleep now
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wake" className="mt-4 space-y-6">
          <ToolPanel title="Wake-up time" description="We work backwards in whole sleep cycles so you wake between cycles, not mid-deep-sleep.">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="sc-wake">Wake up at</Label>
              <Input id="sc-wake" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </div>
            {settings}
          </ToolPanel>

          {!wakeParsed ? (
            <ErrorNote message="Enter a wake-up time as HH:MM." />
          ) : (
            <OptionList
              title="Go to bed at one of these times"
              icon={<Moon className="h-5 w-5 text-foreground" aria-hidden="true" />}
              options={bedtimeOptions}
              reference={reference}
              latency={latency}
              mode="bed"
            />
          )}
        </TabsContent>

        <TabsContent value="bed" className="mt-4 space-y-6">
          <ToolPanel title="Bedtime" description="Enter when you get into bed. The tool adds the time you take to fall asleep.">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="sc-bed">Go to bed at</Label>
              <Input id="sc-bed" type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} />
            </div>
            {settings}
          </ToolPanel>

          {!bedParsed ? (
            <ErrorNote message="Enter a bedtime as HH:MM." />
          ) : (
            <OptionList
              title="Set your alarm for one of these times"
              icon={<Sunrise className="h-5 w-5 text-foreground" aria-hidden="true" />}
              options={wakeOptions}
              reference={reference}
              latency={latency}
              mode="wake"
            />
          )}
        </TabsContent>

        <TabsContent value="now" className="mt-4 space-y-6">
          <ToolPanel
            title="Sleeping right now"
            description={
              mounted
                ? `Based on the current time, ${formatClock(reference)}, plus ${latency} minutes to fall asleep.`
                : 'Reading the clock…'
            }
          >
            {settings}
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setBedTime(formatClock(new Date()))}>
                <Bed className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy this time into the bedtime tab
              </Button>
            </div>
          </ToolPanel>

          <OptionList
            title="If you fall asleep now, wake up at"
            icon={<Sunrise className="h-5 w-5 text-foreground" aria-hidden="true" />}
            options={sleepNowOptions}
            reference={reference}
            latency={latency}
            mode="wake"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OptionList({
  title,
  icon,
  options,
  reference,
  latency,
  mode,
}: {
  title: string
  icon: React.ReactNode
  options: Option[]
  reference: Date
  latency: number
  mode: 'bed' | 'wake'
}) {
  if (options.length === 0) return null
  const copyValue = [
    title,
    ...options.map(
      (o) =>
        `${formatClock(o.at)} (${dayLabel(o.at, reference)}): ${o.cycles} cycles, ${humanDuration(o.sleepMinutes)} of sleep`,
    ),
    `Includes ${latency} minutes to fall asleep.`,
  ].join('\n')

  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const recommended = o.cycles === 5 || o.cycles === 6
          return (
            <li
              key={o.cycles}
              className={cn(
                'rounded-xl bg-card p-4',
                recommended && 'ring-2 ring-foreground',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">{formatClock(o.at)}</span>
                <span className="text-xs text-muted-foreground">{dayLabel(o.at, reference)}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {o.cycles} sleep cycles · {humanDuration(o.sleepMinutes)}
              </div>
              {recommended ? (
                <div className="mt-2 text-xs font-medium text-foreground">
                  Recommended for adults
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  {o.cycles <= 4 ? 'Short night, fine occasionally' : 'Long night, good for recovery'}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {mode === 'bed'
          ? `Each bedtime already allows ${latency} minutes to actually fall asleep.`
          : `Each wake time starts counting ${latency} minutes after you get into bed.`}
      </p>
      <CopyButton value={copyValue} label="Copy these times" />
    </div>
  )
}
