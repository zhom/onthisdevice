import * as React from 'react'
import { marked } from 'marked'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { formatBytes, slugify } from '@/lib/utils'

import { escapeHtml, sanitizeHtml } from './datautil'
import { EditorPane, Field, OutputPane, Pane, ToggleRow, WarningList, useDebounced } from './ui'

const SAMPLE = `# Release notes

A short, **GitHub-flavoured** example with everything the converter handles.

## What changed

- Faster CSV parsing
- Better error messages, with the exact ~~row~~ line and column
- New \`--strict\` flag

### Task list

- [x] Ship the parser
- [ ] Write the migration guide

### Supported formats

| Format | Read | Write |
| ------ | :--: | ----: |
| CSV    |  Yes |   Yes |
| JSON   |  Yes |   Yes |
| YAML   |  Yes |   Yes |

> Everything runs on your device. Nothing is uploaded.

\`\`\`js
const rows = parseCsv(text, { header: true })
console.log(rows.length)
\`\`\`

Read the [documentation](https://example.com/docs) for the full list.

---

*Last updated 16 August 2026.*
`

const PROSE = [
  'text-sm text-foreground',
  '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold',
  '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold',
  '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold',
  '[&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:font-semibold',
  '[&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:font-semibold [&_h6]:text-muted-foreground',
  '[&_p]:my-3 [&_p]:leading-7',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
  '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_li]:my-1 [&_li>ul]:my-1 [&_li>ol]:my-1',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-6',
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
  '[&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
  '[&_td]:border [&_td]:px-2 [&_td]:py-1',
  '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_input]:mr-1.5 [&_input]:align-middle',
  '[&_del]:line-through',
].join(' ')

const DOC_CSS = `:root{color-scheme:light dark;--fg:#1a1c22;--bg:#ffffff;--muted:#5b6070;--line:#e3e5ea;--soft:#f5f6f8;--link:#4f46e5}
@media (prefers-color-scheme:dark){:root{--fg:#e8eaf0;--bg:#14161c;--muted:#a0a5b4;--line:#2b2f3a;--soft:#1d2027;--link:#a5b4fc}}
*{box-sizing:border-box}
body{margin:0 auto;padding:2.5rem 1.25rem 4rem;max-width:44rem;background:var(--bg);color:var(--fg);
font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:2rem 0 .75rem;font-weight:650}
h1{font-size:2rem;margin-top:0}h2{font-size:1.5rem}h3{font-size:1.25rem}
p,ul,ol,blockquote,table,pre{margin:0 0 1rem}
ul,ol{padding-left:1.5rem}li{margin:.25rem 0}
a{color:var(--link)}
code{background:var(--soft);padding:.15em .35em;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
pre{background:var(--soft);padding:1rem;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0;font-size:.85em}
blockquote{border-left:4px solid var(--line);margin-left:0;padding-left:1rem;color:var(--muted)}
hr{border:0;border-top:1px solid var(--line);margin:2rem 0}
table{border-collapse:collapse;width:100%;font-size:.95em;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left}
th{background:var(--soft)}
img{max-width:100%;height:auto;border-radius:8px}
input[type=checkbox]{margin-right:.4rem}`

function addHeadingIds(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div id="__r">${html}</div>`, 'text/html')
  const root = doc.getElementById('__r')
  if (!root) return html
  const used = new Set<string>()
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    if (h.id) {
      used.add(h.id)
      return
    }
    const base = slugify(h.textContent ?? '') || 'section'
    let id = base
    let n = 2
    while (used.has(id)) id = `${base}-${n++}`
    used.add(id)
    h.id = id
  })
  return root.innerHTML
}

function wrapDocument(body: string, title: string, lang: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Document')}</title>
<style>
${DOC_CSS}
</style>
</head>
<body>
${body}
</body>
</html>
`
}

export default function MarkdownToHtml() {
  const [input, setInput] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [readError, setReadError] = React.useState<string | null>(null)

  const [gfm, setGfm] = React.useState(true)
  const [breaks, setBreaks] = React.useState(false)
  const [headingIds, setHeadingIds] = React.useState(true)
  const [fullDocument, setFullDocument] = React.useState(false)
  const [docTitle, setDocTitle] = React.useState('Document')
  const [lang, setLang] = React.useState('en')
  const [indentOutput, setIndentOutput] = React.useState(false)

  const debounced = useDebounced(input, 180)

  const { fragment, output, warnings } = React.useMemo(() => {
    if (debounced.trim() === '') return { fragment: '', output: '', warnings: [] as string[] }
    let html: string
    try {
      html = marked.parse(debounced, { gfm, breaks, async: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The Markdown could not be parsed.'
      return { fragment: `<p>${escapeHtml(message)}</p>`, output: '', warnings: [message] }
    }
    if (headingIds) html = addHeadingIds(html)
    const clean = sanitizeHtml(html)
    const notes: string[] = []
    if (clean.removedElements > 0) {
      notes.push(
        `${clean.removedElements} unsafe element${clean.removedElements === 1 ? '' : 's'} (script, style, iframe or similar) were removed from the output.`,
      )
    }
    if (clean.removedAttributes > 0) {
      notes.push(
        `${clean.removedAttributes} attribute${clean.removedAttributes === 1 ? '' : 's'} were removed. Event handlers and javascript: URLs are never kept.`,
      )
    }
    const body = indentOutput ? prettyPrintHtml(clean.html) : clean.html
    return {
      fragment: clean.html,
      output: fullDocument ? wrapDocument(body, docTitle, lang) : body.trimEnd() + '\n',
      warnings: notes,
    }
  }, [debounced, gfm, breaks, headingIds, fullDocument, docTitle, lang, indentOutput])

  const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'document'
  const bytes = new TextEncoder().encode(output).length

  return (
    <div className="space-y-4">
      <ToolPanel title="Rendering options" description="marked with a strict allowlist sanitiser.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="m2h-title" label="Document title" hint="Used for the <title> tag in full-document mode.">
            <Input
              id="m2h-title"
              value={docTitle}
              disabled={!fullDocument}
              onChange={(e) => setDocTitle(e.currentTarget.value)}
              placeholder="Document"
            />
          </Field>
          <Field id="m2h-lang" label="Language attribute">
            <Input
              id="m2h-lang"
              value={lang}
              disabled={!fullDocument}
              maxLength={12}
              onChange={(e) => setLang(e.currentTarget.value)}
              placeholder="en"
            />
          </Field>
          <Field id="m2h-indent" label="Output formatting">
            <Select value={indentOutput ? 'pretty' : 'raw'} onValueChange={(v) => setIndentOutput(v === 'pretty')}>
              <SelectTrigger id="m2h-indent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">As marked emits it</SelectItem>
                <SelectItem value="pretty">Indent block elements</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ToggleRow
            id="m2h-gfm"
            label="GitHub-flavoured Markdown"
            hint="Tables, task lists, strikethrough and autolinks."
            checked={gfm}
            onCheckedChange={setGfm}
          />
          <ToggleRow
            id="m2h-breaks"
            label="Single newline = <br>"
            hint="Matches how comments render on GitHub and Slack."
            checked={breaks}
            onCheckedChange={setBreaks}
          />
          <ToggleRow
            id="m2h-ids"
            label="Add id anchors to headings"
            hint="Lets you deep-link to #each-section."
            checked={headingIds}
            onCheckedChange={setHeadingIds}
          />
          <ToggleRow
            id="m2h-full"
            label="Full HTML document"
            hint="Wraps the output with doctype, meta tags and embedded styles."
            checked={fullDocument}
            onCheckedChange={setFullDocument}
          />
        </div>
      </ToolPanel>

      {warnings.length > 0 ? <WarningList warnings={warnings} /> : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <EditorPane
          id="m2h-input"
          title="Markdown input"
          value={input}
          onChange={(v) => {
            setReadError(null)
            setInput(v)
          }}
          placeholder="Type or paste Markdown here, or drop a .md file…"
          accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
          sample={SAMPLE}
          sampleLabel="Sample"
          fileName={fileName}
          onFileName={setFileName}
          issue={readError ? { message: readError } : null}
          onError={setReadError}
          rows={22}
        />

        <Tabs defaultValue="html" className="min-w-0">
          <TabsList>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="html" className="mt-2">
            <OutputPane
              id="m2h-output"
              title={fullDocument ? 'HTML document' : 'HTML fragment'}
              value={output}
              filename={`${base}.html`}
              mime="text/html"
              emptyHint="Your HTML will appear here."
              rows={22}
              downloadLabel="Download .html"
              stats={
                output === ''
                  ? []
                  : [
                      { label: 'lines', value: output.split('\n').length.toLocaleString() },
                      { label: 'characters', value: output.length.toLocaleString() },
                      { label: 'size', value: formatBytes(bytes) },
                    ]
              }
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-2">
            <Pane title="Rendered preview" subtitle="sanitised: scripts and inline handlers are removed">
              {fragment === '' ? (
                <p className="grid min-h-[18rem] place-items-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
                  The rendered page appears here as you type.
                </p>
              ) : (
                <div
                  className={`min-w-0 overflow-x-auto rounded-lg bg-background p-4 ${PROSE}`}
                  // The HTML has already been run through the allowlist sanitiser above.
                  dangerouslySetInnerHTML={{ __html: fragment }}
                />
              )}
            </Pane>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

/** Light-touch indenter: only block elements get their own indented line. */
function prettyPrintHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div id="__r">${html}</div>`, 'text/html')
  const root = doc.getElementById('__r')
  if (!root) return html

  const lines: string[] = []
  const walk = (node: Element, depth: number): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const text = (child.textContent ?? '').trim()
        if (text !== '') lines.push('  '.repeat(depth) + text)
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (!BLOCK_TAGS.has(tag)) {
        lines.push('  '.repeat(depth) + el.outerHTML)
        continue
      }
      const attrs = Array.from(el.attributes)
        .map((a) => ` ${a.name}="${escapeHtml(a.value)}"`)
        .join('')
      if (tag === 'hr') {
        lines.push('  '.repeat(depth) + '<hr>')
        continue
      }
      const hasBlockChild = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()))
      if (!hasBlockChild || tag === 'pre') {
        lines.push(`${'  '.repeat(depth)}<${tag}${attrs}>${el.innerHTML}</${tag}>`)
        continue
      }
      lines.push(`${'  '.repeat(depth)}<${tag}${attrs}>`)
      walk(el, depth + 1)
      lines.push(`${'  '.repeat(depth)}</${tag}>`)
    }
  }
  walk(root, 0)
  return lines.join('\n')
}
