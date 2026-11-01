import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { MASK_MODES } from '@/lib/ml/text/placeholders'
import type { MaskMode } from '@/lib/ml/text/placeholders'
import { TYPE_INFO } from '@/lib/ml/text/types'
import { cn } from '@/lib/utils'
import type { EntityType } from '@/lib/ml/text/types'

/** Checkboxes for the entity types, each with the number found. */
export function TypePicker({
  types,
  onChange,
  counts,
  only,
  className,
}: {
  types: ReadonlySet<EntityType>
  onChange: (next: Set<EntityType>) => void
  counts: ReadonlyMap<EntityType, number>
  /** Limit the list to these types. */
  only?: readonly EntityType[]
  className?: string
}) {
  const id = useId()
  const list = only ? TYPE_INFO.filter((t) => only.includes(t.type)) : TYPE_INFO
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-[600] text-foreground">What to hide</legend>
      <div className={cn('grid grid-cols-1 gap-x-4 gap-y-2.5 min-[420px]:grid-cols-2', className)}>
        {list.map((t) => {
          const n = counts.get(t.type) ?? 0
          return (
            <div key={t.type} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${t.type}`}
                checked={types.has(t.type)}
                onCheckedChange={(v) => {
                  const next = new Set(types)
                  if (v === true) next.add(t.type)
                  else next.delete(t.type)
                  onChange(next)
                }}
              />
              <Label htmlFor={`${id}-${t.type}`} className="text-sm font-normal">
                {t.name}
                {n > 0 ? <span className="num ml-1.5 text-muted-foreground">{n}</span> : null}
              </Label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Radio buttons for the replacement style. */
export function MaskPicker({
  mode,
  onChange,
  modes = MASK_MODES,
  className,
}: {
  mode: MaskMode
  onChange: (m: MaskMode) => void
  modes?: typeof MASK_MODES
  className?: string
}) {
  const id = useId()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-[600] text-foreground">Replace with</legend>
      <RadioGroup value={mode} onValueChange={(v) => onChange(v as MaskMode)} className={cn('grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2', className)}>
        {modes.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${m.id}`} value={m.id} />
            <Label htmlFor={`${id}-${m.id}`} className="text-sm font-normal">
              {m.name}
              <span className="ml-1.5 font-mono text-[0.8125rem] text-muted-foreground">{m.example}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

/** One word or phrase per line; every match is hidden. */
export function HideList({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-[600]">
        Always hide
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'One word or phrase per line\nProject Falcon\nGreenfield'}
        rows={3}
        className="min-h-20 font-mono text-[0.8125rem]"
        spellCheck={false}
      />
    </div>
  )
}

export function hideTerms(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}
