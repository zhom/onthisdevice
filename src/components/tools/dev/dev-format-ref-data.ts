/**
 * Static reference tables for the `dev-format` batch's lookup pages:
 * MIME types, the ASCII table and HTML entities.
 *
 * All three are shipped as plain data so the pages render server-side and the
 * only JavaScript on them is the filter box.
 */

/* ------------------------------------------------------------------ */
/* MIME types                                                          */
/* ------------------------------------------------------------------ */

export interface MimeEntry {
  mime: string
  extensions: string[]
  name: string
  group: 'text' | 'image' | 'audio' | 'video' | 'application' | 'font' | 'archive' | 'document'
  note?: string
}

export const MIME_TYPES: MimeEntry[] = [
  // text
  { mime: 'text/plain', extensions: ['txt', 'log', 'text'], name: 'Plain text', group: 'text', note: 'Add `; charset=utf-8`. Without it, browsers guess, and old ones guess Latin-1.' },
  { mime: 'text/html', extensions: ['html', 'htm'], name: 'HTML document', group: 'text' },
  { mime: 'text/css', extensions: ['css'], name: 'Cascading style sheet', group: 'text', note: 'Serving CSS as text/plain makes browsers refuse it under X-Content-Type-Options: nosniff.' },
  { mime: 'text/javascript', extensions: ['js', 'mjs'], name: 'JavaScript', group: 'text', note: 'The IANA-registered type. application/javascript is obsolete but still widely accepted.' },
  { mime: 'text/csv', extensions: ['csv'], name: 'Comma-separated values', group: 'text', note: 'Excel opens text/csv inline; add Content-Disposition: attachment to force a download.' },
  { mime: 'text/markdown', extensions: ['md', 'markdown'], name: 'Markdown', group: 'text' },
  { mime: 'text/calendar', extensions: ['ics'], name: 'iCalendar', group: 'text' },
  { mime: 'text/vcard', extensions: ['vcf'], name: 'vCard contact', group: 'text' },
  { mime: 'text/xml', extensions: ['xml'], name: 'XML (human-readable)', group: 'text', note: 'Prefer application/xml unless the document is genuinely meant to be read as text.' },
  { mime: 'text/tab-separated-values', extensions: ['tsv'], name: 'Tab-separated values', group: 'text' },
  { mime: 'text/event-stream', extensions: [], name: 'Server-sent events', group: 'text', note: 'Must not be buffered by a proxy or the stream never arrives.' },

  // image
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg', 'jpe'], name: 'JPEG image', group: 'image', note: 'image/jpg is not a real type. Some servers send it, but it is wrong.' },
  { mime: 'image/png', extensions: ['png'], name: 'PNG image', group: 'image' },
  { mime: 'image/gif', extensions: ['gif'], name: 'GIF image', group: 'image' },
  { mime: 'image/webp', extensions: ['webp'], name: 'WebP image', group: 'image' },
  { mime: 'image/avif', extensions: ['avif'], name: 'AVIF image', group: 'image' },
  { mime: 'image/svg+xml', extensions: ['svg'], name: 'SVG vector image', group: 'image', note: 'SVG can contain script. Serve user-uploaded SVG from a separate origin or with a strict CSP.' },
  { mime: 'image/x-icon', extensions: ['ico'], name: 'Windows icon', group: 'image', note: 'image/vnd.microsoft.icon is the registered type; image/x-icon is what everything sends.' },
  { mime: 'image/bmp', extensions: ['bmp'], name: 'Bitmap image', group: 'image' },
  { mime: 'image/tiff', extensions: ['tif', 'tiff'], name: 'TIFF image', group: 'image' },
  { mime: 'image/heic', extensions: ['heic'], name: 'HEIC image', group: 'image', note: 'iPhone default. Only Safari decodes it natively.' },
  { mime: 'image/apng', extensions: ['apng'], name: 'Animated PNG', group: 'image' },

  // audio
  { mime: 'audio/mpeg', extensions: ['mp3'], name: 'MP3 audio', group: 'audio', note: 'Not audio/mp3. That type does not exist.' },
  { mime: 'audio/wav', extensions: ['wav'], name: 'WAV audio', group: 'audio', note: 'audio/x-wav and audio/wave also appear in the wild.' },
  { mime: 'audio/ogg', extensions: ['ogg', 'oga'], name: 'Ogg audio', group: 'audio' },
  { mime: 'audio/webm', extensions: ['weba'], name: 'WebM audio', group: 'audio' },
  { mime: 'audio/aac', extensions: ['aac'], name: 'AAC audio', group: 'audio' },
  { mime: 'audio/mp4', extensions: ['m4a'], name: 'MPEG-4 audio', group: 'audio' },
  { mime: 'audio/flac', extensions: ['flac'], name: 'FLAC audio', group: 'audio' },
  { mime: 'audio/opus', extensions: ['opus'], name: 'Opus audio', group: 'audio' },

  // video
  { mime: 'video/mp4', extensions: ['mp4', 'm4v'], name: 'MPEG-4 video', group: 'video', note: 'Add `#t=0.1` or a poster if the first frame is black. That is a container issue, not a MIME one.' },
  { mime: 'video/webm', extensions: ['webm'], name: 'WebM video', group: 'video' },
  { mime: 'video/quicktime', extensions: ['mov'], name: 'QuickTime video', group: 'video' },
  { mime: 'video/x-msvideo', extensions: ['avi'], name: 'AVI video', group: 'video' },
  { mime: 'video/x-matroska', extensions: ['mkv'], name: 'Matroska video', group: 'video' },
  { mime: 'video/mpeg', extensions: ['mpeg', 'mpg'], name: 'MPEG video', group: 'video' },
  { mime: 'video/ogg', extensions: ['ogv'], name: 'Ogg video', group: 'video' },

  // application / data
  { mime: 'application/json', extensions: ['json'], name: 'JSON', group: 'application', note: 'No charset parameter is defined. JSON is always UTF-8.' },
  { mime: 'application/ld+json', extensions: ['jsonld'], name: 'JSON-LD', group: 'application' },
  { mime: 'application/xml', extensions: ['xml'], name: 'XML', group: 'application' },
  { mime: 'application/pdf', extensions: ['pdf'], name: 'PDF document', group: 'document' },
  { mime: 'application/zip', extensions: ['zip'], name: 'ZIP archive', group: 'archive' },
  { mime: 'application/gzip', extensions: ['gz'], name: 'Gzip archive', group: 'archive' },
  { mime: 'application/x-tar', extensions: ['tar'], name: 'Tar archive', group: 'archive' },
  { mime: 'application/x-7z-compressed', extensions: ['7z'], name: '7-Zip archive', group: 'archive' },
  { mime: 'application/vnd.rar', extensions: ['rar'], name: 'RAR archive', group: 'archive' },
  { mime: 'application/octet-stream', extensions: ['bin'], name: 'Arbitrary binary data', group: 'application', note: 'The fallback when nothing is known. Browsers download rather than display it.' },
  { mime: 'application/x-www-form-urlencoded', extensions: [], name: 'URL-encoded form data', group: 'application' },
  { mime: 'multipart/form-data', extensions: [], name: 'Multipart form data', group: 'application', note: 'Required for file uploads. Never set the boundary yourself; let the client library do it.' },
  { mime: 'application/wasm', extensions: ['wasm'], name: 'WebAssembly module', group: 'application', note: 'Required for WebAssembly.instantiateStreaming(); the wrong type makes it fall back or fail.' },
  { mime: 'application/manifest+json', extensions: ['webmanifest'], name: 'Web app manifest', group: 'application' },
  { mime: 'application/rss+xml', extensions: ['rss'], name: 'RSS feed', group: 'application' },
  { mime: 'application/atom+xml', extensions: ['atom'], name: 'Atom feed', group: 'application' },
  { mime: 'application/yaml', extensions: ['yaml', 'yml'], name: 'YAML', group: 'application' },
  { mime: 'application/sql', extensions: ['sql'], name: 'SQL script', group: 'application' },
  { mime: 'application/x-ndjson', extensions: ['ndjson', 'jsonl'], name: 'Newline-delimited JSON', group: 'application' },

  // office documents
  { mime: 'application/msword', extensions: ['doc'], name: 'Word 97–2003', group: 'document' },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'], name: 'Word document', group: 'document' },
  { mime: 'application/vnd.ms-excel', extensions: ['xls'], name: 'Excel 97–2003', group: 'document' },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'], name: 'Excel workbook', group: 'document' },
  { mime: 'application/vnd.ms-powerpoint', extensions: ['ppt'], name: 'PowerPoint 97–2003', group: 'document' },
  { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['pptx'], name: 'PowerPoint presentation', group: 'document' },
  { mime: 'application/vnd.oasis.opendocument.text', extensions: ['odt'], name: 'OpenDocument text', group: 'document' },
  { mime: 'application/vnd.oasis.opendocument.spreadsheet', extensions: ['ods'], name: 'OpenDocument spreadsheet', group: 'document' },
  { mime: 'application/epub+zip', extensions: ['epub'], name: 'EPUB e-book', group: 'document' },
  { mime: 'application/rtf', extensions: ['rtf'], name: 'Rich Text Format', group: 'document' },

  // fonts
  { mime: 'font/woff', extensions: ['woff'], name: 'WOFF font', group: 'font' },
  { mime: 'font/woff2', extensions: ['woff2'], name: 'WOFF2 font', group: 'font', note: 'The only web font format worth serving in 2026. Every current browser supports it.' },
  { mime: 'font/ttf', extensions: ['ttf'], name: 'TrueType font', group: 'font' },
  { mime: 'font/otf', extensions: ['otf'], name: 'OpenType font', group: 'font' },
  { mime: 'application/vnd.ms-fontobject', extensions: ['eot'], name: 'Embedded OpenType', group: 'font', note: 'Internet Explorer only. Safe to drop.' },
]

/* ------------------------------------------------------------------ */
/* ASCII table                                                         */
/* ------------------------------------------------------------------ */

export interface AsciiRow {
  dec: number
  hex: string
  oct: string
  bin: string
  char: string
  /** Short name for control characters, e.g. "LF". */
  abbr?: string
  description: string
  group: 'control' | 'printable' | 'extended'
  /** C / regex escape where one exists. */
  escape?: string
  htmlEntity?: string
}

const CONTROL_NAMES: [string, string, string?][] = [
  ['NUL', 'Null: terminates C strings', '\\0'],
  ['SOH', 'Start of heading'],
  ['STX', 'Start of text'],
  ['ETX', 'End of text: what Ctrl+C sends'],
  ['EOT', 'End of transmission: what Ctrl+D sends'],
  ['ENQ', 'Enquiry'],
  ['ACK', 'Acknowledge'],
  ['BEL', 'Bell: makes the terminal beep', '\\a'],
  ['BS', 'Backspace', '\\b'],
  ['HT', 'Horizontal tab', '\\t'],
  ['LF', 'Line feed: the newline on Unix and in HTTP', '\\n'],
  ['VT', 'Vertical tab', '\\v'],
  ['FF', 'Form feed: page break', '\\f'],
  ['CR', 'Carriage return: paired with LF on Windows', '\\r'],
  ['SO', 'Shift out'],
  ['SI', 'Shift in'],
  ['DLE', 'Data link escape'],
  ['DC1', 'Device control 1 (XON)'],
  ['DC2', 'Device control 2'],
  ['DC3', 'Device control 3 (XOFF)'],
  ['DC4', 'Device control 4'],
  ['NAK', 'Negative acknowledge'],
  ['SYN', 'Synchronous idle'],
  ['ETB', 'End of transmission block'],
  ['CAN', 'Cancel'],
  ['EM', 'End of medium'],
  ['SUB', 'Substitute: end-of-file on Windows consoles'],
  ['ESC', 'Escape: starts every ANSI terminal sequence', '\\e'],
  ['FS', 'File separator'],
  ['GS', 'Group separator'],
  ['RS', 'Record separator'],
  ['US', 'Unit separator'],
]

const PRINTABLE_NOTES: Record<number, string> = {
  32: 'Space: percent-encodes to %20, or + in form data',
  33: 'Exclamation mark',
  34: 'Double quote: &quot; in HTML',
  35: 'Number sign / hash: starts the fragment in a URL',
  36: 'Dollar sign',
  37: 'Percent sign: starts a percent-encoded byte',
  38: 'Ampersand: &amp; in HTML, separates query parameters',
  39: "Apostrophe: &apos; in HTML",
  40: 'Left parenthesis',
  41: 'Right parenthesis',
  42: 'Asterisk',
  43: 'Plus sign: means a space in form-encoded data',
  44: 'Comma',
  45: 'Hyphen-minus',
  46: 'Full stop',
  47: 'Solidus / slash',
  58: 'Colon',
  59: 'Semicolon',
  60: 'Less-than: &lt; in HTML',
  61: 'Equals sign',
  62: 'Greater-than: &gt; in HTML',
  63: 'Question mark: starts the query string',
  64: 'Commercial at',
  91: 'Left square bracket',
  92: 'Reverse solidus / backslash: the escape character',
  93: 'Right square bracket',
  94: 'Circumflex accent',
  95: 'Low line / underscore',
  96: 'Grave accent: the JavaScript template literal delimiter',
  123: 'Left curly bracket',
  124: 'Vertical line / pipe',
  125: 'Right curly bracket',
  126: 'Tilde',
}

const EXTENDED_NOTES: Record<number, string> = {
  160: 'Non-breaking space: &nbsp;',
  161: 'Inverted exclamation mark',
  162: 'Cent sign',
  163: 'Pound sign',
  164: 'Currency sign',
  165: 'Yen sign',
  169: 'Copyright sign',
  171: 'Left double angle quote',
  174: 'Registered sign',
  176: 'Degree sign',
  177: 'Plus-minus sign',
  180: 'Acute accent',
  183: 'Middle dot',
  187: 'Right double angle quote',
  191: 'Inverted question mark',
  215: 'Multiplication sign',
  247: 'Division sign',
}

export function buildAsciiTable(): AsciiRow[] {
  const rows: AsciiRow[] = []
  for (let dec = 0; dec <= 255; dec += 1) {
    const hex = dec.toString(16).toUpperCase().padStart(2, '0')
    const oct = dec.toString(8).padStart(3, '0')
    const bin = dec.toString(2).padStart(8, '0')

    if (dec < 32) {
      const [abbr, description, escape] = CONTROL_NAMES[dec]
      rows.push({ dec, hex, oct, bin, char: `^${String.fromCharCode(64 + dec)}`, abbr, description, group: 'control', escape })
      continue
    }
    if (dec === 127) {
      rows.push({ dec, hex, oct, bin, char: 'DEL', abbr: 'DEL', description: 'Delete', group: 'control' })
      continue
    }
    if (dec < 127) {
      const char = String.fromCharCode(dec)
      const entity =
        dec === 34 ? '&quot;' : dec === 38 ? '&amp;' : dec === 39 ? '&apos;' : dec === 60 ? '&lt;' : dec === 62 ? '&gt;' : undefined
      rows.push({
        dec,
        hex,
        oct,
        bin,
        char: dec === 32 ? '␠' : char,
        description:
          PRINTABLE_NOTES[dec] ??
          (dec >= 48 && dec <= 57
            ? `Digit ${char}`
            : dec >= 65 && dec <= 90
              ? `Capital letter ${char}`
              : `Small letter ${char}`),
        group: 'printable',
        htmlEntity: entity,
      })
      continue
    }
    if (dec < 160) {
      rows.push({
        dec,
        hex,
        oct,
        bin,
        char: '–',
        description:
          'Unassigned in Latin-1 (C1 control range). Windows-1252 puts typographic characters here, which is where “smart quote” mojibake comes from.',
        group: 'extended',
      })
      continue
    }
    rows.push({
      dec,
      hex,
      oct,
      bin,
      char: String.fromCharCode(dec),
      description: EXTENDED_NOTES[dec] ?? `Latin-1 character ${String.fromCharCode(dec)}`,
      group: 'extended',
    })
  }
  return rows
}

/* ------------------------------------------------------------------ */
/* HTML entities                                                       */
/* ------------------------------------------------------------------ */

export interface EntityRow {
  char: string
  /** Named references, most canonical first. */
  names: string[]
  dec: number
  description: string
  group: 'reserved' | 'space' | 'punctuation' | 'currency' | 'math' | 'arrow' | 'greek' | 'accented' | 'symbol'
}

const raw: [string, string[], string, EntityRow['group']][] = [
  ['&', ['amp'], 'Ampersand: must be escaped in HTML and XML text and attribute values', 'reserved'],
  ['<', ['lt'], 'Less-than: must be escaped or the parser starts a tag', 'reserved'],
  ['>', ['gt'], 'Greater-than: escape it for symmetry and to avoid "]]>" edge cases', 'reserved'],
  ['"', ['quot'], 'Double quote: must be escaped inside a double-quoted attribute', 'reserved'],
  ["'", ['apos', '#39'], "Apostrophe: &apos; is HTML5 and XML; use &#39; for HTML4 compatibility", 'reserved'],
  [' ', ['nbsp'], 'Non-breaking space: prevents a line break and collapses differently from a normal space', 'space'],
  [' ', ['ensp'], 'En space: the width of an n', 'space'],
  [' ', ['emsp'], 'Em space: the width of an m', 'space'],
  [' ', ['thinsp'], 'Thin space: used before French punctuation and inside numbers', 'space'],
  ['‌', ['zwnj'], 'Zero-width non-joiner: stops two characters forming a ligature', 'space'],
  ['‍', ['zwj'], 'Zero-width joiner: forces a ligature; also glues emoji sequences together', 'space'],
  ['–', ['ndash'], 'En dash: number ranges such as 1914–1918', 'punctuation'],
  ['—', ['mdash'], 'Em dash: a parenthetical break in a sentence', 'punctuation'],
  ['‘', ['lsquo'], 'Left single quotation mark', 'punctuation'],
  ['’', ['rsquo'], 'Right single quotation mark: also the correct apostrophe in prose', 'punctuation'],
  ['“', ['ldquo'], 'Left double quotation mark', 'punctuation'],
  ['”', ['rdquo'], 'Right double quotation mark', 'punctuation'],
  ['„', ['bdquo'], 'Double low-9 quotation mark: opening quote in German', 'punctuation'],
  ['«', ['laquo'], 'Left-pointing double angle quotation mark: French guillemet', 'punctuation'],
  ['»', ['raquo'], 'Right-pointing double angle quotation mark', 'punctuation'],
  ['…', ['hellip'], 'Horizontal ellipsis: one character, not three full stops', 'punctuation'],
  ['·', ['middot'], 'Middle dot: a separator in breadcrumbs and bylines', 'punctuation'],
  ['•', ['bull'], 'Bullet', 'punctuation'],
  ['†', ['dagger'], 'Dagger: first footnote mark', 'punctuation'],
  ['‡', ['Dagger'], 'Double dagger: second footnote mark', 'punctuation'],
  ['§', ['sect'], 'Section sign', 'punctuation'],
  ['¶', ['para'], 'Pilcrow / paragraph sign', 'punctuation'],
  ['′', ['prime'], 'Prime: feet, minutes of arc', 'punctuation'],
  ['″', ['Prime'], 'Double prime: inches, seconds of arc', 'punctuation'],
  ['€', ['euro'], 'Euro sign', 'currency'],
  ['£', ['pound'], 'Pound sign', 'currency'],
  ['¥', ['yen'], 'Yen sign', 'currency'],
  ['¢', ['cent'], 'Cent sign', 'currency'],
  ['¤', ['curren'], 'Generic currency sign', 'currency'],
  ['₹', ['#8377'], 'Indian rupee sign: no named entity exists', 'currency'],
  ['©', ['copy'], 'Copyright sign', 'symbol'],
  ['®', ['reg'], 'Registered trademark sign', 'symbol'],
  ['™', ['trade'], 'Trademark sign', 'symbol'],
  ['°', ['deg'], 'Degree sign', 'symbol'],
  ['µ', ['micro'], 'Micro sign', 'symbol'],
  ['¦', ['brvbar'], 'Broken bar', 'symbol'],
  ['¡', ['iexcl'], 'Inverted exclamation mark', 'symbol'],
  ['¿', ['iquest'], 'Inverted question mark', 'symbol'],
  ['×', ['times'], 'Multiplication sign: not the letter x', 'math'],
  ['÷', ['divide'], 'Division sign', 'math'],
  ['±', ['plusmn'], 'Plus-minus sign', 'math'],
  ['−', ['minus'], 'Minus sign: wider than a hyphen', 'math'],
  ['≠', ['ne'], 'Not equal to', 'math'],
  ['≤', ['le'], 'Less than or equal to', 'math'],
  ['≥', ['ge'], 'Greater than or equal to', 'math'],
  ['≈', ['asymp'], 'Almost equal to', 'math'],
  ['∞', ['infin'], 'Infinity', 'math'],
  ['√', ['radic'], 'Square root', 'math'],
  ['∑', ['sum'], 'N-ary summation', 'math'],
  ['∏', ['prod'], 'N-ary product', 'math'],
  ['∫', ['int'], 'Integral', 'math'],
  ['∂', ['part'], 'Partial differential', 'math'],
  ['½', ['frac12'], 'Vulgar fraction one half', 'math'],
  ['¼', ['frac14'], 'Vulgar fraction one quarter', 'math'],
  ['¾', ['frac34'], 'Vulgar fraction three quarters', 'math'],
  ['²', ['sup2'], 'Superscript two', 'math'],
  ['³', ['sup3'], 'Superscript three', 'math'],
  ['←', ['larr'], 'Leftwards arrow', 'arrow'],
  ['→', ['rarr'], 'Rightwards arrow', 'arrow'],
  ['↑', ['uarr'], 'Upwards arrow', 'arrow'],
  ['↓', ['darr'], 'Downwards arrow', 'arrow'],
  ['↔', ['harr'], 'Left-right arrow', 'arrow'],
  ['⇒', ['rArr'], 'Rightwards double arrow', 'arrow'],
  ['⇐', ['lArr'], 'Leftwards double arrow', 'arrow'],
  ['↵', ['crarr'], 'Carriage return arrow', 'arrow'],
  ['α', ['alpha'], 'Greek small letter alpha', 'greek'],
  ['β', ['beta'], 'Greek small letter beta', 'greek'],
  ['γ', ['gamma'], 'Greek small letter gamma', 'greek'],
  ['δ', ['delta'], 'Greek small letter delta', 'greek'],
  ['ε', ['epsilon'], 'Greek small letter epsilon', 'greek'],
  ['θ', ['theta'], 'Greek small letter theta', 'greek'],
  ['λ', ['lambda'], 'Greek small letter lambda', 'greek'],
  ['μ', ['mu'], 'Greek small letter mu', 'greek'],
  ['π', ['pi'], 'Greek small letter pi', 'greek'],
  ['σ', ['sigma'], 'Greek small letter sigma', 'greek'],
  ['φ', ['phi'], 'Greek small letter phi', 'greek'],
  ['ω', ['omega'], 'Greek small letter omega', 'greek'],
  ['Δ', ['Delta'], 'Greek capital letter delta', 'greek'],
  ['Ω', ['Omega'], 'Greek capital letter omega', 'greek'],
  ['Σ', ['Sigma'], 'Greek capital letter sigma', 'greek'],
  ['á', ['aacute'], 'Latin small letter a with acute', 'accented'],
  ['à', ['agrave'], 'Latin small letter a with grave', 'accented'],
  ['â', ['acirc'], 'Latin small letter a with circumflex', 'accented'],
  ['ä', ['auml'], 'Latin small letter a with diaeresis', 'accented'],
  ['å', ['aring'], 'Latin small letter a with ring above', 'accented'],
  ['æ', ['aelig'], 'Latin small letter ae', 'accented'],
  ['ç', ['ccedil'], 'Latin small letter c with cedilla', 'accented'],
  ['é', ['eacute'], 'Latin small letter e with acute', 'accented'],
  ['è', ['egrave'], 'Latin small letter e with grave', 'accented'],
  ['ê', ['ecirc'], 'Latin small letter e with circumflex', 'accented'],
  ['ë', ['euml'], 'Latin small letter e with diaeresis', 'accented'],
  ['í', ['iacute'], 'Latin small letter i with acute', 'accented'],
  ['ñ', ['ntilde'], 'Latin small letter n with tilde', 'accented'],
  ['ó', ['oacute'], 'Latin small letter o with acute', 'accented'],
  ['ö', ['ouml'], 'Latin small letter o with diaeresis', 'accented'],
  ['ø', ['oslash'], 'Latin small letter o with stroke', 'accented'],
  ['ú', ['uacute'], 'Latin small letter u with acute', 'accented'],
  ['ü', ['uuml'], 'Latin small letter u with diaeresis', 'accented'],
  ['ß', ['szlig'], 'Latin small letter sharp s (eszett)', 'accented'],
  ['♠', ['spades'], 'Black spade suit', 'symbol'],
  ['♣', ['clubs'], 'Black club suit', 'symbol'],
  ['♥', ['hearts'], 'Black heart suit', 'symbol'],
  ['♦', ['diams'], 'Black diamond suit', 'symbol'],
  ['★', ['#9733'], 'Black star: no named entity', 'symbol'],
  ['✓', ['check', '#10003'], 'Check mark', 'symbol'],
  ['✗', ['#10007'], 'Ballot X', 'symbol'],
]

export const HTML_ENTITIES: EntityRow[] = raw.map(([char, names, description, group]) => ({
  char,
  names,
  dec: char.codePointAt(0) ?? 0,
  description,
  group,
}))

export function entityHex(row: EntityRow): string {
  return row.dec.toString(16).toUpperCase()
}
