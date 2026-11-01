import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import {
  Bold,
  Code,
  FileUp,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Printer,
  Quote,
  Save,
  Table as TableIcon,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { CopyButton } from '@/components/shared/CopyButton'
import { DownloadButton } from '@/components/shared/DownloadButton'
import { ErrorNote } from '@/components/shared/ErrorNote'
import { DfProofPanel, DfSegmented, DfStatChips, readTextFile } from '../dev/dev-format-ui'

const STORAGE_KEY = 'otd:markdown-editor:v1'
const STORAGE_FLAG = 'otd:markdown-editor:enabled'

const SAMPLE = `# Release notes for v2.4

A short summary of what changed, written in **Markdown** and previewed live.

## Highlights

- Exports now stream, so a 200 MB report no longer buffers in memory
- \`--dry-run\` prints the plan without touching anything
- Fixed a crash when a column header contained a newline

## Upgrade steps

1. Stop the worker
2. Run \`bin/migrate --to 2.4\`
3. Start the worker

> Migrations are forward-only. Take a snapshot first.

| Setting | Old default | New default |
| --- | ---: | ---: |
| \`batch_size\` | 100 | 500 |
| \`timeout_ms\` | 5000 | 15000 |

- [x] Changelog written
- [ ] Blog post drafted

\`\`\`bash
bin/migrate --to 2.4 --dry-run
\`\`\`

See the [migration guide](https://example.com/docs/migrate) for details.
`

/* ------------------------------------------------------------------ */
/* Sanitiser                                                           */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'A', 'ABBR', 'BLOCKQUOTE', 'BR', 'CODE', 'DD', 'DEL', 'DIV', 'DL', 'DT', 'EM', 'H1', 'H2',
  'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'INPUT', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN',
  'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'title']),
  IMG: new Set(['src', 'alt', 'title']),
  INPUT: new Set(['type', 'checked', 'disabled']),
  TD: new Set(['align']),
  TH: new Set(['align', 'scope']),
  OL: new Set(['start']),
}

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i

const DANGEROUS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'LINK', 'META', 'BASE', 'NOSCRIPT',
])

/**
 * marked emits raw HTML that appeared in the source, so the output has to be
 * cleaned before it is inserted. This is an allowlist: unknown elements are
 * unwrapped, unknown attributes are dropped, and any URL scheme other than the
 * five safe ones is removed. There is no DOMPurify in the dependency set, so
 * this runs against the browser's own parser instead of a regex.
 */
function sanitizeHtml(html: string): { html: string; removed: number } {
  if (typeof DOMParser === 'undefined') return { html: '', removed: 0 }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  let removed = 0

  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) walk(child)

    if (DANGEROUS.has(node.tagName)) {
      removed += 1
      node.remove()
      return
    }

    if (!ALLOWED_TAGS.has(node.tagName)) {
      removed += 1
      // Unwrap: keep the text, drop the element.
      const parent = node.parentNode
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node)
        parent.removeChild(node)
      }
      return
    }

    const allowed = ALLOWED_ATTRS[node.tagName] ?? new Set<string>()
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      if (!allowed.has(name)) {
        node.removeAttribute(attr.name)
        if (name.startsWith('on') || name === 'style' || name === 'srcset') removed += 1
        continue
      }
      if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
        node.removeAttribute(attr.name)
        removed += 1
      }
    }

    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener nofollow ugc')
      node.setAttribute('target', '_blank')
    }
    if (node.tagName === 'INPUT') {
      node.setAttribute('disabled', '')
    }
  }

  for (const child of Array.from(doc.body.children)) walk(child)
  return { html: doc.body.innerHTML, removed }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Wrap {
  icon: typeof Bold
  label: string
  before: string
  after: string
  block?: boolean
}

const TOOLBAR: Wrap[] = [
  { icon: Bold, label: 'Bold', before: '**', after: '**' },
  { icon: Italic, label: 'Italic', before: '_', after: '_' },
  { icon: Code, label: 'Inline code', before: '`', after: '`' },
  { icon: Heading2, label: 'Heading', before: '## ', after: '', block: true },
  { icon: Quote, label: 'Blockquote', before: '> ', after: '', block: true },
  { icon: List, label: 'Bulleted list', before: '- ', after: '', block: true },
  { icon: ListOrdered, label: 'Numbered list', before: '1. ', after: '', block: true },
  { icon: Link2, label: 'Link', before: '[', after: '](https://)' },
  {
    icon: TableIcon,
    label: 'Table',
    before: '\n| Column A | Column B |\n| --- | --- |\n| ',
    after: ' |  |\n',
    block: true,
  },
]

export default function DevFormatMarkdownEditor() {
  const [text, setText] = useState('')
  const [view, setView] = useState<'split' | 'write' | 'preview'>('split')
  const [autosave, setAutosave] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [breaks, setBreaks] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const syncing = useRef(false)

  /* Restore, but only if the visitor previously opted in. */
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_FLAG) !== '1') return
      const stored = localStorage.getItem(STORAGE_KEY)
      setAutosave(true)
      if (stored !== null) {
        setText(stored)
        setSavedAt('restored from this device')
      }
    } catch {
      /* storage disabled — the editor still works, it just will not persist */
    }
  }, [])

  useEffect(() => {
    if (!autosave) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, text)
        localStorage.setItem(STORAGE_FLAG, '1')
        setSavedAt(new Date().toLocaleTimeString())
      } catch {
        setSavedAt('could not save: storage is full or disabled')
      }
    }, 600)
    return () => clearTimeout(id)
  }, [autosave, text])

  const rendered = useMemo(() => {
    if (text.trim() === '') return { html: '', removed: 0 }
    const raw = marked.parse(text, { gfm: true, breaks, async: false })
    return sanitizeHtml(raw)
  }, [breaks, text])

  const stats = useMemo(() => {
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / 225))
    return [
      { label: 'Words', value: words.toLocaleString() },
      { label: 'Characters', value: text.length.toLocaleString() },
      { label: 'Lines', value: String(text === '' ? 0 : text.split('\n').length) },
      { label: 'Reading time', value: `${minutes} min` },
    ]
  }, [text])

  const applyWrap = useCallback((wrap: Wrap) => {
    const area = textareaRef.current
    if (!area) return
    const start = area.selectionStart
    const end = area.selectionEnd
    const selected = area.value.slice(start, end)
    const next =
      area.value.slice(0, start) + wrap.before + selected + wrap.after + area.value.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      area.focus()
      const caret = start + wrap.before.length + selected.length
      area.setSelectionRange(caret, caret)
    })
  }, [])

  const syncScroll = useCallback((source: 'editor' | 'preview') => {
    if (syncing.current) return
    const area = textareaRef.current
    const preview = previewRef.current
    if (!area || !preview) return
    syncing.current = true
    const from = source === 'editor' ? area : preview
    const to = source === 'editor' ? preview : area
    const range = from.scrollHeight - from.clientHeight
    const ratio = range > 0 ? from.scrollTop / range : 0
    to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setText(await readTextFile(file, 8 * 1024 * 1024))
    } catch (caught) {
      setFileError(caught instanceof Error ? caught.message : 'That file could not be read.')
    }
  }, [])

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_FLAG)
    } catch {
      /* nothing to clear */
    }
    setAutosave(false)
    setSavedAt(null)
  }, [])

  const mdBlob = useMemo(
    () => (text ? new Blob([text], { type: 'text/markdown' }) : null),
    [text],
  )
  const htmlDocument = useMemo(() => {
    if (!rendered.html) return ''
    return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Document</title>\n</head>\n<body>\n${rendered.html}\n</body>\n</html>\n`
  }, [rendered.html])
  const htmlBlob = useMemo(
    () => (htmlDocument ? new Blob([htmlDocument], { type: 'text/html' }) : null),
    [htmlDocument],
  )

  const showEditor = view !== 'preview'
  const showPreview = view !== 'write'

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Markdown editor"
        description="Write on the left, see the rendered result on the right. The optional autosave stores your draft in this browser only."
      >
        <div className="flex flex-wrap items-center gap-2">
          <DfSegmented
            label="Layout"
            value={view}
            onChange={setView}
            options={[
              { value: 'write', label: 'Write' },
              { value: 'split', label: 'Split' },
              { value: 'preview', label: 'Preview' },
            ]}
            className="sm:w-auto"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden="true" />
            Open .md
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="sr-only"
            aria-label="Open a Markdown file"
            onChange={(event) => {
              void onFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
            Load sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center gap-3">
            <Switch
              id="md-autosave"
              checked={autosave}
              onCheckedChange={(checked) => {
                setAutosave(checked)
                if (!checked) clearStorage()
              }}
            />
            <Label htmlFor="md-autosave" className="text-sm">
              <Save className="mr-1.5 inline size-3.5" aria-hidden="true" />
              Autosave to this device
            </Label>
          </div>
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {autosave
              ? savedAt
                ? `Saved on this device · ${savedAt}`
                : 'Saving to this browser only.'
              : 'Off. Your draft is lost when you close the tab.'}
          </p>
          {autosave ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearStorage} className="gap-2">
              <Trash2 className="size-4" aria-hidden="true" />
              Delete saved draft
            </Button>
          ) : null}
          <div className="flex items-center gap-3">
            <Switch id="md-breaks" checked={breaks} onCheckedChange={setBreaks} />
            <Label htmlFor="md-breaks" className="text-sm">
              Treat single newlines as line breaks
            </Label>
          </div>
        </div>

        {fileError ? <ErrorNote message={fileError} onRetry={() => setFileError(null)} /> : null}

        {showEditor ? (
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
            {TOOLBAR.map((wrap) => {
              const Glyph = wrap.icon
              return (
                <Button
                  key={wrap.label}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={wrap.label}
                  title={wrap.label}
                  onClick={() => applyWrap(wrap)}
                >
                  <Glyph className="size-4" aria-hidden="true" />
                </Button>
              )
            })}
          </div>
        ) : null}

        <div
          className={
            view === 'split' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'
          }
        >
          {showEditor ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="md-source" className="text-sm font-medium">
                Markdown
              </Label>
              <Textarea
                id="md-source"
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onScroll={() => syncScroll('editor')}
                rows={22}
                spellCheck
                placeholder="# Start typing…"
                className="resize-y font-mono text-[13px] leading-relaxed"
              />
            </div>
          ) : null}

          {showPreview ? (
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Preview</span>
              <div
                ref={previewRef}
                onScroll={() => syncScroll('preview')}
                className="markdown-preview h-[34rem] overflow-auto rounded-md bg-background px-5 py-4 text-[15px] leading-7 text-foreground"
              >
                {rendered.html ? (
                  <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The rendered document appears here as you type.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DfStatChips items={stats} />

        {rendered.removed > 0 ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              {rendered.removed} unsafe element or attribute was removed from the preview (script
              tags, inline event handlers or a <code className="font-mono">javascript:</code> URL).
              Your Markdown source is untouched. Only the preview is filtered.
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <CopyButton value={text} label="Copy Markdown" />
          <CopyButton value={rendered.html} label="Copy HTML" />
          <DownloadButton blob={mdBlob} filename="document.md" label="Download .md" />
          <DownloadButton
            blob={htmlBlob}
            filename="document.html"
            label="Download .html"
            variant="outline"
          />
        </div>
      </ToolPanel>

      <DfProofPanel subject="draft" />

      <style>{`
        .markdown-preview h1 { font-size: 1.75rem; font-weight: 700; margin: 1.25rem 0 0.75rem; line-height: 1.2; }
        .markdown-preview h2 { font-size: 1.375rem; font-weight: 650; margin: 1.5rem 0 0.65rem; line-height: 1.25; }
        .markdown-preview h3 { font-size: 1.125rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 { font-weight: 600; margin: 1rem 0 0.5rem; }
        .markdown-preview p { margin: 0.75rem 0; }
        .markdown-preview ul { list-style: disc; padding-left: 1.4rem; margin: 0.75rem 0; }
        .markdown-preview ol { list-style: decimal; padding-left: 1.4rem; margin: 0.75rem 0; }
        .markdown-preview li { margin: 0.25rem 0; }
        .markdown-preview li > input[type="checkbox"] { margin-right: 0.4rem; }
        .markdown-preview blockquote { border-left: 3px solid var(--border); padding-left: 0.9rem; margin: 0.9rem 0; color: var(--muted-foreground); }
        .markdown-preview code { background: var(--muted); border-radius: 0.3rem; padding: 0.1rem 0.35rem; font-size: 0.85em; font-family: var(--font-mono, ui-monospace, monospace); }
        .markdown-preview pre { background: var(--muted); border: 1px solid var(--border); border-radius: 0.6rem; padding: 0.9rem; overflow-x: auto; margin: 0.9rem 0; }
        .markdown-preview pre code { background: transparent; padding: 0; font-size: 0.82em; }
        .markdown-preview a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
        .markdown-preview table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; margin: 0.9rem 0; font-size: 0.92em; }
        .markdown-preview th, .markdown-preview td { border: 1px solid var(--border); padding: 0.4rem 0.7rem; text-align: left; }
        .markdown-preview th { background: var(--muted); font-weight: 600; }
        .markdown-preview hr { border: 0; border-top: 1px solid var(--border); margin: 1.4rem 0; }
        .markdown-preview img { max-width: 100%; height: auto; border-radius: 0.4rem; }
      `}</style>
    </div>
  )
}
