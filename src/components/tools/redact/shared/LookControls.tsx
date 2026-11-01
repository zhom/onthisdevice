/**
 * Style, shape and strength of a redaction, shared by the photo, video and
 * camera tools.
 *
 *   <LookControls look={look} onChange={setLook} idPrefix="photo" />
 */
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { RedactLook, RedactShape, RedactStyle } from './paint'

interface Option<T extends string> {
  value: T
  label: string
}

const STYLES: Option<RedactStyle>[] = [
  { value: 'blur', label: 'Blur' },
  { value: 'pixelate', label: 'Pixelate' },
  { value: 'fill', label: 'Fill' },
]

const FILLS: Option<string>[] = [
  { value: '#000', label: 'Black' },
  { value: '#fff', label: 'White' },
]

const SHAPES: Option<RedactShape>[] = [
  { value: 'oval', label: 'Oval' },
  { value: 'rect', label: 'Rectangle' },
]

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  labelId,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  labelId: string
}) {
  return (
    <div role="group" aria-labelledby={labelId} className="flex w-full gap-1 rounded-lg bg-background p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-9 flex-1 rounded-md px-2 text-sm font-[600] whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function LookControls({
  look,
  onChange,
  idPrefix,
}: {
  look: RedactLook
  onChange: (look: RedactLook) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label id={`${idPrefix}-style`}>Style</Label>
        <Segmented labelId={`${idPrefix}-style`} value={look.style} options={STYLES} onChange={(style) => onChange({ ...look, style })} />
      </div>
      <div className="space-y-2">
        <Label id={`${idPrefix}-shape`}>Shape</Label>
        <Segmented labelId={`${idPrefix}-shape`} value={look.shape} options={SHAPES} onChange={(shape) => onChange({ ...look, shape })} />
      </div>
      {look.style === 'fill' && (
        <div className="space-y-2">
          <Label id={`${idPrefix}-fill`}>Colour</Label>
          <Segmented labelId={`${idPrefix}-fill`} value={look.fill ?? '#000'} options={FILLS} onChange={(fill) => onChange({ ...look, fill })} />
        </div>
      )}
      {look.style !== 'fill' && (
        <div className="space-y-2">
          <Label id={`${idPrefix}-strength`}>Strength: {look.strength}%</Label>
          <Slider
            aria-labelledby={`${idPrefix}-strength`}
            min={20}
            max={100}
            step={1}
            value={[look.strength]}
            onValueChange={(v) => onChange({ ...look, strength: v[0] ?? look.strength })}
          />
        </div>
      )}
    </div>
  )
}
