import type { Tool } from './types'

/**
 * Round-2 batch `pdf-secure`: encryption, exact-size compression and document
 * conversion. Every entry here has its own page, its own copy and its own FAQs.
 */

const UPDATED = '2026-11-01'

/** The compress-to-a-size family: one component, seven distinct pages. */
interface TargetPage {
  slug: string
  title: string
  h1: string
  description: string
  keywords: string[]
  faqs: { q: string; a: string }[]
  related: string[]
  icon: string
  popular?: boolean
}

const TARGET_PAGES: TargetPage[] = [
  {
    slug: 'compress-pdf-to-100kb',
    title: 'Compress PDF to 100KB',
    h1: 'Compress a PDF to under 100 KB',
    description:
      'Compress a PDF to under 100 KB for government and university upload forms. The tool searches JPEG quality page by page to fit the limit.',
    keywords: [
      'reduce pdf size to 100kb',
      'pdf 100kb converter',
      'compress pdf below 100kb',
      'pdf size reducer 100kb',
    ],
    icon: 'Gauge',
    faqs: [
      {
        q: 'Why do so many forms ask for 100 KB?',
        a: 'It is an old default in much government and university upload software, often a database column limit for one field. It has nothing to do with how readable the document is, so meeting it usually costs visible quality.',
      },
      {
        q: 'Will my scanned ID still be readable at 100 KB?',
        a: 'A single-page scan usually stays readable, because the whole budget goes to one image. At 100 KB, a document of more than about four pages starts to look rough. The result panel shows the JPEG quality of each page, so you can check it before you submit.',
      },
      {
        q: 'What if the file is already under 100 KB?',
        a: 'The tool tells you and recommends that you upload it unchanged. Compressing a PDF that is already small only removes quality.',
      },
      {
        q: 'Does the text stay searchable?',
        a: 'No. To reach a hard byte target, each page is rendered again as a JPEG, so the text layer is lost. If searchable text matters more than the exact size, use our lossless compression instead.',
      },
      {
        q: 'Is there a page limit?',
        a: 'No. The work happens on your device, so a 200-page document only takes more time and memory.',
      },
    ],
    related: ['compress-pdf-to-200kb', 'compress-pdf-to-size', 'compress-pdf', 'compress-image'],
  },
  {
    slug: 'compress-pdf-to-200kb',
    title: 'Compress PDF to 200KB',
    h1: 'Compress a PDF to under 200 KB',
    description:
      'Compress a PDF to under 200 KB for job portals, exam boards and visa forms. The result shows the final size and the JPEG quality of each page.',
    keywords: [
      'reduce pdf to 200kb',
      'pdf compressor 200kb',
      '200kb pdf online',
      'compress pdf below 200kb',
    ],
    icon: 'Gauge',
    faqs: [
      {
        q: 'How is 200 KB different from 100 KB in practice?',
        a: 'Doubling the budget is roughly one full quality step, or about 40 extra DPI on a scan. A two-page document that looks blocky at 100 KB is usually clean at 200 KB.',
      },
      {
        q: 'Which upload forms use a 200 KB limit?',
        a: 'It is common on Indian job portals and exam registration systems (SSC, UPSC, IBPS), on several university application systems, and on older HR document upload flows.',
      },
      {
        q: 'Can I compress several documents to 200 KB one after another?',
        a: 'Yes, and there is no daily limit. Drop the next file onto the same page. The files are processed on your device, so nothing is queued or counted.',
      },
      {
        q: 'What decides how much quality I lose?',
        a: 'Mainly the number of pages. The budget is split across the pages, and budget that simple pages do not use goes to the dense ones. So a one-page form keeps far more detail than a twelve-page report at the same target.',
      },
    ],
    related: ['compress-pdf-to-100kb', 'compress-pdf-to-300kb', 'compress-pdf-to-size', 'split-pdf'],
  },
  {
    slug: 'compress-pdf-to-300kb',
    title: 'Compress PDF to 300KB',
    h1: 'Compress a PDF to under 300 KB',
    description:
      'Compress a PDF to under 300 KB for a multi-page upload. A scan of three to six pages gets about 50 KB a page, which holds up at 100 DPI.',
    keywords: [
      'reduce pdf to 300kb',
      'pdf 300kb compressor',
      'compress pdf below 300kb',
      '300 kb pdf',
    ],
    icon: 'Gauge',
    faqs: [
      {
        q: 'Is 300 KB enough for a multi-page document?',
        a: 'For three to six pages of scanned text, yes. That is about 50 KB a page, which holds up at around 100 DPI. Photographic pages look softer.',
      },
      {
        q: 'Why is my result 291 KB when the target is 300 KB?',
        a: 'The search stops at the highest quality that still fits. JPEG size changes in steps, so the next quality step up would be larger than the target. A result just under the target is correct.',
      },
      {
        q: 'Can I keep colour?',
        a: 'Yes. Colour is kept by default. The advanced controls have a grayscale option, which usually saves another 10 to 25 per cent.',
      },
      {
        q: 'Does this work on a phone?',
        a: 'Yes. It is slower than on a laptop, and a very large scan can reach the memory limit of a mobile browser. A normal document of a few pages compresses fine on a phone.',
      },
    ],
    related: ['compress-pdf-to-200kb', 'compress-pdf-to-500kb', 'compress-pdf-to-size', 'compress-pdf'],
  },
  {
    slug: 'compress-pdf-to-500kb',
    title: 'Compress PDF to 500KB',
    h1: 'Compress a PDF to under 500 KB',
    description:
      'Compress a PDF to under 500 KB for email attachments and portal uploads. Pages are rendered at 72 to 200 DPI to keep as much detail as fits.',
    keywords: [
      'reduce pdf to 500kb',
      'compress pdf 500kb',
      'pdf under 500kb',
      '0.5 mb pdf compressor',
    ],
    icon: 'Gauge',
    faqs: [
      {
        q: 'Is 500 KB a sensible target for emailing?',
        a: 'It is a good default. Most corporate mail gateways reject attachments somewhere between 10 MB and 25 MB, and a file under 1 MB also downloads quickly for a recipient with a slow connection.',
      },
      {
        q: 'Will 500 KB keep a photo-heavy brochure looking good?',
        a: 'Partly. Photographs compress worse than text scans, so a ten-page brochure at 500 KB shows JPEG artefacts in gradients. Try 1 MB or 2 MB first, and go lower only if the form requires it.',
      },
      {
        q: 'Can I choose the rendering resolution myself?',
        a: 'Yes. Open the resolution options and pick 72, 110, 150 or 200 DPI in place of the automatic choice. A higher DPI keeps small print sharp, but then the quality search must go lower to stay inside the same byte budget.',
      },
      {
        q: 'Does compressing remove metadata?',
        a: 'Yes, as a side effect. The output is rebuilt as image pages, so the original author, producer, creation date and any XMP block do not carry over.',
      },
    ],
    related: ['compress-pdf-to-300kb', 'compress-pdf-to-1mb', 'compress-pdf-to-size', 'merge-pdf'],
  },
  {
    slug: 'compress-pdf-to-1mb',
    title: 'Compress PDF to 1MB',
    h1: 'Compress a PDF to under 1 MB',
    description:
      'Compress a PDF to under 1 MB with the pages still legible. A document of ten pages or fewer usually shows little visible loss at this size.',
    keywords: [
      'compress pdf to 1mb',
      'reduce pdf under 1mb',
      'pdf 1 mb limit',
      'shrink pdf to 1mb',
    ],
    icon: 'Shrink',
    faqs: [
      {
        q: 'How much quality do I lose at 1 MB?',
        a: 'For a document of ten pages or fewer, usually very little that is visible on screen. The table in the result shows the JPEG quality of each page. Above about 70, it is hard to see a difference from the original.',
      },
      {
        q: 'Why is 1 MB such a common limit?',
        a: 'It is the usual limit on web application forms and content management uploads, so that a page of attachments still loads quickly. Below about 1 MB, email previews also load without delay.',
      },
      {
        q: 'My scan is 40 MB. Can it really come down to 1 MB?',
        a: 'Almost always. Phone scanners save very large JPEGs at 300 DPI or more. Rendering the same page again at 110 DPI removes about 90 per cent of the pixels before the JPEG quality changes at all.',
      },
      {
        q: 'Is there a size limit on the file I start with?',
        a: 'Only the memory of your device. A 500 MB scan works if your browser can hold it in RAM.',
      },
    ],
    related: ['compress-pdf-to-500kb', 'compress-pdf-to-2mb', 'compress-pdf-to-size', 'compress-pdf'],
  },
  {
    slug: 'compress-pdf-to-2mb',
    title: 'Compress PDF to 2MB',
    h1: 'Compress a PDF to under 2 MB',
    description:
      'Compress a PDF to under 2 MB with little visible loss. Twenty to sixty pages of scanned text fit at this size and stay readable.',
    keywords: [
      'compress pdf to 2mb',
      'reduce pdf under 2mb',
      'pdf 2 mb limit',
      'large pdf compressor',
    ],
    icon: 'Shrink',
    faqs: [
      {
        q: 'What kind of document suits a 2 MB target?',
        a: 'Long ones. Twenty to sixty pages of scanned text fit at 2 MB and stay readable. At that length, smaller targets start to fail.',
      },
      {
        q: 'Will a 300-page document work?',
        a: 'It runs, but each page gets only a few kilobytes at 2 MB, so the result is heavily degraded. If the content matters, split the document first and compress the parts separately.',
      },
      {
        q: 'How long does a large document take?',
        a: 'About a third to half a second per page on a laptop, because each page is rendered once and then encoded up to nine times. Progress is shown for each page, and you can cancel at any time.',
      },
      {
        q: 'Can I stop it halfway?',
        a: 'Yes. Cancel leaves your original file unchanged. The tool never modifies it in place.',
      },
    ],
    related: ['compress-pdf-to-1mb', 'compress-pdf-to-size', 'split-pdf', 'compress-pdf'],
  },
  {
    slug: 'compress-pdf-to-size',
    title: 'Compress PDF to a Size',
    h1: 'Compress a PDF to any size you choose',
    description:
      'Compress a PDF to an exact size in KB or MB. Type the limit that your form sets, and the encoder finds the highest JPEG quality that fits.',
    keywords: [
      'compress pdf to exact size',
      'pdf size reducer custom',
      'pdf to specific kb',
      'target size pdf compressor',
    ],
    icon: 'Gauge',
    faqs: [
      {
        q: 'How does the search actually work?',
        a: 'Each page is rendered once. Then the encoder does a binary search of JPEG quality between 5 and 94, with up to nine attempts, to find the highest setting that fits the share of the budget for that page. If even the lowest quality is too big, the page is scaled down and the search runs again.',
      },
      {
        q: 'Why can an upload service not do this?',
        a: 'It can, but each attempt costs the server a round trip and CPU time. Ten encodes per page are trivial on your own hardware and expensive on a server, so upload converters usually offer three fixed presets.',
      },
      {
        q: 'Is there a smallest possible size?',
        a: 'Yes. A PDF still needs a catalog, a page tree and a cross-reference table, so each page needs a few hundred bytes before any image data. The tool tells you when it reaches that floor and cannot meet your target.',
      },
      {
        q: 'Can I aim for a size in MB?',
        a: 'Yes. Change the unit next to the number. The tool accepts anything from a few kilobytes to hundreds of megabytes, and the search works the same way at every size.',
      },
      {
        q: 'Does the target include the file structure or only the images?',
        a: 'The target is the final file size on disk. The tool first estimates the container overhead and subtracts it, then divides the rest between the pages. The formula with your numbers is shown under the result.',
      },
    ],
    related: [
      'compress-pdf-to-100kb',
      'compress-pdf-to-1mb',
      'compress-pdf',
      'compress-image',
      'pdf-page-counter',
    ],
  },
]

const TARGET_TOOLS: Tool[] = TARGET_PAGES.map((page) => ({
  slug: page.slug,
  title: page.title,
  h1: page.h1,
  description: page.description,
  keywords: page.keywords,
  category: 'pdf',
  icon: page.icon,
  ...(page.popular ? { popular: true } : {}),
  accepts: ['pdf'],
  faqs: page.faqs,
  related: page.related,
  updated: UPDATED,
}))

export const tools: Tool[] = [
  /* ---------------------------------------------------------------- *
   * Encryption
   * ---------------------------------------------------------------- */
  {
    slug: 'password-protect-pdf',
    title: 'Password Protect PDF',
    h1: 'Password protect a PDF with AES-256',
    description:
      'Password protect a PDF with AES-256 encryption and set permission flags for printing, copying and editing. The file and password stay in this tab.',
    keywords: [
      'encrypt pdf',
      'add password to pdf',
      'lock pdf',
      'pdf password protection',
      'aes-256 pdf',
    ],
    category: 'pdf',
    icon: 'FileLock2',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What encryption is actually used?',
        a: 'The PDF 2.0 standard security handler, version 5, revision 6: AES-256 in CBC mode on every string and stream. The key comes from the iterated SHA-256/384/512 hash in the specification. It is the strongest scheme that the PDF format defines.',
      },
      {
        q: 'Can you recover my password if I lose it?',
        a: 'No, and nobody else can. The key comes from your password through a deliberately slow hash, and it is never written down, sent or stored. If you lose the password, you lose the document. Save it in a password manager before you download the file.',
      },
      {
        q: 'What is the difference between the open password and the owner password?',
        a: 'The open (user) password is necessary to read the document at all. The owner password removes the permission restrictions (printing, copying, editing) for a person who has it. Use two different passwords if you want people to read but not print.',
      },
      {
        q: 'Do the permission flags really stop anyone printing?',
        a: 'They stop readers that follow the standard. The flags are inside the encrypted, tamper-checked /Perms block, so nobody can edit them without the key. But a tool can choose to ignore them. Only the open password makes the content unreadable.',
      },
      {
        q: 'How do I know the encryption worked?',
        a: 'Before it shows the download button, the tool opens its own output again with your password and reports the page count it reads. If that check fails, the tool tells you.',
      },
    ],
    related: ['unlock-pdf', 'compress-pdf-to-size', 'merge-pdf', 'password-generator', 'watermark-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'unlock-pdf',
    title: 'Unlock PDF',
    h1: 'Unlock a PDF and remove its password',
    description:
      'Unlock a PDF with its known password, or remove print and copy restrictions. Text, links, bookmarks and form fields stay where possible.',
    keywords: [
      'remove pdf password',
      'pdf password remover',
      'decrypt pdf',
      'remove pdf restrictions',
      'unlock secured pdf',
    ],
    category: 'pdf',
    icon: 'LockOpen',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Can this crack a password I do not know?',
        a: 'No. There is no brute-force mode. AES-256 with the iterated hash of the specification makes guessing too slow to be practical.',
      },
      {
        q: 'My PDF opens fine but will not let me print or copy. Does that count?',
        a: 'Yes, and it is the easy case. These files have an empty user password and only permission flags, so you do not need a password. Drop the file in and press Remove protection.',
      },
      {
        q: 'Does unlocking damage the file?',
        a: 'Normally not. The tool decrypts each string and stream in place and rewrites the object graph, so text, links, bookmarks and form fields stay. If a document does not allow that rewrite, the tool renders the pages as images and tells you.',
      },
      {
        q: 'Which encryption schemes are supported?',
        a: 'All revisions of the standard handler: RC4 40-bit and 128-bit (revisions 2 and 3), AES-128 (revision 4) and AES-256 (revisions 5 and 6). Vendor DRM handlers are not part of the PDF specification. The tool cannot remove them and tells you so.',
      },
      {
        q: 'Is it legal to remove a password?',
        a: 'That depends on the document and on where you are. The tool assumes that you own the file or have permission to open it. It cannot check this, so the decision is yours.',
      },
    ],
    related: ['password-protect-pdf', 'compress-pdf', 'merge-pdf', 'pdf-to-text', 'split-pdf'],
    updated: UPDATED,
  },

  ...TARGET_TOOLS,

  /* ---------------------------------------------------------------- *
   * Document conversion
   * ---------------------------------------------------------------- */
  {
    slug: 'pdf-to-markdown',
    title: 'PDF to Markdown',
    h1: 'Convert a PDF to Markdown',
    description:
      'Convert a PDF to Markdown with headings, lists and tables found from the page layout. Paste the result into a language model or a docs site.',
    keywords: [
      'pdf to md',
      'convert pdf to markdown',
      'pdf to markdown for chatgpt',
      'extract pdf structure',
    ],
    category: 'pdf-convert',
    icon: 'FileCode2',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How are headings worked out when a PDF has no heading tags?',
        a: 'From the font sizes. The size with the most characters is taken as body text, and the larger sizes above it become heading levels one to four, from largest to smallest. A PDF has no markup to read, so the tool uses the geometry.',
      },
      {
        q: 'What does Markdown give me over plain text?',
        a: 'It keeps the structure. Language models follow a document better when headings, bullets and tables are marked up, and Markdown is the format they were trained on most. It also pastes into Obsidian, Notion, a static site or a pull request.',
      },
      {
        q: 'Does it work on scanned documents?',
        a: 'No. A scan has no text layer, only pixels, and reading pixels needs OCR, which this tool does not have. The tool tells you this and does not return an empty file.',
      },
      {
        q: 'What happens to tables?',
        a: 'Groups of three or more lines that split into the same number of aligned columns become GFM pipe tables. Ragged tables and tables with merged cells are not recognised and come through as ordinary lines. If detection guesses wrongly, turn it off.',
      },
      {
        q: 'Is the document sent anywhere when I press “Copy for ChatGPT”?',
        a: 'No. That button only puts text on your clipboard. If you then paste it into a chatbot, it goes to that company, so first make sure that you are allowed to share the document.',
      },
    ],
    related: ['pdf-to-text', 'pdf-to-word', 'markdown-to-word', 'markdown-to-pdf', 'docx-to-markdown'],
    updated: UPDATED,
  },
  {
    slug: 'pdf-to-excel',
    title: 'PDF to Excel',
    h1: 'Convert PDF tables to Excel',
    description:
      'Convert PDF to Excel: tables in a digital PDF go into an .xlsx workbook with one sheet per page. Adjust column snapping with a live preview.',
    keywords: [
      'pdf to xlsx',
      'extract table from pdf',
      'pdf table to excel',
      'convert pdf spreadsheet',
    ],
    category: 'pdf-convert',
    icon: 'Sheet',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How are columns detected?',
        a: 'Each text fragment on a page adds its starting x position to a histogram. Positions that cluster within a few points become a column, and each fragment goes to its nearest column. A person reads a printed table in the same way.',
      },
      {
        q: 'One column is being split into two. How do I fix it?',
        a: 'Raise the column-snapping value. It is the tolerance in points for merging nearby start positions: a wider tolerance merges more, and a narrower one splits more. The preview runs again when you release the slider.',
      },
      {
        q: 'Will this read a scanned bank statement?',
        a: 'No. A scan is an image and has no text to cluster. This tool is for PDFs that were generated digitally, such as exports from accounting software, statements downloaded from a bank and reports from a database.',
      },
      {
        q: 'Where does each page end up in the workbook?',
        a: 'On its own worksheet, named “Page 1”, “Page 2” and so on. A multi-page statement stays in order and is not joined into one long sheet.',
      },
      {
        q: 'Is my financial data uploaded to check the table?',
        a: 'No. Text extraction, clustering and writing the .xlsx all run in this tab. Watch the network panel of your browser while it works: it stays empty.',
      },
    ],
    related: ['pdf-to-csv', 'excel-to-pdf', 'excel-to-csv', 'pdf-to-text', 'csv-to-excel'],
    updated: UPDATED,
  },
  {
    slug: 'pdf-to-csv',
    title: 'PDF to CSV',
    h1: 'Convert PDF tables to CSV',
    description:
      'Convert PDF to CSV: the table rows of each page go into one plain CSV file, with a blank line between pages. Copy the result or download it.',
    keywords: [
      'pdf table to csv',
      'convert pdf to csv',
      'pdf data extraction csv',
      'pdf to comma separated',
    ],
    category: 'pdf-convert',
    icon: 'Table2',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why choose CSV over Excel?',
        a: 'CSV is plain text. It imports into anything (pandas, R, a database loader, a spreadsheet), it diffs cleanly in version control, and it has no binary format. Take the CSV if a script reads the data, and Excel if a person does.',
      },
      {
        q: 'How are pages separated in the output?',
        a: 'The rows of each page are written in order, with a blank line between pages. A multi-page statement stays in one file, with a clear boundary that you can split on.',
      },
      {
        q: 'What about commas and quotes inside a cell?',
        a: 'They are escaped to RFC 4180 rules: a cell that contains a comma, a double quote or a newline is put in quotes, and its quotes are doubled. The file opens correctly in Excel, Numbers, LibreOffice and standard CSV parsers.',
      },
      {
        q: 'Can I copy the result instead of downloading it?',
        a: 'Yes. The Copy CSV button is next to the download. It is faster when you only want to paste a few rows into a sheet that is already open.',
      },
    ],
    related: ['pdf-to-excel', 'csv-to-pdf', 'csv-to-json', 'json-to-csv', 'excel-to-csv'],
    updated: UPDATED,
  },
  {
    slug: 'excel-to-pdf',
    title: 'Excel to PDF',
    h1: 'Convert an Excel workbook to PDF',
    description:
      'Convert Excel to PDF: .xlsx sheets become a paginated PDF table with a repeated header row, fit-to-width columns and a landscape option.',
    keywords: [
      'xlsx to pdf',
      'spreadsheet to pdf',
      'convert excel to pdf online',
      'xls to pdf converter',
    ],
    category: 'pdf-convert',
    icon: 'FileSpreadsheet',
    accepts: ['xlsx', 'xls', 'xlsm', 'ods', 'csv'],
    faqs: [
      {
        q: 'Are formulas recalculated?',
        a: 'No. The tool prints the cached results that Excel stored when the workbook was last saved, which is what the file contains. Nothing is calculated again, so volatile functions print the values they had at the last save.',
      },
      {
        q: 'Does it keep my cell colours and fonts?',
        a: 'No. The tool draws a plain table with column widths, a repeated header row, optional zebra stripes and grid lines. For the exact styling, print to PDF from Excel.',
      },
      {
        q: 'My table is very wide. What are my options?',
        a: 'Switch to landscape, use A3, make the font smaller, or keep fit-to-width on. Fit-to-width scales all columns by the same ratio, so the whole table fits inside the margins and nothing is cut off at the page edge.',
      },
      {
        q: 'Can I export only one worksheet?',
        a: 'Yes. When a workbook has several sheets, a picker appears. Choose one sheet or all of them. With all sheets, the name of each sheet is printed above its table.',
      },
      {
        q: 'Which characters might not survive?',
        a: 'Characters outside the Western European (WinAnsi) range. The tool uses the fourteen standard fonts that all PDF readers have, and it does not download fonts from a server. So Greek, Cyrillic, Arabic and CJK text is replaced with a question mark, and the tool reports how many characters it replaced.',
      },
    ],
    related: ['csv-to-pdf', 'pdf-to-excel', 'excel-to-csv', 'excel-to-json', 'word-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'csv-to-pdf',
    title: 'CSV to PDF',
    h1: 'Convert a CSV file to a PDF table',
    description:
      'Convert CSV to PDF: a CSV export becomes a printable table with a repeated header row and automatic column widths. The delimiter is detected.',
    keywords: [
      'csv to pdf converter',
      'print csv as pdf',
      'comma separated to pdf',
      'tsv to pdf',
    ],
    category: 'pdf-convert',
    icon: 'FileType2',
    accepts: ['csv', 'tsv', 'txt'],
    faqs: [
      {
        q: 'Does it detect the delimiter automatically?',
        a: 'Yes. The tool detects commas, semicolons, tabs and pipes from the content. European CSVs with semicolons and tab-separated exports work without a setting.',
      },
      {
        q: 'What happens to a very long CSV?',
        a: 'It continues on as many pages as necessary, and the header row is drawn again at the top of each page. A 5,000-row export stays readable.',
      },
      {
        q: 'Can I control how the table looks?',
        a: 'You can set the paper size, orientation and font size, and turn grid lines, zebra stripes, the repeated header and fit-to-width columns on or off. Long cells wrap to at most four lines and are marked as trimmed if they are longer.',
      },
      {
        q: 'Is a CSV containing personal data safe here?',
        a: 'JavaScript in this tab reads the CSV and draws the PDF. The page has no server endpoint, so the data cannot be sent anywhere.',
      },
    ],
    related: ['excel-to-pdf', 'pdf-to-csv', 'csv-to-excel', 'csv-to-json', 'text-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'pages-to-pdf',
    title: 'Pages to PDF',
    h1: 'Open an Apple Pages file as a PDF',
    description:
      'Convert an Apple Pages file to PDF on Windows or Linux without iWork or iCloud. The tool extracts the preview that Pages stored in the file.',
    keywords: [
      'open pages file on windows',
      'apple pages to pdf',
      '.pages converter',
      'pages file viewer',
    ],
    category: 'pdf-convert',
    icon: 'Sparkles',
    accepts: ['pages', 'zip'],
    faqs: [
      {
        q: 'How can this work without Pages installed?',
        a: 'A .pages file is a zip archive with a preview inside. Older files hold a full PDF preview, which you get untouched. Newer files hold only an image of the first page, which becomes a one-page PDF. The archive is opened in your browser.',
      },
      {
        q: 'Is the result identical to what the Mac showed?',
        a: 'For older files, yes: it is the PDF the Mac made. Newer files give an image of the first page only. For the full document, use File → Export To → PDF in Pages.',
      },
      {
        q: 'It says there is no preview inside. What now?',
        a: 'The document was saved without a preview. Ask the sender to export a PDF from Pages (File → Export To → PDF).',
      },
      {
        q: 'My .pages file is a folder, not a file.',
        a: 'Older Pages documents are macOS packages: folders that Finder shows as one item. Compress the package into a .zip and drop the .zip in. The tool reads it the same way.',
      },
      {
        q: 'Can I convert several at once?',
        a: 'Yes. Drop as many as you like and download them one by one or as one zip. There is no per-file charge or daily limit, because the files are processed on your device.',
      },
    ],
    related: ['keynote-to-pdf', 'numbers-to-pdf', 'word-to-pdf', 'pdf-to-jpg', 'merge-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'keynote-to-pdf',
    title: 'Keynote to PDF',
    h1: 'Open an Apple Keynote file as a PDF',
    description:
      'Convert a Keynote file to a PDF that opens anywhere. The tool extracts the slide preview that Keynote saved inside the .key file.',
    keywords: [
      'open keynote on windows',
      'key to pdf',
      'keynote converter',
      'apple presentation to pdf',
    ],
    category: 'pdf-convert',
    icon: 'Presentation',
    accepts: ['key', 'zip'],
    faqs: [
      {
        q: 'Do I get one page per slide?',
        a: 'Only from older files, which hold a full PDF preview. Newer files hold an image of the first slide only, so you get a one-page PDF. For every slide, use File → Export To → PDF in Keynote.',
      },
      {
        q: 'What happens to builds, transitions and presenter notes?',
        a: 'They are lost, because a PDF has no animation. Each slide shows its final built state, which is what “Export to PDF” in Keynote does with the default settings.',
      },
      {
        q: 'Are embedded videos included?',
        a: 'No. A video placeholder appears as its poster frame. PDF has no reliable cross-reader video support, and Keynote’s preview does not attempt it either.',
      },
      {
        q: 'Why is this faster than an online converter?',
        a: 'Nothing is uploaded or re-rendered. The file is unzipped in your browser and the preview inside it is read out, which takes about a second.',
      },
    ],
    related: ['pages-to-pdf', 'numbers-to-pdf', 'pdf-to-jpg', 'merge-pdf', 'compress-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'numbers-to-pdf',
    title: 'Numbers to PDF',
    h1: 'Open an Apple Numbers file as a PDF',
    description:
      'Convert an Apple Numbers file to PDF without a Mac. The tool extracts the print-ready preview that Numbers stores inside the .numbers file.',
    keywords: [
      'open numbers file on windows',
      'numbers to pdf',
      'apple spreadsheet converter',
      '.numbers viewer',
    ],
    category: 'pdf-convert',
    icon: 'Table',
    accepts: ['numbers', 'zip'],
    faqs: [
      {
        q: 'Will I get the data as a spreadsheet or as a picture of one?',
        a: 'A picture. The cells are not editable. Older files give the full print layout; newer files give an image of the first sheet only. For the data, ask for an .xlsx or .csv export.',
      },
      {
        q: 'Are charts included?',
        a: 'Yes, as they appear in the preview. In older files they stay vector graphics; in newer files the preview is an image.',
      },
      {
        q: 'Do all the sheets come through?',
        a: 'Only from older files, which hold a full PDF preview. Newer files hold an image of the first sheet only. For every sheet, use File → Export To → PDF in Numbers.',
      },
      {
        q: 'Can I then convert that PDF to Excel?',
        a: 'You can try our PDF to Excel tool on the result. It recovers the values from the text positions, but merged cells and charts are lost. Use it only to rescue data.',
      },
    ],
    related: ['pages-to-pdf', 'keynote-to-pdf', 'pdf-to-excel', 'excel-to-pdf', 'pdf-to-csv'],
    updated: UPDATED,
  },

  /* ---------------------------------------------------------------- *
   * Word output
   * ---------------------------------------------------------------- */
  {
    slug: 'markdown-to-word',
    title: 'Markdown to Word',
    h1: 'Convert Markdown to a Word .docx file',
    description:
      'Convert Markdown to Word, including AI chat output. The .docx file uses the built-in Word styles for headings, lists and tables.',
    keywords: [
      'md to docx',
      'markdown to docx',
      'convert markdown to word',
      'chatgpt output to word',
    ],
    category: 'data',
    icon: 'FileType',
    accepts: ['md', 'markdown', 'txt'],
    faqs: [
      {
        q: 'Is this a real .docx or a renamed HTML file?',
        a: 'A real one. The output is a zip with [Content_Types].xml, the document part, a styles part and a numbering part, which is the OOXML structure that Word writes. It opens in Word, LibreOffice, Pages and Google Docs.',
      },
      {
        q: 'Which Markdown features are supported?',
        a: 'Headings one to six, bold, italic, strikethrough, inline code, fenced code blocks, links, ordered and unordered lists with nesting, task lists, block quotes, horizontal rules and GFM tables.',
      },
      {
        q: 'Why do headings use Word styles?',
        a: 'Styles make the navigation pane, an automatic table of contents and your organisation’s template work. Big bold text looks the same, but it breaks all three, and you cannot restyle it later.',
      },
      {
        q: 'Are the bullets real Word lists?',
        a: 'Yes. A numbering definition is written into the document, so bullets and numbers renumber themselves when you edit, and demoting an item with Tab behaves normally.',
      },
      {
        q: 'Is this safe for confidential AI output?',
        a: 'The conversion is. JavaScript in this tab turns the text into XML and zips it. Text that you already pasted into a chatbot is a separate question, which this page cannot help with.',
      },
    ],
    related: ['html-to-word', 'text-to-word', 'markdown-to-pdf', 'markdown-to-html', 'docx-to-markdown'],
    updated: UPDATED,
  },
  {
    slug: 'html-to-word',
    title: 'HTML to Word',
    h1: 'Convert HTML to a Word .docx file',
    description:
      'Convert HTML to Word: paste HTML or drop an .html file and get a .docx file with real heading styles, working lists and tables.',
    keywords: [
      'html to docx',
      'webpage html to word',
      'convert html to word document',
      'html table to word',
    ],
    category: 'data',
    icon: 'CodeXml',
    accepts: ['html', 'htm'],
    faqs: [
      {
        q: 'How is the HTML interpreted?',
        a: 'It is converted to Markdown first, with the same rules as our HTML to Markdown tool, and then written as OOXML. That step removes presentational markup and keeps the structure, which is what Word needs.',
      },
      {
        q: 'Do CSS styles carry over?',
        a: 'No. The tool drops inline colours, fonts and layout. It keeps the meaning (headings, emphasis, lists, tables, links and code) and renders it with the Word styles, so it matches your template.',
      },
      {
        q: 'What about images?',
        a: 'Images are not embedded. Each one is noted in place as a caption in brackets, because an <img> usually points at a remote URL and this page makes no network requests. Paste the images into Word yourself.',
      },
      {
        q: 'Can I convert a whole saved web page?',
        a: 'Yes. Drop the .html file in. Expect navigation and footer text to come with it. It is quicker to delete those in Word than to guess which part of a page is the article.',
      },
    ],
    related: ['markdown-to-word', 'text-to-word', 'html-to-markdown', 'markdown-to-html', 'html-entity-encoder'],
    updated: UPDATED,
  },
  {
    slug: 'text-to-word',
    title: 'Text to Word',
    h1: 'Convert plain text to a Word .docx file',
    description:
      'Convert text to Word: a .txt file or pasted text becomes a .docx file. Blank lines start paragraphs, and bullets and ALL-CAPS headings are detected.',
    keywords: [
      'txt to docx',
      'text file to word',
      'convert txt to word online',
      'notepad to word',
    ],
    category: 'data',
    icon: 'Type',
    accepts: ['txt', 'text'],
    faqs: [
      {
        q: 'How does it decide where paragraphs end?',
        a: 'A blank line starts a new paragraph, which is the convention almost every plain-text document follows. Single line breaks inside a paragraph are joined into flowing text unless you tick “Keep every line break”.',
      },
      {
        q: 'When should I keep every line break?',
        a: 'For poetry, addresses, log excerpts, song lyrics or anything where the line endings are meaningful. For prose that was hard-wrapped at 72 columns, leave it off so the text reflows properly in Word.',
      },
      {
        q: 'What does the ALL-CAPS heading option do?',
        a: 'A short line entirely in capitals, on its own, with no full stop, is treated as a section heading and given Word’s Heading 2 style. It is the usual convention in plain-text reports, and you can turn it off if your text shouts for other reasons.',
      },
      {
        q: 'Are bullets recognised?',
        a: 'Yes. A block where each line starts with -, * or • becomes a real Word bulleted list, which renumbers and indents correctly when you edit it.',
      },
    ],
    related: ['markdown-to-word', 'html-to-word', 'text-to-pdf', 'word-counter', 'case-converter'],
    updated: UPDATED,
  },
]
