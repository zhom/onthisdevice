/**
 * Visual kit for calculators: hand-written SVG, black and white, animated.
 *
 * import { LineChart, AreaChart, StackedBars, Donut, Split, Gauge, Timeline,
 *          AnimatedNumber, useTween } from '@/components/viz'
 *
 * Rules every component follows
 * - Inputs change -> the drawing tweens to the new state in 320-420 ms with an
 *   ease-out (requestAnimationFrame, interruptible: a new value starts from
 *   what is on screen). Reduced motion -> no tween, the final frame at once.
 * - Series are told apart by paint, never colour: Paint = 'ink' | 'grey' |
 *   'hatch' | 'dots' | 'paper'; line Stroke = 'solid' | 'dash' | 'grey' | 'dot'.
 *   Defaults go by position (ink, hatch, grey, dots / solid, dash, grey, dot).
 * - Width follows the container (ResizeObserver); text is drawn at 1:1, so it
 *   stays crisp at 360 px. Grid lines use the paper colour, so place charts
 *   on the card fill (ToolPanel) for the grid to show.
 * - Each chart is a <figure>: `summary` (required) is the visible text summary
 *   in the figcaption; `table` (true or a DataTableSpec) adds a "Show the data
 *   table" disclosure. Line and bar charts take focus: Left/Right/Home/End move
 *   the readout, and pointer or touch drag scrubs.
 *
 * Components (props in each file; the short form here)
 *
 * <AnimatedNumber value={n} format={(n) => money(n)} className="text-4xl font-[740]" />
 *   Rolling digits for the main result. Put it inside your role="status" result.
 *
 * <LineChart x={years} series={[{ id, label, values, stroke? }]} summary="…"
 *   xLabel="Year" formatX? readoutX? formatY? formatValue? markers={[{ x, label }]}
 *   guides={[{ y, label, align? }]} height={220} zero={true} table defaultIndex? />
 *   Multi-series lines. The readout row above the plot is also the legend.
 *   markers are vertical lines (a payoff year), guides horizontal (a limit).
 *
 * <AreaChart … /> = LineChart with area fills, stacked unless stacked={false}.
 *   Series `paint` picks the fill.
 *
 * <StackedBars categories={[1, 2, 3]} series={[{ id, label, values, paint? }]}
 *   summary="…" categoryLabel="Year" formatCategory? formatY? formatValue?
 *   showTotal table defaultIndex? height? />
 *   Stacked columns (principal vs interest per year, splits per km).
 *
 * <BarList items={[{ label, value, note?, highlight? }]} summary="…"
 *   formatValue? max? table columns={['Formula', 'BSA']} />
 *   Labelled horizontal bars to compare a few results; highlight one.
 *
 * <Donut parts={[{ label, value, paint? }]} center={<b>42%</b>} size={180}
 *   summary="…" formatValue? table />
 * <Split parts={…} summary="…" height={14} />  one horizontal 100% bar.
 *
 * <Gauge value={bmi} min={15} max={40} bands={[{ to: 18.5, label: 'Under' }, …]}
 *   variant="arc" | "bar" center={<…>} summary="…" formatValue? />
 *   Labelled bands; the band that holds the value grows thick and ink; the
 *   needle (arc) or marker (bar) slides.
 *
 * <Timeline start={0} end={40} spans={[{ from, to, label, paint? }]}
 *   events={[{ at, label, detail? }]} now={23} nowLabel="Week 23"
 *   formatAt={(w) => `Week ${w}`} summary="…" list />
 *   Numbers or Dates. The track fills to `now`; events are numbered ticks
 *   with a list below (past events grey, the next one bold).
 *
 * Hooks
 * useTween(target, { duration?, from? }) -> number
 * useTweenArray(target[], { duration?, from? }) -> number[]  (resampled by index)
 * useTweenRows(rows[][], { duration?, from?, stride? }) -> number[][]
 * useReducedMotion() -> boolean
 * useWidth<HTMLDivElement>(fallback) -> [ref, width, measured]
 *
 * Helpers: Legend, ChartTable, ChartFrame, Swatch, PaintDefs, fillOf,
 * strokeOf, compact (1.2k, 3.4M), niceDomain, linear, pickIndexes.
 */
export { AnimatedNumber } from './AnimatedNumber'
export type { AnimatedNumberProps } from './AnimatedNumber'
export { LineChart, AreaChart } from './LineChart'
export type { LineChartProps, LineSeries, ChartMarker, ChartGuide } from './LineChart'
export { BarList } from './BarList'
export type { BarListProps, BarItem } from './BarList'
export { StackedBars } from './StackedBars'
export type { StackedBarsProps, BarSeries } from './StackedBars'
export { Donut, Split } from './Donut'
export type { DonutProps, SplitProps, Part } from './Donut'
export { Gauge } from './Gauge'
export type { GaugeProps, GaugeBand } from './Gauge'
export { Timeline } from './Timeline'
export type { TimelineProps, TimelineEvent, TimelineSpan } from './Timeline'
export { ChartFrame, ChartTable, Legend } from './ChartFrame'
export type { DataTableSpec, LegendItem } from './ChartFrame'
export { PaintDefs, Swatch, fillOf, strokeOf, paintBackground, PAINT_ORDER, STROKE_ORDER } from './paint'
export type { Paint, Stroke } from './paint'
export { barLabelIndexes, compact, linear, niceDomain, niceStep, niceTicksIn, pickIndexes, px } from './scale'
export { useTween, useTweenArray, useTweenRows, useReducedMotion, useWidth, resample, easeOut, TWEEN_MS } from './tween'
