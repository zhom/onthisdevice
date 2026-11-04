import type { Tool } from './types'

/**
 * Round-2 batch `dev-encode` — encoders, hashes and sysadmin calculators.
 *
 * Every entry here is a real page under `src/pages/`. Sibling slugs share a
 * React island but never share body copy: each has its own H1, description,
 * explainer and FAQ set.
 */

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  /* ------------------------------------------------------------------ */
  /* 61 · Image / file → Base64 family                                   */
  /* ------------------------------------------------------------------ */
  {
    slug: 'image-to-base64',
    title: 'Image to Base64',
    h1: 'Convert an image to Base64',
    description:
      'Convert an image to Base64: PNG, JPG, GIF, WebP or SVG becomes raw Base64, a data URI, and HTML, CSS and Markdown snippets to copy.',
    keywords: ['png to base64', 'jpg to base64', 'image data uri', 'base64 image encoder'],
    category: 'dev',
    icon: 'ImageUp',
    popular: true,
    accepts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'],
    faqs: [
      {
        q: 'How much bigger does Base64 make my image?',
        a: 'Exactly 4 characters for every 3 bytes, so about 33% larger, plus a few bytes of padding and the data: prefix. A 90 KB photo becomes about 120 KB of text.',
      },
      {
        q: 'When is inlining an image actually worth it?',
        a: 'Below about 2 KB. Inlining removes one request. That was important before HTTP/2 and is much less important now. Also, an inlined image cannot be cached apart from the page or stylesheet that contains it.',
      },
      {
        q: 'Does the image lose quality?',
        a: 'No. Base64 is a lossless encoding of the same bytes. Decode it and you get a byte-identical file. No pixels change.',
      },
      {
        q: 'Is the image uploaded anywhere?',
        a: 'No. The browser File API reads it, and your device encodes it in 3 MB slices. Watch the Network tab while you use the tool: nothing is sent.',
      },
      {
        q: 'Why does my SVG produce a smaller CSS snippet than a PNG?',
        a: 'For SVG, the tool offers URL-encoding in place of Base64. SVG is text, so percent-encoding keeps it readable and usually 20-30% smaller than the Base64 version. It also compresses well with gzip.',
      },
    ],
    related: ['base64-to-image', 'svg-to-base64', 'file-to-base64', 'base64-encoder-decoder'],
    updated: UPDATED,
  },
  {
    slug: 'base64-to-image',
    title: 'Base64 to Image',
    h1: 'Decode Base64 back to an image',
    description:
      'Convert Base64 to an image: paste a Base64 string or data URI to preview it and download a PNG, JPG, GIF, WebP or SVG. The type comes from the bytes.',
    keywords: ['base64 to png', 'base64 to jpg', 'decode base64 image', 'data uri to image'],
    category: 'dev',
    icon: 'ImageDown',
    accepts: [],
    faqs: [
      {
        q: 'My string starts with data:image/png;base64. Do I remove that?',
        a: 'No. Paste the whole string. The tool reads the prefix, then confirms the real file type from the decoded bytes.',
      },
      {
        q: 'It says the type is not what the data URI claims. Which is right?',
        a: 'The bytes. A data URI header is only a label, and anyone can mistype it. The tool checks the file signature (89 50 4E 47 for PNG, FF D8 FF for JPEG, RIFF…WEBP for WebP) and names the file from it.',
      },
      {
        q: 'Nothing previews and the download is a .bin file.',
        a: 'The decoded bytes are not a known image. The usual causes are a cut-off copy, a string that was URL-encoded on the way out, or a value that was never an image.',
      },
      {
        q: 'Does it handle URL-safe Base64?',
        a: 'Yes. Hyphen and underscore become plus and slash, missing padding is added, and whitespace and line breaks are ignored. A value copied from a JWT or a log line works as it is.',
      },
    ],
    related: ['image-to-base64', 'base64-to-file', 'base64-encoder-decoder', 'svg-to-base64'],
    updated: UPDATED,
  },
  {
    slug: 'svg-to-base64',
    title: 'SVG to Base64',
    h1: 'Encode an SVG for CSS and HTML',
    description:
      'Convert SVG to Base64 or to the smaller URL-encoded form, with background-image, img and Markdown snippets to copy for inline icons.',
    keywords: ['svg data uri', 'svg base64 css', 'inline svg background', 'encode svg url'],
    category: 'dev',
    icon: 'Shapes',
    accepts: ['svg'],
    faqs: [
      {
        q: 'Should I use Base64 or URL-encoding for an SVG in CSS?',
        a: 'URL-encoding, almost always. SVG is text, so Base64 adds 33% for no gain. Percent-encoding adds much less, stays readable in the stylesheet, and compresses better. This page makes both so you can compare.',
      },
      {
        q: 'Why does my URL-encoded SVG break the stylesheet?',
        a: 'Unescaped hash and quote characters. The output changes double quotes to single quotes in the markup and escapes # and %. That combination works in every CSS parser.',
      },
      {
        q: 'Can I still recolour the icon with CSS?',
        a: 'Not when it is a data URI in background-image. It is then an image, so currentColor and fill rules do not reach it. To follow the text colour, put the SVG element inline in your HTML, or use mask-image.',
      },
      {
        q: 'Does the SVG get minified first?',
        a: 'The tool collapses runs of whitespace, which is safe. It does not rewrite paths or remove attributes, because that can change the rendering in ways that a preview does not show.',
      },
    ],
    related: ['image-to-base64', 'file-to-base64', 'base64-to-image', 'favicon-generator'],
    updated: UPDATED,
  },
  {
    slug: 'file-to-base64',
    title: 'File to Base64',
    h1: 'Convert any file to Base64',
    description:
      'Convert any file to Base64 or a data URI: PDF, ZIP, font, certificate or audio. The file is encoded in 3 MB slices with a progress bar.',
    keywords: ['pdf to base64', 'encode file base64', 'binary to base64', 'base64 converter file'],
    category: 'dev',
    icon: 'FileUp',
    accepts: [],
    faqs: [
      {
        q: 'Is there a file size limit?',
        a: 'Only the memory of your device. Encoding runs in 3 MB slices with a progress bar. Past a few hundred megabytes, most editors and APIs refuse the resulting string.',
      },
      {
        q: 'Is it safe to encode a private key or a certificate here?',
        a: 'Yes. The bytes stay in the tab, and the page cannot reach a server, because its Content-Security-Policy allows no external origin. The trust model is the same as running base64 in your own terminal.',
      },
      {
        q: 'Which MIME type is used in the data URI?',
        a: 'The type that the browser reports for the file. If there is none, the tool uses a table of common extensions, then application/octet-stream. You can edit the prefix afterwards.',
      },
      {
        q: 'Why is the output about a third larger than the file?',
        a: 'Base64 writes 3 bytes as 4 printable characters, a 4/3 ratio by design. That is the cost of moving binary data through a text-only channel such as JSON, email or a URL.',
      },
    ],
    related: ['base64-to-file', 'image-to-base64', 'base64-encoder-decoder', 'file-hash-checker'],
    updated: UPDATED,
  },
  {
    slug: 'base64-to-file',
    title: 'Base64 to File',
    h1: 'Decode Base64 into a file',
    description:
      'Convert Base64 to a file: paste Base64 or a data URI and download the original file. The file type comes from the file signature in the bytes.',
    keywords: ['base64 to pdf', 'decode base64 file', 'data uri to file', 'base64 decoder download'],
    category: 'dev',
    icon: 'FileDown',
    accepts: [],
    faqs: [
      {
        q: 'How does it know what kind of file this is?',
        a: 'It reads the magic bytes: %PDF for PDF, PK for ZIP and Office files, 89 50 4E 47 for PNG, ftyp for MP4. A data URI header is often wrong or missing, so the bytes are more reliable.',
      },
      {
        q: 'The download opens as garbage. What went wrong?',
        a: 'Usually the string was cut off. After padding, the Base64 length must be a multiple of four. If the copy was short, the last bytes are lost and the file does not parse. Copy the complete value again.',
      },
      {
        q: 'Can I decode Base64 that came out of a JSON payload?',
        a: 'Yes. Remove the quotes around the value and paste it. Escaped newlines and whitespace in it are ignored, and URL-safe characters are handled.',
      },
      {
        q: 'Where does the downloaded file come from?',
        a: 'From a Blob that this tab builds and gives to the browser download manager. No request is made, so the tool also works with Wi-Fi off.',
      },
    ],
    related: ['file-to-base64', 'base64-to-image', 'base64-encoder-decoder', 'image-to-base64'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 62 · Hex / octal / decimal / base32 family                          */
  /* ------------------------------------------------------------------ */
  {
    slug: 'hex-to-text',
    title: 'Hex to Text',
    h1: 'Convert hex to text',
    description:
      'Convert hex to text with full UTF-8 support. Any separator and 0x prefixes are accepted, and you can drop in a file that contains a hex dump.',
    keywords: ['hex decoder', 'hexadecimal to string', 'hex to utf8', 'convert hex to text'],
    category: 'dev',
    icon: 'Binary',
    faqs: [
      {
        q: 'Does the input need spaces between the bytes?',
        a: 'No. Continuous hex, and hex separated by spaces, commas or colons or with 0x prefixes, all parse. Any character that is not a hex digit counts as a separator.',
      },
      {
        q: 'Why do accented characters come out wrong?',
        a: 'The character set is ASCII/Latin-1. In UTF-8, é is the two bytes C3 A9, and a single-byte decoder shows them as two symbols. Switch the character set to UTF-8.',
      },
      {
        q: 'It says the number of digits must be even.',
        a: 'Each byte is exactly two hex digits, so a valid dump always has an even length. An odd count usually means a leading zero was lost, for example 0A written as A.',
      },
      {
        q: 'Can I decode a hex dump from Wireshark or xxd?',
        a: 'Yes. Paste it, or drop the .txt file. But remove the offset and ASCII columns first: the parser cannot tell a byte value from an offset, so it reads them as data.',
      },
    ],
    related: ['text-to-hex', 'hex-to-ascii', 'binary-to-text', 'number-base-converter'],
    updated: UPDATED,
  },
  {
    slug: 'text-to-hex',
    title: 'Text to Hex',
    h1: 'Convert text to hex',
    description:
      'Convert text to hex with your choice of separator, uppercase digits and 0x prefixes. Drop in any file to get a hex byte dump of it.',
    keywords: ['string to hex', 'hex encoder', 'utf8 to hex', 'ascii to hexadecimal'],
    category: 'dev',
    icon: 'Hash',
    faqs: [
      {
        q: 'How many bytes will my text be?',
        a: 'In UTF-8, plain Latin letters are one byte each, most accented, Greek and Cyrillic letters are two, CJK is three, and emoji are four. The byte counter under the output shows the exact number.',
      },
      {
        q: 'Which output format do I want?',
        a: 'Space-separated pairs are easiest to read in documentation. Most APIs and config files expect continuous hex. The 0x prefix suits C, Python and shell literals. One toggle switches between the three.',
      },
      {
        q: 'Why does an emoji produce four bytes and not two?',
        a: 'Most emoji are above U+FFFF, so UTF-8 needs four bytes. Some, such as flags, skin-tone variants and family groups, are several code points joined by zero-width joiners and use many more bytes.',
      },
      {
        q: 'Can I dump a binary file as hex?',
        a: 'Yes. Drop it into the file panel. The tool dumps the first 512 KB so the page stays responsive. For larger files, use xxd or a hex editor.',
      },
    ],
    related: ['hex-to-text', 'ascii-to-hex', 'text-to-binary', 'base64-encoder-decoder'],
    updated: UPDATED,
  },
  {
    slug: 'hex-to-ascii',
    title: 'Hex to ASCII',
    h1: 'Convert hex to ASCII',
    description:
      'Convert hex to ASCII characters, one byte per character. Values outside the printable ASCII range (20 to 7E) get a clear error message.',
    keywords: ['hex to ascii converter', 'hexadecimal ascii', 'hex character codes'],
    category: 'dev',
    icon: 'Type',
    faqs: [
      {
        q: 'What is the difference between this and the hex-to-text page?',
        a: 'This page reads one byte per character, which is what people mean by ASCII. The text page uses UTF-8, where one character can be up to four bytes.',
      },
      {
        q: 'Which hex values are printable ASCII?',
        a: '20 to 7E, from space to tilde. Below 20 are control codes such as 09 tab, 0A line feed and 0D carriage return. 7F is delete. Values above 7F are not ASCII.',
      },
      {
        q: 'My data has bytes above 7F. What are they?',
        a: 'They are not ASCII. In Latin-1 they are accented characters and symbols. In UTF-8 they are part of a multi-byte sequence. Switch the character set to UTF-8 if the source is modern text.',
      },
      {
        q: 'Why do I get 48 65 6C 6C 6F for "Hello"?',
        a: 'Those are the ASCII codes 72, 101, 108, 108, 111 written in base 16. Hex is a compact way to write the same byte values that a decimal ASCII table shows.',
      },
    ],
    related: ['ascii-to-hex', 'hex-to-text', 'decimal-to-text', 'binary-to-text'],
    updated: UPDATED,
  },
  {
    slug: 'ascii-to-hex',
    title: 'ASCII to Hex',
    h1: 'Convert ASCII to hex',
    description:
      'Convert ASCII to hex byte values, with your choice of spacing, letter case and 0x prefix. Any character outside ASCII gets a warning.',
    keywords: ['ascii to hexadecimal', 'char to hex', 'ascii hex table', 'text hex encoder'],
    category: 'dev',
    icon: 'CaseSensitive',
    faqs: [
      {
        q: 'What happens to characters that are not ASCII?',
        a: 'In ASCII/Latin-1 mode, the tool rejects any character above U+00FF and names it in the message. Switch to UTF-8 to encode it as multiple bytes.',
      },
      {
        q: 'Does it encode spaces and line breaks?',
        a: 'Yes. Space is 20, line feed is 0A and carriage return is 0D. Windows line endings show as the pair 0D 0A, which is often the detail you are looking for.',
      },
      {
        q: 'Uppercase or lowercase hex: does it matter?',
        a: 'Not to any parser. Protocol specifications and hardware documentation usually use uppercase. Most programming languages and web tools use lowercase. The toggle changes only the look.',
      },
      {
        q: 'Why does my "identical" string produce different hex?',
        a: 'Almost always a difference you cannot see: a non-breaking space (C2 A0 in UTF-8) in place of 20, a curly quote in place of a straight one, or a trailing newline. The hex view finds it fastest.',
      },
    ],
    related: ['hex-to-ascii', 'text-to-hex', 'text-to-binary', 'character-counter'],
    updated: UPDATED,
  },
  {
    slug: 'octal-to-text',
    title: 'Octal to Text',
    h1: 'Convert octal to text',
    description:
      'Convert octal to text and text to octal. Base-8 byte values can be padded or unpadded, and the output can be UTF-8 or ASCII.',
    keywords: ['octal decoder', 'base 8 to text', 'octal to string', 'text to octal'],
    category: 'dev',
    icon: 'Grid2x2',
    faqs: [
      {
        q: 'Why is octal still used at all?',
        a: 'Unix file permissions, some escape sequences in C and Python (\\101 is A), and older hardware documentation. Three bits make one octal digit, which suited machines with 12, 24 and 36-bit words.',
      },
      {
        q: 'How many digits per byte?',
        a: 'Three, because a byte goes up to 377 in octal. So input without spaces must be a multiple of three digits. 101 145 154 is clear, but 101145154 parses only if every value is padded.',
      },
      {
        q: 'What does the 0o prefix mean?',
        a: 'It is the modern prefix for octal literals in Python, JavaScript and Rust. In C, a bare leading zero meant the same. That caused so many bugs that most languages dropped it.',
      },
      {
        q: 'Is this the same as a chmod value?',
        a: 'No. They are related but different. A chmod octal value encodes permission bits, and this page converts octal byte values to and from text. Use the chmod calculator for permissions.',
      },
    ],
    related: ['decimal-to-text', 'hex-to-text', 'chmod-calculator', 'number-base-converter'],
    updated: UPDATED,
  },
  {
    slug: 'decimal-to-text',
    title: 'Decimal to Text',
    h1: 'Convert decimal codes to text',
    description:
      'Convert decimal to text: turn a list of decimal character codes into text and back, with UTF-8 or ASCII bytes and any separator.',
    keywords: ['decimal to ascii', 'char codes to text', 'text to decimal', 'ascii code converter'],
    category: 'dev',
    icon: 'ListOrdered',
    faqs: [
      {
        q: 'Are these character codes or byte values?',
        a: 'Byte values. In ASCII mode they are the same as character codes. In UTF-8 mode one character can be two, three or four byte values, and the list shows all of them.',
      },
      {
        q: 'Do I need separators?',
        a: 'For decimal, yes: 72101108 can be read in many ways. Space, comma, semicolon and newline all work. If you pad each value to three digits, you can also write them without separators.',
      },
      {
        q: 'What is the highest valid number?',
        a: '255, because each value is one byte. Numbers above 255 are Unicode code points, and the character counter and hex pages handle those better.',
      },
      {
        q: 'Why is capital A 65 and lowercase a 97?',
        a: 'ASCII puts the case in a single bit: 65 is 1000001 and 97 is 1100001. Flipping bit 6 changes the case, which made early terminal hardware much simpler.',
      },
    ],
    related: ['octal-to-text', 'hex-to-text', 'binary-to-decimal', 'ascii-to-hex'],
    updated: UPDATED,
  },
  {
    slug: 'base32-encoder-decoder',
    title: 'Base32 Encoder / Decoder',
    h1: 'Base32 encode and decode',
    description:
      'Base32 encoder and decoder for RFC 4648 Base32 and base32hex, the alphabets used by TOTP secrets, DNSSEC records and Tor addresses.',
    keywords: ['base32 decode', 'rfc 4648', 'base32hex', 'totp secret decoder'],
    category: 'dev',
    icon: 'Braces',
    faqs: [
      {
        q: 'Why does Base32 avoid 0, 1 and 8?',
        a: 'So that it survives being read aloud, handwritten or typed from a screen. Without the digits that look like O, I/L and B, the most common copy mistakes go away. That is why 2FA secrets use it.',
      },
      {
        q: 'What is base32hex and when do I need it?',
        a: 'The extended-hex alphabet from RFC 4648 §7: 0-9, then A-V. Its sort order matches the sort order of the bytes, which is why NSEC3 records in DNSSEC use it. Standard Base32 does not have this property.',
      },
      {
        q: 'Is the padding with = signs required?',
        a: 'The RFC requires it, but most implementations accept input without padding, and TOTP secrets are almost always shared without it. This decoder ignores padding. The encoder adds it, and you can remove it.',
      },
      {
        q: 'How much larger is Base32 than Base64?',
        a: 'Base32 makes data 60% larger and Base64 33% larger, because each Base32 character carries 5 bits and each Base64 character 6. In exchange you get an alphabet that ignores case and has no look-alike characters.',
      },
    ],
    related: ['totp-generator', 'base64-encoder-decoder', 'hex-to-text', 'hotp-generator'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 63 · Binary family                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: 'text-to-binary',
    title: 'Text to Binary',
    h1: 'Convert text to binary',
    description:
      'Convert text to binary with UTF-8 or ASCII, 7-bit or 8-bit groups and any separator. You can also drop in a file and translate its bytes.',
    keywords: ['text to binary translator', 'string to binary', 'binary encoder', 'ascii binary'],
    category: 'text',
    icon: 'Binary',
    faqs: [
      {
        q: 'Should I choose 7-bit or 8-bit groups?',
        a: '8-bit if the result stands for bytes, which is what a computer stores. 7-bit for a classic ASCII exercise, where the top bit was originally a parity bit.',
      },
      {
        q: 'Why does one emoji produce 32 bits?',
        a: 'In UTF-8 most emoji are four bytes, and four bytes are 32 bits. Composite emoji, such as flags, families and skin tones, are several code points joined together and can use 100 bits or more.',
      },
      {
        q: 'Is binary a form of encryption?',
        a: 'No. It is the same data written in base 2. Anyone can reverse it, also on this page, so it hides nothing.',
      },
      {
        q: 'Can I translate a whole file?',
        a: 'Yes, up to the first 64 KB. Binary uses eight characters per byte, so a 1 MB file gives eight million characters, which no browser shows comfortably.',
      },
    ],
    related: ['binary-to-text', 'binary-translator', 'text-to-hex', 'decimal-to-binary'],
    updated: UPDATED,
  },
  {
    slug: 'binary-to-text',
    title: 'Binary to Text',
    h1: 'Convert binary to text',
    description:
      'Convert binary to text. Any spacing works, UTF-8 and ASCII are supported, and each error message says what is wrong with the input.',
    keywords: ['binary decoder', 'binary to ascii', 'binary to string', 'decode binary'],
    category: 'text',
    icon: 'FileDigit',
    faqs: [
      {
        q: 'Does the spacing in my binary matter?',
        a: 'No. The tool removes each character that is not 0 or 1 before decoding, so input with spaces, commas, line breaks or no separators gives the same result.',
      },
      {
        q: 'It says my bit count is not a whole number of groups.',
        a: 'The total number of binary digits must divide by 8 (or by 7 in ASCII mode). One to seven extra bits mean a digit was lost in the copy, or the source used a different group size.',
      },
      {
        q: 'The output is question marks and boxes.',
        a: 'The bytes are valid but are not valid UTF-8, usually because the original was 7-bit ASCII or Latin-1. Switch the character set.',
      },
      {
        q: 'Can it decode binary that is not text at all?',
        a: 'It tries, and you get control characters. If the bits came from a file and not a message, the hex pages show them in a more useful form.',
      },
    ],
    related: ['text-to-binary', 'binary-translator', 'binary-to-decimal', 'hex-to-text'],
    updated: UPDATED,
  },
  {
    slug: 'binary-translator',
    title: 'Binary Translator',
    h1: 'Binary translator',
    description:
      'Binary translator that works in both directions in one box: paste text to get binary, or paste binary to get text. It detects the direction.',
    keywords: ['binary translator', 'binary code translator', 'binary converter', '01 translator'],
    category: 'text',
    icon: 'ArrowLeftRight',
    faqs: [
      {
        q: 'How does it know which way to translate?',
        a: 'If the input is only 0, 1 and whitespace, it decodes. Any other input is encoded. The swap button overrides the guess.',
      },
      {
        q: 'Why did my text of only zeros and ones get decoded?',
        a: 'Because it looks the same as binary. Use swap to force the encode direction.',
      },
      {
        q: 'What does 01001000 mean?',
        a: 'It is 72 in decimal, which is the capital letter H in ASCII and UTF-8. From right to left, the place values are 1, 2, 4, 8, 16, 32, 64 and 128. Only the 64 and 8 columns are set.',
      },
      {
        q: 'Can I use this for homework where the answer must be 7-bit?',
        a: 'Yes. Switch the character set to ASCII and pick 7 bits per character. The groups then match the classic ASCII table.',
      },
    ],
    related: ['text-to-binary', 'binary-to-text', 'decimal-to-binary', 'morse-code-translator'],
    updated: UPDATED,
  },
  {
    slug: 'decimal-to-binary',
    title: 'Decimal to Binary',
    h1: 'Convert decimal to binary',
    description:
      'Convert decimal to binary, hex and octal with each step of the repeated division shown, and two’s complement for negative numbers.',
    keywords: ['decimal to binary converter', 'base 10 to base 2', 'number to binary', 'binary math'],
    category: 'text',
    icon: 'Calculator',
    faqs: [
      {
        q: 'How does the repeated-division method work?',
        a: 'Divide the number by two and write down the remainder. Divide the quotient by two and repeat until you reach zero. The remainders, read from bottom to top, are the binary digits. The tool shows the full table for your number.',
      },
      {
        q: 'How are negative numbers represented?',
        a: 'As two’s complement, which is what hardware uses: take the positive value, invert each bit and add one. The tool shows the result at 8, 16, 32 or 64 bits, and warns when the value does not fit.',
      },
      {
        q: 'Can it handle very large numbers?',
        a: 'Yes. All arithmetic uses BigInt, so a 200-digit number converts exactly. Ordinary JavaScript numbers lose precision above about 9 quadrillion.',
      },
      {
        q: 'What about decimals like 12.5?',
        a: 'Not on this page, which handles integers. Fractional binary is a different problem: 0.1 has no finite binary representation, which causes most floating-point surprises.',
      },
    ],
    related: ['binary-to-decimal', 'text-to-binary', 'number-base-converter', 'ipv4-to-binary'],
    updated: UPDATED,
  },
  {
    slug: 'binary-to-decimal',
    title: 'Binary to Decimal',
    h1: 'Convert binary to decimal',
    description:
      'Convert binary to decimal, hex and octal, with the place-value sum written out for your number, for example 1011 = 8 + 2 + 1 = 11.',
    keywords: ['binary to decimal converter', 'base 2 to base 10', 'binary place value'],
    category: 'text',
    icon: 'Sigma',
    faqs: [
      {
        q: 'How do I convert binary to decimal by hand?',
        a: 'Give each digit a place value that doubles from the right (1, 2, 4, 8, 16), then add the values where there is a 1. The tool prints that sum with your digits.',
      },
      {
        q: 'Why is 1111 equal to 15 and not 16?',
        a: 'Because n ones equal 2ⁿ − 1. Four ones are 8 + 4 + 2 + 1 = 15. For the same reason a byte stops at 255 and a 32-bit unsigned integer at 4,294,967,295.',
      },
      {
        q: 'Does the spacing in my input matter?',
        a: 'No. Spaces, commas and underscores are ignored, so 1010 1101 and 10101101 give the same answer. Groups of four make long values easier to read.',
      },
      {
        q: 'What if my binary is a negative two’s complement value?',
        a: 'As written, it is a large positive number. Put a minus sign in front to see the two’s complement panel, which shows the bit pattern that hardware stores for that negative value.',
      },
    ],
    related: ['decimal-to-binary', 'binary-to-text', 'number-base-converter', 'hex-to-text'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 64 · Morse and NATO                                                 */
  /* ------------------------------------------------------------------ */
  {
    slug: 'morse-code-translator',
    title: 'Morse Code Translator',
    h1: 'Morse code translator',
    description:
      'Morse code translator for text to Morse and back. Play it as audio at any WPM with Farnsworth spacing, flash it as light or download a WAV.',
    keywords: ['morse code converter', 'morse audio', 'sos morse', 'learn morse code'],
    category: 'text',
    icon: 'AudioLines',
    popular: true,
    faqs: [
      {
        q: 'What is Farnsworth timing?',
        a: 'Characters are sent at full speed, and the gaps between them are longer. This stops learners from counting single dits, the habit that stops most people at about 10 WPM. Set the character speed above the overall speed to use it.',
      },
      {
        q: 'Is the audio generated on my device?',
        a: 'Yes. The Web Audio API builds the waveform sample by sample. For the download, the tab writes it into a PCM WAV file. No audio file is fetched.',
      },
      {
        q: 'What do the spaces and slashes mean?',
        a: 'One space separates letters, and a slash separates words. In a letter, the symbols run together. The formal ratios are: dot 1, dash 3, gap in a letter 1, gap between letters 3, gap between words 7.',
      },
      {
        q: 'Which characters have no Morse equivalent?',
        a: 'Most symbols and all emoji. International Morse covers A-Z, 0-9, some punctuation and a few accented letters. The tool lists other characters as skipped.',
      },
      {
        q: 'Why is SOS written as one continuous string?',
        a: 'It is a prosign: ...---... sent as one unbroken character, which is different from the three letters S, O and S. This tells a distress call apart from someone spelling a word.',
      },
    ],
    related: ['nato-phonetic-alphabet-translator', 'binary-translator', 'text-to-binary', 'fancy-text-generator'],
    updated: UPDATED,
  },
  {
    slug: 'nato-phonetic-alphabet-translator',
    title: 'NATO Phonetic Alphabet Translator',
    h1: 'NATO phonetic alphabet translator',
    description:
      'NATO phonetic alphabet translator: spell any text as Alfa Bravo Charlie and decode it back, with aviation numbers and the full ICAO table.',
    keywords: ['nato alphabet', 'phonetic alphabet converter', 'alfa bravo charlie', 'icao spelling'],
    category: 'text',
    icon: 'Megaphone',
    faqs: [
      {
        q: 'Is it Alfa or Alpha, Juliett or Juliet?',
        a: 'Alfa and Juliett. The official ICAO spellings avoid "ph" and a silent final "t", because speakers of many languages mispronounce them. Input accepts both spellings.',
      },
      {
        q: 'Why do pilots say "niner" and "tree"?',
        a: 'To keep numbers distinct over noisy radio: nine can sound like the German "nein", and three can lose its "th". Turn on aviation pronunciation to see the full set.',
      },
      {
        q: 'Is the NATO alphabet the same as the police one?',
        a: 'No. UK and US police forces use their own lists. Alpha Bravo Charlie is the same, but many letters are different. When it matters, say which alphabet you use before you spell.',
      },
      {
        q: 'Can I decode phonetic words back into letters?',
        a: 'Yes. Use the swap button. A word that is not in the ICAO alphabet becomes a question mark, so you can see where a transcription went wrong.',
      },
    ],
    related: ['morse-code-translator', 'fancy-text-generator', 'case-converter', 'text-to-binary'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 65 · Fancy text family                                              */
  /* ------------------------------------------------------------------ */
  {
    slug: 'fancy-text-generator',
    title: 'Fancy Text Generator',
    h1: 'Fancy text generator',
    description:
      'Fancy text generator with over 40 Unicode text styles, such as bold, italic, script, bubble, fullwidth and cursed. Each style has a copy button.',
    keywords: ['fancy fonts copy paste', 'unicode text styles', 'aesthetic text', 'instagram fonts'],
    category: 'text',
    icon: 'Sparkles',
    popular: true,
    faqs: [
      {
        q: 'Are these really fonts?',
        a: 'No. They are separate Unicode characters that look like styled letters. That is why they stay styled when you paste them into apps that have no formatting controls.',
      },
      {
        q: 'Why does a style show as boxes on someone else’s phone?',
        a: 'Their device has no glyph for those code points. Bold, italic, script, monospace and fullwidth are the safest on iOS, Android and Windows. The boxed and cursed sets break most often.',
      },
      {
        q: 'Will Instagram or TikTok strip the styling?',
        a: 'They cannot, because to them it is ordinary text. It stays unchanged in bios, captions and comments. Some platforms leave these characters out of search indexing, so keep your real name in plain text.',
      },
      {
        q: 'Is this accessible?',
        a: 'Not very. Screen readers often read mathematical letters one at a time or skip them. Use styled text for decoration, never for information someone needs.',
      },
      {
        q: 'Why does the same text look different in each app?',
        a: 'Each platform uses its own glyph for characters that its font does not have, so the same string can be serif on one device and sans on another. The text itself cannot control this.',
      },
    ],
    related: ['bold-text-generator', 'small-text-generator', 'strikethrough-text-generator', 'upside-down-text', 'cursed-text-generator'],
    updated: UPDATED,
  },
  {
    slug: 'bold-text-generator',
    title: 'Bold Text Generator',
    h1: 'Bold text generator',
    description:
      'Bold text generator for text you can paste into Instagram, LinkedIn, Discord or a Google Doc, in serif, sans, italic and script bold styles.',
    keywords: ['bold text copy paste', 'bold unicode', 'linkedin bold text', 'instagram bold font'],
    category: 'text',
    icon: 'Bold',
    faqs: [
      {
        q: 'Why does LinkedIn have no bold button but this still works?',
        a: 'The boldness is in the characters. LinkedIn stores your post as plain text, and these are different plain-text characters that look heavy.',
      },
      {
        q: 'Which bold style should I choose?',
        a: 'Sans-serif bold matches the interface font of most social apps, so it looks intentional. Serif bold looks more formal. Keep bold italic for a single phrase that needs emphasis.',
      },
      {
        q: 'Do bold Unicode characters hurt my reach?',
        a: 'They can. Search and hashtag indexing often ignore them, and screen readers handle them badly. Bold a heading, never the whole post.',
      },
      {
        q: 'Do numbers get bolded too?',
        a: 'Yes for the sans and serif bold sets, which have bold digits. The italic and script sets have no digits in Unicode, so numbers stay plain.',
      },
    ],
    related: ['fancy-text-generator', 'small-text-generator', 'strikethrough-text-generator', 'case-converter'],
    updated: UPDATED,
  },
  {
    slug: 'small-text-generator',
    title: 'Small Text Generator',
    h1: 'Small text generator',
    description:
      'Small text generator for small caps, superscript and subscript text for bios, footnotes and usernames, with a copy button for each style.',
    keywords: ['small text copy paste', 'tiny text generator', 'small caps unicode', 'superscript text'],
    category: 'text',
    icon: 'Subscript',
    faqs: [
      {
        q: 'What is the difference between small caps and superscript?',
        a: 'Small caps are small capital letters on the baseline, so they read as normal text. Superscript is raised and much smaller, for footnote markers and exponents.',
      },
      {
        q: 'Why are some letters not shrunk?',
        a: 'Unicode has no small-caps X and no superscript Q, so those letters stay full size.',
      },
      {
        q: 'Can I use small text for a legal disclaimer?',
        a: 'Please do not. It fails on devices without the glyphs, screen readers read it unpredictably, and in several jurisdictions terms that are made hard to read on purpose cannot be enforced.',
      },
      {
        q: 'Does small text work in usernames?',
        a: 'Sometimes. Discord and Twitter/X accept it in display names. Many platforms allow only ASCII in handles. Test before you rely on it, because a rejected name can leave you waiting out a rename cooldown.',
      },
    ],
    related: ['fancy-text-generator', 'bold-text-generator', 'upside-down-text', 'cursed-text-generator'],
    updated: UPDATED,
  },
  {
    slug: 'strikethrough-text-generator',
    title: 'Strikethrough Text Generator',
    h1: 'Strikethrough text generator',
    description:
      'Strikethrough text generator: cross out text in apps that have no formatting menu, with combining strike, slash, underline and overline marks.',
    keywords: ['strikethrough text copy paste', 'crossed out text', 'strike text unicode'],
    category: 'text',
    icon: 'Strikethrough',
    faqs: [
      {
        q: 'How does strikethrough work without any formatting?',
        a: 'Each character is followed by U+0336, a combining long stroke overlay. The font draws the line through the character before it, so the effect stays with the plain text.',
      },
      {
        q: 'Why does the line look broken between letters?',
        a: 'There is one short stroke per character, and the font decides how far each stroke goes. Proportional fonts with wide letter spacing show small gaps. Try the short-stroke variant.',
      },
      {
        q: 'Does this work in Discord and Slack?',
        a: 'Both have their own markdown for it: in Discord, put the text between double tildes. Use the native syntax where it exists. This page is for places with no formatting, such as bios and form fields.',
      },
      {
        q: 'Will search still find the crossed-out words?',
        a: 'Usually not. The combining marks change the byte sequence, so a plain-text search for the same word does not find it.',
      },
    ],
    related: ['fancy-text-generator', 'bold-text-generator', 'cursed-text-generator', 'small-text-generator'],
    updated: UPDATED,
  },
  {
    slug: 'upside-down-text',
    title: 'Upside Down Text',
    h1: 'Upside down text generator',
    description:
      'Upside down text generator: flip text with rotated Unicode look-alikes and reverse the order, so it reads correctly when the screen is turned over.',
    keywords: ['flip text', 'upside down letters', 'reverse text generator', 'rotated text'],
    category: 'text',
    icon: 'FlipVertical',
    faqs: [
      {
        q: 'How is the flip done?',
        a: 'Each character is replaced by a Unicode look-alike that looks rotated (a becomes ɐ, E becomes Ǝ). Then the whole string is reversed so the reading order is correct.',
      },
      {
        q: 'Why do a few characters stay the same?',
        a: 'Some letters are symmetrical (o, x, z), and some have no rotated form in Unicode, so they stay the same. There is no rotated Q or G that displays reliably.',
      },
      {
        q: 'Is this the same as reversed text?',
        a: 'No. Reversing changes only the order of the characters. Flipping also replaces each character, so the result reads as words when you turn the screen over.',
      },
      {
        q: 'Does punctuation flip too?',
        a: 'Yes. Full stops move to the top, question and exclamation marks become their inverted Spanish forms, and brackets change direction so pairs still enclose the right text.',
      },
    ],
    related: ['fancy-text-generator', 'reverse-text', 'cursed-text-generator', 'small-text-generator'],
    updated: UPDATED,
  },
  {
    slug: 'cursed-text-generator',
    title: 'Cursed Text Generator',
    h1: 'Cursed text generator',
    description:
      'Cursed text generator for glitchy zalgo text at three intensities, made from stacked combining marks. Heavy zalgo can get you muted in chat servers.',
    keywords: ['zalgo text', 'glitch text generator', 'cursed font', 'creepy text copy paste'],
    category: 'text',
    icon: 'Ghost',
    faqs: [
      {
        q: 'What actually makes text look cursed?',
        a: 'Stacked combining diacritics. Unicode lets any number of accents attach to one base character, and rendering engines draw all of them, so the marks pile up above and below the line.',
      },
      {
        q: 'Why does it bleed into the lines above and below?',
        a: 'Combining marks are drawn outside the character cell, and most layout engines do not reserve space for a stack of any height. That overlap makes the effect, and it is also why moderators dislike it.',
      },
      {
        q: 'Will I get muted for posting this?',
        a: 'Possibly. Most Discord servers and many forums treat heavy zalgo as disruptive, and some clients render it slowly. Light intensity is usually tolerated.',
      },
      {
        q: 'Is the output stable? Do I get the same text twice?',
        a: 'Yes. The tool places the marks from the position of each character, with no random numbers, so the same input always gives the same output.',
      },
    ],
    related: ['fancy-text-generator', 'strikethrough-text-generator', 'upside-down-text', 'bold-text-generator'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 66 · Hash family                                                    */
  /* ------------------------------------------------------------------ */
  {
    slug: 'md5-hash-generator',
    title: 'MD5 Hash Generator',
    h1: 'MD5 hash generator',
    description:
      'MD5 hash generator for text or a file of any size. Compare the MD5 checksum with a published value, and read where MD5 is still safe to use.',
    keywords: ['md5 checksum', 'md5 online', 'md5 file hash', 'verify md5'],
    category: 'security',
    icon: 'Fingerprint',
    accepts: [],
    faqs: [
      {
        q: 'Can you reverse an MD5 hash?',
        a: 'Not by computation, because hashing discards information. Short or common inputs can be found in rainbow tables, which is why MD5 must never store passwords. A large file cannot be recovered from its digest.',
      },
      {
        q: 'Is MD5 broken?',
        a: 'For security, yes: collisions have been practical since 2004 and take seconds to make. To detect accidental corruption, such as a cut-off download or a bad disk, it still works and is very fast.',
      },
      {
        q: 'Is there a file size limit?',
        a: 'No. MD5 is computed as a stream in 4 MB slices, so an 8 GB ISO uses no more memory than a small text file.',
      },
      {
        q: 'Why does WebCrypto not offer MD5?',
        a: 'It is left out on purpose because it is obsolete. This page has a small MD5 implementation in plain JavaScript, so it works with no network access.',
      },
      {
        q: 'Why does the same file give a different hash on another site?',
        a: 'Check line endings and trailing newlines. A form often changes CRLF to LF in pasted text, but a hashed file keeps its bytes. Hash the file itself, and do not paste its contents.',
      },
    ],
    related: ['sha256-hash-generator', 'sha1-hash-generator', 'crc32-calculator', 'file-hash-checker'],
    updated: UPDATED,
  },
  {
    slug: 'sha1-hash-generator',
    title: 'SHA-1 Hash Generator',
    h1: 'SHA-1 hash generator',
    description:
      'SHA-1 hash generator for text or files with the native WebCrypto API. Compare the digest with an expected value, and see why Git still uses SHA-1.',
    keywords: ['sha1 online', 'sha-1 checksum', 'sha1 file hash', 'git object hash'],
    category: 'security',
    icon: 'ShieldAlert',
    accepts: [],
    faqs: [
      {
        q: 'Is SHA-1 still safe to use?',
        a: 'Not against an attacker. Google and CWI made two colliding PDFs in 2017, and a chosen-prefix collision followed in 2020. For identification where nobody attacks, such as Git object names or legacy protocol fingerprints, it still works.',
      },
      {
        q: 'How long is a SHA-1 digest?',
        a: '160 bits, written as 40 hexadecimal characters. The length is the fastest way to identify a checksum with no label: 8 is CRC-32, 32 is MD5, 40 is SHA-1, 64 is SHA-256.',
      },
      {
        q: 'Why does my Git commit hash not match this?',
        a: 'Git hashes a header plus the content. For a blob, that is the string "blob <length>\\0" and then the bytes. The file alone gives a different digest.',
      },
      {
        q: 'Which algorithm should I use instead?',
        a: 'SHA-256 for anything new. Every platform has it, modern CPUs accelerate it in hardware, and it has no known weaknesses. The comparison table on this page switches with one click.',
      },
    ],
    related: ['sha256-hash-generator', 'md5-hash-generator', 'sha512-hash-generator', 'hmac-generator'],
    updated: UPDATED,
  },
  {
    slug: 'sha256-hash-generator',
    title: 'SHA-256 Hash Generator',
    h1: 'SHA-256 hash generator',
    description:
      'SHA-256 hash generator for text or files with WebCrypto. Verify a download by pasting the SHA-256 checksum that its publisher lists.',
    keywords: ['sha256 online', 'sha-256 checksum', 'verify sha256', 'file integrity check'],
    category: 'security',
    icon: 'ShieldCheck',
    popular: true,
    accepts: [],
    faqs: [
      {
        q: 'How do I verify a download with SHA-256?',
        a: 'Drop the downloaded file on the File tab, paste the checksum from the publisher into the compare box, and look for the match banner. Case and spacing are ignored.',
      },
      {
        q: 'Does a matching checksum prove the file is safe?',
        a: 'It proves that the bytes match what the publisher hashed. If an attacker controls the file and the page that lists the checksum, both change together. Signed releases exist for this reason.',
      },
      {
        q: 'Is SHA-256 good for storing passwords?',
        a: 'No. It is far too fast: a GPU tries billions of guesses per second. Passwords need a slow function such as bcrypt, scrypt or Argon2, with a salt for each user.',
      },
      {
        q: 'Why is a big file slower here than on the command line?',
        a: 'Native tools use the SHA instructions of your processor, and WebAssembly cannot. This page reads the file in slices on a background core, so memory use stays flat for a file of any size.',
      },
      {
        q: 'Is SHA-256 the same as SHA-2?',
        a: 'SHA-2 is the family. SHA-256, SHA-384 and SHA-512 are members, with different digest lengths and internal word sizes. SHA-3 is a separate, newer design, and WebCrypto does not offer it.',
      },
    ],
    related: ['sha512-hash-generator', 'md5-hash-generator', 'hmac-generator', 'file-hash-checker'],
    updated: UPDATED,
  },
  {
    slug: 'sha512-hash-generator',
    title: 'SHA-512 Hash Generator',
    h1: 'SHA-512 hash generator',
    description:
      'SHA-512 hash generator for 512-bit SHA-2 digests of text or files, with an expected-value check and the other hash algorithms next to it.',
    keywords: ['sha512 online', 'sha-512 checksum', 'sha2 512', 'long hash generator'],
    category: 'security',
    icon: 'Lock',
    accepts: [],
    faqs: [
      {
        q: 'Is SHA-512 slower than SHA-256?',
        a: 'On 64-bit hardware it is usually faster, even with the longer output, because it works on 64-bit words. On 32-bit devices, and where the CPU has SHA-256 instructions, SHA-256 is faster.',
      },
      {
        q: 'Do I need 512 bits of digest?',
        a: 'Rarely. SHA-256 already puts a collision search far out of reach. People choose SHA-512 for long-term archive integrity, for compliance rules, and as the base of SHA-512/256.',
      },
      {
        q: 'How long is the output?',
        a: '128 hexadecimal characters. If a field rejects it, the system probably expects SHA-256. This mismatch is common when you copy a checksum between tools.',
      },
      {
        q: 'Can I hash a file?',
        a: 'Yes, on the File tab, with a progress bar. It gives the same result as sha512sum on the command line.',
      },
    ],
    related: ['sha256-hash-generator', 'sha1-hash-generator', 'md5-hash-generator', 'hmac-generator'],
    updated: UPDATED,
  },
  {
    slug: 'crc32-calculator',
    title: 'CRC32 Calculator',
    h1: 'CRC-32 checksum calculator',
    description:
      'CRC32 calculator for the CRC-32 checksum of text or a file, in hex and decimal. ZIP archives and PNG chunks use this checksum to detect corruption.',
    keywords: ['crc32 online', 'crc checksum', 'zip crc', 'crc-32 hex'],
    category: 'security',
    icon: 'CircleDot',
    accepts: [],
    faqs: [
      {
        q: 'Which CRC-32 variant is this?',
        a: 'The IEEE 802.3 polynomial 0xEDB88320, reflected, with an initial and final value of 0xFFFFFFFF. ZIP, gzip, PNG and Ethernet use it. CRC-32C (Castagnoli) has a different polynomial and gives different results.',
      },
      {
        q: 'Is a CRC a hash?',
        a: 'No. It is an error-detecting code. It is easy to make a different file with the same CRC, so a CRC finds accidental errors on a wire or a disk, but it does not protect against tampering.',
      },
      {
        q: 'Why does my ZIP tool show a different value?',
        a: 'The CRC of a ZIP entry covers the uncompressed contents of one file in the archive. It does not cover the archive file. Extract the file first, then calculate its CRC.',
      },
      {
        q: 'Hex or decimal: which do I need?',
        a: 'Most tools print hex, as eight lowercase characters. Some libraries give the same value as an unsigned decimal integer, so the tool shows both.',
      },
    ],
    related: ['md5-hash-generator', 'sha256-hash-generator', 'file-hash-checker', 'hmac-generator'],
    updated: UPDATED,
  },
  {
    slug: 'hmac-generator',
    title: 'HMAC Generator',
    h1: 'HMAC generator',
    description:
      'HMAC generator for HMAC-SHA1, SHA-256, SHA-384 and SHA-512 codes from a secret key and a message, in hex or Base64, to debug webhook signatures.',
    keywords: ['hmac sha256', 'webhook signature', 'hmac online', 'stripe signature verify'],
    category: 'security',
    icon: 'KeySquare',
    accepts: [],
    faqs: [
      {
        q: 'What does HMAC add over a plain hash?',
        a: 'A key. Anyone can compute the SHA-256 of a message, so a bare hash does not prove who sent it. HMAC mixes a shared secret into the hash in a nested construction, so only someone with the key can make a valid code.',
      },
      {
        q: 'My webhook signature will not match. What is wrong?',
        a: 'Nearly always the message bytes. Sign the exact raw body, before any JSON parse and re-serialisation, with any trailing newline. Many providers also put a timestamp and a dot before the payload.',
      },
      {
        q: 'Which key format should I pick?',
        a: 'Use the format the provider gave you. Stripe and GitHub secrets are UTF-8 text. AWS derives a binary key, which you give as hex or Base64. The wrong format gives a wrong code with no error.',
      },
      {
        q: 'Is it safe to paste a production signing secret here?',
        a: 'The secret stays in the tab: WebCrypto runs on your device and the page has no network access. Still use a test key where you can, because a person or a screenshot tool can capture anything on screen.',
      },
      {
        q: 'Should I compare signatures with a simple equality check?',
        a: 'Not in production code. Use a constant-time comparison so that timing does not leak information. On this page the comparison is for debugging, so a plain check is fine.',
      },
    ],
    related: ['sha256-hash-generator', 'totp-generator', 'jwt-decoder', 'md5-hash-generator'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 67 · TOTP / HOTP                                                    */
  /* ------------------------------------------------------------------ */
  {
    slug: 'totp-generator',
    title: 'TOTP Generator',
    h1: 'TOTP / 2FA code generator',
    description:
      'TOTP generator for a 2FA secret, its enrollment QR code and the live 30-second code. It also verifies codes, works offline and stores nothing.',
    keywords: ['2fa code generator', 'totp online', 'authenticator code', 'otpauth qr'],
    category: 'security',
    icon: 'ShieldCheck',
    popular: true,
    faqs: [
      {
        q: 'Is it safe to put a 2FA secret into a web page?',
        a: 'The risk is that a page sends the secret to a server, and this page cannot: the QR code is drawn on your device, the HMAC runs in WebCrypto, and the Content-Security-Policy allows no external origin. The tool also works with Wi-Fi off. Never paste a live secret into a page that fails these tests.',
      },
      {
        q: 'Why does my code differ from my phone?',
        a: 'Clock skew or different settings. TOTP comes from the current 30-second window, so a phone clock that is a few seconds off gives different codes. Also check the digits and the algorithm: Google Authenticator supports only SHA1 with 6 digits.',
      },
      {
        q: 'What is inside the otpauth:// URI?',
        a: 'The Base32 secret, the issuer and account labels, the algorithm, the digit count and the period. Scanning the QR code gives the authenticator app that string and nothing else.',
      },
      {
        q: 'How is the code actually computed?',
        a: 'Take the Unix time divided by 30 as a 64-bit counter and HMAC it with the secret. Then truncate the result dynamically to a 31-bit number and take it modulo 10⁶. That is RFC 6238.',
      },
      {
        q: 'Does this replace my authenticator app?',
        a: 'No. Nothing is stored here: refresh the page and the secret is gone. Use it to test an integration, check a code, or recover a secret you already have.',
      },
    ],
    related: ['hotp-generator', 'base32-encoder-decoder', 'hmac-generator', 'qr-code-generator'],
    updated: UPDATED,
  },
  {
    slug: 'hotp-generator',
    title: 'HOTP Generator',
    h1: 'HOTP counter-based code generator',
    description:
      'HOTP generator for RFC 4226 counter-based one-time passwords. Step the counter by hand and resynchronise a token that drifted with a look-ahead check.',
    keywords: ['hotp online', 'rfc 4226', 'counter otp', 'yubikey oath hotp'],
    category: 'security',
    icon: 'KeyRound',
    faqs: [
      {
        q: 'How is HOTP different from TOTP?',
        a: 'The counter. HOTP moves forward only when a code is generated. TOTP gets the counter from the clock. So HOTP suits hardware with no battery-backed clock, and its codes stay valid until used.',
      },
      {
        q: 'What is counter drift and how do I fix it?',
        a: 'If a token generates codes that nobody submits, its counter gets ahead of the server. So servers accept a window of the next counters and resynchronise on a match. This page checks ten steps ahead and tells you the value to set.',
      },
      {
        q: 'Which is more secure?',
        a: 'Each has trade-offs. A TOTP code expires in under a minute. An HOTP code stays valid until used, so an intercepted code keeps working. HOTP has no clock-sync failures. Most services use TOTP.',
      },
      {
        q: 'Can I use an existing YubiKey OATH secret?',
        a: 'Yes, if you have the Base32 secret: paste it and set the counter. You cannot read the secret out of the key, which is the purpose of the hardware.',
      },
    ],
    related: ['totp-generator', 'base32-encoder-decoder', 'hmac-generator', 'password-generator'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 68 · Subnetting family                                              */
  /* ------------------------------------------------------------------ */
  {
    slug: 'subnet-calculator',
    title: 'Subnet Calculator',
    h1: 'IP subnet and CIDR calculator',
    description:
      'Subnet calculator for IPv4 and IPv6: mask, wildcard, network, broadcast, host range and count, a binary view, VLSM splits and cloud reserved hosts.',
    keywords: ['cidr calculator', 'subnet mask calculator', 'vlsm', 'ipv6 subnet'],
    category: 'dev',
    icon: 'Network',
    popular: true,
    faqs: [
      {
        q: 'Why does a /24 give 254 usable hosts, not 256?',
        a: 'The first address identifies the network and the last is the broadcast address, so neither is usable. 2⁸ = 256 in total, minus 2, is 254.',
      },
      {
        q: 'Why does AWS say my /24 has 251 hosts?',
        a: 'AWS, Azure and GCP each reserve five addresses in each subnet: the network address, the router, a DNS resolver, one for future use, and the broadcast address. Turn on cloud mode to see that count.',
      },
      {
        q: 'Is a /31 really usable?',
        a: 'Yes, on point-to-point links. RFC 3021 makes both addresses in a /31 host addresses, because a link between two nodes needs no broadcast address. Most router platforms support it.',
      },
      {
        q: 'Does this look up who owns an address?',
        a: 'No. WHOIS and geolocation need a network call, and this site makes none. The tool does arithmetic on the bits you type.',
      },
      {
        q: 'How do I plan a VLSM split?',
        a: 'Start with the largest subnet you need and take it from the start of the block. Then cut the next size from what is left. The split table lists each subnet at a chosen prefix, so you can allocate from it.',
      },
    ],
    related: ['cidr-to-ip-range', 'ip-range-to-cidr', 'ipv4-to-binary', 'number-base-converter'],
    updated: UPDATED,
  },
  {
    slug: 'cidr-to-ip-range',
    title: 'CIDR to IP Range',
    h1: 'CIDR to IP range',
    description:
      'CIDR to IP range: expand a CIDR block into its first and last address, host range, mask and total count for firewall rules and allowlists.',
    keywords: ['cidr to range', 'cidr expander', 'ip block range', 'firewall allowlist'],
    category: 'dev',
    icon: 'Route',
    faqs: [
      {
        q: 'What range does 10.0.0.0/8 actually cover?',
        a: '10.0.0.0 through 10.255.255.255, which is 16,777,216 addresses. The /8 fixes the first eight bits and leaves 24 host bits, and 2²⁴ is that total.',
      },
      {
        q: 'Does the range include the network and broadcast addresses?',
        a: 'The address range does, and the host range does not. The tool lists both, because a firewall rule usually needs the full range and a DHCP pool needs the host range.',
      },
      {
        q: 'Can I paste a dotted mask instead of a prefix?',
        a: 'Yes, 192.168.1.0/255.255.255.0 works. Non-contiguous masks such as 255.0.255.0 are not valid CIDR, and the tool rejects them with an explanation.',
      },
      {
        q: 'What does /32 mean in a rule?',
        a: 'Exactly one address. It is the usual way to write a single host in a firewall or route table. The IPv6 equivalent is /128.',
      },
    ],
    related: ['subnet-calculator', 'ip-range-to-cidr', 'ipv4-to-binary', 'chmod-calculator'],
    updated: UPDATED,
  },
  {
    slug: 'ip-range-to-cidr',
    title: 'IP Range to CIDR',
    h1: 'IP range to CIDR',
    description:
      'IP range to CIDR: convert a start and end address into the smallest exact set of CIDR blocks for security groups, firewalls and route tables.',
    keywords: ['range to cidr', 'ip range converter', 'cidr aggregation', 'summarise ip range'],
    category: 'dev',
    icon: 'Waypoints',
    faqs: [
      {
        q: 'Why does one range need several CIDR blocks?',
        a: 'A CIDR block must start on an address aligned to its own size. An arbitrary range rarely lines up, so a series of aligned blocks covers it. The algorithm always finds the smallest such set.',
      },
      {
        q: 'Is the result exact, or does it over-cover?',
        a: 'Exact. Each block is inside the range you gave, and together they cover all of it. No address outside the range is included, which matters when the output becomes a firewall rule.',
      },
      {
        q: 'Why do I need this for AWS?',
        a: 'Security groups, NACLs and route tables accept only CIDR. If a vendor lists its egress IPs as a range, this conversion gets them into the rule.',
      },
      {
        q: 'What if the end address is before the start?',
        a: 'You get a clear error. Swap the two values: a reversed range is almost always a typo in one octet.',
      },
    ],
    related: ['cidr-to-ip-range', 'subnet-calculator', 'ipv4-to-binary', 'crontab-generator'],
    updated: UPDATED,
  },
  {
    slug: 'ipv4-to-binary',
    title: 'IPv4 to Binary',
    h1: 'IPv4 address to binary',
    description:
      'IPv4 to binary converter: see an IPv4 address in binary, hex, octal and as a 32-bit integer, octet by octet, with the place-value arithmetic.',
    keywords: ['ip to binary', 'ipv4 binary converter', 'ip decimal integer', 'dotted binary'],
    category: 'dev',
    icon: 'Binary',
    faqs: [
      {
        q: 'Why convert an IP to binary at all?',
        a: 'Subnetting is a bitwise operation. When you see the address and the mask as bit patterns, it is clear how the AND makes the network address, and you do not have to memorise it.',
      },
      {
        q: 'What is the 32-bit integer form for?',
        a: 'Databases and log pipelines often store addresses as one unsigned integer, because it sorts and range-queries much faster than a string. 192.168.1.1 is 3232235777.',
      },
      {
        q: 'Why are there always eight bits per octet?',
        a: 'Each octet is one byte, and a byte is eight bits. That is also why the maximum value is 255: eight ones is 2⁸ − 1.',
      },
      {
        q: 'Does it work for addresses with a prefix?',
        a: 'Yes. Add /24 or a dotted mask, and the tool breaks the mask down next to the address, so you can see which bits it fixes.',
      },
    ],
    related: ['subnet-calculator', 'decimal-to-binary', 'cidr-to-ip-range', 'binary-to-decimal'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ */
  /* 69-70 · Sysadmin calculators                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'chmod-calculator',
    title: 'Chmod Calculator',
    h1: 'Chmod permissions calculator',
    description:
      'Chmod calculator: tick a permission grid to get the octal and symbolic mode, the setuid, setgid and sticky bits, and chmod commands to copy.',
    keywords: ['chmod 755', 'file permissions calculator', 'octal permissions', 'chmod symbolic'],
    category: 'dev',
    icon: 'FolderCog',
    faqs: [
      {
        q: 'What do 644 and 755 mean?',
        a: '644 is read and write for the owner and read for everyone else, the normal mode for a file. 755 adds execute for all three classes. A script needs it to run, and a directory needs it to be entered.',
      },
      {
        q: 'Why is 777 a bad idea?',
        a: 'Every account on the machine can then change the file. On a web server, any compromised process can then rewrite your code. Fix ownership with chown, or give write access to the group.',
      },
      {
        q: 'What does execute mean on a directory?',
        a: 'Permission to traverse it, which means to reach the files in it. Read without execute lets you list the names but not open anything. Execute without read lets you open a file only if you know its exact name.',
      },
      {
        q: 'When would I use the sticky bit?',
        a: 'On a shared writable directory such as /tmp. With the sticky bit set, users can create files, but only the owner of a file can delete it. This stops one user from removing the work of another.',
      },
      {
        q: 'What is the difference between chmod u+x and chmod u=rwx?',
        a: 'The plus form adds a permission and keeps the others. The equals form sets that class exactly and clears anything not listed. This page generates the equals form because it is unambiguous.',
      },
    ],
    related: ['octal-to-text', 'crontab-generator', 'subnet-calculator', 'number-base-converter'],
    updated: UPDATED,
  },
  {
    slug: 'crontab-generator',
    title: 'Crontab Generator',
    h1: 'Crontab expression generator',
    description:
      'Crontab generator: build a cron expression from dropdowns, read it back in plain English, and see the next ten run times in any timezone.',
    keywords: ['cron generator', 'crontab builder', 'cron expression', 'cron schedule'],
    category: 'dev',
    icon: 'CalendarClock',
    faqs: [
      {
        q: 'What are the five fields, in order?',
        a: 'Minute, hour, day of month, month, day of week. A common mistake is to treat the third field as day of week. Day of week is the fifth field, and 0 and 7 both mean Sunday.',
      },
      {
        q: 'What happens when I set both day-of-month and day-of-week?',
        a: 'The job runs when either one matches. So 0 0 13 * 5 runs on every 13th and on every Friday. For "Friday the 13th", the command itself must check the day of week.',
      },
      {
        q: 'Which timezone does cron use?',
        a: 'The timezone of the server, unless a CRON_TZ line or a systemd timer sets another. This is the most common cause of a job that runs an hour off after a daylight-saving change. Pick the server timezone in the selector to preview it.',
      },
      {
        q: 'Why does my job not run even though the schedule is right?',
        a: 'Almost always the environment. cron runs with a minimal PATH and no shell profile. Use absolute paths for the interpreter and the script, and send the output to a log so that you can see failures.',
      },
      {
        q: 'Is Quartz cron the same thing?',
        a: 'No. Quartz adds a seconds field, uses ? in the day field that is not constrained, and numbers weekdays 1-7 from Sunday. Quartz mode here adds the seconds field, but run times use Unix rules.',
      },
    ],
    related: ['cron-expression-parser', 'chmod-calculator', 'subnet-calculator', 'ip-range-to-cidr'],
    updated: UPDATED,
  },
]
