/**
 * Small form controls shared by the AI tool islands.
 */
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { Segmented } from '@/components/tools/redact/shared/LookControls'

export { Segmented }

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <Label id={id}>{label}</Label>
      <Segmented labelId={id} value={value} options={options} onChange={onChange} />
    </div>
  )
}

export function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <Label id={id}>
        {label}: <span className="num">{format(value)}</span>
      </Label>
      <Slider aria-labelledby={id} min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? value)} />
    </div>
  )
}

/** Colour swatches plus a free colour picker. */
export function ColorPick({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string
  value: string
  swatches: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-[600]">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-label={s.label}
            aria-pressed={value.toLowerCase() === s.value}
            title={s.label}
            onClick={() => onChange(s.value)}
            className={cn(
              'size-8 rounded-full shadow-[inset_0_0_0_1px_var(--input)] transition-transform active:scale-95',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
              value.toLowerCase() === s.value && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
            style={{ background: s.value }}
          />
        ))}
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-muted-foreground">
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded-full bg-transparent" />
          Other
        </label>
      </div>
    </fieldset>
  )
}
