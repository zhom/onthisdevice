import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CircleCheck, Link2, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { CopyButton } from '@/components/shared/CopyButton'
import { formatNumber } from '@/components/tools/finance/format'
import { MiniStat, ZonePicker, useMounted, useNow, useZoneState } from './common'
import { breakdownMs, formatFullInZone, formatInZone, getZonedParts, inputsToInstant, pad2, relativeTime, zonedDateInput, zonedPartsToInstant, zonedTimeInput, utcMs } from './tz'
import { upcomingHolidays } from './holidays'

interface Preset {
  label: string
  build: (zone: string) => Date
}

function atZoned(zone: string, days: number, hour: number, minute = 0): Date {
  const now = new Date()
  const p = getZonedParts(now, zone)
  const shifted = new Date(utcMs(p.year, p.month - 1, p.day + days))
  return zonedPartsToInstant(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour,
      minute,
      second: 0,
    },
    zone,
  )
}

const TIME_PRESETS: Preset[] = [
  { label: 'In 1 hour', build: () => new Date(Date.now() + 3_600_000) },
  { label: 'In 24 hours', build: () => new Date(Date.now() + 86_400_000) },
  { label: 'Tomorrow 09:00', build: (z) => atZoned(z, 1, 9) },
  {
    label: 'Next Monday 09:00',
    build: (z) => {
      const p = getZonedParts(new Date(), z)
      const wd = new Date(utcMs(p.year, p.month - 1, p.day)).getUTCDay()
      const delta = ((1 - wd + 7) % 7) || 7
      return atZoned(z, delta, 9)
    },
  },
  {
    label: 'End of this month',
    build: (z) => {
      const p = getZonedParts(new Date(), z)
      const last = new Date(utcMs(p.year, p.month, 0)).getUTCDate()
      return zonedPartsToInstant(
        { year: p.year, month: p.month, day: last, hour: 23, minute: 59, second: 59 },
        z,
      )
    },
  },
]

function encodeState(target: Date, zone: string, title: string): string {
  const params = new URLSearchParams()
  params.set('t', String(target.getTime()))
  params.set('z', zone)
  if (title.trim()) params.set('n', title.trim())
  return `#${params.toString()}`
}

export default function CountdownTimer() {
  const mounted = useMounted()
  const [zone, setZone] = useZoneState()
  const [title, setTitle] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('00:00')
  const [alarmOn, setAlarmOn] = useState(false)
  const [alarmFired, setAlarmFired] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const hydratedFromHash = useRef(false)
  const now = useNow(100)

  // Restore a shared countdown from the URL fragment.
  useEffect(() => {
    if (hydratedFromHash.current) return
    hydratedFromHash.current = true
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const params = new URLSearchParams(hash)
    const t = Number(params.get('t'))
    const z = params.get('z')
    const n = params.get('n')
    if (!Number.isFinite(t) || t <= 0) return
    const instant = new Date(t)
    const useZone = z || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setZone(useZone)
    setDateValue(zonedDateInput(instant, useZone))
    setTimeValue(zonedTimeInput(instant, useZone))
    if (n) setTitle(n)
  }, [setZone])

  const target = useMemo(
    () => (dateValue ? inputsToInstant(dateValue, timeValue, zone) : null),
    [dateValue, timeValue, zone],
  )

  // Keep the address bar in sync so the page can simply be bookmarked.
  useEffect(() => {
    if (!target) return
    const next = encodeState(target, zone, title)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [target, zone, title])

  const remaining = target && mounted ? target.getTime() - now.getTime() : null
  const finished = remaining !== null && remaining <= 0

  const beep = useCallback(() => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      let ctx = audioRef.current
      if (!ctx) {
        ctx = new Ctor()
        audioRef.current = ctx
      }
      void ctx.resume()
      const start = ctx.currentTime
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, start + i * 0.45)
        gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.45 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.45 + 0.35)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start + i * 0.45)
        osc.stop(start + i * 0.45 + 0.4)
      }
    } catch {
      /* audio blocked — the visual "time's up" state still shows */
    }
  }, [])

  useEffect(() => {
    if (!alarmOn || !finished || alarmFired) return
    setAlarmFired(true)
    beep()
  }, [alarmOn, finished, alarmFired, beep])

  useEffect(() => {
    setAlarmFired(false)
  }, [target?.getTime()])

  useEffect(() => () => void audioRef.current?.close(), [])

  const parts = remaining === null ? null : breakdownMs(Math.abs(remaining))
  const totalSeconds = remaining === null ? 0 : Math.floor(Math.abs(remaining) / 1000)

  const milestones = useMemo(() => {
    if (!mounted) return []
    const p = getZonedParts(new Date(), zone)
    return upcomingHolidays({ year: p.year, month: p.month, day: p.day }, 8)
  }, [mounted, zone])

  const applyInstant = (instant: Date) => {
    setDateValue(zonedDateInput(instant, zone))
    setTimeValue(zonedTimeInput(instant, zone))
  }

  const shareUrl = mounted && target ? `${window.location.origin}${window.location.pathname}${encodeState(target, zone, title)}` : ''

  const invalidDate = dateValue.length > 0 && target === null

  return (
    <div className="space-y-6">
      <ToolPanel title="Countdown target" description="Set any date and time. The link in your address bar updates so you can share it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cd-date">Target date</Label>
            <Input id="cd-date" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-time">Target time</Label>
            <Input id="cd-time" type="time" step={1} value={timeValue} onChange={(e) => setTimeValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-title">Event name (optional)</Label>
            <Input
              id="cd-title"
              value={title}
              maxLength={80}
              placeholder="Launch day"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <ZonePicker value={zone} onChange={setZone} label="Timezone of the target" />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Quick presets</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIME_PRESETS.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => applyInstant(p.build(zone))}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {milestones.length > 0 ? (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Upcoming milestones</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {milestones.map((h) => (
                  <Button
                    key={h.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTitle(h.name)
                      setDateValue(
                        `${String(h.date.year).padStart(4, '0')}-${String(h.date.month).padStart(2, '0')}-${String(h.date.day).padStart(2, '0')}`,
                      )
                      setTimeValue('00:00')
                    }}
                  >
                    {h.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
          <Label htmlFor="cd-alarm" className="cursor-pointer text-sm font-normal">
            <BellRing className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            Play an alarm when the countdown reaches zero
          </Label>
          <Switch
            id="cd-alarm"
            checked={alarmOn}
            onCheckedChange={(v) => {
              setAlarmOn(v)
              if (v) beep()
            }}
          />
        </div>
      </ToolPanel>

      {invalidDate ? <ErrorNote message="That target date isn’t valid. Check the day, month and year." /> : null}

      {!target || !mounted || parts === null ? (
        <div className="rounded-xl bg-muted p-8 text-center">
          <Timer className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Pick a date, or tap a preset, to start the countdown.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl bg-card p-5 sm:p-8">
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground">
                {title.trim() ? title.trim() : finished ? 'Time since' : 'Time remaining'}
              </div>
              <div
                className="mt-4 grid grid-cols-4 gap-2 sm:gap-4"
                role="timer"
                aria-live="off"
                aria-label={`${finished ? 'Elapsed' : 'Remaining'}: ${parts.days} days ${parts.hours} hours ${parts.minutes} minutes ${parts.seconds} seconds`}
              >
                {[
                  { v: parts.days, l: parts.days === 1 ? 'day' : 'days' },
                  { v: parts.hours, l: 'hours' },
                  { v: parts.minutes, l: 'minutes' },
                  { v: parts.seconds, l: 'seconds' },
                ].map((cell) => (
                  <div key={cell.l} className="rounded-lg bg-muted px-1 py-3 sm:px-2 sm:py-4">
                    <div className="text-2xl font-bold tabular-nums text-foreground sm:text-5xl">
                      {cell.l === 'days' || cell.l === 'day' ? formatNumber(cell.v, 0) : pad2(cell.v)}
                    </div>
                    <div className="mt-1 text-[0.65rem] text-muted-foreground sm:text-xs">
                      {cell.l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm tabular-nums text-muted-foreground">
                .{String(parts.ms).padStart(3, '0')} seconds
              </div>

              {finished ? (
                <p className="mt-4 flex items-start justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium text-foreground">
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>Time’s up: {formatFullInZone(target, zone)} has passed. The clock above is now counting up.</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Target" value={formatInZone(target, zone, { dateStyle: 'medium', timeStyle: 'short' })} hint={zone} />
            <MiniStat label="In your words" value={relativeTime(target, now)} />
            <MiniStat label="Total seconds" value={formatNumber(totalSeconds, 0)} />
            <MiniStat label="Total hours" value={formatNumber(Math.floor(totalSeconds / 3600), 0)} />
          </div>

          <div className="rounded-xl bg-muted p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Shareable link
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The target instant is stored in the link itself, so anyone who opens it sees the same
              countdown.
            </p>
            <div className="mt-3 overflow-x-auto rounded-md bg-background p-2">
              <code className="whitespace-nowrap text-xs text-foreground">{shareUrl}</code>
            </div>
            <div className="mt-3">
              <CopyButton value={shareUrl} label="Copy countdown link" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
