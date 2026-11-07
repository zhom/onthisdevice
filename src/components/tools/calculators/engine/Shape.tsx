import { useId } from 'react'
import type { CSSProperties } from 'react'
import { PaintDefs, useTweenArray, useWidth } from '@/components/viz'
import type { ShapePath, ShapeProps } from './types'

const PX = 44
const PY = 28

function fillStyle(fill: ShapePath['fill'], uid: string): CSSProperties {
  switch (fill) {
    case 'ink':
      return { fill: 'var(--foreground)' }
    case 'grey':
      return { fill: 'var(--muted-foreground)' }
    case 'hatch':
      return { fill: `url(#${uid}-hatch)` }
    case 'light':
      return { fill: 'var(--background)' }
    default:
      return { fill: 'none' }
  }
}

function lineStyle(line: ShapePath['line'], width = 2): CSSProperties {
  switch (line) {
    case 'none':
      return { stroke: 'none' }
    case 'dash':
      return { stroke: 'var(--foreground)', strokeWidth: width, strokeDasharray: '6 4' }
    case 'grey':
      return { stroke: 'var(--muted-foreground)', strokeWidth: width }
    default:
      return { stroke: 'var(--foreground)', strokeWidth: width }
  }
}

/**
 * A scale drawing in math coordinates (y up) with equal axes. The bounds and every point
 * tween together, so the figure morphs to new inputs; reduced motion gets the final frame.
 */
export function Shape({ paths, labels = [], dots = [], summary, ariaLabel, height = 240 }: ShapeProps) {
  const uid = useId().replace(/:/g, '')
  const [ref, width] = useWidth<HTMLDivElement>(420)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = ([x, y]: [number, number]) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  for (const p of paths) p.pts.forEach(grow)
  dots.forEach(grow)
  if (!Number.isFinite(minX)) {
    minX = minY = 0
    maxX = maxY = 1
  }

  const flat = [minX, minY, maxX, maxY, ...paths.flatMap((p) => p.pts.flat()), ...labels.flatMap((l) => l.at), ...dots.flat()]
  const tw = useTweenArray(flat)
  const at = (k: number) => tw[k] ?? flat[k] ?? 0

  const [bx0, by0, bx1, by1] = [at(0), at(1), at(2), at(3)]
  const bw = Math.max(bx1 - bx0, 1e-9)
  const bh = Math.max(by1 - by0, 1e-9)
  const k = Math.min((width - 2 * PX) / bw, (height - 2 * PY) / bh)
  const ox = (width - bw * k) / 2
  const oy = (height - bh * k) / 2
  const X = (x: number) => ox + (x - bx0) * k
  const Y = (y: number) => height - oy - (y - by0) * k

  let i = 4
  const drawn = paths.map((p) => {
    const pts: string[] = []
    for (let j = 0; j < p.pts.length; j++) {
      pts.push(`${X(at(i)).toFixed(1)},${Y(at(i + 1)).toFixed(1)}`)
      i += 2
    }
    return { p, d: pts.length ? `M${pts.join('L')}${p.closed ? 'Z' : ''}` : '' }
  })
  const placed = labels.map((l) => {
    const pos = { l, x: X(at(i)) + (l.dx ?? 0), y: Y(at(i + 1)) + (l.dy ?? 0) }
    i += 2
    return pos
  })
  const points = dots.map(() => {
    const pos = { x: X(at(i)), y: Y(at(i + 1)) }
    i += 2
    return pos
  })

  return (
    <figure className="min-w-0 space-y-3">
      <div ref={ref} className="w-full">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel ?? summary} className="block overflow-visible">
          <PaintDefs uid={uid} />
          {drawn.map(({ p, d }, j) => (
            <path key={j} d={d} style={{ ...fillStyle(p.fill, uid), ...lineStyle(p.line, p.width) }} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {points.map((pt, j) => (
            <circle key={j} cx={pt.x} cy={pt.y} r={4} style={{ fill: 'var(--foreground)' }} />
          ))}
          {placed.map(({ l, x, y }, j) => (
            <text
              key={j}
              x={x}
              y={y}
              textAnchor={l.anchor ?? 'middle'}
              dominantBaseline="middle"
              className={l.strong ? 'fill-foreground text-[13px] font-[680]' : 'fill-muted-foreground text-[12px] font-[560]'}
              style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 4, strokeLinejoin: 'round' }}
            >
              {l.text}
            </text>
          ))}
        </svg>
      </div>
      <figcaption className="text-[0.875rem] text-pretty text-muted-foreground">{summary}</figcaption>
    </figure>
  )
}
