import type { Tool } from '../types'

const updated = '2026-11-07'
const images = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff']
const upload = {
  q: 'Is my image uploaded?',
  a: 'No. The text is read in this browser tab and the image never leaves your device. The reader and its language data download once from this site.',
}
const langs = {
  q: 'Which languages can it read?',
  a: '19: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Turkish, Vietnamese, Indonesian, Russian, Ukrainian, Arabic, Hindi, Chinese, Japanese and Korean. Choose up to two at once.',
}
const accuracy = {
  q: 'How accurate is it?',
  a: 'Printed text in good light reads almost without mistakes. Handwriting, curved pages, very small text and text on busy pictures read worse. You can correct the text before you copy it.',
}

export const tools: Tool[] = [
  {
    slug: 'image-to-text',
    title: 'Image to Text',
    h1: 'Image to text (OCR)',
    description: 'Copy text from photos, scans and screenshots with OCR in 19 languages. The text is read on your device, so the image is never uploaded. Edit, copy or download.',
    keywords: ['ocr', 'extract text from image', 'picture to text', 'photo to text', 'text recognition', 'copy text from image', 'ocr online'],
    category: 'ai',
    icon: 'ScanText',
    popular: true,
    accepts: images,
    faqs: [langs, accuracy, { q: 'Can I read several images at once?', a: 'Yes. Drop them together. Each is read in turn, and Download all puts their text in one file.' }, upload],
    related: ['screenshot-to-text', 'ocr-pdf', 'remove-text-from-image', 'pdf-to-text'],
    updated,
  },
  {
    slug: 'screenshot-to-text',
    title: 'Screenshot to Text',
    h1: 'Screenshot to text',
    description: 'Paste a screenshot and get its text to copy: chats, error messages, slides and apps, also in dark mode. OCR runs in your browser and nothing is uploaded.',
    keywords: ['copy text from screenshot', 'screenshot ocr', 'extract text from screenshot', 'screenshot text extractor', 'paste image get text'],
    category: 'ai',
    icon: 'ScanText',
    accepts: images,
    faqs: [
      { q: 'How do I paste a screenshot?', a: 'Take the screenshot to the clipboard, then press Ctrl+V (Cmd+V on a Mac) on this page.' },
      { q: 'Does it work with dark mode?', a: 'Yes. Light text on a dark background is inverted before it is read.' },
      langs,
      upload,
    ],
    related: ['image-to-text', 'redact-screenshot', 'anonymize-chat-screenshot', 'remove-text-from-image'],
    updated,
  },
  {
    slug: 'jpg-to-text',
    title: 'JPG to Text',
    h1: 'JPG to text',
    description: 'Convert a JPG photo or scan to editable text with OCR that runs on your device. 19 languages, several images at once, and the text as TXT. Free and private.',
    keywords: ['jpg to txt', 'jpeg to text', 'convert jpg to text', 'jpg ocr', 'jpg to word text'],
    category: 'ai',
    icon: 'FileText',
    accepts: images,
    faqs: [langs, accuracy, upload],
    related: ['image-to-text', 'png-to-text', 'jpg-to-pdf', 'ocr-pdf'],
    updated,
  },
  {
    slug: 'png-to-text',
    title: 'PNG to Text',
    h1: 'PNG to text',
    description: 'Get the text out of a PNG image or screenshot with OCR in your browser. 19 languages, editable result, copy or download as TXT. No upload, no sign-up.',
    keywords: ['png to txt', 'convert png to text', 'png ocr', 'extract text from png'],
    category: 'ai',
    icon: 'FileText',
    accepts: images,
    faqs: [langs, accuracy, upload],
    related: ['image-to-text', 'jpg-to-text', 'screenshot-to-text', 'png-to-pdf'],
    updated,
  },
  {
    slug: 'ocr-pdf',
    title: 'OCR PDF',
    h1: 'OCR a PDF: make a scanned PDF searchable',
    description: 'Make a scanned PDF searchable: OCR adds an invisible text layer, so you can search, select and copy the text. The pages look the same. Runs on your device.',
    keywords: ['searchable pdf', 'ocr pdf online', 'make pdf searchable', 'scanned pdf to searchable pdf', 'pdf text recognition'],
    category: 'ai',
    icon: 'FileSearch',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      { q: 'Does the PDF look different?', a: 'No. The original pages are kept as they are. The recognised words are written in invisible text on top, in the place of each word, so search and selection find them.' },
      { q: 'Which languages work?', a: 'Languages in the Latin alphabet, such as English, Spanish, French, German, Italian, Portuguese, Dutch, Polish and Turkish. For other scripts, extract the text instead.' },
      { q: 'What about pages that already have text?', a: 'A page with its own text layer is kept as it is and not read again.' },
      { q: 'Is my PDF uploaded?', a: 'No. Pages are drawn and read in this browser tab, and the new PDF is made here too. Nothing is sent anywhere.' },
    ],
    related: ['extract-text-from-scanned-pdf', 'image-to-text', 'pdf-to-text', 'compress-pdf'],
    updated,
  },
  {
    slug: 'extract-text-from-scanned-pdf',
    title: 'Extract Text from Scanned PDF',
    h1: 'Extract text from a scanned PDF',
    description: 'Get the text out of a scanned PDF with OCR in 19 languages, page by page. Copy it or download a TXT file. The PDF is read on your device and never uploaded.',
    keywords: ['scanned pdf to text', 'pdf ocr to text', 'copy text from scanned pdf', 'image pdf to text', 'convert scanned pdf to word'],
    category: 'ai',
    icon: 'FileText',
    accepts: ['pdf'],
    faqs: [
      langs,
      { q: 'How long does it take?', a: 'About 2 to 5 seconds per page on a laptop. The progress shows the page that is being read.' },
      { q: 'Why is my text in the wrong order?', a: 'Pages with several columns, tables or text boxes can be read in another order. Check the result, or split the page into parts as images.' },
      upload,
    ],
    related: ['ocr-pdf', 'pdf-to-text', 'image-to-text', 'pdf-to-word'],
    updated,
  },
]
