import type { Tool } from './types'

/**
 * Round-2 batch `pdf-pages` — lossless page geometry.
 *
 * Crop, resize, margin, split-in-half, N-up, interleave, reverse, Bates
 * numbering, embedded-image extraction, metadata editing and word counting.
 * Every one of these runs on pdf-lib and pdf.js inside the visitor's tab.
 */
export const tools: Tool[] = [
  {
    slug: 'crop-pdf',
    title: 'Crop PDF',
    h1: 'Crop a PDF online',
    description:
      'Crop a PDF: drag a crop box over a page or detect the white margins, then trim every page at once. Text stays selectable.',
    keywords: [
      'crop pdf pages',
      'trim pdf margins',
      'remove white space pdf',
      'pdf cropper',
      'cut pdf edges',
    ],
    category: 'pdf',
    icon: 'Crop',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Does cropping delete the content outside the box?',
        a: 'No. Cropping changes the visible page box, so readers and printers show only the area you kept. The original objects are still in the file, and a new crop can show them again. To remove content, redact the page or convert it to an image.',
      },
      {
        q: 'What is the difference between the CropBox and the MediaBox?',
        a: 'The MediaBox is the physical sheet that the page is defined on. The CropBox is the area a viewer shows. Most software uses the CropBox, but some printers and older tools read only the MediaBox. This tool sets both by default, so the crop looks correct everywhere.',
      },
      {
        q: 'Can I crop every page at once when the pages are different sizes?',
        a: 'Yes. The crop is stored as a proportion of each page and not in fixed millimetres, so a document with A4 and A3 pages is trimmed by the same relative amount on each page.',
      },
      {
        q: 'How does auto-detect margins work?',
        a: 'The tool renders the preview page at low resolution and scans each pixel to find the box around the content that is not white. It adds 2 mm of space so descenders and rules are not cut.',
      },
      {
        q: 'Will the text still be searchable afterwards?',
        a: 'Yes. Only the page boxes change and nothing becomes an image, so text, fonts, vectors, links and bookmarks stay as they were.',
      },
    ],
    related: [
      'resize-pdf-pages',
      'add-margins-to-pdf',
      'pdf-to-a4',
      'split-pdf-pages-in-half',
      'rotate-pdf',
      'split-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'resize-pdf-pages',
    title: 'Resize PDF Pages',
    h1: 'Resize PDF pages to any paper size',
    description:
      'Resize PDF pages to A4, Letter, Legal or A3. The content is scaled to fit and centred, and documents with mixed page sizes work.',
    keywords: [
      'change pdf page size',
      'resize pdf',
      'letter to a4 pdf',
      'a4 to letter pdf',
      'scale pdf pages',
    ],
    category: 'pdf',
    icon: 'Scaling',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Does resizing make the text blurry?',
        a: 'No. Text and vector graphics are drawn again as vectors on the new sheet, so they stay sharp at any zoom or print resolution. Embedded photographs keep their pixel count, so their effective DPI changes a little.',
      },
      {
        q: 'Why does A4 to Letter leave a strip of white space?',
        a: 'A4 is 210 × 297 mm and Letter is 216 × 279 mm. Letter is wider and shorter, so neither fits the other exactly. Scale to fit keeps the whole page visible and centres it, which leaves a margin on the two long edges. No content is cut off the bottom.',
      },
      {
        q: 'What happens to links, bookmarks and form fields?',
        a: 'They are not copied. To put a page on a new sheet, the tool rebuilds the page object, and annotations belong to the old one. If you need only more white space, use Add Margins to PDF in lossless mode, which keeps them.',
      },
      {
        q: 'Can I keep the original size and centre the content?',
        a: 'Yes. Set content scaling to “keep original size and centre”, and each page is placed on the new sheet at 100%. Anything larger than the sheet will overhang and be clipped when printed.',
      },
    ],
    related: ['pdf-to-a4', 'add-margins-to-pdf', 'crop-pdf', 'pdf-multiple-pages-per-sheet', 'rotate-pdf'],
    updated: '2026-11-01',
  },

  {
    slug: 'add-margins-to-pdf',
    title: 'Add Margins to PDF',
    h1: 'Add margins to a PDF',
    description:
      'Add margins to a PDF for binding, hole punching or notes, with mirror margins for double-sided print. Lossless mode keeps links and form fields.',
    keywords: [
      'add margin pdf',
      'add white space to pdf',
      'binding margin pdf',
      'pdf padding',
      'expand pdf page',
    ],
    category: 'pdf',
    icon: 'Frame',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why is “grow the sheet” lossless but the other mode is not?',
        a: 'Grow the sheet only makes the page rectangle in the file larger. No object in the page moves, so annotations, links, bookmarks and form fields do not change. Keep the paper size makes the content smaller and draws it on a new page, which rebuilds the page object.',
      },
      {
        q: 'What are mirror margins for?',
        a: 'When a document is printed double-sided and bound, the binding edge alternates between left and right. Mirror margins swap the left and right values on even-numbered pages so the wide margin always lands on the inside edge of the spread.',
      },
      {
        q: 'How much margin does a three-hole punch need?',
        a: 'About 25 mm (1 inch) on the binding edge is safe for a standard three-ring binder or a comb binding. 20 mm is enough for a staple or a two-hole punch.',
      },
      {
        q: 'Will the printed page be bigger than A4 now?',
        a: 'In grow-the-sheet mode, yes. An A4 page with 20 mm added on each side becomes 250 × 337 mm. Print it with “fit to page” to bring it back to A4, or use keep-the-paper-size mode so the sheet does not change.',
      },
    ],
    related: ['crop-pdf', 'resize-pdf-pages', 'pdf-to-a4', 'add-page-numbers-to-pdf', 'watermark-pdf'],
    updated: '2026-11-01',
  },

  {
    slug: 'pdf-to-a4',
    title: 'PDF to A4',
    h1: 'Convert a PDF to A4',
    description:
      'Convert a PDF to A4 (210 × 297 mm). Letter, Legal and other page sizes are scaled to fit, in portrait or landscape orientation.',
    keywords: [
      'convert pdf to a4',
      'letter to a4',
      'resize pdf to a4',
      'a4 pdf converter',
      'make pdf a4 size',
    ],
    category: 'pdf',
    icon: 'RectangleVertical',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What exactly is A4 in points?',
        a: 'A4 is 210 × 297 mm, which is 595.28 × 841.89 PostScript points at 72 points per inch. This tool writes those exact dimensions, so a checker that measures the page box reports a true A4 sheet.',
      },
      {
        q: 'Why does my printer still say “scale to fit”?',
        a: 'Printers keep a border of a few millimetres that they cannot print, so a full-bleed A4 page is always slightly larger than the printable area. The prompt is about this hardware margin. Accept it, or print at 100% and lose a very thin strip at each edge.',
      },
      {
        q: 'Does it rotate landscape pages to fit portrait A4?',
        a: 'No. With orientation set to “match each page”, a landscape page goes on a landscape A4 sheet, so it does not shrink more than necessary. Choose “always portrait” if every sheet must be the same way up. Wide pages are then scaled down to fit.',
      },
      {
        q: 'Why do universities and government portals insist on A4?',
        a: 'Their print systems and archive scanners are set up for one sheet size. A Letter-size upload is cut off or sent to manual review. Convert the file before you upload it to prevent a rejected submission.',
      },
    ],
    related: ['resize-pdf-pages', 'crop-pdf', 'add-margins-to-pdf', 'compress-pdf', 'pdf-multiple-pages-per-sheet'],
    updated: '2026-11-01',
  },

  {
    slug: 'split-pdf-pages-in-half',
    title: 'Split PDF Pages in Half',
    h1: 'Split PDF pages in half',
    description:
      'Split PDF pages in half to turn scanned book spreads and two-up handouts into single pages. The tool finds the spine and can trim the gutter.',
    keywords: [
      'split pdf pages in half',
      'split scanned book pdf',
      'two page spread to single pages',
      'de-spread pdf',
      'cut pdf page in two',
    ],
    category: 'pdf',
    icon: 'Columns2',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How does spine detection work?',
        a: 'The tool renders the page at low resolution and counts the dark ink in each pixel column. The emptiest column near the middle is almost always the gutter between the two printed pages, and the cut goes there.',
      },
      {
        q: 'My scan is crooked and the split cuts through text. What can I do?',
        a: 'Spine detection finds only a straight vertical cut. If the scan is skewed, straighten it first in your scanner software. Or move the split slider by hand and add a few millimetres of gutter trim to remove the thin strip.',
      },
      {
        q: 'Does splitting reduce the scan quality?',
        a: 'No. Each half is a clipped view of the original page, so a 600 DPI scan gives two 600 DPI halves. The file size changes very little, because both halves use the same embedded image.',
      },
      {
        q: 'How do I handle Arabic, Hebrew or manga scans?',
        a: 'Set the reading order to “right half first”. The cut is the same. Only the order of the two halves in the output changes, so the PDF reads correctly from right to left.',
      },
      {
        q: 'Why did the cover page come out unsplit?',
        a: 'The “only split wide pages” option is on by default. A page that is taller than it is wide (usually the cover, the back and single-page inserts) is copied without a change. Turn the option off to split every page in the selection.',
      },
    ],
    related: [
      'crop-pdf',
      'merge-alternate-pdf-pages',
      'reverse-pdf-page-order',
      'split-pdf',
      'organize-pdf',
      'rotate-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'pdf-multiple-pages-per-sheet',
    title: 'Multiple Pages Per Sheet',
    h1: 'Put multiple PDF pages on one sheet (N-up)',
    description:
      'Print multiple pages per sheet: put 2, 4, 6, 9 or 16 PDF pages on one sheet and set gaps, borders and order. Text stays sharp vector text.',
    keywords: [
      'n-up pdf',
      '2 pages per sheet pdf',
      '4 pages per sheet',
      'pdf booklet layout',
      'print multiple pages on one page',
    ],
    category: 'pdf',
    icon: 'LayoutGrid',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why make an N-up PDF instead of using the printer driver?',
        a: 'The layout becomes part of the file. You can check it before you print, email it, or print it from a phone or a public printer that has no N-up option. The result is the same each time and does not depend on a driver setting.',
      },
      {
        q: 'Will the small pages be blurry?',
        a: 'No. Each source page is embedded as a vector form and scaled by the PDF, so text stays real text: selectable, searchable and sharp at any print resolution. Bitmap photographs get a higher pixel density, which makes them sharper.',
      },
      {
        q: 'What does “auto” orientation choose?',
        a: 'It puts the grid on a portrait sheet and on a landscape sheet, measures how much each one shrinks the pages, and keeps the one with larger pages. For 2-up with portrait source pages, this is usually landscape. For 4-up, it is usually portrait.',
      },
      {
        q: 'How small does 9-up or 16-up text get?',
        a: 'A 4 × 4 grid on A4 gives each page about 45 × 65 mm, about 21% of full size. 11 pt body text becomes about 2.3 pt, which is useful only as a visual index. Use 2-up or 4-up for text you want to read.',
      },
      {
        q: 'Should I print it at 100%?',
        a: 'Yes. Choose “actual size” in the print dialog. With “fit to page”, the printer scales the sheet a second time and the small text gets smaller.',
      },
    ],
    related: ['resize-pdf-pages', 'pdf-to-a4', 'crop-pdf', 'merge-pdf', 'organize-pdf'],
    updated: '2026-11-01',
  },

  {
    slug: 'merge-alternate-pdf-pages',
    title: 'Merge Alternate Pages',
    h1: 'Merge alternate pages to fix a duplex scan',
    description:
      'Merge alternate pages from two PDFs to fix a duplex scan. The tool interleaves the fronts and backs and reverses the second file for you.',
    keywords: [
      'merge alternate pages pdf',
      'interleave pdf pages',
      'collate pdf scans',
      'fix duplex scan',
      'combine odd and even pages',
    ],
    category: 'pdf',
    icon: 'Combine',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why does the second file need reversing?',
        a: 'A single-sided sheet feeder scans page 1, 3, 5 on the first pass. When you flip the whole stack over and feed it again, the last sheet goes in first, so the backs come out as page 10, 8, 6, 4, 2. Reversing that file puts them back into ascending order before interleaving.',
      },
      {
        q: 'The two files have different page counts. Is that a problem?',
        a: 'Usually not. It usually means the last sheet has print on one side only. Keep the default “keep the extra pages at the end” and check the order preview. The blank or missing back has no matching page.',
      },
      {
        q: 'Does interleaving re-compress the scans?',
        a: 'No. Pages are copied object-for-object between documents, so the image data, resolution, colour profile and any text layer from OCR are kept byte for byte.',
      },
      {
        q: 'Can I do this with one file that has all the fronts then all the backs?',
        a: 'Yes. First use Split PDF to make two files: pages 1 to N are the fronts, and N+1 to the end are the backs. Then add both files here. With two steps, the order is easy to check.',
      },
    ],
    related: [
      'reverse-pdf-page-order',
      'split-pdf-pages-in-half',
      'merge-pdf',
      'organize-pdf',
      'split-pdf',
      'rotate-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'reverse-pdf-page-order',
    title: 'Reverse PDF Page Order',
    h1: 'Reverse the page order of a PDF',
    description:
      'Reverse the page order of a PDF, of one page range, or of the sheets with fronts and backs kept together. Pages are copied without quality loss.',
    keywords: [
      'reverse pdf pages',
      'flip pdf page order',
      'invert page order pdf',
      'last page first pdf',
      'reorder pdf backwards',
    ],
    category: 'pdf',
    icon: 'ArrowDownUp',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'When would I need to reverse a PDF?',
        a: 'Usually after you scan a stack face down, after a printer puts the last page on top, or when a scanner makes a document that reads from the back. It also fixes a right-to-left booklet that was put together in the wrong direction.',
      },
      {
        q: 'What does the sheet mode do differently?',
        a: 'It reverses the order of the sheets and keeps each front and back together, so 1,2,3,4,5,6 becomes 5,6,3,4,1,2. Use it for a double-sided document whose sheets are in the wrong order but whose fronts and backs are in correct pairs.',
      },
      {
        q: 'Can I reverse only part of the document?',
        a: 'Yes. Choose “only a page range” and enter a range such as 3-12. Those pages are reversed, and all other pages keep their positions. Use this when an appendix or a set of exhibits was scanned backwards.',
      },
      {
        q: 'Does reversing change the file size or quality?',
        a: 'Not in a meaningful way. The pages are copied as complete objects into a new document in the new order. The images, fonts and text layer are the same. Only the page tree changes.',
      },
    ],
    related: [
      'merge-alternate-pdf-pages',
      'organize-pdf',
      'split-pdf-pages-in-half',
      'delete-pages-from-pdf',
      'merge-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'bates-numbering-pdf',
    title: 'Bates Numbering',
    h1: 'Add Bates numbering to PDFs',
    description:
      'Add Bates numbering to one or more PDFs with a prefix, zero padding and numbers that continue across files. Export the ranges as a CSV log.',
    keywords: [
      'bates numbering',
      'bates stamp pdf',
      'legal document numbering',
      'add bates numbers free',
      'discovery production numbering',
    ],
    category: 'pdf',
    icon: 'Hash',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What is a Bates number?',
        a: 'A unique, sequential identifier stamped on each page of a document production, such as ABC000123, so that any page can be cited without doubt. The name comes from the Bates Automatic Numbering Machine. It is standard in litigation discovery, patent filing and medical records.',
      },
      {
        q: 'Does numbering continue across several files?',
        a: 'Yes, by default. Add the files in production order, and file two continues where file one ended. Turn the option off if each document must start again at the same number.',
      },
      {
        q: 'How many digits should I use?',
        a: 'Enough that the highest number in the production never needs an extra digit, because padding must stay constant for sorting to work. Six digits covers a million pages and is the usual default; four is common for small matters.',
      },
      {
        q: 'Is the stamp real text or an image?',
        a: 'Real PDF text in a built-in font, so you can search and copy it, and it stays sharp at any zoom. An optional white box behind the number keeps it legible when it is on top of existing content.',
      },
      {
        q: 'Can opposing counsel see that this was done in a browser?',
        a: 'No. The output is an ordinary PDF with an ordinary text stamp. The tool runs on your computer, so a privileged or confidential production is not sent to a third-party server.',
      },
    ],
    related: [
      'add-page-numbers-to-pdf',
      'watermark-pdf',
      'pdf-metadata-editor',
      'merge-pdf',
      'crop-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'extract-images-from-pdf',
    title: 'Extract Images from PDF',
    h1: 'Extract images from a PDF',
    description:
      'Extract images from a PDF at their original resolution. Embedded JPEGs are saved byte for byte. Preview and filter them, then download a ZIP.',
    keywords: [
      'extract images from pdf',
      'pdf image extractor',
      'save pictures from pdf',
      'get photos out of pdf',
      'pdf to images original quality',
    ],
    category: 'pdf',
    icon: 'ImageDown',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How is this different from PDF to JPG?',
        a: 'PDF to JPG renders the whole page, with text and background, into a new picture at the resolution you choose. This tool takes out the photographs that were placed in the file, at their stored pixel dimensions, with no other page content around them.',
      },
      {
        q: 'What does “original, byte-for-byte” mean?',
        a: 'Most photographs are stored in a PDF as a JPEG stream. In that case, the tool saves the bytes with no decoding and no new encoding. The saved file is the same JPEG that was embedded, with the same quality and size and no EXIF data.',
      },
      {
        q: 'Why did it find no images in my scanned document?',
        a: 'It probably found one: the whole page. A scan is one large picture, so it shows in the list unless the size filter is set high. Line art, charts and logos are usually vector drawing instructions, so they have no picture to extract.',
      },
      {
        q: 'Some images were skipped. What are CCITT and JBIG2?',
        a: 'They are bi-level compression formats from fax machines and document scanners. No browser can decode them, so the tool lists those images as skipped, with the reason.',
      },
      {
        q: 'Are transparency masks handled?',
        a: 'Yes, for images rebuilt as PNG: the soft mask is decoded and used as the alpha channel. Original JPEGs are saved as stored. JPEG has no alpha channel, so the tool notes the mask and does not apply it.',
      },
    ],
    related: ['pdf-to-jpg', 'pdf-to-png', 'pdf-metadata-editor', 'compress-pdf', 'crop-pdf'],
    updated: '2026-11-01',
  },

  {
    slug: 'pdf-metadata-editor',
    title: 'Edit PDF Metadata',
    h1: 'View and edit PDF metadata',
    description:
      'Edit PDF metadata: view and change the title, author, subject, keywords, producer and dates, or remove all of it, including the XMP block.',
    keywords: [
      'pdf metadata editor',
      'remove pdf metadata',
      'change pdf author',
      'pdf properties editor',
      'strip pdf xmp',
    ],
    category: 'pdf',
    icon: 'FileCog',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What can a PDF give away about me?',
        a: 'The information dictionary usually has the author name of the account that made the file, the application that made it, and exact creation and modification times. The XMP packet can add more: original filenames, document IDs that link revisions, and editing history. All of it goes with the file.',
      },
      {
        q: 'What is the difference between the Info dictionary and XMP?',
        a: 'The Info dictionary is the old, simple key-value block that File → Properties displays. XMP is an XML packet stored separately in the document catalogue, and many tools write both. If you clear only the first, the second stays, so the strip option removes both.',
      },
      {
        q: 'Does clearing a field really remove it?',
        a: 'Yes. The tool deletes an empty field from the information dictionary and does not write it as an empty string, so the old value is not in the saved file.',
      },
      {
        q: 'Why do the creation and modification dates matter?',
        a: 'They are the fields most often used to challenge a document, such as a contract with a creation time after the signing date, or a submission modified after a deadline. Check them before you send a file.',
      },
      {
        q: 'Does saving change the pages?',
        a: 'No. Only the metadata is written again. The page objects, fonts, images and text are copied without change. The file is serialised again, so the byte layout and total size differ slightly from the original.',
      },
    ],
    related: [
      'extract-images-from-pdf',
      'bates-numbering-pdf',
      'pdf-word-counter',
      'compress-pdf',
      'merge-pdf',
    ],
    updated: '2026-11-01',
  },

  {
    slug: 'pdf-word-counter',
    title: 'PDF Word Count',
    h1: 'Count the words in a PDF',
    description:
      'Get a PDF word count with characters, a count for each page, reading time at 238 words per minute and a fee estimate per word.',
    keywords: [
      'pdf word count',
      'count words in pdf',
      'pdf character count',
      'translation word count',
      'pdf reading time',
    ],
    category: 'pdf',
    icon: 'WholeWord',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why does the count differ slightly from Word?',
        a: 'A PDF has no words. It stores positioned glyph runs, and the tool finds word boundaries from the gaps between them. Hyphens at line breaks, ligatures, headers, footers and page numbers can change the total by one or two percent. Use the figure for quotes and planning. Do not use it as a legally binding count.',
      },
      {
        q: 'How are Chinese, Japanese and Korean counted?',
        a: 'By character, which is the convention for those languages. Each CJK ideograph or kana counts as one unit. Latin text around it is counted as words separated by spaces, so a mixed document gets a correct total.',
      },
      {
        q: 'What is a standard page?',
        a: 'A billing unit used by translation agencies: 250 words in the English-speaking world, or 1,800 characters including spaces in Germany, Poland and much of central Europe. Both figures are shown so you can quote in whichever convention your client uses.',
      },
      {
        q: 'Why does it say my PDF has almost no words?',
        a: 'It is probably a scan: a photograph of a document with no text layer. Reading it needs OCR, which this tool does not do. To check, try to select a word in a PDF reader. If nothing highlights, there is no text to count.',
      },
      {
        q: 'Where does 238 words per minute come from?',
        a: 'It is the mean silent reading rate of adults for English non-fiction, from a 2019 meta-analysis of 190 studies by Brysbaert. Dense technical or legal text is nearer 150. Reading aloud is about 130, which the spoken estimate uses.',
      },
    ],
    related: [
      'pdf-to-text',
      'pdf-page-counter',
      'pdf-metadata-editor',
      'extract-images-from-pdf',
      'word-counter',
    ],
    updated: '2026-11-01',
  },
]
