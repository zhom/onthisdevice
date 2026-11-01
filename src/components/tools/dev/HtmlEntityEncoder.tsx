import { useCallback, useMemo, useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CodePane, Field, Segmented, StatChips } from './DevUi'
import { formatNumber } from '@/lib/utils'

type Direction = 'encode' | 'decode'
type EntityStyle = 'named' | 'decimal' | 'hex'
type Scope = 'minimal' | 'nonascii' | 'all'

/* ------------------------------------------------------------------ */
/* Entity table                                                        */
/* ------------------------------------------------------------------ */

const TABLE_SOURCE =
  '34 quot,38 amp,39 apos,60 lt,62 gt,160 nbsp,161 iexcl,162 cent,163 pound,164 curren,165 yen,' +
  '166 brvbar,167 sect,168 uml,169 copy,170 ordf,171 laquo,172 not,173 shy,174 reg,175 macr,' +
  '176 deg,177 plusmn,178 sup2,179 sup3,180 acute,181 micro,182 para,183 middot,184 cedil,185 sup1,' +
  '186 ordm,187 raquo,188 frac14,189 frac12,190 frac34,191 iquest,192 Agrave,193 Aacute,194 Acirc,' +
  '195 Atilde,196 Auml,197 Aring,198 AElig,199 Ccedil,200 Egrave,201 Eacute,202 Ecirc,203 Euml,' +
  '204 Igrave,205 Iacute,206 Icirc,207 Iuml,208 ETH,209 Ntilde,210 Ograve,211 Oacute,212 Ocirc,' +
  '213 Otilde,214 Ouml,215 times,216 Oslash,217 Ugrave,218 Uacute,219 Ucirc,220 Uuml,221 Yacute,' +
  '222 THORN,223 szlig,224 agrave,225 aacute,226 acirc,227 atilde,228 auml,229 aring,230 aelig,' +
  '231 ccedil,232 egrave,233 eacute,234 ecirc,235 euml,236 igrave,237 iacute,238 icirc,239 iuml,' +
  '240 eth,241 ntilde,242 ograve,243 oacute,244 ocirc,245 otilde,246 ouml,247 divide,248 oslash,' +
  '249 ugrave,250 uacute,251 ucirc,252 uuml,253 yacute,254 thorn,255 yuml,338 OElig,339 oelig,' +
  '352 Scaron,353 scaron,376 Yuml,402 fnof,710 circ,732 tilde,913 Alpha,914 Beta,915 Gamma,' +
  '916 Delta,917 Epsilon,918 Zeta,919 Eta,920 Theta,921 Iota,922 Kappa,923 Lambda,924 Mu,925 Nu,' +
  '926 Xi,927 Omicron,928 Pi,929 Rho,931 Sigma,932 Tau,933 Upsilon,934 Phi,935 Chi,936 Psi,' +
  '937 Omega,945 alpha,946 beta,947 gamma,948 delta,949 epsilon,950 zeta,951 eta,952 theta,' +
  '953 iota,954 kappa,955 lambda,956 mu,957 nu,958 xi,959 omicron,960 pi,961 rho,962 sigmaf,' +
  '963 sigma,964 tau,965 upsilon,966 phi,967 chi,968 psi,969 omega,8194 ensp,8195 emsp,' +
  '8201 thinsp,8204 zwnj,8205 zwj,8206 lrm,8207 rlm,8211 ndash,8212 mdash,8216 lsquo,8217 rsquo,' +
  '8218 sbquo,8220 ldquo,8221 rdquo,8222 bdquo,8224 dagger,8225 Dagger,8226 bull,8230 hellip,' +
  '8240 permil,8242 prime,8243 Prime,8249 lsaquo,8250 rsaquo,8254 oline,8260 frasl,8364 euro,' +
  '8465 image,8472 weierp,8476 real,8482 trade,8501 alefsym,8592 larr,8593 uarr,8594 rarr,' +
  '8595 darr,8596 harr,8629 crarr,8656 lArr,8657 uArr,8658 rArr,8659 dArr,8660 hArr,8704 forall,' +
  '8706 part,8707 exist,8709 empty,8711 nabla,8712 isin,8713 notin,8715 ni,8719 prod,8721 sum,' +
  '8722 minus,8727 lowast,8730 radic,8733 prop,8734 infin,8736 ang,8743 and,8744 or,8745 cap,' +
  '8746 cup,8747 int,8756 there4,8764 sim,8773 cong,8776 asymp,8800 ne,8801 equiv,8804 le,' +
  '8805 ge,8834 sub,8835 sup,8836 nsub,8838 sube,8839 supe,8853 oplus,8855 otimes,8869 perp,' +
  '8901 sdot,8968 lceil,8969 rceil,8970 lfloor,8971 rfloor,9674 loz,9824 spades,9827 clubs,' +
  '9829 hearts,9830 diams'

const CODE_TO_NAME = new Map<number, string>()
const NAME_TO_CODE = new Map<string, number>()
for (const entry of TABLE_SOURCE.split(',')) {
  const space = entry.indexOf(' ')
  const code = Number(entry.slice(0, space))
  const name = entry.slice(space + 1)
  if (!CODE_TO_NAME.has(code)) CODE_TO_NAME.set(code, name)
  NAME_TO_CODE.set(name, code)
}

const DESCRIPTIONS: Record<string, string> = {
  quot: 'Double quotation mark',
  amp: 'Ampersand',
  apos: 'Apostrophe / single quote',
  lt: 'Less-than sign: opens a tag',
  gt: 'Greater-than sign: closes a tag',
  nbsp: 'Non-breaking space',
  copy: 'Copyright sign',
  reg: 'Registered trademark',
  trade: 'Trademark',
  ndash: 'En dash',
  mdash: 'Em dash',
  hellip: 'Horizontal ellipsis',
  lsquo: 'Left single quotation mark',
  rsquo: 'Right single quotation mark / apostrophe',
  ldquo: 'Left double quotation mark',
  rdquo: 'Right double quotation mark',
  bull: 'Bullet',
  euro: 'Euro sign',
  pound: 'Pound sign',
  deg: 'Degree sign',
  times: 'Multiplication sign',
  divide: 'Division sign',
  laquo: 'Left double angle quotation mark',
  raquo: 'Right double angle quotation mark',
  shy: 'Soft hyphen: an invisible optional break point',
  zwnj: 'Zero-width non-joiner',
  zwj: 'Zero-width joiner',
}

const MINIMAL = new Set([38, 60, 62, 34, 39])

/* ------------------------------------------------------------------ */
/* Encode / decode                                                     */
/* ------------------------------------------------------------------ */

function encodeEntities(text: string, style: EntityStyle, scope: Scope): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue

    const isMinimal = MINIMAL.has(code)
    const isNonAscii = code > 127
    const isPunctuation = code < 128 && !/[A-Za-z0-9]/.test(ch) && code !== 32 && code > 32

    let shouldEncode = isMinimal
    if (scope === 'nonascii') shouldEncode = isMinimal || isNonAscii
    if (scope === 'all') shouldEncode = isMinimal || isNonAscii || isPunctuation

    if (!shouldEncode) {
      out += ch
      continue
    }

    if (style === 'named') {
      const name = CODE_TO_NAME.get(code)
      out += name ? `&${name};` : `&#${code};`
    } else if (style === 'hex') {
      out += `&#x${code.toString(16).toUpperCase()};`
    } else {
      out += `&#${code};`
    }
  }
  return out
}

/** Fall back to the browser's own entity table for names we do not carry. */
function browserDecode(entity: string): string | null {
  if (typeof document === 'undefined') return null
  const el = document.createElement('textarea')
  el.innerHTML = entity
  const value = el.value
  return value === entity ? null : value
}

const ENTITY_RE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g

function decodeEntities(text: string): { output: string; count: number } {
  let count = 0
  const output = text.replace(ENTITY_RE, (whole, body: string) => {
    let code: number | null = null
    if (body[0] === '#') {
      code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
    } else {
      const known = NAME_TO_CODE.get(body)
      if (known !== undefined) code = known
    }

    if (code !== null && Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
      try {
        count += 1
        return String.fromCodePoint(code)
      } catch {
        return whole
      }
    }

    const viaBrowser = browserDecode(whole)
    if (viaBrowser !== null) {
      count += 1
      return viaBrowser
    }
    return whole
  })
  return { output, count }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE = '<a href="/pricing?plan=pro&trial=1">Réservez — 50 % off</a> 😀'

export default function HtmlEntityEncoder() {
  const [direction, setDirection] = useState<Direction>('encode')
  const [style, setStyle] = useState<EntityStyle>('named')
  const [scope, setScope] = useState<Scope>('minimal')
  const [text, setText] = useState(SAMPLE)
  const [filter, setFilter] = useState('')

  const result = useMemo(() => {
    if (!text) return { output: '', count: 0 }
    if (direction === 'encode') {
      const output = encodeEntities(text, style, scope)
      return { output, count: (output.match(/&[#a-zA-Z0-9]+;/g) ?? []).length }
    }
    return decodeEntities(text)
  }, [text, direction, style, scope])

  const swap = useCallback(() => {
    setText(result.output || text)
    setDirection((d) => (d === 'encode' ? 'decode' : 'encode'))
  }, [result.output, text])

  const referenceRows = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const rows = [...CODE_TO_NAME.entries()].map(([code, name]) => ({
      code,
      name,
      char: String.fromCodePoint(code),
      description: DESCRIPTIONS[name] ?? '',
    }))
    if (!query) return rows.slice(0, 40)
    return rows
      .filter(
        (row) =>
          row.name.toLowerCase().includes(query) ||
          row.description.toLowerCase().includes(query) ||
          String(row.code) === query ||
          row.char === filter.trim(),
      )
      .slice(0, 60)
  }, [filter])

  return (
    <div className="flex flex-col gap-4">
      <ToolPanel
        title="HTML entities"
        description="Encode text so a browser renders it literally, or turn entities back into the characters they stand for."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'encode', label: 'Encode' },
              { value: 'decode', label: 'Decode' },
            ]}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={swap}>
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Swap
          </Button>
        </div>

        {direction === 'encode' ? (
          <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmented
              label="Entity style"
              value={style}
              onChange={setStyle}
              options={[
                { value: 'named', label: 'Named', title: '&amp; &mdash; &eacute;' },
                { value: 'decimal', label: 'Decimal', title: '&#38; &#8212;' },
                { value: 'hex', label: 'Hex', title: '&#x26; &#x2014;' },
              ]}
            />
            <Segmented
              label="What to encode"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'minimal', label: 'Only special characters' },
                { value: 'nonascii', label: 'Specials + non-ASCII' },
                { value: 'all', label: 'Everything non-alphanumeric' },
              ]}
            />
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Decoding understands named entities, decimal references such as{' '}
            <code className="font-mono">&amp;#8212;</code> and hexadecimal ones such as{' '}
            <code className="font-mono">&amp;#x2014;</code>. Anything it does not recognise is left
            exactly as you typed it.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <CodePane
            label={direction === 'encode' ? 'Plain text' : 'Text with entities'}
            value={text}
            onChange={setText}
            rows={9}
            copyable
            placeholder={direction === 'encode' ? '<b>Bold & beautiful</b>' : '&lt;b&gt;Bold &amp; beautiful&lt;/b&gt;'}
            footer={`${formatNumber(text.length, 0)} characters`}
          />
          <CodePane
            label={direction === 'encode' ? 'Encoded' : 'Decoded'}
            value={result.output}
            readOnly
            rows={9}
            footer={`${formatNumber(result.output.length, 0)} characters`}
          />
        </div>

        <StatChips
          items={[
            {
              label: direction === 'encode' ? 'Entities written' : 'Entities resolved',
              value: formatNumber(result.count, 0),
            },
            {
              label: 'Size change',
              value:
                text.length > 0
                  ? `${result.output.length >= text.length ? '+' : ''}${formatNumber(result.output.length - text.length, 0)} chars`
                  : '–',
            },
          ]}
        />

        {direction === 'encode' && scope === 'minimal' ? (
          <p className="text-xs text-muted-foreground text-pretty">
            Minimal mode escapes only <code className="font-mono">&amp; &lt; &gt; &quot; &#39;</code>,
            the characters that can break out of element text or an attribute. Everything else, including
            accents and emoji, is left as literal UTF-8, which is what a modern page wants.
          </p>
        ) : null}
      </ToolPanel>

      <ToolPanel
        title="Entity reference"
        description="Search by name, character or code point. The first 40 entries are shown until you search."
      >
        <Field label="Search entities" htmlFor="entity-filter">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="entity-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="nbsp, dash, 8212, €…"
              className="pl-8"
            />
          </div>
        </Field>

        <div className="max-h-96 overflow-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Char</TableHead>
                <TableHead className="min-w-[7rem]">Named</TableHead>
                <TableHead className="min-w-[6rem]">Decimal</TableHead>
                <TableHead className="min-w-[6rem]">Hex</TableHead>
                <TableHead className="min-w-[10rem]">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referenceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Nothing matches “{filter}”.
                  </TableCell>
                </TableRow>
              ) : (
                referenceRows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="text-lg">{row.char}</TableCell>
                    <TableCell className="font-mono text-[13px]">&amp;{row.name};</TableCell>
                    <TableCell className="font-mono text-[13px]">&amp;#{row.code};</TableCell>
                    <TableCell className="font-mono text-[13px]">
                      &amp;#x{row.code.toString(16).toUpperCase()};
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ToolPanel>
    </div>
  )
}
