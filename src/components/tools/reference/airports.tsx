import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import airportsData from '@/data/airports.json'
import type { DataMeta } from './data'
import { loadJson } from './data'
import { useLoaded } from './controls'
import type { Airport } from './geo'
import { mapPath, project, searchAirports } from './geo'

interface AirportsManifest {
  meta: DataMeta
  count: number
  files: string
}
export const AIRPORTS = airportsData as unknown as AirportsManifest
interface World {
  width: number
  height: number
  top: number
  path: string
}

/** Loads the airport list and the world outline (both from this site). */
export function useAirportData() {
  return useLoaded('airports', async () => {
    const [list, world] = await Promise.all([loadJson<Airport[]>(`${AIRPORTS.files}/airports.json`), loadJson<World>(`${AIRPORTS.files}/world.json`)])
    return { list, byCode: new Map(list.map((a) => [a[0], a])), world }
  })
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' })
export const countryName = (cc: string) => {
  try {
    return regions.of(cc) ?? cc
  } catch {
    return cc
  }
}
export const airportLine = (a: Airport) => `${a[0]} · ${a[2]}${a[3] ? `, ${a[3]}` : ''}, ${countryName(a[4])}`

/** Text field with airport suggestions (code, name or city). */
export function AirportPicker({ id, label, list, value, onPick }: { id: string; label: string; list: Airport[]; value: Airport | null; onPick: (a: Airport) => void }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const results = useMemo(() => (open ? searchAirports(list, text, 8) : []), [list, text, open])
  const choose = (a: Airport) => {
    onPick(a)
    setText('')
    setOpen(false)
  }
  return (
    <div className="relative min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={text}
        placeholder={value ? `${value[0]} · ${value[3] || value[2]}` : 'Code, city or airport'}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(results.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === 'Escape') setOpen(false)
        }}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="text-base"
      />
      {results.length ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg bg-popover p-1 shadow-pop">
          {results.map((a, i) => (
            <li
              key={a[0]}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${i === active ? 'bg-muted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(a)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="font-[700] tabular-nums">{a[0]}</span> <span>{a[2]}</span>
              <span className="block text-xs text-muted-foreground">
                {[a[3], countryName(a[4]), a[1]].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * World outline with airports and an optional great-circle route. The route draws itself from
 * the origin (a stroke-dashoffset tween); a new route restarts from the start.
 */
export function WorldMap({ world, points, route, label }: { world: World; points: Airport[]; route?: [number, number][]; label: string }) {
  const routeRef = useRef<SVGPathElement>(null)
  const d = route ? mapPath(route, world.top) : ''
  useEffect(() => {
    const el = routeRef.current
    if (!el || !d) return
    if (reducedMotion()) {
      el.style.strokeDashoffset = '0'
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      const e = 1 - (1 - t) ** 3
      el.style.strokeDashoffset = String(1 - e)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    el.style.strokeDashoffset = '1'
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [d])
  return (
    <svg viewBox={`0 0 ${world.width} ${world.height}`} className="h-auto w-full" role="img" aria-label={label}>
      <path d={world.path} fill="var(--chart-5)" />
      {route ? <path ref={routeRef} d={d} fill="none" stroke="var(--foreground)" strokeWidth={0.9} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" /> : null}
      {points.map((a) => {
        const [x, y] = project(a[5], a[6], world.top)
        return (
          <g key={a[0]}>
            <circle cx={x} cy={y} r={4} fill="var(--foreground)" opacity={0.2} className="motion-safe:animate-ping" style={{ transformOrigin: `${x}px ${y}px`, animationIterationCount: 2 }} />
            <circle cx={x} cy={y} r={2.3} fill="var(--foreground)" stroke="var(--background)" strokeWidth={0.7} />
            <text x={x} y={y - 4.2} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.2} paintOrder="stroke">
              {a[0]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
