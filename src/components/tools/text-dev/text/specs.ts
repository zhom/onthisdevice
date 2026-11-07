/** Text tools: case, clean-up, lines, extraction, ciphers. One Spec per slug. */
import {
  toAlternatingCase,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
} from '@/components/tools/text/text-core'
import type { Field, Result, Spec, Specs, Values } from '../shell/spec'
import { bool, num, str } from '../shell/spec'
import {
  atbash,
  baconDecode,
  baconEncode,
  caesar,
  crackCaesar,
  fromLeet,
  lettersToNumbers,
  numbersToLetters,
  pigLatin,
  railFence,
  rot13,
  rot47,
  toLeet,
  vigenere,
} from './ciphers'
import {
  countEmoji,
  removeAccents,
  removeDuplicateWords,
  removeEmoji,
  removeEmptyLines,
  removeExtraSpaces,
  removeNonAscii,
  removeNumbers,
  removePunctuation,
  removeSpecial,
  smartToStraight,
  spacesToTabs,
  straightToSmart,
  stripHtml,
  tabsToSpaces,
} from './cleanup'
import { extractEmails, extractIps, extractNumbers, extractPhones, extractTags, extractUrls } from './extract'
import type { Found } from './extract'
import { addLineNumbers, delimitedToList, listToDelimited, splitLines, splitText, wrapLines, wrapText } from './lines'

const SAMPLE_PROSE = `The quick brown fox jumps over the lazy dog.
user profile settings
HTTP response code`

const perLine = (text: string, f: (line: string) => string) => splitLines(text).map(f).join('\n')

const toggle = (id: string, label: string, def: boolean, hint?: string): Field => ({ kind: 'toggle', id, label, default: def, hint })

/** Output plus how much the text changed. */
function changed(input: string, output: string, noun = 'Characters removed'): Result {
  const diff = [...input].length - [...output].length
  return {
    text: output,
    stats: [
      { label: noun, value: Math.max(0, diff) },
      { label: 'Characters left', value: [...output].length },
      { label: 'Lines', value: output === '' ? 0 : splitLines(output).length },
    ],
  }
}

function caseSpec(label: string, convert: (text: string, v: Values) => string, fields?: Field[]): Spec {
  return {
    input: { label: 'Your text', sample: SAMPLE_PROSE, hint: 'Each line is converted on its own.' },
    output: { label, filename: `${label.toLowerCase().replace(/[^a-z]+/g, '-')}.txt` },
    fields,
    run: (input, v) => convert(input, v),
  }
}

const IDENT_HINT = 'Each line becomes one identifier. Spaces, dashes, underscores and case changes split words.'

function identSpec(label: string, convert: (s: string) => string): Spec {
  return {
    input: { label: 'Words or identifiers', sample: 'user profile settings\nHTTPResponseCode\nmax-retry-count\nfirst_name', hint: IDENT_HINT, mono: true },
    output: { label, filename: 'identifiers.txt' },
    run: (input) => perLine(input, convert),
  }
}

function listResult(found: Found, noun: string, extra: Result['stats'] = []): Result {
  return {
    text: found.items.join('\n'),
    stats: [{ label: `${noun} found`, value: found.items.length }, { label: 'Matches with repeats', value: found.total }, ...extra],
    note: found.items.length === 0 ? `No ${noun.toLowerCase()} in this text.` : undefined,
  }
}

const UNIQUE = toggle('unique', 'Remove duplicates', true)
const SORT = toggle('sort', 'Sort A to Z', false)

export const TEXT_SPECS: Specs = {
  /* ── case ── */
  'uppercase-converter': caseSpec('UPPERCASE text', (t) => t.toUpperCase()),
  'lowercase-converter': caseSpec('lowercase text', (t) => t.toLowerCase()),
  'title-case-converter': caseSpec(
    'Title Case text',
    (t, v) =>
      str(v, 'style') === 'every'
        ? t.toLowerCase().replace(/(^|[\s"'([{/-])(\p{L})/gu, (_m, pre: string, c: string) => pre + c.toUpperCase())
        : toTitleCase(t),
    [
      {
        kind: 'choice',
        id: 'style',
        label: 'Style',
        default: 'headline',
        choices: [
          { value: 'headline', label: 'Headline' },
          { value: 'every', label: 'Every word' },
        ],
        hint: 'Headline keeps short words such as of, and, the in lowercase unless they start or end the line.',
      },
    ],
  ),
  'sentence-case-converter': caseSpec('Sentence case text', (t) => toSentenceCase(t)),
  'camel-case-converter': identSpec('camelCase', toCamelCase),
  'snake-case-converter': identSpec('snake_case', toSnakeCase),
  'kebab-case-converter': identSpec('kebab-case', toKebabCase),
  'pascal-case-converter': identSpec('PascalCase', toPascalCase),
  'constant-case-converter': identSpec('CONSTANT_CASE', toConstantCase),
  'alternating-case-converter': caseSpec('aLtErNaTiNg text', (t, v) => toAlternatingCase(t, str(v, 'start') === 'upper'), [
    {
      kind: 'choice',
      id: 'start',
      label: 'First letter',
      default: 'lower',
      choices: [
        { value: 'lower', label: 'lowercase' },
        { value: 'upper', label: 'UPPERCASE' },
      ],
    },
  ]),

  /* ── clean-up ── */
  'remove-extra-spaces': {
    input: { label: 'Text with extra spaces', sample: '  This   sentence has    too many\tspaces.  \n   And this line  starts with some.' },
    output: { label: 'Clean text', filename: 'clean-text.txt' },
    fields: [toggle('trim', 'Trim each line', true, 'Removes spaces at the start and end of every line.'), toggle('tabs', 'Also tabs and wide spaces', true, 'Tabs, non-breaking and thin spaces become one normal space.')],
    run: (input, v) => changed(input, removeExtraSpaces(input, { trim: bool(v, 'trim'), tabs: bool(v, 'tabs') })),
  },
  'remove-empty-lines': {
    input: { label: 'Text with empty lines', sample: 'First line\n\n\nSecond line\n   \nThird line\n\n\n\nFourth line' },
    output: { label: 'Text without empty lines', filename: 'no-empty-lines.txt' },
    fields: [toggle('keepParagraphs', 'Keep one blank line between paragraphs', false, 'Several blank lines become one, so paragraphs stay apart.')],
    run: (input, v) => {
      const out = removeEmptyLines(input, { keepParagraphs: bool(v, 'keepParagraphs') })
      const before = splitLines(input).length
      const after = out === '' ? 0 : splitLines(out).length
      return { text: out, stats: [{ label: 'Lines removed', value: before - after }, { label: 'Lines left', value: after }] }
    },
  },
  'remove-punctuation': {
    input: { label: 'Text', sample: "Wait... what?! It's a well-known fact: commas, periods (and brackets) are punctuation; $5 + 10% are symbols." },
    output: { label: 'Text without punctuation', filename: 'no-punctuation.txt' },
    fields: [
      toggle('apostrophes', "Keep apostrophes in words (don't)", true),
      toggle('hyphens', 'Keep hyphens in words (well-known)', false),
      toggle('symbols', 'Also remove symbols ($ % + = @)', false),
    ],
    run: (input, v) =>
      changed(input, removePunctuation(input, { apostrophes: bool(v, 'apostrophes'), hyphens: bool(v, 'hyphens'), symbols: bool(v, 'symbols') })),
  },
  'remove-numbers-from-text': {
    input: { label: 'Text', sample: 'Order 4521 shipped on 12 March with 3 items for 1,299.50 dollars.\nRoom 101, floor 2.' },
    output: { label: 'Text without numbers', filename: 'no-numbers.txt' },
    fields: [
      toggle('whole', 'Remove whole numbers with their separators', true, 'Off removes only the digits, so 1,299.50 leaves ",.".'),
      toggle('tidy', 'Tidy the spaces left behind', true),
    ],
    run: (input, v) => changed(input, removeNumbers(input, { whole: bool(v, 'whole'), tidy: bool(v, 'tidy') })),
  },
  'remove-accents': {
    input: { label: 'Text with accents', sample: 'Crème brûlée, jalapeño, Zoë, São Paulo, Ærøskøbing, Łódź, straße' },
    output: { label: 'Text without accents', filename: 'no-accents.txt' },
    fields: [toggle('letters', 'Also replace special letters (ø, ß, æ, ł)', true, 'These letters have no separate accent mark, so they are swapped for o, ss, ae and l.')],
    run: (input, v) => {
      const letters = bool(v, 'letters')
      const out = removeAccents(input, { letters })
      const accented = [...input.normalize('NFC')].filter((c) => removeAccents(c, { letters }) !== c).length
      return { text: out, stats: [{ label: 'Letters changed', value: accented }, { label: 'Characters', value: [...out].length }] }
    },
  },
  'remove-html-tags': {
    input: {
      label: 'HTML',
      mono: true,
      sample:
        '<article>\n  <h1>Release notes</h1>\n  <p>Version <b>2.1</b> fixes &amp; improves:</p>\n  <ul><li>Faster start</li><li>Fewer crashes</li></ul>\n  <script>track()</script>\n</article>',
    },
    output: { label: 'Plain text', filename: 'plain-text.txt', mono: false },
    fields: [
      toggle('breaks', 'Keep line breaks from blocks', true, 'Paragraphs, headings and list items start new lines; list items get a dash.'),
      toggle('entities', 'Decode entities (&amp; to &)', true),
    ],
    run: (input, v) => changed(input, stripHtml(input, { breaks: bool(v, 'breaks'), entities: bool(v, 'entities') })),
  },
  'remove-special-characters': {
    input: { label: 'Text', sample: 'Hello™ wörld! Price: $49.99 → now #1 *best* deal © 2026 <3' },
    output: { label: 'Clean text', filename: 'clean-text.txt' },
    fields: [
      toggle('punctuation', 'Keep basic punctuation (. , ; : ! ? \' " ( ) -)', true),
      toggle('accents', 'Keep accented letters', true, 'Off turns é into e and ß into ss instead.'),
    ],
    run: (input, v) => changed(input, removeSpecial(input, { punctuation: bool(v, 'punctuation'), accents: bool(v, 'accents') })),
  },
  'remove-emojis': {
    input: { label: 'Text with emoji', sample: 'Launch day 🚀🎉 Thanks team 👍🏽 See you in 🇫🇷 ❤️ #1 1️⃣ © 2026' },
    output: { label: 'Text without emoji', filename: 'no-emoji.txt' },
    fields: [toggle('tidy', 'Tidy the spaces left behind', true)],
    run: (input, v) => {
      const out = removeEmoji(input, { tidy: bool(v, 'tidy') })
      return { text: out, stats: [{ label: 'Emoji removed', value: countEmoji(input) }, { label: 'Characters left', value: [...out].length }] }
    },
  },
  'remove-non-ascii-characters': {
    input: { label: 'Text', sample: 'Café “quotes” — dashes… naïve 日本 ✓ résumé' },
    output: { label: 'ASCII text', filename: 'ascii.txt' },
    fields: [
      toggle('transliterate', 'Replace with the nearest ASCII first', true, 'é becomes e, curly quotes become straight, dashes become hyphens. Off deletes them.'),
      toggle('keepLines', 'Keep tabs and line breaks', true),
    ],
    run: (input, v) => changed(input, removeNonAscii(input, { transliterate: bool(v, 'transliterate'), keepLines: bool(v, 'keepLines') })),
  },
  'smart-quotes-to-straight-quotes': {
    input: { label: 'Text', sample: '“Don’t worry,” she said — it’s ‘fine’…' },
    output: { label: 'Converted text', filename: 'quotes.txt' },
    modes: [
      { id: 'straight', label: 'Smart to straight', run: (input, v) => changed(input, smartToStraight(input, { dashes: bool(v, 'dashes') }), 'Characters shorter') },
      { id: 'smart', label: 'Straight to smart', sample: '"Don\'t worry," she said. It\'s \'fine\'.', run: (input) => straightToSmart(input) },
    ],
    fields: [{ ...toggle('dashes', 'Also dashes, ellipses and non-breaking spaces', true), modes: ['straight'] }],
  },
  'tabs-to-spaces': {
    input: { label: 'Text or code', mono: true, sample: 'function main() {\n\tif (ok) {\n\t\treturn 1\n\t}\n}' },
    output: { label: 'Converted text', filename: 'converted.txt' },
    fields: [
      { kind: 'number', id: 'width', label: 'Tab width', default: 4, min: 1, max: 16 },
      { ...toggle('leading', 'Only the indentation at the start of lines', true), modes: ['tabs'] },
    ],
    swap: true,
    modes: [
      { id: 'spaces', label: 'Tabs to spaces', run: (input, v) => tabsToSpaces(input, num(v, 'width')) },
      { id: 'tabs', label: 'Spaces to tabs', sample: 'function main() {\n    if (ok) {\n        return 1\n    }\n}', run: (input, v) => spacesToTabs(input, num(v, 'width'), bool(v, 'leading')) },
    ],
  },
  'remove-duplicate-words': {
    input: { label: 'Text', sample: 'This is is a test of the the tool.\nThe tool removes repeated repeated words.' },
    output: { label: 'Text without duplicates', filename: 'no-duplicate-words.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'scope',
        label: 'Remove',
        default: 'adjacent',
        choices: [
          { value: 'adjacent', label: 'Repeats in a row' },
          { value: 'all', label: 'Every repeat' },
        ],
        hint: 'Repeats in a row fixes typos such as "the the". Every repeat keeps only the first use of each word.',
      },
      toggle('caseSensitive', 'Case sensitive', false),
    ],
    run: (input, v) => {
      const r = removeDuplicateWords(input, { everywhere: str(v, 'scope') === 'all', caseSensitive: bool(v, 'caseSensitive') })
      return { text: r.text, stats: [{ label: 'Words removed', value: r.removed }] }
    },
  },

  /* ── lines ── */
  'add-line-numbers': {
    input: { label: 'Lines', sample: 'Preheat the oven\nMix the flour and sugar\n\nAdd the eggs\nBake for 25 minutes' },
    output: { label: 'Numbered lines', filename: 'numbered.txt' },
    fields: [
      { kind: 'number', id: 'start', label: 'Start at', default: 1, min: -1000000, max: 1000000 },
      {
        kind: 'choice',
        id: 'separator',
        label: 'After the number',
        default: '. ',
        choices: [
          { value: '. ', label: '1. ' },
          { value: ') ', label: '1) ' },
          { value: ': ', label: '1: ' },
          { value: '\t', label: 'Tab' },
          { value: ' ', label: 'Space' },
          { value: ' | ', label: '1 | ' },
        ],
      },
      toggle('pad', 'Pad with zeros (01, 02)', false),
      toggle('skipEmpty', 'Skip empty lines', true),
    ],
    run: (input, v) =>
      addLineNumbers(input, { start: num(v, 'start'), separator: str(v, 'separator'), pad: bool(v, 'pad'), skipEmpty: bool(v, 'skipEmpty') }),
  },
  'add-prefix-and-suffix-to-lines': {
    input: { label: 'Lines', sample: 'apple\nbanana\ncherry', mono: true },
    output: { label: 'Result', filename: 'lines.txt' },
    fields: [
      { kind: 'text', id: 'prefix', label: 'Prefix', default: "'", mono: true },
      { kind: 'text', id: 'suffix', label: 'Suffix', default: "',", mono: true },
      toggle('skipEmpty', 'Skip empty lines', true),
    ],
    run: (input, v) => wrapLines(input, { prefix: str(v, 'prefix'), suffix: str(v, 'suffix'), skipEmpty: bool(v, 'skipEmpty') }),
  },
  'split-text': {
    input: {
      label: 'Text to split',
      sample:
        'Long posts are easier to read in parts. This tool cuts text into pieces of a set size, so each piece fits a post, a text message or a form field. Words stay whole when it splits by characters.',
    },
    output: { label: 'Pieces', filename: 'pieces.txt', mono: false },
    fields: [
      {
        kind: 'choice',
        id: 'by',
        label: 'Split by',
        default: 'characters',
        choices: [
          { value: 'characters', label: 'Characters' },
          { value: 'words', label: 'Words' },
          { value: 'sentences', label: 'Sentences' },
          { value: 'delimiter', label: 'Delimiter' },
        ],
      },
      { kind: 'number', id: 'size', label: 'Size of each piece', default: 80, min: 1, max: 1000000 },
      { kind: 'text', id: 'delimiter', label: 'Delimiter', default: ',', mono: true, hint: 'Write \\n for a line break, \\t for a tab.' },
    ],
    run: (input, v) => {
      const by = str(v, 'by') as 'characters' | 'words' | 'sentences' | 'delimiter'
      const parts = splitText(input, by, num(v, 'size'), str(v, 'delimiter'))
      const longest = parts.reduce((m, p) => Math.max(m, [...p].length), 0)
      return {
        text: parts.join(by === 'delimiter' ? '\n' : '\n\n'),
        stats: [{ label: 'Pieces', value: parts.length }, { label: 'Longest piece', value: `${longest} chars` }],
      }
    },
  },
  'wrap-text': {
    input: {
      label: 'Text to wrap',
      sample:
        'Hard wrapping inserts line breaks so that no line is longer than a set width. Plain text email, commit messages and code comments often use 72 or 80 columns.',
    },
    output: { label: 'Wrapped text', filename: 'wrapped.txt' },
    fields: [
      { kind: 'number', id: 'width', label: 'Line width (characters)', default: 72, min: 1, max: 1000 },
      toggle('breakWords', 'Break words longer than the width', false),
    ],
    run: (input, v) => {
      const out = wrapText(input, num(v, 'width'), bool(v, 'breakWords'))
      const longest = splitLines(out).reduce((m, l) => Math.max(m, l.length), 0)
      return { text: out, stats: [{ label: 'Lines', value: splitLines(out).length }, { label: 'Longest line', value: `${longest} chars` }] }
    },
  },
  'list-to-comma-separated': {
    input: { label: 'List, one item per line', sample: 'apple\nbanana\ncherry\nbanana\n  date  ', mono: true },
    output: { label: 'Comma-separated list', filename: 'list.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'separator',
        label: 'Separator',
        default: ', ',
        choices: [
          { value: ', ', label: 'Comma and space' },
          { value: ',', label: 'Comma' },
          { value: '; ', label: 'Semicolon' },
          { value: ' | ', label: 'Pipe' },
          { value: ' ', label: 'Space' },
          { value: '\t', label: 'Tab' },
        ],
      },
      {
        kind: 'choice',
        id: 'quote',
        label: 'Quotes',
        default: '',
        choices: [
          { value: '', label: 'None' },
          { value: "'", label: "'single'" },
          { value: '"', label: '"double"' },
        ],
      },
      {
        kind: 'choice',
        id: 'wrap',
        label: 'Wrap in',
        default: '',
        choices: [
          { value: '', label: 'Nothing' },
          { value: '()', label: '( )' },
          { value: '[]', label: '[ ]' },
        ],
        hint: "Single quotes in ( ) give an SQL IN list: ('a', 'b').",
      },
      toggle('trim', 'Trim spaces', true),
      toggle('dedupe', 'Remove duplicates', false),
    ],
    run: (input, v) => {
      const r = listToDelimited(input, { separator: str(v, 'separator'), quote: str(v, 'quote'), wrap: str(v, 'wrap'), trim: bool(v, 'trim'), dedupe: bool(v, 'dedupe') })
      return { text: r.text, stats: [{ label: 'Items', value: r.count }] }
    },
  },
  'comma-separated-to-list': {
    input: { label: 'Comma-separated values', sample: 'apple, banana, "cherry, red", date;', mono: true },
    output: { label: 'List, one item per line', filename: 'list.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'separator',
        label: 'Separator',
        default: 'auto',
        choices: [
          { value: 'auto', label: 'Detect' },
          { value: ',', label: 'Comma' },
          { value: ';', label: 'Semicolon' },
          { value: '|', label: 'Pipe' },
          { value: '\t', label: 'Tab' },
          { value: ' ', label: 'Space' },
        ],
      },
      toggle('trim', 'Trim spaces', true),
      toggle('unquote', 'Remove surrounding quotes', true),
      toggle('dedupe', 'Remove duplicates', false),
    ],
    run: (input, v) => {
      const r = delimitedToList(input, { separator: str(v, 'separator'), trim: bool(v, 'trim'), unquote: bool(v, 'unquote'), dedupe: bool(v, 'dedupe') })
      const name: Record<string, string> = { ',': 'comma', ';': 'semicolon', '|': 'pipe', '\t': 'tab', ' ': 'space', '\n': 'line break' }
      return { text: r.text, stats: [{ label: 'Items', value: r.count }, { label: 'Separator', value: name[r.separator] ?? r.separator }] }
    },
  },

  /* ── extraction ── */
  'extract-emails': {
    input: { label: 'Text that contains email addresses', sample: 'Contact sales@example.com or Support <help@example.org>.\nCC: jane.doe+news@mail.example.co.uk, SALES@example.com' },
    output: { label: 'Email addresses', filename: 'emails.txt' },
    fields: [UNIQUE, SORT, toggle('lower', 'Lowercase', true, 'Lowercase also makes SALES@ and sales@ the same address.')],
    run: (input, v) => {
      const f = extractEmails(input, { unique: bool(v, 'unique'), sort: bool(v, 'sort'), lower: bool(v, 'lower') })
      const domains = new Set(f.items.map((e) => e.split('@')[1].toLowerCase()))
      return listResult(f, 'Emails', [{ label: 'Domains', value: domains.size }])
    },
  },
  'extract-urls': {
    input: { label: 'Text that contains links', sample: 'Docs at https://example.com/docs?page=2#setup, the wiki (https://en.example.org/wiki/Foo_(bar)) and www.example.net.' },
    output: { label: 'URLs', filename: 'urls.txt' },
    fields: [UNIQUE, SORT, toggle('www', 'Include links without http (www.)', true)],
    run: (input, v) => listResult(extractUrls(input, { unique: bool(v, 'unique'), sort: bool(v, 'sort'), www: bool(v, 'www') }), 'URLs'),
  },
  'extract-numbers': {
    input: { label: 'Text that contains numbers', sample: 'Q3 revenue was 1,204.50 on 38 orders, up 12.5% from -3 last year. Shipping: 7.99' },
    output: { label: 'Numbers', filename: 'numbers.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'decimal',
        label: 'Decimal mark',
        default: '.',
        choices: [
          { value: '.', label: 'Point (1,234.5)' },
          { value: ',', label: 'Comma (1.234,5)' },
        ],
      },
      toggle('unique', 'Remove duplicates', false),
      toggle('sort', 'Sort smallest first', false),
    ],
    run: (input, v) => {
      const { found, values } = extractNumbers(input, { decimal: str(v, 'decimal') === ',' ? ',' : '.', unique: bool(v, 'unique'), sort: bool(v, 'sort') })
      const sum = values.reduce((s, x) => s + x, 0)
      return {
        text: found.items.join('\n'),
        stats: [
          { label: 'Numbers', value: values.length },
          { label: 'Sum', value: sum },
          { label: 'Average', value: values.length ? sum / values.length : 0 },
          { label: 'Range', value: values.length ? `${Math.min(...values)} to ${Math.max(...values)}` : '–' },
        ],
        note: values.length === 0 ? 'No numbers in this text.' : undefined,
      }
    },
  },
  'extract-phone-numbers': {
    input: { label: 'Text that contains phone numbers', sample: 'Call +1 (415) 555-0132 or 020 7946 0958.\nFax: +44-20-7946-0000, office 555.0199 ext 12. Ref 2026-11-07.' },
    output: { label: 'Phone numbers', filename: 'phone-numbers.txt' },
    fields: [UNIQUE, toggle('normalize', 'Digits only (+14155550132)', false, 'Removes spaces, dots, dashes and brackets.')],
    run: (input, v) => listResult(extractPhones(input, { unique: bool(v, 'unique'), normalize: bool(v, 'normalize') }), 'Phone numbers'),
  },
  'extract-hashtags': {
    input: { label: 'Posts or captions', sample: 'Sunset at the pier #photography #Sunset #travel2026 with @jane_doe and @studio.north #sunset' },
    output: { label: 'Tags', filename: 'tags.txt' },
    modes: [
      { id: 'hashtags', label: 'Hashtags', outputLabel: 'Hashtags', run: (input, v) => listResult(extractTags(input, { kind: 'hashtags', unique: bool(v, 'unique'), sort: bool(v, 'sort'), lower: bool(v, 'lower') }), 'Hashtags') },
      { id: 'mentions', label: 'Mentions', outputLabel: 'Mentions', run: (input, v) => listResult(extractTags(input, { kind: 'mentions', unique: bool(v, 'unique'), sort: bool(v, 'sort'), lower: bool(v, 'lower') }), 'Mentions') },
    ],
    fields: [UNIQUE, SORT, toggle('lower', 'Lowercase', true, 'Most networks treat #Sunset and #sunset as the same tag.')],
  },
  'extract-ip-addresses': {
    input: { label: 'Logs or text', mono: true, sample: '2026-11-07 10:01:44 GET / 200 from 203.0.113.42\n10:02:10 denied 198.51.100.7 (blocklist 192.0.2.0/24)\n10:03:00 ok 2001:db8::8a2e:370:7334 via fe80::1%eth0\nversion 1.2.3.4.5 is not an address' },
    output: { label: 'IP addresses', filename: 'ip-addresses.txt' },
    fields: [UNIQUE, SORT, toggle('v6', 'Include IPv6', true)],
    run: (input, v) => listResult(extractIps(input, { v6: bool(v, 'v6'), unique: bool(v, 'unique'), sort: bool(v, 'sort') }), 'Addresses'),
  },

  /* ── ciphers ── */
  'rot13-encoder-decoder': {
    input: { label: 'Text', sample: 'Why did the chicken cross the road? Gb trg gb gur bgure fvqr.' },
    output: { label: 'ROT13 text', filename: 'rot13.txt' },
    swap: true,
    run: (input) => rot13(input),
  },
  'rot47-encoder-decoder': {
    input: { label: 'Text', sample: 'Meet at 9:30, gate #4.', mono: true },
    output: { label: 'ROT47 text', filename: 'rot47.txt' },
    swap: true,
    run: (input) => rot47(input),
  },
  'caesar-cipher': {
    input: { label: 'Text', sample: 'Attack at dawn' },
    output: { label: 'Result', filename: 'caesar.txt' },
    fields: [{ kind: 'number', id: 'shift', label: 'Shift', default: 3, min: -25, max: 25, modes: ['encode', 'decode'] }],
    swap: true,
    modes: [
      { id: 'encode', label: 'Encode', outputLabel: 'Encoded text', run: (input, v) => caesar(input, num(v, 'shift')) },
      { id: 'decode', label: 'Decode', outputLabel: 'Decoded text', sample: 'Dwwdfn dw gdzq', run: (input, v) => caesar(input, -num(v, 'shift')) },
      {
        id: 'crack',
        label: 'Find the shift',
        outputLabel: 'Most likely plain text',
        sample: 'Wkh vhfuhw phhwlqj lv dw qrrq lq wkh sdun',
        run: (input) => {
          const tries = crackCaesar(input)
          return {
            text: tries[0].text,
            stats: [{ label: 'Most likely shift', value: tries[0].shift }],
            table: { head: ['Shift', 'Text'], rows: tries.map((t) => [t.shift, t.text.slice(0, 120)]) },
            note: 'All 26 shifts, ranked by how close their letter frequencies are to English.',
          }
        },
      },
    ],
  },
  'vigenere-cipher': {
    input: { label: 'Text', sample: 'Attack at dawn' },
    output: { label: 'Result', filename: 'vigenere.txt' },
    fields: [{ kind: 'text', id: 'key', label: 'Key', default: 'LEMON', hint: 'Letters A to Z. Other characters in the key are ignored.' }],
    swap: true,
    modes: [
      { id: 'encode', label: 'Encrypt', outputLabel: 'Encrypted text', run: (input, v) => vigenere(input, str(v, 'key'), false) },
      { id: 'decode', label: 'Decrypt', outputLabel: 'Decrypted text', sample: 'Lxfopv ef rnhr', run: (input, v) => vigenere(input, str(v, 'key'), true) },
    ],
  },
  'atbash-cipher': {
    input: { label: 'Text', sample: 'Hello world' },
    output: { label: 'Atbash text', filename: 'atbash.txt' },
    swap: true,
    run: (input) => atbash(input),
  },
  'letters-to-numbers': {
    input: { label: 'Text', sample: 'Hello world' },
    output: { label: 'Result', filename: 'a1z26.txt' },
    swap: true,
    fields: [
      {
        kind: 'choice',
        id: 'joiner',
        label: 'Between letters',
        default: '-',
        choices: [
          { value: '-', label: '8-5-12' },
          { value: ' ', label: '8 5 12' },
          { value: ',', label: '8,5,12' },
        ],
        modes: ['encode'],
      },
      { ...toggle('upper', 'Uppercase letters', true), modes: ['decode'] },
    ],
    modes: [
      { id: 'encode', label: 'Letters to numbers', outputLabel: 'Numbers', run: (input, v) => lettersToNumbers(input, str(v, 'joiner')) },
      { id: 'decode', label: 'Numbers to letters', outputLabel: 'Letters', sample: '8-5-12-12-15 / 23-15-18-12-4', run: (input, v) => numbersToLetters(input, bool(v, 'upper')) },
    ],
  },
  'rail-fence-cipher': {
    input: { label: 'Text', sample: 'WE ARE DISCOVERED FLEE AT ONCE' },
    output: { label: 'Result', filename: 'rail-fence.txt' },
    fields: [
      { kind: 'number', id: 'rails', label: 'Rails', default: 3, min: 2, max: 50 },
      toggle('spaces', 'Remove spaces first', true, 'The classic form writes the message without spaces.'),
    ],
    swap: true,
    modes: [
      { id: 'encode', label: 'Encrypt', outputLabel: 'Encrypted text', run: (input, v) => railFence(bool(v, 'spaces') ? input.replace(/\s+/g, '') : input, num(v, 'rails'), false) },
      { id: 'decode', label: 'Decrypt', outputLabel: 'Decrypted text', sample: 'WECRLTEERDSOEEFEAOCAIVDEN', run: (input, v) => railFence(bool(v, 'spaces') ? input.replace(/\s+/g, '') : input, num(v, 'rails'), true) },
    ],
  },
  'baconian-cipher': {
    input: { label: 'Text', sample: 'Hide' },
    output: { label: 'Result', filename: 'bacon.txt' },
    fields: [
      {
        kind: 'choice',
        id: 'alphabet',
        label: 'Alphabet',
        default: '26',
        choices: [
          { value: '26', label: '26 letters' },
          { value: '24', label: '24 letters (I=J, U=V)' },
        ],
      },
    ],
    swap: true,
    modes: [
      { id: 'encode', label: 'Encode', outputLabel: 'A and B groups', run: (input, v) => baconEncode(input, str(v, 'alphabet') === '26') },
      { id: 'decode', label: 'Decode', outputLabel: 'Letters', sample: 'AABBB ABAAA AAABB AABAA', run: (input, v) => baconDecode(input, str(v, 'alphabet') === '26') },
    ],
  },
  'pig-latin-translator': {
    input: { label: 'English text', sample: 'The quick brown fox likes to eat yellow apples' },
    output: { label: 'Pig Latin', filename: 'pig-latin.txt', mono: false },
    fields: [
      {
        kind: 'choice',
        id: 'ending',
        label: 'Ending for words that start with a vowel',
        default: 'way',
        choices: [
          { value: 'way', label: '-way' },
          { value: 'yay', label: '-yay' },
          { value: 'ay', label: '-ay' },
        ],
      },
    ],
    run: (input, v) => pigLatin(input, str(v, 'ending')),
  },
  'leetspeak-translator': {
    input: { label: 'Text', sample: 'Elite hackers speak leet' },
    output: { label: 'Result', filename: 'leet.txt' },
    swap: true,
    fields: [{ ...toggle('full', 'Advanced alphabet (|-| for H, |_| for U)', false), modes: ['encode'] }],
    modes: [
      { id: 'encode', label: 'To leet', outputLabel: 'Leetspeak', run: (input, v) => toLeet(input, bool(v, 'full')) },
      { id: 'decode', label: 'From leet', outputLabel: 'Plain text', sample: '3l173 h4ck3r5 5p34k l337', run: (input) => fromLeet(input) },
    ],
  },
}
