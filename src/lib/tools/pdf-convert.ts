import type { Tool } from './types'

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  {
    slug: 'pdf-to-jpg',
    title: 'PDF to JPG',
    h1: 'Convert PDF to JPG images',
    description:
      'Convert PDF to JPG at 72, 150 or 300 DPI. Each page becomes one JPG image, which you can download one by one or as a ZIP.',
    keywords: [
      'pdf to jpg',
      'pdf to jpeg',
      'convert pdf to image',
      'pdf page to picture',
      'extract pdf pages as images',
      'pdf to jpg converter',
    ],
    category: 'pdf-convert',
    icon: 'FileImage',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What DPI should I choose?',
        a: '72 DPI matches screen resolution and keeps files small. 150 DPI is good for sharing and reading on screen. 300 DPI matches print resolution: use it for print or OCR. It has about 17× the pixels of a 72 DPI render.',
      },
      {
        q: 'Are my pages uploaded anywhere?',
        a: 'No. pdf.js reads and renders the PDF in this tab, and the canvas encoder of your browser makes the JPGs. Nothing is sent, so the tool also works offline.',
      },
      {
        q: 'Why does my scanned PDF look soft at 300 DPI?',
        a: 'Rendering cannot add detail that is not in the file. If a page contains a 150 DPI scan, 300 DPI only upscales those pixels. Text-based PDFs are vector, so they get sharper at higher DPI.',
      },
      {
        q: 'Is there a page or file-size limit?',
        a: 'Only the memory of your device. Hundreds of pages work. Very large pages at 300 DPI use a lot of RAM, so the tool limits the canvas size to prevent a failure.',
      },
      {
        q: 'Can I convert just one page?',
        a: 'Yes. Convert the document, then use the download button on the thumbnail of that page.',
      },
    ],
    related: ['pdf-to-png', 'jpg-to-pdf', 'pdf-to-text', 'images-to-pdf', 'split-pdf', 'compress-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'pdf-to-png',
    title: 'PDF to PNG',
    h1: 'Convert PDF to PNG images',
    description:
      'Convert PDF to PNG images at up to 300 DPI. Each page becomes a lossless PNG, and an option gives the pages a transparent background.',
    keywords: [
      'pdf to png',
      'pdf to transparent png',
      'convert pdf page to png',
      'pdf to lossless image',
      'pdf screenshot',
    ],
    category: 'pdf-convert',
    icon: 'Images',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'When should I pick PNG over JPG?',
        a: 'PNG is lossless, so text edges and line art stay sharp with no compression artefacts. It also supports transparency. Choose JPG only when the page is a photo and you need a small file.',
      },
      {
        q: 'How does the transparent background option work?',
        a: 'A PDF page has no background of its own. Viewers paint white behind it. With the option on, the tool skips that fill, so areas the page does not draw stay transparent. Scanned pages stay opaque because the scan is a white image.',
      },
      {
        q: 'Why are PNG files so much bigger than JPG?',
        a: 'PNG stores each pixel exactly. A 300 DPI A4 page is about 8.7 megapixels: a few megabytes as PNG and a few hundred kilobytes as JPG.',
      },
      {
        q: 'Does this work offline?',
        a: 'Yes. pdf.js and the canvas PNG encoder in your browser do all the rendering. After the page loads, you can disconnect from the internet.',
      },
    ],
    related: ['pdf-to-jpg', 'png-to-pdf', 'images-to-pdf', 'pdf-to-text', 'png-to-jpg'],
    updated: UPDATED,
  },
  {
    slug: 'jpg-to-pdf',
    title: 'JPG to PDF',
    h1: 'Convert JPG images to PDF',
    description:
      'Convert JPG to PDF. Drag the photos into order and set page size, orientation, margin and fit. Each JPG is embedded without recompression.',
    keywords: [
      'jpg to pdf',
      'jpeg to pdf',
      'photos to pdf',
      'combine images into pdf',
      'image to pdf converter',
      'multiple jpg to one pdf',
    ],
    category: 'pdf-convert',
    icon: 'ImagePlus',
    popular: true,
    accepts: ['jpg', 'jpeg'],
    faqs: [
      {
        q: 'Does it keep my photos at full quality?',
        a: 'Yes. Each JPG is embedded into the PDF byte for byte, with no recompression, so the pages are as sharp as the originals. The exception is a photo with an EXIF rotation tag, which is saved again upright at quality 94.',
      },
      {
        q: 'What is the difference between Fit, Fill and Stretch?',
        a: 'Fit scales the whole image inside the margins and leaves white space on the short side. Fill scales it up until it covers the page, cropping the overflow. Stretch forces the image to the page box and distorts its aspect ratio.',
      },
      {
        q: 'How do I change the page order?',
        a: 'Drag a thumbnail to a new position, or use the arrow buttons on each card. The buttons also work with the keyboard.',
      },
      {
        q: 'Should I use "Auto" page size?',
        a: 'Auto makes each page the size of its image, with no white borders. Use it for screenshots or artwork. Choose A4 or Letter when you will print the result or file it with other documents.',
      },
      {
        q: 'Are the photos uploaded?',
        a: 'No. Decoding and PDF assembly happen in this tab with pdf-lib, so the images stay on your device. This matters for passports, receipts and ID scans.',
      },
    ],
    related: ['png-to-pdf', 'images-to-pdf', 'pdf-to-jpg', 'merge-pdf', 'compress-pdf', 'jpg-to-png'],
    updated: UPDATED,
  },
  {
    slug: 'png-to-pdf',
    title: 'PNG to PDF',
    h1: 'Convert PNG images to PDF',
    description:
      'Convert PNG to PDF: put screenshots and graphics in one file and set page size, orientation, margins and fit. Transparent areas show as white.',
    keywords: [
      'png to pdf',
      'screenshots to pdf',
      'convert png to pdf',
      'transparent png to pdf',
      'combine png files',
    ],
    category: 'pdf-convert',
    icon: 'FileUp',
    accepts: ['png'],
    faqs: [
      {
        q: 'What happens to transparent areas?',
        a: 'PDF pages have no background layer, so any transparent pixel shows the viewer’s page colour, which is white in every mainstream reader and on print. Add a solid background before converting if you need a specific colour.',
      },
      {
        q: 'Is the PNG re-compressed?',
        a: 'No. The original PNG stream is embedded directly, so the pages are pixel-identical to your files.',
      },
      {
        q: 'My screenshots are different sizes. Which page size should I pick?',
        a: 'Use the Auto page size so each page matches its own screenshot, or pick a fixed size with Fit so every page has the same size and margin.',
      },
      {
        q: 'Can I mix PNGs with JPGs?',
        a: 'Not in this tool. Use Images to PDF, which accepts JPG, PNG and WebP in one batch and has the same layout options.',
      },
    ],
    related: ['jpg-to-pdf', 'images-to-pdf', 'pdf-to-png', 'merge-pdf', 'png-to-jpg'],
    updated: UPDATED,
  },
  {
    slug: 'images-to-pdf',
    title: 'Images to PDF',
    h1: 'Convert images to PDF',
    description:
      'Convert images to PDF from a mix of JPG, PNG, WebP, GIF, BMP and AVIF files. Drag the pages into order and set page size, margin and fit.',
    keywords: [
      'images to pdf',
      'webp to pdf',
      'mixed images to pdf',
      'picture to pdf',
      'photo album pdf',
      'convert images to one pdf',
    ],
    category: 'pdf-convert',
    icon: 'FileStack',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'],
    faqs: [
      {
        q: 'Which formats can I mix?',
        a: 'JPG, PNG, WebP, GIF, BMP and AVIF, in any combination and any order. JPG and PNG are embedded unchanged. Other formats are decoded and saved as lossless PNG, so there is no visible quality loss.',
      },
      {
        q: 'Why is WebP converted to PNG?',
        a: 'The PDF format has no WebP image type, so readers cannot draw it. The tool decodes the WebP in the browser and stores it as PNG, which every PDF viewer can show, with no quality loss.',
      },
      {
        q: 'How many images can I add at once?',
        a: 'There is no fixed limit. Memory limits very large batches. The tool shows progress and stays responsive because it pauses for the browser between images.',
      },
      {
        q: 'Does it keep the file order I selected?',
        a: 'Files are added in the order the picker returns them, then you can drag any card or use its arrow buttons to move it. The page order in the PDF always matches the order shown on screen.',
      },
    ],
    related: ['jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'merge-pdf', 'webp-to-png', 'compress-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'pdf-to-text',
    title: 'PDF to Text',
    h1: 'Extract text from a PDF',
    description:
      'Convert PDF to text page by page, with reading order and paragraph breaks kept. Copy the text or download it as a plain .txt file.',
    keywords: [
      'pdf to text',
      'extract text from pdf',
      'pdf to txt',
      'copy text from pdf',
      'pdf text extractor',
      'read pdf text',
    ],
    category: 'pdf-convert',
    icon: 'ScanText',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'The tool says my PDF has no text layer. What does that mean?',
        a: 'The file is a picture of a page, such as a scan or a photo saved as PDF. It has pixels and no characters to extract. You need OCR (optical character recognition) to read it, and this tool does not do OCR.',
      },
      {
        q: 'How do you decide where paragraphs start?',
        a: 'pdf.js returns positioned glyph runs and no paragraphs. The tool groups runs into lines by baseline and sorts them top to bottom. A larger line gap, a first-line indent or a list marker starts a new paragraph. Words split by a hyphen at a line end are joined again.',
      },
      {
        q: 'Why is the text out of order on some pages?',
        a: 'Multi-column layouts, sidebars and tables store text in the order the generator wrote it. The tool sorts by vertical position. This is correct for single-column pages, but it mixes the columns of magazine-style layouts.',
      },
      {
        q: 'Can I get one file per page?',
        a: 'The download puts all pages in one file with a separator between them. Each page also has a copy button in the results list.',
      },
    ],
    related: ['pdf-to-word', 'pdf-to-jpg', 'text-to-pdf', 'word-counter', 'markdown-to-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'pdf-to-word',
    title: 'PDF to Word',
    h1: 'Convert PDF to Word (.docx)',
    description:
      'Convert PDF to Word (.docx) with paragraphs, detected headings and page breaks kept. The PDF must have a text layer; scanned pages do not convert.',
    keywords: [
      'pdf to word',
      'pdf to docx',
      'convert pdf to editable document',
      'pdf to doc',
      'edit pdf in word',
    ],
    category: 'pdf-convert',
    icon: 'FileType2',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Will my layout, tables and images come across?',
        a: 'No. The tool converts the text layer into editable paragraphs. Columns, tables, images, headers and footers are not rebuilt. You get the words in the correct order, ready to edit.',
      },
      {
        q: 'Does it work on scanned PDFs?',
        a: 'No. A scan holds no characters, only an image of them, so there is nothing to place in the document. The tool detects this and tells you, so you do not get an empty file.',
      },
      {
        q: 'Is the .docx a real Word file?',
        a: 'Yes. It is an OOXML package ([Content_Types].xml, relationships, styles and document parts, zipped as a .docx), so Word, LibreOffice, Pages and Google Docs open it.',
      },
      {
        q: 'How are headings detected?',
        a: 'By shape, since PDFs carry no structure: short lines with no terminal punctuation, all-caps lines, and numbered section prefixes such as "2." or "2.1" become Heading 1 or Heading 2. You can restyle anything in Word afterwards.',
      },
      {
        q: 'Is the file uploaded to a converter service?',
        a: 'No. pdf.js extracts the text and JSZip builds the .docx in your browser. This makes it safe for contracts, medical letters and other confidential files.',
      },
    ],
    related: ['word-to-pdf', 'pdf-to-text', 'markdown-to-pdf', 'text-to-pdf', 'pdf-to-jpg'],
    updated: UPDATED,
  },
  {
    slug: 'word-to-pdf',
    title: 'Word to PDF',
    h1: 'Convert Word (.docx) to PDF',
    description:
      'Convert Word (.docx) to PDF with headings, bold and italic text, bullet and numbered lists and blockquotes kept. Tables become rows of text.',
    keywords: [
      'word to pdf',
      'docx to pdf',
      'convert doc to pdf',
      'document to pdf',
      'save word as pdf',
    ],
    category: 'pdf-convert',
    icon: 'FileText',
    accepts: ['docx'],
    faqs: [
      {
        q: 'How faithful is the result?',
        a: 'The tool typesets the document again. Headings, paragraphs, bold, italic, lists, blockquotes and horizontal rules are kept. Tables become text rows, and images, columns, footnotes, headers and footers are dropped.',
      },
      {
        q: 'Why is it different from Word’s own export?',
        a: 'An exact match needs Word’s layout engine and your installed fonts. In the browser, the tool reads the document with Mammoth and sets it in the standard PDF fonts, so line breaks and spacing can differ from Word.',
      },
      {
        q: 'Does it support .doc files?',
        a: 'No. It reads only the .docx format. The old binary .doc format has a different structure. Open the file in Word or LibreOffice and save it as .docx first.',
      },
      {
        q: 'What about non-Latin text?',
        a: 'The standard PDF fonts cover Western European characters. Greek, Cyrillic, Hebrew, Arabic and CJK cannot be embedded from those fonts, so the tool tells you how many characters it replaced.',
      },
    ],
    related: ['pdf-to-word', 'markdown-to-pdf', 'text-to-pdf', 'pdf-to-text', 'merge-pdf'],
    updated: UPDATED,
  },
  {
    slug: 'text-to-pdf',
    title: 'Text to PDF',
    h1: 'Convert text to PDF',
    description:
      'Convert text to PDF. Paste text or drop a .txt file, then set the font, size, line height, margins, page size and page numbers.',
    keywords: [
      'text to pdf',
      'txt to pdf',
      'paste text to pdf',
      'plain text to pdf',
      'notes to pdf',
      'make a pdf from text',
    ],
    category: 'pdf-convert',
    icon: 'Type',
    accepts: ['txt', 'log', 'csv', 'md'],
    faqs: [
      {
        q: 'Which fonts can I use?',
        a: 'Helvetica, Times and Courier, the standard PDF typefaces built into every reader. They are not embedded, so the file is only a few kilobytes and looks the same in every reader.',
      },
      {
        q: 'Is long text wrapped or cut off?',
        a: 'Wrapped, using real font metrics. Words break at spaces, and a single token wider than the column (a long URL or hash) is split between characters, so no text runs off the page.',
      },
      {
        q: 'Does it keep my line breaks?',
        a: 'Yes. Hard line breaks are preserved and blank lines become paragraph spacing, so code snippets, logs and poetry keep their shape. Pick Courier for anything where column alignment matters.',
      },
      {
        q: 'Can I add page numbers?',
        a: 'Yes. Turn on page numbers, and each page gets "page / total" centred in the bottom margin.',
      },
    ],
    related: ['markdown-to-pdf', 'pdf-to-text', 'word-to-pdf', 'pdf-to-word', 'word-counter'],
    updated: UPDATED,
  },
  {
    slug: 'markdown-to-pdf',
    title: 'Markdown to PDF',
    h1: 'Convert Markdown to PDF',
    description:
      'Convert Markdown to PDF with headings, lists, tables, code blocks and blockquotes. A preview shows the paginated result as you type.',
    keywords: [
      'markdown to pdf',
      'md to pdf',
      'readme to pdf',
      'convert markdown file',
      'markdown printer',
      'markdown export pdf',
    ],
    category: 'pdf-convert',
    icon: 'FileCode2',
    accepts: ['md', 'markdown', 'mdown', 'txt'],
    faqs: [
      {
        q: 'Which Markdown features are supported?',
        a: 'Headings 1–6, paragraphs, bold, italic, inline code, links, fenced and indented code blocks, ordered and unordered lists including nesting, task lists, blockquotes, horizontal rules and simple tables. Parsing is done by marked in CommonMark-ish GFM mode.',
      },
      {
        q: 'What happens to images and raw HTML?',
        a: 'Images are skipped, because the PDF is built locally with no network access and remote images cannot be fetched. Raw HTML blocks become their text content.',
      },
      {
        q: 'How are code blocks styled?',
        a: 'In Courier on a light tinted panel with a thin border. Long lines wrap to the column width, and a block longer than the space left on a page continues on the next page. There is no syntax highlighting.',
      },
      {
        q: 'Can I convert a README straight from disk?',
        a: 'Yes. Drop the .md file and its text loads into the editor, where you can change it before you export. You can also paste Markdown.',
      },
    ],
    related: ['text-to-pdf', 'word-to-pdf', 'pdf-to-text', 'markdown-to-html', 'html-to-markdown'],
    updated: UPDATED,
  },
]
