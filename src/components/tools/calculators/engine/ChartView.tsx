import { BarList, Donut, Gauge, LineChart, Split, StackedBars, Timeline } from '@/components/viz'
import { Shape } from './Shape'
import type { Chart } from './types'

/** Repeated labels get " (2)", " (3)": the charts key their rows by label. */
function uniq<T extends { label: string }>(items: T[]): T[] {
  const seen = new Map<string, number>()
  return items.map((it) => {
    const k = (seen.get(it.label) ?? 0) + 1
    seen.set(it.label, k)
    return k === 1 ? it : { ...it, label: `${it.label} (${k})` }
  })
}

/** Draws a spec's chart with the shared viz components. */
export function ChartView({ chart }: { chart: Chart }) {
  switch (chart.kind) {
    case 'gauge': {
      const { kind: _, ...p } = chart
      return <Gauge {...p} />
    }
    case 'bars': {
      const { kind: _, items, ...p } = chart
      return <BarList {...p} items={uniq(items)} />
    }
    case 'donut': {
      const { kind: _, parts, ...p } = chart
      return <Donut {...p} parts={uniq(parts)} />
    }
    case 'split': {
      const { kind: _, parts, ...p } = chart
      return <Split {...p} parts={uniq(parts)} />
    }
    case 'line': {
      const { kind: _, ...p } = chart
      return <LineChart {...p} />
    }
    case 'stacked': {
      const { kind: _, ...p } = chart
      return <StackedBars {...p} />
    }
    case 'timeline': {
      const { kind: _, ...p } = chart
      return <Timeline {...p} />
    }
    case 'shape': {
      const { kind: _, ...p } = chart
      return <Shape {...p} />
    }
  }
}
