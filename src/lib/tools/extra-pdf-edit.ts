import type { Tool } from './types'

/**
 * Round-2 batch `pdf-edit` — the overlay editor family plus the page-rebuild
 * tools that share its geometry code.
 *
 * Every slug here has its own page, its own copy and its own FAQ set; the
 * siblings share a React island but never share body text.
 */
export const tools: Tool[] = [
  {
    slug: 'edit-pdf',
    title: 'Edit PDF',
    h1: 'Edit a PDF in your browser',
    description:
      'Edit PDF pages: add text, images, freehand drawings, highlights and white-out boxes, undo up to 50 steps, then download the edited file.',
    keywords: ['pdf editor', 'edit pdf online', 'free pdf editor', 'modify pdf', 'change pdf text'],
    category: 'pdf',
    icon: 'FilePen',
    popular: true,
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Can I edit the text that is already in the PDF?',
        a: 'No. A PDF stores positioned glyphs and no paragraphs, so a change to existing text means a guess at word boundaries, fonts and line breaks. Editors that try it often break the layout. This tool adds a layer on top: cover the old text with a white-out box and type the new text. The result looks and prints correctly, and the content below does not change.',
      },
      {
        q: 'Does editing damage the rest of the document?',
        a: 'No. Your additions go at the end of the content stream of each page. The original text stays selectable and searchable, vector graphics stay sharp at any zoom, and the file is not rendered or compressed again. Only the pages you edit change.',
      },
      {
        q: 'What fonts can I use?',
        a: 'The fourteen fonts built into every PDF reader, which include Helvetica, Times and Courier in regular, bold and italic. They are built in, so nothing is embedded and the file stays small. They cover only Western European characters. For Greek, Cyrillic, Arabic or CJK text, make the words into a transparent PNG and place it with the image tool.',
      },
      {
        q: 'Is there a page or file size limit?',
        a: 'No fixed limit. Your device does the work, so the limit is its memory. A few hundred pages is fine on a laptop. Very large scans work better in a desktop browser than on a phone.',
      },
      {
        q: 'Can I undo a mistake?',
        a: 'Yes. You can undo and redo up to 50 steps. The tool does not change the file you dropped in. The download is a new file.',
      },
    ],
    related: ['add-text-to-pdf', 'sign-pdf', 'annotate-pdf', 'whiteout-pdf', 'fill-pdf-form', 'merge-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'annotate-pdf',
    title: 'Annotate PDF',
    h1: 'Annotate a PDF online',
    description:
      'Annotate a PDF with highlights, freehand drawing, boxes and margin notes. The marks are drawn into the page, so every PDF reader shows them.',
    keywords: ['pdf annotator', 'markup pdf', 'comment on pdf', 'draw on pdf', 'review pdf'],
    category: 'pdf',
    icon: 'MessageSquareText',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Are these real PDF comments or drawn marks?',
        a: 'Drawn marks. A PDF comment is an annotation object next to the page, and readers do not agree on how to show and print comments, or if they show them at all. The marks you add here become page content. They stay when you print or email the file, upload it to a court filing system or open it in the built-in viewer of a phone.',
      },
      {
        q: 'Can the person I send it to remove my markup?',
        a: 'Not with an ordinary reader. The marks are part of the page content, so there is no annotation to delete, no comment pane to clear and no layer to turn off. A person with a full editor can still paint over them, so the marks give no security.',
      },
      {
        q: 'Can I reply to comments other people left?',
        a: 'No. Threaded review needs a shared server to hold the conversation. This site has none, because it never receives your document. If you got a PDF with comments, Flatten PDF draws them into the page so they cannot be lost.',
      },
      {
        q: 'Does marking up a legal document leave a trace?',
        a: 'Only the marks you made. The tool writes no author name, timestamp or revision history into the file. Your original PDF does not change on disk. The annotated copy is a new file that the tool makes when you press download.',
      },
      {
        q: 'Can I annotate on a tablet with a stylus?',
        a: 'Yes. The freehand pen uses pointer events, so an Apple Pencil, an S Pen or a Surface Pen works like a mouse and is more accurate. Pinch to zoom the page first for fine control.',
      },
    ],
    related: ['highlight-pdf', 'edit-pdf', 'flatten-pdf', 'sign-pdf', 'add-text-to-pdf', 'watermark-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'whiteout-pdf',
    title: 'White Out PDF',
    h1: 'White out text in a PDF',
    description:
      'White out text in a PDF: cover a mistake, an old date or an old address with an opaque box, then type the correction on top.',
    keywords: ['whiteout pdf', 'erase pdf text', 'cover text in pdf', 'delete text from pdf', 'pdf correction'],
    category: 'pdf',
    icon: 'Eraser',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Is white-out the same as redaction?',
        a: 'No. A white box is opaque ink drawn on top. The text below it is still in the file, and anyone can select, copy or extract it. This is fine for a typo and unsafe for a name or an account number. To hide those, use Redact PDF, which rebuilds the affected pages as images with the words removed.',
      },
      {
        q: 'Why not delete the text?',
        a: 'A PDF has no editable text object. Each character is placed at fixed coordinates in a compressed content stream, often out of reading order and often split inside a word. To remove one phrase reliably, the tool would have to lay out the page again. Cover and retype gives a document that looks and prints correctly, with no risk to the rest of the page.',
      },
      {
        q: 'The page has a coloured or scanned background. Will a white box show?',
        a: 'Yes. A pure white box on off-white scanned paper is visible. Use the custom colour control to pick a cream or grey that matches the page, and the patch is hard to see. On scans with heavy texture, a slightly larger box that lines up with a margin looks tidier than an exact fit.',
      },
      {
        q: 'Does the correction print properly?',
        a: 'Yes. The box and your text are ordinary page content, so they print as they appear on screen. Objects are painted in the order you add them, so draw the box first and then type on top. If the order is wrong, use "Bring to front".',
      },
    ],
    related: ['redact-pdf', 'edit-pdf', 'add-text-to-pdf', 'annotate-pdf', 'flatten-pdf', 'watermark-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'highlight-pdf',
    title: 'Highlight PDF',
    h1: 'Highlight text in a PDF',
    description:
      'Highlight text in a PDF: drag a translucent marker across the words. The highlight uses multiply blending, so the text stays dark and selectable.',
    keywords: ['highlight pdf', 'pdf highlighter', 'mark up pdf', 'highlight text in pdf online'],
    category: 'pdf',
    icon: 'Highlighter',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why is my text still readable under the highlight?',
        a: 'The highlight is drawn in multiply blend mode, which works like ink on paper: it darkens what is below it and does not cover it. A plain translucent rectangle would make the text grey. Multiply keeps black text black and turns white paper yellow, as a real marker does.',
      },
      {
        q: 'Which colours work best?',
        a: 'Yellow is the default because it survives black-and-white printing as a light grey without obscuring anything. Green and blue read well on screen but print as heavy grey. If the document will be photocopied, pick yellow and keep opacity around 40%.',
      },
      {
        q: 'Can I highlight several lines at once?',
        a: 'Drag one rectangle for each line, so a short last line of a paragraph looks correct. For a whole block, one tall rectangle across the column is quicker, but its edge is straight and does not follow the line ends.',
      },
      {
        q: 'Will the highlights show up in other PDF readers?',
        a: 'Yes, in all of them. The highlights are page content. No reader setting hides them, and they stay when the file is printed or converted.',
      },
    ],
    related: ['annotate-pdf', 'edit-pdf', 'whiteout-pdf', 'flatten-pdf', 'pdf-to-text', 'add-text-to-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'add-image-to-pdf',
    title: 'Add Image to PDF',
    h1: 'Add an image to a PDF',
    description:
      'Add an image to a PDF: place a logo, stamp, photo or chart on any page, then drag and resize it. PNG transparency is kept.',
    keywords: ['insert image into pdf', 'add logo to pdf', 'put picture in pdf', 'stamp pdf', 'add photo to pdf'],
    category: 'pdf',
    icon: 'ImagePlus',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Which image formats can I place?',
        a: 'PNG and JPEG are embedded byte-for-byte, so a JPEG photo keeps its original compression and a PNG keeps its alpha channel. GIF, BMP, WebP and SVG are decoded by your browser and saved as PNG before embedding, which adds a little file size. HEIC from an iPhone decodes only in Safari. Convert it first on Windows or Android.',
      },
      {
        q: 'Does transparency survive?',
        a: 'Yes, for PNG. A logo with a transparent background sits on the page with no white card behind it. If your logo has a white rectangle around it, the rectangle is part of the image. Export it again from your design tool with a transparent background.',
      },
      {
        q: 'How large should the image be?',
        a: 'A page has 72 points to the inch, so a logo 2 inches wide is 144 points. For sharp print, use about 300 pixels per inch of final size: about 600 pixels wide for that logo. A larger image only adds bytes. A much smaller one looks soft in print, even if it looks fine on screen.',
      },
      {
        q: 'Can I put the same image on every page?',
        a: 'Place it on each page you need. The editor keeps the image in memory, so each placement uses the same embedded copy and the file does not grow. For every page of a long document, Watermark PDF adds an image to all pages in one pass, with tiling and opacity controls.',
      },
    ],
    related: ['watermark-pdf', 'edit-pdf', 'sign-pdf', 'images-to-pdf', 'jpg-to-pdf', 'add-text-to-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'add-text-to-pdf',
    title: 'Add Text to PDF',
    h1: 'Add text to a PDF',
    description:
      'Add text to a PDF: click anywhere on the page and type. Use it for scanned forms with no fields, with eight built-in fonts in any size and colour.',
    keywords: ['type on pdf', 'write on pdf', 'fill in pdf by hand', 'add text to scanned pdf', 'pdf typewriter'],
    category: 'pdf',
    icon: 'TextCursorInput',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'My form is a scan with no fields. Will this work?',
        a: 'Yes. This tool is for that case. A scanned form is a picture of paper, with pixels and no fields. Click on the line where a name or date goes and type. Zoom in with the plus button to line up the text with the printed line.',
      },
      {
        q: 'How do I get the text to sit on the line?',
        a: 'Click near the position, then move the text with the arrow keys: one point per press, ten points with Shift. One point is 1/72 inch, so two or three presses can move the text from above the line to on it. The panel shows the exact coordinates.',
      },
      {
        q: 'Why can I not type an accented or non-Latin character?',
        a: 'The built-in PDF fonts cover the WinAnsi character set: Western European letters, digits and common punctuation. Characters outside it, such as Polish ł, Greek, Cyrillic, Hebrew, Arabic and all CJK, need a font file embedded in the document. The tool tells you which character is the problem, so you do not get a file with blank spaces.',
      },
      {
        q: 'Can I match the font of the printed form?',
        a: 'Approximately. Most official forms are set in Helvetica or Arial, which the built-in Helvetica matches closely, or Times New Roman, which Times Roman matches. Use Courier for text that looks typewritten. An exact match needs the original font identified and embedded, which no tool can do reliably from a scan.',
      },
      {
        q: 'Is the typed text selectable afterwards?',
        a: 'Yes. It is real text in a real font, so you can select it, copy it and find it with Ctrl+F in the finished PDF.',
      },
    ],
    related: ['fill-pdf-form', 'edit-pdf', 'sign-pdf', 'whiteout-pdf', 'flatten-pdf', 'pdf-to-text'],
    updated: '2026-11-01',
  },
  {
    slug: 'sign-pdf',
    title: 'Sign PDF',
    h1: 'Sign a PDF online',
    description:
      'Sign a PDF: draw, type or upload your signature, drag it onto any page and download the signed file. Form fields stay fillable after you sign.',
    keywords: ['esign pdf', 'electronic signature pdf', 'sign document online', 'add signature to pdf', 'free pdf signature'],
    category: 'pdf',
    icon: 'Signature',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Is this a legally valid signature?',
        a: 'In most jurisdictions, an electronic signature is valid when it shows clear intent to sign, and a drawn or typed signature on the document does that. It is not a cryptographic digital signature (PAdES, an eIDAS qualified signature or an Indian DSC). Those need a certificate from a certificate authority and a trusted timestamp, which a browser with no server cannot make. If the other party asks for a certificate-based signature, use a signing service that issues certificates. Most contracts, forms and consent letters ask for a visual signature.',
      },
      {
        q: 'What actually gets stored in the file?',
        a: 'A transparent PNG of your signature, embedded as an image and drawn on the page. There is no separate signature layer, so the recipient cannot drag it off. No metadata records who signed or when, unless you add a date stamp.',
      },
      {
        q: 'Where does my signature image go?',
        a: 'Only into the memory of this browser tab. It is not saved to a signature library or to local storage, and it is not sent anywhere. When you close the tab, it is deleted. You draw it again next time, and no service keeps a picture of your signature.',
      },
      {
        q: 'How do I get a good-looking drawn signature?',
        a: 'Use a touchscreen with a finger or stylus. A mouse gives a much worse result. Sign larger than usual: the tool trims the drawing and scales it down when you place it. A large signature scaled down looks steady, and a small one scaled up looks shaky. If you have only a mouse, the typed option with a script font usually looks better.',
      },
      {
        q: 'Can I sign a form and keep it fillable?',
        a: 'Yes. The signature is page content and does not change form fields, so an AcroForm PDF stays fillable after you sign it. To lock the whole file, put the signed file through Flatten PDF.',
      },
    ],
    related: ['fill-pdf-form', 'flatten-pdf', 'add-text-to-pdf', 'edit-pdf', 'signature-generator', 'watermark-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'fill-pdf-form',
    title: 'Fill Out PDF Forms',
    h1: 'Fill out a PDF form',
    description:
      'Fill out PDF forms on the page and save an editable or a flattened copy. The tool lists each AcroForm field with its name, type and page.',
    keywords: ['fill pdf form', 'pdf form filler', 'complete pdf form online', 'acroform', 'editable pdf'],
    category: 'pdf',
    icon: 'ClipboardPen',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'How do I know whether my PDF has real form fields?',
        a: 'Drop it in. The tool lists each field it finds, with its name, type and page. If the list is empty, the file is a flat design or a scan that only looks like a form. For that, use Add Text to PDF, which lets you type anywhere on the page.',
      },
      {
        q: 'What is the difference between saving editable and flattened?',
        a: 'Editable keeps the fields live, so the next person can change an answer. Use it for a form that still goes around an office. Flattened merges the answers into the page, so nothing can be changed and every reader shows it the same way. Use it for the copy you send back. Most institutions want this version.',
      },
      {
        q: 'My form says it needs Adobe Acrobat to open. What is that?',
        a: 'It is an XFA form: an Adobe format that keeps the whole layout in an XML payload outside the PDF pages. Only Adobe software shows it correctly, and no browser tool can fill one reliably. The tool detects it and tells you, so you do not get a file that loses your answers.',
      },
      {
        q: 'Why does a field look empty in my reader after I fill it?',
        a: 'Some PDF producers make fields with no appearance stream, and readers do not agree on whether to make one. The tool makes new appearances in Helvetica when it saves, which fixes most cases. If a field still shows blank, save the flattened version. The text is then painted on the page.',
      },
      {
        q: 'Are my answers saved anywhere?',
        a: 'No. They stay in the memory of this tab while you type, and go into the PDF only when you press a build button. Nothing is autosaved or uploaded, and a page refresh deletes everything. This matters when the form is a tax return or a medical history.',
      },
    ],
    related: ['add-text-to-pdf', 'flatten-pdf', 'sign-pdf', 'edit-pdf', 'pdf-to-text', 'merge-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'flatten-pdf',
    title: 'Flatten PDF',
    h1: 'Flatten a PDF',
    description:
      'Flatten a PDF: merge form answers, highlights, stamps and comments into the page, so they do not disappear when the file is printed or emailed.',
    keywords: ['flatten pdf', 'flatten pdf form', 'merge annotations into pdf', 'lock pdf form fields'],
    category: 'pdf',
    icon: 'Layers2',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why do my form answers disappear when I print?',
        a: 'Form fields are annotations that sit above the page, and printers and readers do not agree on whether to render them. For the same reason, answers can disappear when a file is uploaded to a portal, opened on a phone or converted to an image. Flattening moves the answers into the page content, which every reader shows.',
      },
      {
        q: 'What happens to highlights and sticky notes?',
        a: 'Each annotation has a stored appearance stream: the drawing instructions a reader uses to show it. This tool draws that stream into the page with the transform that the PDF specification defines, then removes the annotation. So comments stay visible, where some other flatten tools delete them.',
      },
      {
        q: 'Can flattening be undone?',
        a: 'No. After a field or comment becomes page content, there is no field or comment to restore. Keep the original. The tool does not change the file you dropped in, so that copy is still on your disk.',
      },
      {
        q: 'Does flattening make the PDF smaller?',
        a: 'Usually a little, because the tool removes the form dictionary, the field tree and the object graph of each annotation. The text and images do not change, so the saving is much smaller than a compressor gives.',
      },
      {
        q: 'Should I keep the links clickable?',
        a: 'Almost always. Link annotations draw nothing, so they do not change how the page looks, and they keep the table of contents and external URLs working. Turn them off only when you want to remove every interactive element from a document.',
      },
    ],
    related: ['fill-pdf-form', 'sign-pdf', 'annotate-pdf', 'redact-pdf', 'compress-pdf', 'edit-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'redact-pdf',
    title: 'Redact PDF',
    h1: 'Redact a PDF properly',
    description:
      'Redact a PDF: find names, emails, phone numbers and ID numbers, add your own boxes, and burn them in so the text under them is gone from the file.',
    keywords: ['redact pdf', 'black out text in pdf', 'remove sensitive information pdf', 'pdf redaction tool', 'auto redact pdf'],
    category: 'redact',
    icon: 'ShieldOff',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why is a black rectangle not enough?',
        a: 'A rectangle drawn on top leaves the text in the file. Anyone can select it, copy it or extract it. This tool renders each page with a box to an image with the box painted in, so the text under the box no longer exists in the file.',
      },
      {
        q: 'What does it find by itself?',
        a: 'Pattern rules find emails, phone numbers, card and bank numbers, ID numbers, dates of birth, addresses and keys in the text layer. An optional language model finds names, organizations and places. You can uncheck anything to keep it.',
      },
      {
        q: 'Does the whole PDF become images?',
        a: 'No. Only pages with a box become images, and their text can no longer be selected or searched. Other pages stay as they were. You can choose to turn every page into an image.',
      },
      {
        q: 'What else is removed?',
        a: 'Document properties such as title and author, XMP metadata, bookmarks, comments and other annotations, form data, attachments and scripts. These often hold a copy of the name you redact.',
      },
      {
        q: 'How do I check the result?',
        a: 'After you apply, the tool reads the text of the new file and tells you if any hidden value is still in it. You can also open the file in the PDF redaction checker on this site.',
      },
    ],
    related: ['pdf-redaction-checker', 'redact-scanned-document', 'remove-metadata', 'redact-text', 'flatten-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'grayscale-pdf',
    title: 'PDF to Grayscale',
    h1: 'Convert a PDF to grayscale',
    description:
      'Convert a PDF to grayscale or black and white for cheaper printing. Choose from four methods, one of them dithered, and set the resolution.',
    keywords: ['pdf to grayscale', 'black and white pdf', 'remove colour from pdf', 'greyscale pdf converter'],
    category: 'pdf',
    icon: 'Contrast',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'Why would I convert a PDF to grayscale?',
        a: 'Print shops and university printers often charge five to ten times more for a colour page than for a mono page. They bill by what the file contains, so one coloured logo in a header can make a hundred-page document a hundred colour pages. A grayscale file is a mono job. Conversion also makes scanned documents smaller and makes faint coloured highlighting legible in print.',
      },
      {
        q: 'Which grayscale method should I choose?',
        a: 'Use perceptual grey (Rec. 709 luma) for photographs or coloured design. It gives green a high weight and blue a low weight, as your eye does. Flat average keeps more difference between colours of similar brightness. Pure black and white is for text scans: it makes the file much smaller and the letters sharper. Dithered black and white keeps photographs readable in one bit, but adds a visible halftone texture.',
      },
      {
        q: 'Does the text stay selectable?',
        a: 'No. To recolour a PDF, the tool draws its pages again, so the output is an image of each page with no text layer. A browser has no other way to do this. Keep the colour original if you need to search it.',
      },
      {
        q: 'What resolution should I pick?',
        a: '150 DPI reads well on screen and keeps files small. 200 DPI is right for ordinary office printing. Use 300 DPI for full-quality print or archives. The file is then several times larger. The preview is at screen resolution, so use it to judge the tones and use the result to judge file size.',
      },
      {
        q: 'Will this make the file smaller?',
        a: 'It depends on the file. A colour scan converted to 1-bit black and white is often 80% smaller or more. A small text-only vector PDF usually gets bigger, because a page of text as an image has much more data than the same page as font instructions.',
      },
    ],
    related: ['invert-pdf-colors', 'compress-pdf', 'pdf-to-jpg', 'redact-pdf', 'grayscale-image', 'pdf-to-png'],
    updated: '2026-11-01',
  },
  {
    slug: 'invert-pdf-colors',
    title: 'Invert PDF Colors',
    h1: 'Invert the colours of a PDF',
    description:
      'Invert PDF colors in one of two modes. Dark mode makes the page black and the text white and keeps hues. True negative inverts every color.',
    keywords: ['invert pdf colors', 'dark mode pdf', 'negative pdf', 'night mode pdf', 'white to black pdf'],
    category: 'pdf',
    icon: 'SunMoon',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What is the difference between dark mode and a true negative?',
        a: 'A true negative inverts every colour channel, so white becomes black and red becomes cyan. This is correct for a scanned film negative and hard to read for a document. Dark mode inverts lightness and keeps hue and saturation: the paper becomes black, the text becomes white, and a red stamp stays red. Use dark mode for night reading and the true negative for a photographic negative.',
      },
      {
        q: 'Why not use the night mode of my reader?',
        a: 'Night mode works only in that reader. An inverted file is inverted everywhere: on an e-reader, on a phone, on a projector in a dark lecture theatre, and when printed as a dark slide handout. It stays inverted when you email it to a person whose reader has no night mode.',
      },
      {
        q: 'Does this save battery?',
        a: 'On an OLED or AMOLED screen, yes. Black pixels are off, and a document page is mostly background. On an LCD the backlight stays on, so the only benefit is comfort.',
      },
      {
        q: 'Will the text still be selectable?',
        a: 'No. To recolour, the tool renders each page and rebuilds the document from the images, so the output has no text layer. Keep the original for search and quotes, and use the inverted copy for reading.',
      },
      {
        q: 'Should I invert a document that contains photographs?',
        a: 'Usually not the whole document. Inverting a page also turns its photographs into negatives, which usually looks wrong. Dark mode keeps hues, so photos look less strange than in a true negative. A page that is mostly images is easier to read as it is.',
      },
    ],
    related: ['grayscale-pdf', 'pdf-to-png', 'compress-pdf', 'pdf-to-jpg', 'redact-pdf', 'edit-pdf'],
    updated: '2026-11-01',
  },
]
