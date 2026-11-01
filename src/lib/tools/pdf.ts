import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    h1: 'Merge PDF files into one',
    description:
      'Merge PDF files into one document. Drag the files into order and set a page range for each file, such as 1-3, 8, 12-.',
    keywords: [
      'combine pdf',
      'join pdf files',
      'pdf merger',
      'merge pdf offline',
      'append pdf',
      'concatenate pdf',
    ],
    category: 'pdf',
    icon: 'FileStack',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Is there a file size or file count limit?',
        a: 'No fixed limit. Your device does the work, so the limit is its memory. A few hundred megabytes of PDFs is normally fine on a laptop, less on an older phone.',
      },
      {
        q: 'Can I merge only some pages from a file?',
        a: 'Yes. Each file in the list has a page-range box. Leave it empty to take the whole file, or enter a range such as 1-3, 8, 12- to take only those pages, in that order.',
      },
      {
        q: 'Does merging change the quality of my PDFs?',
        a: 'No. Pages are copied object-for-object into the new document, so text stays selectable, vectors stay sharp and images are not re-encoded.',
      },
      {
        q: 'What happens to bookmarks, forms and links?',
        a: 'Page content, annotations and form field appearances are carried over. Document-level outlines (bookmarks) from the source files are not rebuilt in the merged file.',
      },
      {
        q: 'Can I merge password-protected PDFs?',
        a: 'Not while they are still encrypted. Open the file in a PDF reader, remove the password or print it to a new PDF, then merge the unprotected copy.',
      },
    ],
    related: ['split-pdf', 'organize-pdf', 'compress-pdf', 'extract-pdf-pages', 'jpg-to-pdf', 'add-page-numbers-to-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'split-pdf',
    title: 'Split PDF',
    h1: 'Split a PDF into separate files',
    description:
      'Split a PDF every N pages, by custom ranges such as 1-3, 7, 10-, or into one file per page. More than one output file downloads as a ZIP.',
    keywords: [
      'separate pdf',
      'divide pdf',
      'pdf splitter',
      'split pdf by pages',
      'cut pdf',
      'break pdf into pages',
    ],
    category: 'pdf',
    icon: 'Scissors',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How do I write a custom range?',
        a: 'Use comma-separated ranges. 1-3, 7, 10- makes three files: pages 1 to 3, page 7, and page 10 to the end. Spaces are ignored.',
      },
      {
        q: 'Why do I get a ZIP file?',
        a: 'A browser can reliably save only one file per click, so a split that makes more than one PDF downloads as one ZIP. A split that makes one file downloads as a PDF.',
      },
      {
        q: 'Are the split files smaller than the original?',
        a: 'Usually, but not proportionally. Shared resources such as embedded fonts are copied into every output file, so ten one-page PDFs can add up to more than the original.',
      },
      {
        q: 'Is the original file modified?',
        a: 'No. The tool reads your file into memory and does not change it on disk. Each output is a new document.',
      },
    ],
    related: ['merge-pdf', 'extract-pdf-pages', 'delete-pages-from-pdf', 'organize-pdf', 'pdf-to-jpg', 'pdf-page-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-pdf',
    title: 'Compress PDF',
    h1: 'Compress a PDF and reduce its file size',
    description:
      'Compress PDF files to reduce their size. Use a lossless clean-up, or one of three quality presets at 72, 110 or 150 DPI for scanned pages.',
    keywords: [
      'reduce pdf size',
      'pdf compressor',
      'shrink pdf',
      'make pdf smaller',
      'optimize pdf',
      'compress pdf offline',
    ],
    category: 'pdf',
    icon: 'Shrink',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What is the difference between the two modes?',
        a: 'Lossless clean-up rewrites the file structure and drops unused objects. Text stays selectable, but the saving is small. Quality presets render each page to a JPEG at the DPI you choose. This makes scans much smaller, but the text becomes an image.',
      },
      {
        q: 'Which preset should I pick?',
        a: 'Recommended (110 DPI) is a good default for email and web. Use Strong (72 DPI) for a document that will only be read on screen, and Light (150 DPI) when the file may be printed.',
      },
      {
        q: 'Why did my file barely get smaller?',
        a: 'PDFs that are mostly text and vectors are already small, so there is little to remove. Large savings come from scanned or image-heavy documents, where images make up most of the file size.',
      },
      {
        q: 'Will text still be searchable after compressing?',
        a: 'Only in lossless clean-up mode. The quality presets convert each page to a picture, so selectable text, links and form fields are flattened away.',
      },
      {
        q: 'Is anything uploaded to a server?',
        a: 'No. Rendering and re-encoding happen with WebAssembly and canvas inside this tab, so the document never leaves your device.',
      },
    ],
    related: ['merge-pdf', 'split-pdf', 'pdf-to-jpg', 'compress-image', 'organize-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'rotate-pdf',
    title: 'Rotate PDF',
    h1: 'Rotate PDF pages',
    description:
      'Rotate PDF pages by 90, 180 or 270 degrees. Turn all pages or select pages in a thumbnail grid, then save the corrected document.',
    keywords: [
      'turn pdf pages',
      'rotate pdf pages permanently',
      'fix sideways pdf',
      'landscape to portrait pdf',
      'flip pdf page',
    ],
    category: 'pdf',
    icon: 'RotateCw',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Does the rotation stick when I reopen the file?',
        a: 'Yes. The page rotation attribute is written into the saved PDF, so every reader and printer shows the page the way you left it.',
      },
      {
        q: 'Can I rotate only some pages?',
        a: 'Yes. Click a thumbnail to select it, or use the odd, even and range shortcuts. The rotate buttons then apply only to the selected pages.',
      },
      {
        q: 'Why do some pages already look rotated?',
        a: 'Scanners often store a landscape page as a portrait image plus a 90 degree rotation flag. The grid shows the page exactly as a reader would display it, flag included.',
      },
      {
        q: 'Does rotating re-compress the page content?',
        a: 'No. Only a rotation value in the page dictionary changes, so file size, image quality and selectable text are all untouched.',
      },
    ],
    related: ['organize-pdf', 'merge-pdf', 'split-pdf', 'delete-pages-from-pdf', 'compress-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'organize-pdf',
    title: 'Organize PDF',
    h1: 'Organize and reorder PDF pages',
    description:
      'Organize PDF pages in a thumbnail grid. Drag pages into a new order, rotate, duplicate or delete them, then export the new document.',
    keywords: [
      'reorder pdf pages',
      'rearrange pdf',
      'pdf page organizer',
      'move pdf pages',
      'sort pdf pages',
      'pdf page editor',
    ],
    category: 'pdf',
    icon: 'LayoutGrid',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How do I move a page without a mouse?',
        a: 'Press Tab to focus a page card, then use its move-left and move-right buttons. Both buttons work from the keyboard.',
      },
      {
        q: 'Can I duplicate a page?',
        a: 'Yes. The duplicate button on each page card inserts a copy after it. Use it to repeat a cover or separator sheet.',
      },
      {
        q: 'Can I undo a deletion?',
        a: 'Yes. Deleted pages move to a restore strip below the grid until you export, so you can put any of them back. Reset restores the original order.',
      },
      {
        q: 'Does the export keep the original quality?',
        a: 'Yes. Pages are copied as they are into the new document. Nothing is rendered or compressed again, so text and images are bit-for-bit the same.',
      },
    ],
    related: ['rotate-pdf', 'delete-pages-from-pdf', 'merge-pdf', 'split-pdf', 'extract-pdf-pages'],
    updated: '2026-11-01',
  },
  {
    slug: 'delete-pages-from-pdf',
    title: 'Delete PDF Pages',
    h1: 'Delete pages from a PDF',
    description:
      'Delete pages from a PDF. Click the thumbnails or type ranges such as 2, 5-9, 20-, check the pages that stay, then download the new file.',
    keywords: [
      'remove pdf pages',
      'delete page from pdf',
      'erase pdf pages',
      'remove blank pages pdf',
      'trim pdf',
    ],
    category: 'pdf',
    icon: 'FileMinus2',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How do I delete a range of pages?',
        a: 'Type it in the range box. 2, 5-9, 20- deletes page 2, pages 5 to 9, and all pages from page 20 to the end. The grid highlights each page that will be deleted.',
      },
      {
        q: 'Can I delete all the even or odd pages?',
        a: 'Yes. The odd and even shortcuts select those pages. Use them to remove the blank backs of a duplex scan.',
      },
      {
        q: 'Does deleting pages shrink the file?',
        a: 'Usually yes, because the images and fonts used only by those pages are left behind when the remaining pages are copied into a fresh document.',
      },
      {
        q: 'Is my original file changed?',
        a: 'No. Nothing is written back to disk. You get a new PDF to download, and the file you selected does not change.',
      },
    ],
    related: ['extract-pdf-pages', 'organize-pdf', 'split-pdf', 'rotate-pdf', 'merge-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'extract-pdf-pages',
    title: 'Extract PDF Pages',
    h1: 'Extract pages from a PDF',
    description:
      'Extract pages from a PDF. Pick them in a thumbnail grid or by range, then save one combined PDF or a ZIP with one file per page.',
    keywords: [
      'get pages from pdf',
      'pdf page extractor',
      'save pdf page separately',
      'copy pages from pdf',
      'select pdf pages',
    ],
    category: 'pdf',
    icon: 'FileOutput',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Does the extraction keep my page order?',
        a: 'Yes. Pages come out in the order you typed them, so 5, 1, 3 makes a three-page PDF in that order.',
      },
      {
        q: 'Should I choose one PDF or one file per page?',
        a: 'Choose one combined PDF when the pages belong together, and the ZIP of single pages when each page is a separate document, such as invoices or certificates.',
      },
      {
        q: 'How is this different from splitting?',
        a: 'Splitting cuts a document into consecutive parts. Extracting takes any set of pages, in any order, and drops the rest.',
      },
      {
        q: 'Will the extracted pages look identical?',
        a: 'Yes. The page objects are copied without re-rendering, so fonts, vectors, images and annotations survive unchanged.',
      },
    ],
    related: ['delete-pages-from-pdf', 'split-pdf', 'organize-pdf', 'merge-pdf', 'pdf-to-jpg'],
    updated: '2026-11-01',
  },
  {
    slug: 'add-page-numbers-to-pdf',
    title: 'Add Page Numbers to PDF',
    h1: 'Add page numbers to a PDF',
    description:
      'Add page numbers to a PDF. Set the position, start number, page range, font and format, such as 7, 7/24 or Page 7 of 24.',
    keywords: [
      'number pdf pages',
      'pdf page numbering',
      'insert page numbers pdf',
      'bates numbering',
      'add folio to pdf',
    ],
    category: 'pdf',
    icon: 'ListOrdered',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Can I start numbering at a page other than the first?',
        a: 'Yes. Set the page range to skip a cover (for example 2-) and set the first printed number separately, so page 2 of the file can read “1”.',
      },
      {
        q: 'What number formats are available?',
        a: 'Plain (7), with a slash (7/24), “Page 7 of 24”, or a custom pattern where {n} is the current number, {total} the total and {p} the physical page.',
      },
      {
        q: 'Will the numbers overlap my content?',
        a: 'They sit in the margin at the position you pick, and the preview shows page one as it will print. Increase the margin if your layout runs close to the edge.',
      },
      {
        q: 'Can the numbers be removed later?',
        a: 'Not easily. They are drawn into the page content stream, like a printed folio. Keep your original without numbers if you may need to renumber.',
      },
    ],
    related: ['watermark-pdf', 'merge-pdf', 'organize-pdf', 'rotate-pdf', 'pdf-page-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'watermark-pdf',
    title: 'Watermark PDF',
    h1: 'Add a watermark to a PDF',
    description:
      'Watermark a PDF with text or an image. Set opacity, rotation, size and tiling, put it in one of nine positions, and preview it on page one.',
    keywords: [
      'add watermark to pdf',
      'stamp pdf',
      'draft watermark pdf',
      'confidential pdf',
      'image watermark pdf',
      'logo on pdf',
    ],
    category: 'pdf',
    icon: 'Droplets',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Can I use my logo instead of text?',
        a: 'Yes. Switch to image mode and drop in a PNG or JPEG. PNG transparency is kept, and you can set scale, opacity, rotation and tiling.',
      },
      {
        q: 'Is the watermark behind or in front of the content?',
        a: 'You choose. The default draws it over the content. Behind the content keeps text legible, but opaque backgrounds such as full-page scans hide it.',
      },
      {
        q: 'Can a watermark be removed by someone else?',
        a: 'Yes. It is merged into the page content, but a person with a full PDF editor can try to remove it. A watermark discourages copying and does not lock the file.',
      },
      {
        q: 'Why is my accented or non-Latin text rejected?',
        a: 'The built-in PDF fonts cover the WinAnsi character set only. Characters outside it, such as Chinese or Cyrillic, cannot be drawn without embedding a custom font.',
      },
      {
        q: 'Can I watermark only some pages?',
        a: 'Yes. The page range box accepts values like 1, 4-8, 12- so covers or annexes can be left clean.',
      },
    ],
    related: ['add-page-numbers-to-pdf', 'compress-pdf', 'merge-pdf', 'organize-pdf', 'jpg-to-pdf', 'signature-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'pdf-page-counter',
    title: 'PDF Page Counter',
    h1: 'Count PDF pages and inspect a PDF',
    description:
      'Count PDF pages in one or many files and get a total. See page sizes such as A4 or Letter, the PDF version, metadata and the weight of each page.',
    keywords: [
      'count pdf pages',
      'how many pages in pdf',
      'pdf page count',
      'pdf metadata viewer',
      'pdf properties',
      'bulk pdf page count',
    ],
    category: 'pdf',
    icon: 'FileSearch',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Can I count pages across many files at once?',
        a: 'Yes. Drop in a folder of PDFs to get a page count for each file and a total, which you can copy or export as CSV.',
      },
      {
        q: 'What does the per-page weight column mean?',
        a: 'Each page is re-saved on its own and measured, which shows which pages carry the heavy images. It is an estimate, because shared fonts are counted in every page.',
      },
      {
        q: 'Which paper size names are detected?',
        a: 'A0 to A6, Letter, Legal, Tabloid, Executive and the common B sizes, matched with a small tolerance and reported in points, millimetres and inches.',
      },
      {
        q: 'Does it work on password-protected PDFs?',
        a: 'The page count and version usually still read, but encrypted content and metadata may be unavailable. The tool tells you when a file is encrypted.',
      },
    ],
    related: ['compress-pdf', 'split-pdf', 'merge-pdf', 'extract-pdf-pages', 'organize-pdf'],
    updated: '2026-11-01',
  },
]
