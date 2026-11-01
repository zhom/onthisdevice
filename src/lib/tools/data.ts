import type { Tool } from './types'

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  {
    slug: 'csv-to-json',
    title: 'CSV to JSON',
    h1: 'Convert CSV to JSON online',
    description:
      'Convert CSV to JSON, or TSV to JSON, with the delimiter detected for you. Dotted headers such as profile.city become nested objects.',
    keywords: [
      'csv to json converter',
      'tsv to json',
      'convert csv file to json',
      'csv parser online',
      'csv to json array',
      'csv to nested json',
    ],
    category: 'data',
    icon: 'FileJson',
    popular: true,
    accepts: ['csv', 'tsv', 'txt'],
    faqs: [
      {
        q: 'Does my CSV get uploaded anywhere?',
        a: 'No. JavaScript in this tab parses the file, so the data stays on your computer. The tool also works with the network disconnected.',
      },
      {
        q: 'How does the delimiter auto-detection work?',
        a: 'The parser scans the first few rows and picks the separator that gives a consistent column count, usually a comma, semicolon, tab or pipe. If it guesses wrong, set it in the delimiter dropdown.',
      },
      {
        q: 'Why is my ID column a string instead of a number?',
        a: 'Values with leading zeros, or digit strings longer than 15 characters, stay strings so that no digits are lost. Turn off “Infer value types” to keep every column as text.',
      },
      {
        q: 'Can I build nested JSON from flat columns?',
        a: 'Yes. With “Expand dotted keys” on, a header called profile.city becomes { "profile": { "city": … } }, and numeric segments like tags.0 become arrays.',
      },
      {
        q: 'What is the difference between the three output shapes?',
        a: '“Array of objects” gives one object per row (the usual API shape), “Column arrays” groups every column into its own list, and “Array of arrays” keeps the raw grid without keys.',
      },
    ],
    related: ['json-to-csv', 'csv-to-excel', 'excel-to-json', 'json-viewer', 'json-to-yaml'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-csv',
    title: 'JSON to CSV',
    h1: 'Convert JSON to CSV online',
    description:
      'Convert JSON to CSV or TSV for a spreadsheet. Nested objects become dotted columns such as contact.email, and you set the column order and quoting.',
    keywords: [
      'json to csv converter',
      'json to excel csv',
      'flatten json to csv',
      'json array to csv',
      'nested json to spreadsheet',
      'json to tsv',
    ],
    category: 'data',
    icon: 'Table2',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'What JSON shapes are supported?',
        a: 'An array of objects is the usual input. A single object, an array of arrays, and an object whose values are all arrays (column format) also work.',
      },
      {
        q: 'How are nested objects turned into columns?',
        a: 'They are flattened with dots: { "contact": { "email": "a@b.c" } } becomes a column named contact.email. Switch flattening off to JSON-encode the nested value in a single cell instead.',
      },
      {
        q: 'What happens to arrays inside a record?',
        a: 'By default an array becomes one JSON-encoded cell such as ["a","b"]. Turn on “Split arrays into columns” to get skills.0, skills.1 and so on.',
      },
      {
        q: 'Why does Excel mangle my accented characters?',
        a: 'Excel assumes the system code page unless the file starts with a UTF-8 byte order mark. Enable “Add UTF-8 BOM” and the accents open correctly.',
      },
      {
        q: 'Can I control the column order?',
        a: 'Yes. Keep the source order, sort alphabetically, or type an exact comma-separated list. Columns that you leave out of the list are added at the end in their original order.',
      },
    ],
    related: ['csv-to-json', 'json-viewer', 'csv-to-excel', 'excel-to-csv', 'yaml-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'json-to-yaml',
    title: 'JSON to YAML',
    h1: 'Convert JSON to YAML online',
    description:
      'Convert JSON to readable YAML with correct quoting, block literals for multi-line text, optional key sorting and 2 or 4 space indentation.',
    keywords: [
      'json to yaml converter',
      'json to yml',
      'convert json config to yaml',
      'kubernetes yaml from json',
      'json to yaml online',
    ],
    category: 'data',
    icon: 'FileCode2',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'Will strings that look like numbers stay strings?',
        a: 'Yes. Values such as "007", "1.10", "yes" and "2026-08-16" are quoted automatically, because an unquoted version would be read back as a number, boolean or date.',
      },
      {
        q: 'How are multi-line strings written?',
        a: 'As block literals using the | indicator, which keeps the line breaks readable instead of escaping them as \\n inside quotes. You can switch that off if your parser prefers quoted scalars.',
      },
      {
        q: 'Is the output valid for Kubernetes, Docker Compose and GitHub Actions?',
        a: 'Yes. The serialiser writes plain YAML 1.2 with two-space indentation, which every mainstream parser accepts. Add the --- document marker if your pipeline expects one.',
      },
      {
        q: 'Are comments preserved?',
        a: 'JSON has no comments, so the YAML output has none. The YAML to JSON converter reads and skips comments.',
      },
    ],
    related: ['yaml-to-json', 'json-viewer', 'json-to-csv', 'csv-to-json', 'markdown-to-html'],
    updated: UPDATED,
  },
  {
    slug: 'yaml-to-json',
    title: 'YAML to JSON',
    h1: 'Convert YAML to JSON online',
    description:
      'Convert YAML to JSON, with support for comments, block scalars and multi-document streams. Parse errors show the exact line and column.',
    keywords: [
      'yaml to json converter',
      'yml to json',
      'yaml parser online',
      'yaml validator',
      'convert yaml config to json',
    ],
    category: 'data',
    icon: 'Braces',
    accepts: ['yaml', 'yml', 'txt'],
    faqs: [
      {
        q: 'Does it validate my YAML?',
        a: 'Yes. Anything the parser cannot read is reported with the exact line and column plus the offending line, so tab indentation or a missing quote is easy to find.',
      },
      {
        q: 'Are yes and no treated as booleans?',
        a: 'Not by default. YAML 1.2 says only true and false are booleans, so yes/no/on/off stay strings. Turn on the toggle to get the older YAML 1.1 behaviour that many config files rely on.',
      },
      {
        q: 'What about a file with several --- documents?',
        a: 'Multi-document streams are supported. Choose whether to convert only the first document or combine every document into a single JSON array.',
      },
      {
        q: 'Are anchors and aliases supported?',
        a: 'No. The tool reports &anchor and *alias references as an error, so no data is dropped without a notice. Expand them in your source file first.',
      },
      {
        q: 'What happens to .inf and .nan values?',
        a: 'JSON has no way to represent infinity or not-a-number, so those values are written as null and a notice explains the substitution.',
      },
    ],
    related: ['json-to-yaml', 'json-viewer', 'json-to-csv', 'csv-to-json', 'excel-to-json'],
    updated: UPDATED,
  },
  {
    slug: 'excel-to-csv',
    title: 'Excel to CSV',
    h1: 'Convert Excel to CSV online',
    description:
      'Convert Excel to CSV from XLSX, XLS, XLSM or ODS files. Pick a sheet and a delimiter, or download every sheet as a CSV file in one ZIP.',
    keywords: [
      'xlsx to csv',
      'excel to csv converter',
      'xls to csv',
      'ods to csv',
      'convert spreadsheet to csv',
      'excel sheets to csv zip',
    ],
    category: 'data',
    icon: 'FileSpreadsheet',
    popular: true,
    accepts: ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv'],
    faqs: [
      {
        q: 'Is my spreadsheet uploaded to a server?',
        a: 'No. WebAssembly and JavaScript in this tab decode the workbook. Nothing is sent, so you can use the tool on confidential financial and HR data.',
      },
      {
        q: 'Can I export every worksheet at once?',
        a: 'Yes. “Download every sheet as a ZIP” writes one CSV per worksheet, numbered in workbook order so the sheet sequence is preserved.',
      },
      {
        q: 'What happens to formulas?',
        a: 'The tool exports the calculated result of each formula, which is what most importers expect. Charts, images and conditional formatting are not part of CSV and are dropped.',
      },
      {
        q: 'How are dates handled?',
        a: 'By default each date keeps the format shown in Excel. You can also force ISO 8601 (2026-08-16), day/month/year or month/day/year for a predictable import.',
      },
      {
        q: 'Can a password-protected file be converted?',
        a: 'No. Encrypted workbooks cannot be opened without the password. Remove protection in Excel with “Save as → Tools → General Options”, then convert the unprotected copy.',
      },
    ],
    related: ['excel-to-json', 'csv-to-excel', 'csv-to-json', 'json-to-csv', 'json-viewer'],
    updated: UPDATED,
  },
  {
    slug: 'excel-to-json',
    title: 'Excel to JSON',
    h1: 'Convert Excel to JSON online',
    description:
      'Convert Excel to JSON from XLSX or ODS sheets, with real numbers, booleans and ISO dates. Export one sheet, or all sheets keyed by sheet name.',
    keywords: [
      'xlsx to json',
      'excel to json converter',
      'spreadsheet to json',
      'xls to json',
      'excel sheet to json array',
    ],
    category: 'data',
    icon: 'Sheet',
    accepts: ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv'],
    faqs: [
      {
        q: 'Are numbers exported as numbers or strings?',
        a: 'As real JSON numbers when “Typed values” is on, with true/false booleans and null for empty cells. Switch it off to get the text that each cell displays.',
      },
      {
        q: 'How are Excel dates converted?',
        a: 'Excel stores dates as serial numbers. Choose ISO 8601, date-only, the displayed text or the raw serial number, to match your target system.',
      },
      {
        q: 'Can I convert every worksheet in one go?',
        a: 'Yes. Pick “All sheets” and you get a single JSON object keyed by worksheet name, with each value being that sheet’s array of records.',
      },
      {
        q: 'What if two columns share the same header?',
        a: 'The tool adds a suffix to the second one (name, name_2), so no data is lost. Empty headers become column_1, column_2 and so on.',
      },
    ],
    related: ['excel-to-csv', 'csv-to-json', 'json-viewer', 'csv-to-excel', 'json-to-csv'],
    updated: UPDATED,
  },
  {
    slug: 'csv-to-excel',
    title: 'CSV to Excel',
    h1: 'Convert CSV to Excel (XLSX) online',
    description:
      'Convert CSV to Excel: build a real .xlsx workbook from CSV or TSV with fitted column widths, a named sheet, an autofilter and typed number cells.',
    keywords: [
      'csv to xlsx',
      'csv to excel converter',
      'tsv to excel',
      'convert csv to spreadsheet',
      'csv to xls online',
    ],
    category: 'data',
    icon: 'TableProperties',
    accepts: ['csv', 'tsv', 'txt'],
    faqs: [
      {
        q: 'Is this a real .xlsx file or a renamed CSV?',
        a: 'A real Office Open XML workbook, written with SheetJS in your browser. Excel, LibreOffice, Numbers and Google Sheets open it without a format warning.',
      },
      {
        q: 'Will my leading zeros survive?',
        a: 'Turn off “Convert numbers and booleans” to keep every cell as text, which preserves postcodes, phone numbers and product codes such as 007 exactly as typed.',
      },
      {
        q: 'Why are my columns already the right width?',
        a: 'The converter measures the longest value in each column and writes matching column widths into the file, so you do not have to double-click every divider.',
      },
      {
        q: 'Can I name the worksheet?',
        a: 'Yes. Excel limits sheet names to 31 characters and forbids : \\ / ? * [ ], so the tool replaces invalid characters before it writes the file.',
      },
    ],
    related: ['excel-to-csv', 'csv-to-json', 'excel-to-json', 'json-to-csv', 'json-viewer'],
    updated: UPDATED,
  },
  {
    slug: 'docx-to-text',
    title: 'DOCX to text',
    h1: 'Convert Word DOCX to plain text',
    description:
      'Convert DOCX to text: extract plain text from Word .docx files with the paragraph breaks kept. Convert many files and download them as one ZIP.',
    keywords: [
      'docx to txt',
      'word to text converter',
      'extract text from word document',
      'docx text extractor',
      'word to plain text',
    ],
    category: 'data',
    icon: 'FileType2',
    accepts: ['docx'],
    faqs: [
      {
        q: 'Can it read old .doc files?',
        a: 'No. The binary .doc format from Word 97-2003 is not supported. Open the file in Word or LibreOffice and save it as .docx, then convert that copy here.',
      },
      {
        q: 'Are headers, footers and footnotes included?',
        a: 'The main document body is extracted, including tables as text. Headers, footers, comments and footnotes live in separate parts of the file and are not included.',
      },
      {
        q: 'Can I convert several documents at once?',
        a: 'Yes. Drop as many .docx files as you like, switch between them with the document picker, and download every result as a single ZIP.',
      },
      {
        q: 'What does “straighten smart quotes” do?',
        a: 'Word replaces typed quotes with curly “ ” ‘ ’ characters and en/em dashes. That option converts them back to plain ASCII, which matters when the text is going into code or a CSV.',
      },
    ],
    related: ['docx-to-markdown', 'markdown-to-html', 'html-to-markdown', 'pdf-to-text', 'word-counter'],
    updated: UPDATED,
  },
  {
    slug: 'docx-to-markdown',
    title: 'DOCX to Markdown',
    h1: 'Convert Word DOCX to Markdown',
    description:
      'Convert DOCX to Markdown with headings, lists, links, bold, italic and tables kept. Word tables become GitHub-flavoured Markdown tables.',
    keywords: [
      'docx to markdown',
      'word to markdown converter',
      'doc to md',
      'word document to md file',
      'convert word to github markdown',
    ],
    category: 'data',
    icon: 'FileText',
    accepts: ['docx'],
    faqs: [
      {
        q: 'Which Word features survive the conversion?',
        a: 'Heading levels 1-6, ordered and unordered lists with nesting, hyperlinks, bold, italic, strikethrough, blockquotes, inline code and tables all map onto Markdown equivalents.',
      },
      {
        q: 'How are Word tables converted?',
        a: 'Into GitHub-flavoured Markdown tables, with the first row promoted to the header and any cell alignment preserved in the divider row. Cell line breaks become <br>.',
      },
      {
        q: 'What happens to images in the document?',
        a: 'Off by default, so the Markdown stays small. Turn on image embedding and each picture is inlined as a base64 data URI, which keeps the file self-contained but much larger.',
      },
      {
        q: 'Why does my styled text lose its formatting?',
        a: 'Markdown has no fonts, colours or sizes. Only structural formatting converts. Direct formatting such as “red 14pt Calibri” is dropped.',
      },
      {
        q: 'Can I see the intermediate HTML?',
        a: 'Yes. The second tab shows the HTML that mammoth produced before Turndown converted it. This helps you find the cause of odd output.',
      },
    ],
    related: ['docx-to-text', 'html-to-markdown', 'markdown-to-html', 'json-viewer', 'pdf-to-word'],
    updated: UPDATED,
  },
  {
    slug: 'markdown-to-html',
    title: 'Markdown to HTML',
    h1: 'Convert Markdown to HTML online',
    description:
      'Convert Markdown to HTML with a live preview, GitHub tables and task lists. The output is sanitised: scripts, iframes and event handlers are removed.',
    keywords: [
      'markdown to html converter',
      'md to html',
      'markdown preview online',
      'markdown renderer',
      'github flavored markdown to html',
    ],
    category: 'data',
    icon: 'Code2',
    popular: true,
    accepts: ['md', 'markdown', 'txt'],
    faqs: [
      {
        q: 'Is the HTML output safe to publish?',
        a: 'Yes. Every result passes through an allowlist sanitiser that removes script, style and iframe elements, all on* event handlers and any javascript: URL, and reports what it stripped.',
      },
      {
        q: 'Which Markdown flavour is used?',
        a: 'CommonMark plus GitHub extensions: pipe tables, task lists, strikethrough and autolinks. Turn GFM off for strict CommonMark behaviour.',
      },
      {
        q: 'What does the “Full HTML document” toggle add?',
        a: 'A doctype, charset and viewport meta tags, a title, and an embedded stylesheet for light and dark mode. The result is a complete page that you can open from disk.',
      },
      {
        q: 'Why do my single line breaks disappear?',
        a: 'That is standard Markdown: a single newline is treated as a space. Enable “Single newline = <br>” to get the behaviour used by GitHub comments and chat apps.',
      },
      {
        q: 'Can I link to individual headings?',
        a: 'Yes. Heading anchors are on by default, so every heading gets a slugified id such as #getting-started that you can link to directly.',
      },
    ],
    related: ['html-to-markdown', 'docx-to-markdown', 'json-viewer', 'json-to-yaml', 'docx-to-text'],
    updated: UPDATED,
  },
  {
    slug: 'html-to-markdown',
    title: 'HTML to Markdown',
    h1: 'Convert HTML to Markdown online',
    description:
      'Convert HTML to Markdown with control over heading style, bullet markers, code fences, link style and GitHub-flavoured tables.',
    keywords: [
      'html to markdown converter',
      'html to md',
      'web page to markdown',
      'turndown online',
      'convert html table to markdown',
    ],
    category: 'data',
    icon: 'FileDown',
    accepts: ['html', 'htm', 'txt'],
    faqs: [
      {
        q: 'Can I paste a whole web page?',
        a: 'Yes. With “Body only” on, the tool ignores everything in <head> (titles, meta tags, scripts and styles) and converts only the visible body content.',
      },
      {
        q: 'Are HTML tables converted?',
        a: 'Yes, into GitHub-flavoured Markdown tables. The first row becomes the header, align attributes become alignment colons, and cells containing line breaks use <br>.',
      },
      {
        q: 'Why is some markup left as raw HTML?',
        a: 'Markdown cannot express every construct. Elements with no Markdown equivalent are passed through as HTML so the meaning survives, which is valid inside Markdown documents.',
      },
      {
        q: 'What is the difference between inline and reference links?',
        a: 'Inline puts the URL next to the text as [text](url). Reference style writes [text][1] and collects the URLs at the bottom, which keeps long prose easier to read.',
      },
    ],
    related: ['markdown-to-html', 'docx-to-markdown', 'docx-to-text', 'json-viewer', 'json-to-yaml'],
    updated: UPDATED,
  },
  {
    slug: 'json-viewer',
    title: 'JSON viewer',
    h1: 'JSON viewer, formatter and validator',
    description:
      'JSON viewer with a collapsible tree, search and the path of each value, such as $.store.books[2].title. It also formats, minifies and validates JSON.',
    keywords: [
      'json viewer online',
      'json tree viewer',
      'json beautifier',
      'json validator',
      'json pretty print',
      'json path finder',
    ],
    category: 'data',
    icon: 'ListTree',
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'How large a document can it handle?',
        a: 'Files of a few megabytes work well on a normal laptop. A very wide node shows its first 300 children and a note about the rest, so the page does not freeze.',
      },
      {
        q: 'Where do I find the path to a value?',
        a: 'Click any row. Its JSONPath-style path, for example $.store.books[2].title, appears in the breadcrumb above the tree with a copy button.',
      },
      {
        q: 'What does the search box match?',
        a: 'Both keys and scalar values, case-insensitively. Matching branches stay visible with their parents expanded, so you can see where each hit sits in the structure.',
      },
      {
        q: 'How exact is the error reporting?',
        a: 'The tool reports invalid JSON with the line, the column and the bad line with a caret under the error, so you can go to the stray comma or missing quote.',
      },
      {
        q: 'Is this the same as the developer JSON formatter?',
        a: 'They share a parser. This page is for reading and exploring documents. The developer formatter is for quick beautify and minify passes.',
      },
    ],
    related: ['csv-to-json', 'json-to-csv', 'json-to-yaml', 'yaml-to-json', 'json-formatter'],
    updated: UPDATED,
  },
]
