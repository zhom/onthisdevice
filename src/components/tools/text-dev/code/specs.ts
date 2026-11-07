/** Code formatters, minifiers and validators. Libraries load on first use. */
import type { Field, Result, Specs } from '../shell/spec'
import { bool, num, str } from '../shell/spec'
import { minifyCss, minifyHtml } from './minify'

const bytes = (s: string) => new TextEncoder().encode(s).length

function sizeResult(input: string, output: string): Result {
  const a = bytes(input)
  const b = bytes(output)
  return {
    text: output,
    stats: [
      { label: 'Before', value: `${a.toLocaleString()} B` },
      { label: 'After', value: `${b.toLocaleString()} B` },
      { label: 'Saved', value: a ? `${(((a - b) / a) * 100).toFixed(1)}%` : '0%' },
    ],
  }
}

const INDENT: Field = {
  kind: 'choice',
  id: 'indent',
  label: 'Indent',
  default: '2',
  choices: [
    { value: '2', label: '2 spaces' },
    { value: '4', label: '4 spaces' },
    { value: 'tab', label: 'Tab' },
  ],
}

const indentOpts = (v: string) => (v === 'tab' ? { indent_size: 1, indent_char: '\t', indent_with_tabs: true } : { indent_size: Number(v), indent_char: ' ' })

async function beautifier() {
  return (await import('js-beautify')).default
}

const YAML_SAMPLE = `# Service settings
server:
    host: example.com
    ports: [80,   443]
    tls: {enabled: true, cert: /etc/ssl/cert.pem}
defaults: &defaults
    retries: 3
    timeout: 30
jobs:
  - name: backup
    <<: *defaults
    schedule: "0 3 * * *"
`

interface YamlIssue {
  message: string
  linePos?: readonly { line: number; col: number }[]
}

const issueRow = (e: YamlIssue, kind: string) => {
  const at = e.linePos?.[0]
  return { label: at ? `${kind}, line ${at.line}, column ${at.col}` : kind, value: e.message.split('\n')[0] }
}

async function parseYamlDocs(input: string) {
  const { parseAllDocuments } = await import('yaml')
  const parsed = parseAllDocuments(input, { prettyErrors: true })
  return Array.isArray(parsed) ? parsed : []
}

const HTML_SAMPLE = `<!doctype html><html><head><title>Example</title><style>body { margin: 0; color: #333333; }</style></head>
<body><!-- main content --><main><h1>Hello</h1><p>Some <b>bold</b> and <a href="/x"   class="link">a link</a>.</p>
<ul><li>One</li><li>Two</li></ul><pre>  keep   this  </pre></main></body></html>`

const CSS_SAMPLE = `/* Buttons */
.button,.button:hover{color:#ffffff;background:#000000;padding:8px 16px}
@media (min-width: 640px){.button{width:calc(100% - 2rem)}}
.card > .title + p { content: "a , b"; margin: 0 0 1rem 0; }`

const JS_SAMPLE = `function greet(name){if(!name){return "Hello, stranger"}const parts=["Hello",name];return parts.join(", ")+"!"}
const items=[1,2,3].map(n=>n*2).filter(n=>n>2);console.log(greet("Ada"),items)`

export const CODE_SPECS: Specs = {
  'yaml-formatter': {
    input: { label: 'YAML', sample: YAML_SAMPLE, mono: true, rows: 12 },
    output: { label: 'Formatted YAML', filename: 'formatted.yaml', rows: 14 },
    fields: [
      {
        kind: 'choice',
        id: 'indent',
        label: 'Indent',
        default: '2',
        choices: [
          { value: '2', label: '2 spaces' },
          { value: '4', label: '4 spaces' },
        ],
      },
      { kind: 'toggle', id: 'sort', label: 'Sort keys A to Z', default: false },
      { kind: 'toggle', id: 'flow', label: 'Expand inline lists and maps', default: true, hint: 'Writes [a, b] and {a: 1} as block style, one item per line.' },
    ],
    run: async (input, v) => {
      const docs = await parseYamlDocs(input)
      const errors = docs.flatMap((d) => d.errors)
      if (errors.length) throw new Error(errors[0].message)
      const { visit, isCollection, isMap } = await import('yaml')
      const out = docs.map((d) => {
        visit(d, (_key, node) => {
          if (bool(v, 'flow') && isCollection(node)) node.flow = false
          if (bool(v, 'sort') && isMap(node)) node.items.sort((a, b) => String(a.key).localeCompare(String(b.key)))
        })
        return d.toString({ indent: num(v, 'indent') || 2, lineWidth: 0 })
      })
      return {
        text: out.map((s, i) => (i > 0 && !s.startsWith('---') ? `---\n${s}` : s)).join(''),
        stats: [{ label: 'Documents', value: docs.length }, { label: 'Warnings', value: docs.reduce((n, d) => n + d.warnings.length, 0) }],
      }
    },
  },
  'yaml-validator': {
    input: { label: 'YAML to check', sample: YAML_SAMPLE.replace('    timeout: 30', '   timeout: 30'), mono: true, rows: 12 },
    output: { label: 'Report', filename: 'yaml-report.txt' },
    run: async (input) => {
      const docs = await parseYamlDocs(input)
      const errors = docs.flatMap((d) => d.errors)
      const warnings = docs.flatMap((d) => d.warnings)
      const rows = [...errors.map((e) => issueRow(e, 'Error')), ...warnings.map((w) => issueRow(w, 'Warning'))]
      const ok = errors.length === 0
      let detail = ''
      if (ok) {
        const values = docs.map((d) => d.toJS({ maxAliasCount: 1000 }) as unknown)
        const top = values[0]
        detail =
          top && typeof top === 'object' && !Array.isArray(top)
            ? `Top-level keys: ${Object.keys(top).slice(0, 12).join(', ')}`
            : `The document is a ${Array.isArray(top) ? 'list' : typeof top}.`
      }
      return {
        verdict: ok
          ? { ok: true, title: `Valid YAML: ${docs.length} document${docs.length === 1 ? '' : 's'}.`, detail }
          : { ok: false, title: `${errors.length} error${errors.length === 1 ? '' : 's'} found.`, detail: 'The first error is often the cause of the others.' },
        rows,
        text: ok ? `Valid YAML. ${detail}` : errors.map((e) => e.message).join('\n\n'),
      }
    },
  },
  'html-formatter': {
    input: { label: 'HTML', sample: HTML_SAMPLE, mono: true, rows: 10 },
    output: { label: 'Formatted HTML', filename: 'formatted.html', rows: 16 },
    fields: [
      INDENT,
      { kind: 'number', id: 'wrap', label: 'Wrap lines at (0 for never)', default: 0, min: 0, max: 400 },
      { kind: 'toggle', id: 'inner', label: 'Indent inside head and body', default: true },
    ],
    run: async (input, v) => {
      const b = await beautifier()
      return b.html(input, { ...indentOpts(str(v, 'indent')), wrap_line_length: num(v, 'wrap'), indent_inner_html: bool(v, 'inner'), end_with_newline: true, extra_liners: [] })
    },
  },
  'html-minifier': {
    input: { label: 'HTML', sample: HTML_SAMPLE, mono: true, rows: 10 },
    output: { label: 'Minified HTML', filename: 'minified.html' },
    fields: [
      { kind: 'toggle', id: 'comments', label: 'Remove comments', default: true, hint: 'Conditional comments (<!--[if IE]>) are kept.' },
      { kind: 'toggle', id: 'css', label: 'Minify CSS in style tags', default: true },
    ],
    run: (input, v) => sizeResult(input, minifyHtml(input, { comments: bool(v, 'comments'), css: bool(v, 'css') })),
  },
  'css-formatter': {
    input: { label: 'CSS', sample: CSS_SAMPLE, mono: true, rows: 10 },
    output: { label: 'Formatted CSS', filename: 'formatted.css', rows: 16 },
    fields: [INDENT, { kind: 'toggle', id: 'between', label: 'Blank line between rules', default: true }, { kind: 'toggle', id: 'selectors', label: 'Each selector on its own line', default: true }],
    run: async (input, v) => {
      const b = await beautifier()
      return b.css(input, { ...indentOpts(str(v, 'indent')), newline_between_rules: bool(v, 'between'), selector_separator_newline: bool(v, 'selectors'), end_with_newline: true })
    },
  },
  'css-minifier': {
    input: { label: 'CSS', sample: CSS_SAMPLE, mono: true, rows: 10 },
    output: { label: 'Minified CSS', filename: 'minified.css' },
    fields: [
      { kind: 'toggle', id: 'license', label: 'Keep /*! license comments', default: true },
      { kind: 'toggle', id: 'colors', label: 'Shorten colors (#ffffff to #fff)', default: true },
    ],
    run: (input, v) => sizeResult(input, minifyCss(input, { keepLicense: bool(v, 'license'), shortenColors: bool(v, 'colors') })),
  },
  'javascript-beautifier': {
    input: { label: 'JavaScript', sample: JS_SAMPLE, mono: true, rows: 10 },
    output: { label: 'Formatted JavaScript', filename: 'formatted.js', rows: 16 },
    fields: [
      INDENT,
      {
        kind: 'choice',
        id: 'brace',
        label: 'Braces',
        default: 'collapse',
        choices: [
          { value: 'collapse', label: 'Same line' },
          { value: 'expand', label: 'Next line' },
          { value: 'end-expand', label: 'Else on next line' },
        ],
      },
      { kind: 'toggle', id: 'unescape', label: 'Decode \\x and \\u escapes in strings', default: false },
    ],
    run: async (input, v) => {
      const b = await beautifier()
      const brace = str(v, 'brace') === 'expand' ? 'expand' : str(v, 'brace') === 'end-expand' ? 'end-expand' : 'collapse'
      return b.js(input, { ...indentOpts(str(v, 'indent')), brace_style: brace, unescape_strings: bool(v, 'unescape'), end_with_newline: true, preserve_newlines: true, max_preserve_newlines: 2 })
    },
  },
}
