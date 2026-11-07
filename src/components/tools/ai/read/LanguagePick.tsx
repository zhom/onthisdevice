/** One or two OCR languages. */
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OCR_LANGUAGES } from '@/lib/ml/read/languages'

export function LanguagePick({ id, langs, onChange, latinOnly = false }: { id: string; langs: string[]; onChange: (langs: string[]) => void; latinOnly?: boolean }) {
  const list = OCR_LANGUAGES.filter((l) => !latinOnly || l.latin)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${id}-lang`}>Language of the text</Label>
        <Select value={langs[0]} onValueChange={(v) => onChange([v, ...langs.slice(1).filter((l) => l !== v)])}>
          <SelectTrigger id={`${id}-lang`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-lang2`}>Second language</Label>
        <Select value={langs[1] ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? [langs[0]] : [langs[0], v])}>
          <SelectTrigger id={`${id}-lang2`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {list
              .filter((l) => l.code !== langs[0])
              .map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
