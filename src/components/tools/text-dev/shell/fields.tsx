import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Segmented, ToggleRow } from '@/components/tools/text/common'
import { cn } from '@/lib/utils'
import type { Field, Value } from './spec'

/** Short choice lists are buttons; long ones are a menu. */
const asButtons = (field: { choices: readonly { label: string }[] }) =>
  field.choices.length <= 4 && field.choices.reduce((n, c) => n + c.label.length, 0) <= 40

function Hint({ text }: { text?: string }) {
  return text ? <p className="text-xs text-muted-foreground text-pretty">{text}</p> : null
}

export function FieldControl({ field, value, onChange }: { field: Field; value: Value; onChange: (v: Value) => void }) {
  const id = useId()
  switch (field.kind) {
    case 'toggle':
      return <ToggleRow label={field.label} description={field.hint} checked={value === true} onChange={onChange} />
    case 'choice':
      if (asButtons(field)) {
        return (
          <div className="space-y-1.5">
            <Segmented label={field.label} value={String(value)} options={field.choices} onChange={onChange} />
            <Hint text={field.hint} />
          </div>
        )
      }
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Select value={String(value)} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Hint text={field.hint} />
        </div>
      )
    case 'checks': {
      const on = new Set(String(value).split(',').filter(Boolean))
      const toggle = (v: string, checked: boolean) => {
        const next = field.choices.map((c) => c.value).filter((x) => (x === v ? checked : on.has(x)))
        onChange(next.join(','))
      }
      return (
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">{field.label}</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {field.choices.map((c) => (
              <div key={c.value} className="flex items-center gap-2">
                <Checkbox id={`${id}-${c.value}`} checked={on.has(c.value)} onCheckedChange={(s) => toggle(c.value, s === true)} />
                <Label htmlFor={`${id}-${c.value}`} className="text-sm font-normal">
                  {c.label}
                </Label>
              </div>
            ))}
          </div>
          <Hint text={field.hint} />
        </fieldset>
      )
    }
    case 'area':
      return (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id}>{field.label}</Label>
          <Textarea
            id={id}
            value={String(value)}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={cn('field-sizing-fixed resize-y', field.mono && 'font-mono text-[13px]')}
          />
          <Hint text={field.hint} />
        </div>
      )
    case 'number':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={Number.isFinite(value) ? String(value) : ''}
            onChange={(e) => {
              const n = e.target.valueAsNumber
              onChange(Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.default)
            }}
            className="num"
          />
          <Hint text={field.hint} />
        </div>
      )
    case 'color':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${field.label} picker`}
              value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-md bg-transparent"
            />
            <Input id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className="font-mono" spellCheck={false} />
          </div>
          <Hint text={field.hint} />
        </div>
      )
    case 'text':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Input
            id={id}
            value={String(value)}
            placeholder={field.placeholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
            className={cn(field.mono && 'font-mono')}
          />
          <Hint text={field.hint} />
        </div>
      )
  }
}
