import TurndownService from 'turndown'

export interface TurndownSettings {
  headingStyle: 'atx' | 'setext'
  bulletListMarker: '-' | '+' | '*'
  codeBlockStyle: 'fenced' | 'indented'
  fence: '```' | '~~~'
  emDelimiter: '_' | '*'
  strongDelimiter: '**' | '__'
  linkStyle: 'inlined' | 'referenced'
  hr: '---' | '***' | '___'
  /** Convert <table> to a GitHub-flavoured Markdown table. */
  tables: boolean
  /** Convert <del>/<s> to ~~strikethrough~~. */
  strikethrough: boolean
  /** Convert checkbox list items to - [x] / - [ ]. */
  taskLists: boolean
  /** Keep images. When false they are dropped entirely. */
  images: boolean
}

export const DEFAULT_TURNDOWN: TurndownSettings = {
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  hr: '---',
  tables: true,
  strikethrough: true,
  taskLists: true,
  images: true,
}

function cellText(service: TurndownService, cell: Element): string {
  const md = service.turndown((cell as HTMLElement).innerHTML || '')
  return md
    .replace(/\|/g, '\\|')
    .replace(/[ \t]*\r?\n+[ \t]*/g, '<br>')
    .trim()
}

function alignmentOf(cell: Element): 'left' | 'right' | 'center' | null {
  const raw = (cell.getAttribute('align') ?? (cell as HTMLElement).style?.textAlign ?? '').toLowerCase()
  if (raw === 'left' || raw === 'right' || raw === 'center') return raw
  return null
}

function tableToMarkdown(table: HTMLElement, service: TurndownService): string | null {
  const rows = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table)
  if (rows.length === 0) return null

  const matrix: { text: string; align: 'left' | 'right' | 'center' | null; header: boolean }[][] = []
  for (const tr of rows) {
    const cells = Array.from(tr.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
    if (cells.length === 0) continue
    const row: { text: string; align: 'left' | 'right' | 'center' | null; header: boolean }[] = []
    for (const cell of cells) {
      const span = Math.max(1, Number(cell.getAttribute('colspan') ?? 1) || 1)
      const entry = { text: cellText(service, cell), align: alignmentOf(cell), header: cell.tagName === 'TH' }
      row.push(entry)
      for (let i = 1; i < span; i++) row.push({ text: '', align: entry.align, header: entry.header })
    }
    matrix.push(row)
  }
  if (matrix.length === 0) return null

  const width = matrix.reduce((acc, r) => Math.max(acc, r.length), 0)
  for (const row of matrix) while (row.length < width) row.push({ text: '', align: null, header: false })

  // GFM requires a header row. Word tables usually put it in row 1, so promote
  // the first row unless it is obviously data (no <th> and more rows follow).
  const headerRow = matrix[0]!
  const body = matrix.slice(1)
  const aligns = headerRow.map((c, i) => c.align ?? body[0]?.[i]?.align ?? null)

  const line = (cells: { text: string }[]) => `| ${cells.map((c) => c.text || ' ').join(' | ')} |`
  const divider = `| ${aligns
    .map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---'))
    .join(' | ')} |`

  const lines = [line(headerRow), divider, ...body.map((r) => line(r))]
  return '\n\n' + lines.join('\n') + '\n\n'
}

export function createTurndown(settings: TurndownSettings): TurndownService {
  const service = new TurndownService({
    headingStyle: settings.headingStyle,
    bulletListMarker: settings.bulletListMarker,
    codeBlockStyle: settings.codeBlockStyle,
    fence: settings.fence,
    emDelimiter: settings.emDelimiter,
    strongDelimiter: settings.strongDelimiter,
    linkStyle: settings.linkStyle,
    hr: settings.hr,
    br: '  ',
  })

  service.remove(['script', 'style', 'noscript'] as (keyof HTMLElementTagNameMap)[])

  if (settings.strikethrough) {
    service.addRule('strikethrough', {
      filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
      replacement: (content) => (content.trim() === '' ? '' : `~~${content}~~`),
    })
  }

  if (settings.taskLists) {
    service.addRule('taskListItem', {
      filter: (node) =>
        node.nodeName === 'LI' &&
        node.firstElementChild?.nodeName === 'INPUT' &&
        (node.firstElementChild as HTMLInputElement).type === 'checkbox',
      replacement: (content, node) => {
        const box = node.firstElementChild as HTMLInputElement
        const marker = box.checked || box.hasAttribute('checked') ? '[x]' : '[ ]'
        const text = content.replace(/^\s+/, '').replace(/\n/gm, '\n  ')
        return `${settings.bulletListMarker} ${marker} ${text}\n`
      },
    })
  }

  if (!settings.images) {
    service.addRule('dropImages', { filter: 'img', replacement: () => '' })
  }

  if (settings.tables) {
    service.addRule('gfmTable', {
      filter: 'table',
      replacement: (content, node) => tableToMarkdown(node, service) ?? content,
    })
    // Rows and cells are handled inside the table rule; make sure the default
    // rules never emit them separately.
    service.addRule('gfmTableParts', {
      filter: ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
      replacement: (content) => content,
    })
  } else {
    // Without GFM tables there is no Markdown equivalent, so keep the original
    // HTML rather than flattening every cell into a stray paragraph.
    service.keep('table')
  }

  return service
}

/** Tidy the Markdown turndown produces: no trailing spaces, no 3+ blank lines. */
export function tidyMarkdown(md: string): string {
  return md
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, (m) => (m === '  ' ? '  ' : '')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd()
    .concat('\n')
}
