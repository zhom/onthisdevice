import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { cn } from '@/lib/utils'

interface Props {
  /** Style ids pinned to the top for a focused sibling page. */
  featured?: string[]
  /** Placeholder/sample text for the input box. */
  sample?: string
}

/* ------------------------------------------------------------------ */
/* Transform helpers                                                   */
/* ------------------------------------------------------------------ */

type Transform = (input: string) => string

function offsetStyle(config: {
  upper?: number
  lower?: number
  digits?: number
  exceptions?: Record<string, string>
  uppercaseFirst?: boolean
}): Transform {
  return (input) => {
    const source = config.uppercaseFirst ? input.toUpperCase() : input
    return Array.from(source)
      .map((char) => {
        const exception = config.exceptions?.[char]
        if (exception) return exception
        const code = char.codePointAt(0) ?? 0
        if (config.upper !== undefined && code >= 65 && code <= 90) {
          return String.fromCodePoint(config.upper + code - 65)
        }
        if (config.lower !== undefined && code >= 97 && code <= 122) {
          return String.fromCodePoint(config.lower + code - 97)
        }
        if (config.digits !== undefined && code >= 48 && code <= 57) {
          return String.fromCodePoint(config.digits + code - 48)
        }
        return char
      })
      .join('')
  }
}

function tableStyle(
  from: string,
  to: string,
  extra?: Record<string, string>,
  /** Also map the uppercase form of each source character to the same glyph. */
  foldCase = false,
): Transform {
  const map = new Map<string, string>()
  const fromChars = Array.from(from)
  const toChars = Array.from(to)
  fromChars.forEach((char, index) => {
    if (!toChars[index]) return
    map.set(char, toChars[index])
    if (foldCase && char !== char.toUpperCase()) map.set(char.toUpperCase(), toChars[index])
  })
  if (extra) for (const [key, value] of Object.entries(extra)) map.set(key, value)
  return (input) =>
    Array.from(input)
      .map((char) => map.get(char) ?? char)
      .join('')
}

function combiningStyle(mark: string): Transform {
  return (input) =>
    Array.from(input)
      .map((char) => (char === ' ' ? char : char + mark))
      .join('')
}

function wrapStyle(before: string, after: string): Transform {
  return (input) => (input.length === 0 ? '' : `${before}${input}${after}`)
}

const ZALGO_UP = Array.from({ length: 16 }, (_, i) => String.fromCharCode(0x0300 + i))
const ZALGO_DOWN = Array.from({ length: 12 }, (_, i) => String.fromCharCode(0x0316 + i))

/** Deterministic pseudo-random so a given input always renders identically. */
function seededPick(list: string[], seed: number): string {
  return list[Math.abs(Math.sin(seed) * 10000) % list.length | 0]
}

function zalgoStyle(intensity: number): Transform {
  return (input) =>
    Array.from(input)
      .map((char, index) => {
        if (char === ' ') return char
        let out = char
        for (let i = 0; i < intensity; i += 1) {
          out += seededPick(ZALGO_UP, index * 7.1 + i * 3.3)
          out += seededPick(ZALGO_DOWN, index * 11.7 + i * 5.9)
        }
        return out
      })
      .join('')
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'

/* ------------------------------------------------------------------ */
/* The style catalogue                                                 */
/* ------------------------------------------------------------------ */

type Group = 'Fonts' | 'Boxed' | 'Small & shifted' | 'Lines & marks' | 'Decorated'

interface Style {
  id: string
  name: string
  group: Group
  note?: string
  transform: Transform
}

const STYLES: Style[] = [
  /* -------------------------------------------------- Fonts */
  {
    id: 'bold',
    name: 'Bold',
    group: 'Fonts',
    note: 'Mathematical Bold. Works in Instagram bios and LinkedIn headlines',
    transform: offsetStyle({ upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce }),
  },
  {
    id: 'italic',
    name: 'Italic',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d434, lower: 0x1d44e, exceptions: { h: 'ℎ' } }),
  },
  {
    id: 'bold-italic',
    name: 'Bold italic',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d468, lower: 0x1d482 }),
  },
  {
    id: 'sans',
    name: 'Sans-serif',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d5a0, lower: 0x1d5ba, digits: 0x1d7e2 }),
  },
  {
    id: 'sans-bold',
    name: 'Sans-serif bold',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec }),
  },
  {
    id: 'sans-italic',
    name: 'Sans-serif italic',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d608, lower: 0x1d622 }),
  },
  {
    id: 'sans-bold-italic',
    name: 'Sans-serif bold italic',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d63c, lower: 0x1d656 }),
  },
  {
    id: 'monospace',
    name: 'Monospace',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 }),
  },
  {
    id: 'script',
    name: 'Script (cursive)',
    group: 'Fonts',
    transform: offsetStyle({
      upper: 0x1d49c,
      lower: 0x1d4b6,
      exceptions: {
        B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ',
        e: 'ℯ', g: 'ℊ', o: 'ℴ',
      },
    }),
  },
  {
    id: 'script-bold',
    name: 'Bold script',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d4d0, lower: 0x1d4ea }),
  },
  {
    id: 'fraktur',
    name: 'Fraktur (old English)',
    group: 'Fonts',
    transform: offsetStyle({
      upper: 0x1d504,
      lower: 0x1d51e,
      exceptions: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' },
    }),
  },
  {
    id: 'fraktur-bold',
    name: 'Bold fraktur',
    group: 'Fonts',
    transform: offsetStyle({ upper: 0x1d56c, lower: 0x1d586 }),
  },
  {
    id: 'double-struck',
    name: 'Double-struck (outline)',
    group: 'Fonts',
    transform: offsetStyle({
      upper: 0x1d538,
      lower: 0x1d552,
      digits: 0x1d7d8,
      exceptions: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
    }),
  },
  {
    id: 'fullwidth',
    name: 'Fullwidth (aesthetic)',
    group: 'Fonts',
    note: 'The vaporwave look: CJK-width Latin letters',
    transform: offsetStyle({ upper: 0xff21, lower: 0xff41, digits: 0xff10, exceptions: { ' ': '　' } }),
  },

  /* -------------------------------------------------- Boxed */
  {
    id: 'circled',
    name: 'Circled (bubble)',
    group: 'Boxed',
    transform: offsetStyle({
      upper: 0x24b6,
      lower: 0x24d0,
      digits: 0x245f,
      exceptions: { '0': '⓪' },
    }),
  },
  {
    id: 'circled-negative',
    name: 'Circled filled',
    group: 'Boxed',
    transform: offsetStyle({
      upper: 0x1f150,
      digits: 0x2775,
      uppercaseFirst: true,
      exceptions: { '0': '⓿' },
    }),
  },
  {
    id: 'squared',
    name: 'Squared',
    group: 'Boxed',
    transform: offsetStyle({ upper: 0x1f130, uppercaseFirst: true }),
  },
  {
    id: 'squared-negative',
    name: 'Squared filled',
    group: 'Boxed',
    transform: offsetStyle({ upper: 0x1f170, uppercaseFirst: true }),
  },
  {
    id: 'parenthesized',
    name: 'Parenthesised',
    group: 'Boxed',
    transform: offsetStyle({
      upper: 0x1f110,
      lower: 0x249c,
      digits: 0x2473,
      exceptions: { '0': '0' },
    }),
  },
  {
    id: 'regional',
    name: 'Regional indicator',
    group: 'Boxed',
    note: 'Renders as flag-style letter tiles on most phones',
    transform: offsetStyle({ upper: 0x1f1e6, uppercaseFirst: true }),
  },

  /* ------------------------------------------ Small & shifted */
  {
    id: 'small-caps',
    name: 'Small caps',
    group: 'Small & shifted',
    transform: tableStyle(LOWER, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘQʀꜱᴛᴜᴠᴡxʏᴢ'),
  },
  {
    id: 'superscript',
    name: 'Superscript (tiny)',
    group: 'Small & shifted',
    transform: tableStyle(
      LOWER + DIGITS,
      'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ' + '⁰¹²³⁴⁵⁶⁷⁸⁹',
      { '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾' },
      true,
    ),
  },
  {
    id: 'subscript',
    name: 'Subscript',
    group: 'Small & shifted',
    transform: tableStyle(
      LOWER + DIGITS,
      'ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz' + '₀₁₂₃₄₅₆₇₈₉',
      { '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' },
      true,
    ),
  },
  {
    id: 'upside-down',
    name: 'Upside down',
    group: 'Small & shifted',
    note: 'Flipped characters, then the whole string reversed',
    transform: (input) => {
      const flip = tableStyle(LOWER + UPPER + DIGITS, 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz' + '∀𐐒ƆpƎℲפHIſʞ˥WNOԀQɹS┴∩ΛMX⅄Z' + '0ƖᄅƐㄣϛ9ㄥ86', {
        '.': '˙', ',': "'", '?': '¿', '!': '¡', "'": ',', '"': '„',
        '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{',
        '<': '>', '>': '<', '&': '⅋', _: '‾',
      })
      return Array.from(flip(input)).reverse().join('')
    },
  },
  {
    id: 'mirrored',
    name: 'Reversed',
    group: 'Small & shifted',
    transform: (input) => Array.from(input).reverse().join(''),
  },
  {
    id: 'spaced',
    name: 'S p a c e d',
    group: 'Small & shifted',
    transform: (input) => Array.from(input).join(' '),
  },

  /* ------------------------------------------ Lines & marks */
  {
    id: 'strikethrough',
    name: 'Strikethrough',
    group: 'Lines & marks',
    note: 'Combining long stroke overlay, U+0336',
    transform: combiningStyle('̶'),
  },
  {
    id: 'strikethrough-short',
    name: 'Short strikethrough',
    group: 'Lines & marks',
    transform: combiningStyle('̵'),
  },
  {
    id: 'underline',
    name: 'Underline',
    group: 'Lines & marks',
    transform: combiningStyle('̲'),
  },
  {
    id: 'double-underline',
    name: 'Double underline',
    group: 'Lines & marks',
    transform: combiningStyle('̳'),
  },
  {
    id: 'overline',
    name: 'Overline',
    group: 'Lines & marks',
    transform: combiningStyle('̅'),
  },
  {
    id: 'slashed',
    name: 'Slashed',
    group: 'Lines & marks',
    transform: combiningStyle('̸'),
  },
  {
    id: 'wavy',
    name: 'Wavy underline',
    group: 'Lines & marks',
    transform: combiningStyle('̰'),
  },
  {
    id: 'cursed-light',
    name: 'Cursed (light)',
    group: 'Lines & marks',
    transform: zalgoStyle(1),
  },
  {
    id: 'cursed-medium',
    name: 'Cursed (medium)',
    group: 'Lines & marks',
    transform: zalgoStyle(3),
  },
  {
    id: 'cursed-heavy',
    name: 'Cursed (heavy)',
    group: 'Lines & marks',
    note: 'Enough combining marks to bleed into the lines above and below',
    transform: zalgoStyle(6),
  },

  /* -------------------------------------------------- Decorated */
  { id: 'sparkle', name: 'Sparkles', group: 'Decorated', transform: wrapStyle('✧･ﾟ: ', ' :･ﾟ✧') },
  { id: 'stars', name: 'Shooting stars', group: 'Decorated', transform: wrapStyle('★彡 ', ' 彡★') },
  { id: 'hearts', name: 'Hearts', group: 'Decorated', transform: wrapStyle('♡ ', ' ♡') },
  { id: 'flowers', name: 'Flowers', group: 'Decorated', transform: wrapStyle('❀ ', ' ❀') },
  { id: 'corner-brackets', name: 'Corner brackets', group: 'Decorated', transform: wrapStyle('『', '』') },
  { id: 'lenticular', name: 'Lenticular brackets', group: 'Decorated', transform: wrapStyle('【', '】') },
  { id: 'scroll', name: 'Scroll', group: 'Decorated', transform: wrapStyle('༺ ', ' ༻') },
  {
    id: 'wave',
    name: 'Wave',
    group: 'Decorated',
    transform: wrapStyle('˜”*°•.˜”*°• ', ' •°*”˜.•°*”˜'),
  },
  { id: 'arrows', name: 'Arrows', group: 'Decorated', transform: wrapStyle('➶➶➶ ', ' ➷➷➷') },
  {
    id: 'dotted',
    name: 'Dotted frame',
    group: 'Decorated',
    transform: wrapStyle('.•°¤*(¯`★´¯)*¤° ', ' °¤*(¯´★`¯)*¤°•.'),
  },
]

const GROUP_ORDER: Group[] = ['Fonts', 'Boxed', 'Small & shifted', 'Lines & marks', 'Decorated']

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function StyleRow({ style, output }: { style: Style; output: string }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-7 break-words text-foreground" lang="en">
          {output || <span className="text-muted-foreground">–</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {style.name}
          {style.note ? ` · ${style.note}` : ''}
        </p>
      </div>
      <CopyButton value={output} label="Copy" className="shrink-0 self-start sm:self-center" />
    </li>
  )
}

export default function DevEncodeFancyText({ featured = [], sample = 'onthisdevice' }: Props) {
  const [text, setText] = useState(sample)
  const [filter, setFilter] = useState('')

  const query = filter.trim().toLowerCase()

  const rendered = useMemo(
    () => STYLES.map((style) => ({ style, output: style.transform(text) })),
    [text],
  )

  const featuredRows = useMemo(
    () => rendered.filter((row) => featured.includes(row.style.id)),
    [rendered, featured],
  )

  const grouped = useMemo(() => {
    const matches = rendered.filter(({ style }) => {
      if (featured.includes(style.id)) return false
      if (!query) return true
      return (
        style.name.toLowerCase().includes(query) ||
        style.group.toLowerCase().includes(query) ||
        style.id.includes(query)
      )
    })
    return GROUP_ORDER.map((group) => ({
      group,
      rows: matches.filter((row) => row.style.group === group),
    })).filter((entry) => entry.rows.length > 0)
  }, [rendered, query, featured])

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Your text"
        description="Every style below updates as you type. Each one is real Unicode, so it pastes into any app that accepts text without images or fonts."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="fancy-input">Text to restyle</Label>
          <Textarea
            id="fancy-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            placeholder="Type something"
            className="text-base"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3" aria-hidden="true" />
            {STYLES.length} styles
          </span>
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="fancy-filter" className="sr-only">
              Filter styles
            </Label>
            <Input
              id="fancy-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter styles: bold, circled, cursed…"
            />
          </div>
        </div>
      </ToolPanel>

      {featuredRows.length > 0 ? (
        <ToolPanel title="Best match for this page">
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
            {featuredRows.map((row) => (
              <StyleRow key={row.style.id} style={row.style} output={row.output} />
            ))}
          </ul>
        </ToolPanel>
      ) : null}

      {grouped.map((entry) => (
        <ToolPanel key={entry.group} title={entry.group}>
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
            {entry.rows.map((row) => (
              <StyleRow key={row.style.id} style={row.style} output={row.output} />
            ))}
          </ul>
        </ToolPanel>
      ))}

      {grouped.length === 0 && featuredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No style matches “{filter}”.</p>
      ) : null}

      <Alert role="note">
        <AlertTitle>Why some styles look plain on some devices</AlertTitle>
        <AlertDescription className={cn('text-pretty')}>
          These characters are substitutes drawn from the Unicode maths, enclosed-alphanumeric and
          phonetic blocks. They are not a font. If a device has no glyph for one of them you see a box or a
          plain letter instead. Bold, italic, script, monospace and fullwidth are the safest across
          iOS, Android, Windows and the major social apps. Screen readers will usually read
          mathematical letters out character by character, so avoid them for anything that matters,
          such as your actual name.
        </AlertDescription>
      </Alert>
    </div>
  )
}
