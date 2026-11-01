import type { Tool } from './types'

/**
 * Redaction tools. Detection models (faces, plates, text entities, OCR, speech)
 * are static files on this site and run in the browser; see src/lib/ml/.
 * Upgraded older tools in this category live in their own modules:
 * blur-face-in-photo, blur-license-plate, censor-image (extra-photo.ts) and
 * redact-pdf (extra-pdf-edit.ts).
 */
export const tools: Tool[] = [
  {
    slug: 'redact-text',
    title: 'Text Redactor',
    h1: 'Redact personal data in text',
    description:
      'Text redactor: paste text and get a copy with names, emails, phone numbers, addresses and ID numbers masked. A language model finds them in your browser.',
    keywords: ['text redactor', 'anonymize text', 'remove personal information from text', 'pii redaction', 'mask names in text', 'redact document text'],
    category: 'redact',
    icon: 'TextSelect',
    popular: true,
    accepts: ['txt', 'md', 'csv', 'json', 'log', 'eml'],
    faqs: [
      {
        q: 'What does the tool find?',
        a: 'Names of people, organizations and places with a language model, and emails, phone numbers, card numbers, IBANs, IP addresses, dates and ID numbers with pattern rules. You choose which types to hide.',
      },
      {
        q: 'Is my text sent anywhere?',
        a: 'No. The model file downloads once from this site and runs in your browser. Your text stays in the page. Open the network panel while you paste to check.',
      },
      {
        q: 'Can I hide a word the model missed?',
        a: 'Yes. Add it to the always-hide list and every match is masked. You can also click any highlighted item to keep it visible.',
      },
      {
        q: 'How is the text masked?',
        a: 'Choose a label such as [NAME], a block of black squares, or a consistent placeholder such as Person 1 and Person 2, which keeps the text readable for review.',
      },
    ],
    related: ['secrets-scrubber', 'anonymize-csv', 'redact-pdf', 'redact-screenshot'],
    updated: '2026-11-01',
  },
  {
    slug: 'blur-faces-in-video',
    title: 'Video Face Blur',
    h1: 'Blur faces in a video',
    description:
      'Find and blur every face in a video, frame by frame, and export an MP4 with the sound kept. Detection and encoding run on your device.',
    keywords: ['blur faces in video', 'video face blur', 'anonymize video', 'blur people in video', 'face blur online'],
    category: 'redact',
    icon: 'Video',
    popular: true,
    accepts: ['mp4', 'mov', 'webm', 'mkv'],
    faqs: [
      {
        q: 'How does it find the faces?',
        a: 'A small face detection model checks 8 frames per second, and a tracker follows each face from frame to frame. The blur moves with the face between the checked frames, so it does not flicker when a face turns or is hidden for a moment.',
      },
      {
        q: 'Can I keep one face visible?',
        a: 'Yes. After the scan, each person is listed with a picture. Click a person to keep their face sharp in the whole video, or click their face in the preview.',
      },
      {
        q: 'How long does it take?',
        a: 'On a recent laptop, the scan of a one-minute 1080p video takes about 30 to 60 seconds and the export less than that. Phones and older computers take longer. The progress bar shows the frame count and the time left.',
      },
      {
        q: 'What file do I get?',
        a: 'An MP4 file (H.264) with the sound kept, at up to 1080p. If your browser cannot encode H.264, you get a WebM file. Location and device data from the original file are not copied.',
      },
      {
        q: 'Is the video uploaded?',
        a: 'No. Your browser decodes, scans, blurs and encodes the video in memory. The face model downloads once from this site. Nothing leaves your device.',
      },
    ],
    related: ['blur-face-in-photo', 'face-blur-camera', 'redact-screen-recording', 'compress-video'],
    updated: '2026-11-01',
  },
  {
    slug: 'face-blur-camera',
    title: 'Face Blur Camera',
    h1: 'Blur faces on your webcam live',
    description:
      'Turn on your camera and each face in view is blurred live. Keep your own face sharp, record a clip, or share the window in a video call.',
    keywords: ['blur background people webcam', 'face blur camera', 'webcam face blur', 'hide faces on video call', 'live face blur'],
    category: 'redact',
    icon: 'Webcam',
    faqs: [
      {
        q: 'Can I use it in a video call?',
        a: 'A web page cannot add a camera to your system. Press "Open in a window" and share that window in the call, or record a clip and send the file.',
      },
      {
        q: 'How do I keep my own face visible?',
        a: 'Turn on "Keep the largest face". The face nearest the camera stays sharp and every other face is blurred.',
      },
      {
        q: 'Can I record a clip?',
        a: 'Yes. Press Record, and the blurred picture is saved as an MP4 or WebM file, with sound if you turn it on. The faces are blurred in the file itself.',
      },
      {
        q: 'Does the video go to a server?',
        a: 'No. Frames go from the camera to the model and to the screen inside your browser. Recording also happens in the page. Turn off the camera with the button and the browser releases it.',
      },
    ],
    related: ['blur-faces-in-video', 'blur-face-in-photo', 'webcam-test', 'screen-recorder'],
    updated: '2026-11-01',
  },
  {
    slug: 'secrets-scrubber',
    title: 'Secrets Scrubber',
    h1: 'Remove API keys and passwords from logs',
    description:
      'Paste logs, code or config and mask API keys, tokens, passwords, private keys, IP addresses and internal hostnames before you share them.',
    keywords: ['remove api keys from logs', 'redact secrets', 'scrub logs', 'mask tokens in code', 'sanitize log file', 'secret scanner'],
    category: 'redact',
    icon: 'KeyRound',
    popular: true,
    accepts: ['log', 'txt', 'json', 'yaml', 'yml', 'env', 'ini', 'toml', 'conf'],
    faqs: [
      {
        q: 'Which secrets does it detect?',
        a: 'Keys and tokens from more than 60 providers by their known formats, private key blocks, JWTs, passwords in URLs and config lines, connection strings, IP addresses, email addresses and internal hostnames. Long random strings are flagged by their entropy.',
      },
      {
        q: 'Does it keep the structure of the log?',
        a: 'Yes. Only the secret value is replaced, so line numbers, keys and timestamps stay as they were. Each secret type can get its own placeholder.',
      },
      {
        q: 'Should I rotate a key that I scrubbed?',
        a: 'If the key was ever shared, committed or pasted into a chat, rotate it. Scrubbing protects only the copy you share next. Copies that exist already still hold the key.',
      },
    ],
    related: ['redact-text', 'jwt-decoder', 'redact-screenshot', 'anonymize-csv'],
    updated: '2026-11-01',
  },
  {
    slug: 'anonymize-chat-screenshot',
    title: 'Chat Screenshot Anonymizer',
    h1: 'Anonymize a chat screenshot',
    description:
      'Anonymize a chat screenshot: hide names, phone numbers, avatars and links in WhatsApp, Telegram, iMessage or Slack screenshots on your device.',
    keywords: ['anonymize chat screenshot', 'hide names in screenshot', 'blur whatsapp screenshot', 'censor chat', 'hide profile picture'],
    category: 'redact',
    icon: 'MessagesSquare',
    accepts: ['png', 'jpg', 'jpeg', 'webp'],
    faqs: [
      {
        q: 'Which chat apps does it work with?',
        a: 'Any app that shows text and round avatars, including WhatsApp, Telegram, iMessage, Signal, Messenger, Slack and Discord. Light and dark themes both work.',
      },
      {
        q: 'Can I keep the message text and hide only the names?',
        a: 'Yes. Choose which types to hide: names, phone numbers, emails, links, avatars. The rest of the conversation stays readable.',
      },
      {
        q: 'Can someone undo the blur?',
        a: 'Use the solid fill for text. Blur and pixelation can sometimes be reversed for short text such as a phone number. A solid fill removes the pixels.',
      },
    ],
    related: ['redact-screenshot', 'censor-image', 'blur-face-in-photo', 'remove-metadata'],
    updated: '2026-11-01',
  },
  {
    slug: 'anonymize-chat-text',
    title: 'Chat Text Anonymizer',
    h1: 'Anonymize a chat with fake names',
    description:
      'Replace each person in a chat or chat export with the same fake name every time. Works with WhatsApp, Slack, Teams and Discord exports.',
    keywords: ['anonymize chat', 'anonymize whatsapp chat', 'replace names in chat', 'chat export anonymizer', 'pseudonymize conversation'],
    category: 'redact',
    icon: 'MessageSquareDashed',
    accepts: ['txt', 'json', 'csv', 'html'],
    faqs: [
      {
        q: 'Does the same person always get the same fake name?',
        a: 'Yes. Each sender and each person named in the messages gets one fake name, and it is used in every line, so the conversation stays easy to follow.',
      },
      {
        q: 'How do I anonymize a WhatsApp chat?',
        a: 'In WhatsApp, open the chat, choose Export chat without media, and drop the .txt file here. Senders are read from the line format and replaced.',
      },
      {
        q: 'Can I use it before I paste a chat into an AI chatbot?',
        a: 'Yes. That is a common use. Names, numbers, emails and addresses are replaced on your device before you copy the text anywhere.',
      },
      {
        q: 'Is it always correct?',
        a: 'No detector is. Nicknames and names written in lower case can be missed. Read the result, and add any missed word to the always-hide list.',
      },
    ],
    related: ['anonymize-chat-screenshot', 'redact-text', 'anonymize-csv', 'secrets-scrubber'],
    updated: '2026-10-30',
  },
  {
    slug: 'redact-screenshot',
    title: 'Screenshot Redactor',
    h1: 'Redact a screenshot',
    description:
      'Redact a screenshot: the tool reads its text and covers emails, phone numbers, usernames, keys and faces. Check each box, then export.',
    keywords: ['redact screenshot', 'blur text in screenshot', 'hide email in screenshot', 'censor screenshot', 'screenshot privacy'],
    category: 'redact',
    icon: 'ScanText',
    popular: true,
    accepts: ['png', 'jpg', 'jpeg', 'webp'],
    faqs: [
      {
        q: 'How does it read the screenshot?',
        a: 'An OCR engine compiled to WebAssembly finds each word and its position. Pattern rules and a language model then mark the words that hold personal data.',
      },
      {
        q: 'Can I add or remove boxes?',
        a: 'Yes. Click a box to remove it, or drag on the image to add one. You see the result before you export.',
      },
      {
        q: 'Can I paste a screenshot?',
        a: 'Yes. Press Ctrl+V or Cmd+V on the page after you copy a screenshot to the clipboard.',
      },
    ],
    related: ['anonymize-chat-screenshot', 'censor-image', 'secrets-scrubber', 'redact-screen-recording'],
    updated: '2026-11-01',
  },
  {
    slug: 'redact-screen-recording',
    title: 'Screencast Redactor',
    h1: 'Redact a screen recording',
    description:
      'Hide emails, API keys, names and faces in a screen recording or product demo. The screen is read as it changes and the result is an MP4.',
    keywords: ['redact screen recording', 'blur sensitive info in video', 'blur email in video', 'screencast redaction', 'hide api key in video'],
    category: 'redact',
    icon: 'MonitorPlay',
    accepts: ['mp4', 'mov', 'webm', 'mkv'],
    faqs: [
      {
        q: 'Does it read every frame?',
        a: 'It reads a frame each time the screen changes, and keeps each box in place until the content under it changes. When the screen scrolls, the boxes move with the text.',
      },
      {
        q: 'Can I add a box by hand?',
        a: 'Yes. Pause on a frame, press Add a box, drag the box, and set the time span it covers.',
      },
      {
        q: 'Blur or black box?',
        a: 'Choose fill, blur or pixelate. A solid fill is the safest for text: blurred text can sometimes be read back.',
      },
      {
        q: 'Is the recording uploaded?',
        a: 'No. Decoding, reading, covering and encoding all happen in your browser.',
      },
    ],
    related: ['redact-screenshot', 'blur-faces-in-video', 'screen-recorder', 'secrets-scrubber'],
    updated: '2026-11-01',
  },
  {
    slug: 'pdf-redaction-checker',
    title: 'PDF Redaction Checker',
    h1: 'Check a redacted PDF for leaks',
    description:
      'Find text under black boxes, old revisions, hidden layers and metadata that a redacted PDF still holds. Get a page by page report.',
    keywords: ['check pdf redaction', 'redaction checker', 'find text under black box pdf', 'bad redaction', 'pdf redaction test'],
    category: 'redact',
    icon: 'FileSearch',
    accepts: ['pdf'],
    faqs: [
      {
        q: 'What does a failed redaction look like?',
        a: 'A black rectangle drawn over text that is still in the file. Anyone can select it, copy it or extract it. The checker finds text that sits under filled shapes and shows it to you.',
      },
      {
        q: 'What else does it check?',
        a: 'Earlier revisions saved in the same file, document properties and XMP metadata, annotations and comments, form field values, attachments, bookmarks and text in white or zero-size fonts.',
      },
      {
        q: 'How do I fix a leak?',
        a: 'Open the original in the PDF redactor on this site. It removes the text under each box, then you can run the checker again on the result.',
      },
    ],
    related: ['redact-pdf', 'remove-metadata', 'pdf-metadata-editor', 'flatten-pdf'],
    updated: '2026-10-30',
  },
  {
    slug: 'remove-metadata',
    title: 'Metadata Remover',
    h1: 'Remove metadata from photos and documents',
    description:
      'Remove metadata from photos and documents: GPS location, camera details, author names, comments and edit history in JPG, PNG, PDF and Office files.',
    keywords: ['remove metadata', 'metadata stripper', 'remove exif', 'remove author from word document', 'remove pdf metadata', 'strip gps from photo'],
    category: 'redact',
    icon: 'FileX2',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'docx', 'xlsx', 'pptx', 'mp4', 'mov'],
    faqs: [
      {
        q: 'What metadata is removed?',
        a: 'For photos: EXIF, GPS, camera and lens, XMP and the embedded thumbnail. For PDFs: the document properties and XMP. For Word, Excel and PowerPoint: author, last editor, company, comments, revision count and custom properties.',
      },
      {
        q: 'Does it change the quality of my photo?',
        a: 'No. JPEG and PNG files are not encoded again. The tool removes the metadata blocks and copies the image data as it is.',
      },
      {
        q: 'Can I see the metadata first?',
        a: 'Yes. The tool lists every field it finds, file by file, before you download the clean copy.',
      },
    ],
    related: ['remove-exif-data', 'image-metadata-viewer', 'pdf-metadata-editor', 'pdf-redaction-checker'],
    updated: '2026-11-01',
  },
  {
    slug: 'redact-id-card',
    title: 'ID Redactor',
    h1: 'Redact a passport or ID card',
    description:
      'Mask document numbers, birth dates, signatures and the machine-readable zone on a passport, driving licence or ID card before you send a copy.',
    keywords: ['redact passport', 'hide id number', 'mask id card copy', 'redact driving licence', 'passport copy watermark'],
    category: 'redact',
    icon: 'IdCard',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    faqs: [
      {
        q: 'Which fields does it find?',
        a: 'The machine-readable zone, document number, personal number, dates of birth, issue and expiry, the address on EU driving licences, the signature and the photo. You choose which to hide; the name often has to stay visible.',
      },
      {
        q: 'What is the machine-readable zone?',
        a: 'The two or three lines of letters, numbers and < signs at the bottom of a passport or ID card. They repeat your name, document number and dates. The tool reads them and checks their check digits.',
      },
      {
        q: 'Can I add a watermark too?',
        a: 'Yes. Add a line such as "Copy for Acme Ltd, 30 Oct 2026" and it is drawn across the whole image. A copy marked for one purpose is less useful to anyone who steals it.',
      },
      {
        q: 'Is my ID sent to a server?',
        a: 'No. The image is read and edited in your browser, and the OCR engine and models are files on this site that run on your device.',
      },
    ],
    related: ['redact-signature', 'redact-scanned-document', 'passport-photo-maker', 'watermark-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'bleep-audio',
    title: 'Audio Bleeper',
    h1: 'Bleep out names and numbers in audio',
    description:
      'Transcribe a recording on your device, find names, numbers and words you choose, and bleep them. Export WAV, MP3 or the video.',
    keywords: ['audio bleeper', 'bleep out words', 'censor audio', 'bleep names in podcast', 'remove personal info from audio'],
    category: 'redact',
    icon: 'AudioLines',
    accepts: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mov'],
    faqs: [
      {
        q: 'How does it know where each word is?',
        a: 'A speech recognition model writes down each word with its start and end time. You see the transcript, press words to bleep them, and the tool cuts at those times.',
      },
      {
        q: 'Which languages are supported?',
        a: 'You choose the spoken language. English works best. The model also transcribes about 90 other languages with less accuracy.',
      },
      {
        q: 'Bleep or silence?',
        a: 'Choose a 1 kHz tone, silence or noise. Each bleep starts 150 ms before the word and ends 150 ms after it, because word times can be off a little. You can change that margin.',
      },
      {
        q: 'Can I bleep the sound of a video?',
        a: 'Yes. The picture is copied as it is and only the sound is written again, as MP4 or WebM.',
      },
      {
        q: 'Is the recording uploaded?',
        a: 'No. The speech model and the name finder download once from this site and run in your browser.',
      },
    ],
    related: ['trim-audio', 'redact-text', 'voice-recorder', 'audio-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'anonymize-csv',
    title: 'CSV Anonymizer',
    h1: 'Anonymize a CSV file',
    description:
      'Anonymize a CSV file: find columns with names, emails, phone numbers and IDs, then mask, hash or replace them with fake values of the same shape.',
    keywords: ['anonymize csv', 'mask data in csv', 'fake data from csv', 'pseudonymize spreadsheet', 'test data anonymization'],
    category: 'redact',
    icon: 'Sheet',
    accepts: ['csv', 'tsv', 'xlsx', 'json'],
    faqs: [
      {
        q: 'How are personal data columns found?',
        a: 'Each column is scored by its header name and by a sample of its values: email and phone formats, name lists, card numbers with a checksum, dates and free text. You can change any column before you export.',
      },
      {
        q: 'Hash, mask or fake?',
        a: 'Hash keeps the same input equal to the same output, so joins between tables still work. Mask keeps the format, such as j***@e***.com. Fake puts in realistic values of the same type.',
      },
      {
        q: 'Is a hashed email anonymous?',
        a: 'Not on its own. Anyone with a list of emails can hash it and compare. The tool adds a secret salt that stays in your browser, which stops that attack.',
      },
    ],
    related: ['redact-text', 'csv-to-json', 'excel-to-csv', 'secrets-scrubber'],
    updated: '2026-11-01',
  },
  {
    slug: 'redact-signature',
    title: 'Signature Redactor',
    h1: 'Hide signatures on scanned documents',
    description:
      'Find handwritten signatures and stamps on scanned pages and cover them with a black box. Works with PDF, JPG and PNG scans.',
    keywords: ['redact signature', 'hide signature on document', 'remove signature from pdf', 'blur signature', 'cover stamp'],
    category: 'redact',
    icon: 'Signature',
    accepts: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'How does it find a signature?',
        a: 'A small model trained on handwritten signatures looks at each page, whole and in overlapping parts, so small signatures are found too. Stamps are found by their ink: a coloured ring or frame.',
      },
      {
        q: 'Does it mark other handwriting?',
        a: 'Sometimes. Notes in the margin and initials can get a box too. Click a box to keep that area visible, or drag to cover what it missed.',
      },
      {
        q: 'Why hide a signature?',
        a: 'A clear copy of a signature makes forgery easier. When you share a contract or a letter as an example, cover it.',
      },
      {
        q: 'What happens to a PDF?',
        a: 'Pages with a covered signature are saved as images with the box burned in, so the original pixels are gone. The other pages keep their text.',
      },
    ],
    related: ['redact-scanned-document', 'redact-id-card', 'redact-pdf', 'sign-pdf'],
    updated: '2026-11-01',
  },
  {
    slug: 'redact-scanned-document',
    title: 'Document Redactor',
    h1: 'Redact a scanned document',
    description:
      'Read scanned letters, invoices and forms with OCR on your device, find personal data and black it out on the page image. Export PDF or PNG.',
    keywords: ['redact scanned pdf', 'redact scanned document', 'ocr redaction', 'black out text in scan', 'redact image of document'],
    category: 'redact',
    icon: 'FileScan',
    accepts: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'My PDF has no text layer. Does it work?',
        a: 'Yes. That is the case this tool is for. Each page is read with OCR, so a scan or a photo of a page works.',
      },
      {
        q: 'What does it find?',
        a: 'Names, addresses, emails, phone numbers, account and card numbers, dates and ID numbers, plus any words you add. You can click any box to keep that text visible.',
      },
      {
        q: 'Is the output searchable?',
        a: 'No. The pages are saved as images with the boxes burned in. This makes sure no hidden text is left under a box.',
      },
      {
        q: 'Which languages can it read?',
        a: 'The OCR uses English data. Other languages in Latin script are read too, with more mistakes, so check each page.',
      },
    ],
    related: ['redact-pdf', 'redact-signature', 'redact-id-card', 'pdf-redaction-checker'],
    updated: '2026-11-01',
  },
]
