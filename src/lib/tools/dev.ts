import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'json-formatter',
    title: 'JSON Formatter',
    h1: 'JSON formatter, validator and minifier',
    description:
      'JSON formatter and validator: beautify or minify JSON, see the line and column of the first error, sort keys and generate TypeScript interfaces.',
    keywords: [
      'json beautifier',
      'json validator',
      'json pretty print',
      'minify json',
      'json lint',
      'json to typescript',
      'sort json keys',
      'json escape',
    ],
    category: 'dev',
    icon: 'Braces',
    popular: true,
    accepts: ['json', 'txt'],
    faqs: [
      {
        q: 'Why does my JSON fail to parse when it looks fine?',
        a: 'The usual causes are a trailing comma before a closing brace or bracket, single quotes in place of double quotes, unquoted keys, or a comment. The error panel gives the line, column and character offset of the first problem.',
      },
      {
        q: 'Is my JSON uploaded anywhere?',
        a: 'No. Parsing, formatting and validation run in JavaScript in this tab. Nothing is sent, so API responses with customer data or access tokens are safe to paste.',
      },
      {
        q: 'How large a document can it handle?',
        a: 'Documents of tens of megabytes work on a normal laptop. The limit is the memory of your browser tab. Minify is faster than beautify on very large files, because beautify writes more characters than it reads.',
      },
      {
        q: 'What does the TypeScript interface generator produce?',
        a: 'It reads the parsed value and makes a named interface for each nested object. It merges the shapes of array elements and marks a field optional when some elements do not have it. Mixed types become unions.',
      },
      {
        q: 'Does sorting keys change the meaning of my JSON?',
        a: 'No. Member order in a JSON object has no meaning, so sorted keys are safe for comparison and diffs. Array order has meaning, and the tool never changes it.',
      },
    ],
    related: ['json-viewer', 'json-to-csv', 'diff-checker-code', 'base64-encoder-decoder', 'jwt-decoder'],
    updated: '2026-11-01',
  },
  {
    slug: 'base64-encoder-decoder',
    title: 'Base64 Encoder / Decoder',
    h1: 'Base64 encoder and decoder',
    description:
      'Base64 encoder and decoder for text and files. It encodes UTF-8 text correctly, makes data URIs and can use the URL-safe alphabet from RFC 4648.',
    keywords: [
      'base64 encode',
      'base64 decode',
      'base64 to file',
      'file to base64',
      'data uri generator',
      'base64url',
      'image to base64',
    ],
    category: 'dev',
    icon: 'Binary',
    popular: true,
    faqs: [
      {
        q: 'Why do accented or emoji characters break in other Base64 tools?',
        a: 'They call btoa() directly, which accepts only code points below 256. This tool encodes text to UTF-8 bytes first, so "café", "日本語" and emoji round-trip exactly.',
      },
      {
        q: 'What is the difference between standard and URL-safe Base64?',
        a: 'URL-safe Base64 (RFC 4648 §5) replaces + with - and / with _ and usually drops the = padding, so the result can sit in a URL path or query string untouched. JWTs use this variant.',
      },
      {
        q: 'How do I turn an image into a data URI for CSS?',
        a: 'Switch to File mode, drop the image in, and copy the data URI. It has the correct MIME type prefix, so you can paste it into a CSS url() or an img src attribute.',
      },
      {
        q: 'Does Base64 encrypt anything?',
        a: 'No. Base64 is an encoding, and anyone can decode it in a second. Use it to move binary data through text channels, never to protect a secret.',
      },
      {
        q: 'Is there a file size limit?',
        a: 'Only your available memory. Base64 output is about 33% larger than the input, so a 100 MB file becomes about 133 MB of text. Most browsers handle that, but the output is slow to display.',
      },
    ],
    related: ['url-encoder-decoder', 'jwt-decoder', 'hash-generator', 'html-entity-encoder', 'json-formatter'],
    updated: '2026-11-01',
  },
  {
    slug: 'url-encoder-decoder',
    title: 'URL Encoder / Decoder',
    h1: 'URL encoder and decoder',
    description:
      'URL encoder and decoder with encodeURIComponent or encodeURI. It also splits a query string into a table of parameters that you can edit and rebuild.',
    keywords: [
      'percent encoding',
      'urlencode',
      'urldecode',
      'encodeuricomponent',
      'query string parser',
      'url escape',
      'uri decode',
    ],
    category: 'dev',
    icon: 'Link2',
    faqs: [
      {
        q: 'What is the difference between encodeURI and encodeURIComponent?',
        a: 'encodeURI keeps the characters that give a URL its structure (: / ? # & =) intact, so it is for encoding a whole URL. encodeURIComponent escapes those too, so it is for a single query value or path segment.',
      },
      {
        q: 'Why does decoding fail with "URI malformed"?',
        a: 'A percent sign must have two hexadecimal digits after it, and multi-byte UTF-8 sequences must be complete. A bare % or a cut-off %E2%82 causes the error. The tool shows the position of the problem.',
      },
      {
        q: 'Should spaces be %20 or +?',
        a: 'Inside a path, %20. Inside an application/x-www-form-urlencoded query string, + is also accepted for a space. The query-string tab lets you pick which convention to emit.',
      },
      {
        q: 'Can I edit individual query parameters?',
        a: 'Yes. Paste a URL or query string into the query-string tab, and each parameter shows as a row that you can edit. Change, add or delete rows, and the rebuilt URL updates with correct encoding.',
      },
    ],
    related: ['base64-encoder-decoder', 'html-entity-encoder', 'json-formatter', 'jwt-decoder', 'uuid-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'jwt-decoder',
    title: 'JWT Decoder',
    h1: 'JWT decoder and HS256 verifier',
    description:
      'JWT decoder for the header, payload and signature, with each claim in plain English and HS256/384/512 verification. The token stays in your browser.',
    keywords: [
      'jwt debugger',
      'decode jwt',
      'json web token',
      'jwt verify hs256',
      'jwt expiry',
      'bearer token decoder',
      'jwt claims',
    ],
    category: 'dev',
    icon: 'KeyRound',
    popular: true,
    faqs: [
      {
        q: 'Is it safe to paste a real access token here?',
        a: 'Safer than on a site that runs a server. This page is static, has no network code, and decodes the token in your tab. Even so, be ready to rotate any token that you paste into any tool.',
      },
      {
        q: 'Does decoding a JWT prove it is valid?',
        a: 'No. Anyone can read a JWT payload, because it is only Base64url encoded. A token is valid when the signature matches the issuer key and the time claims are in range. The tool shows these two checks separately.',
      },
      {
        q: 'Which algorithms can be verified here?',
        a: 'The HMAC family (HS256, HS384 and HS512), with WebCrypto and a shared secret that you supply. RS, ES and PS algorithms need the issuer public key and asymmetric key parsing, which this page does not do.',
      },
      {
        q: 'What do exp, iat and nbf mean?',
        a: 'They are NumericDate claims in seconds since 1970-01-01 UTC. iat is when the token was issued, nbf is the earliest time it may be accepted, and exp is when it stops being valid. Each shows as a local time and as a distance from now.',
      },
      {
        q: 'Why does my token show as expired when the server accepts it?',
        a: 'Usually clock skew. Most verifiers allow a small margin, often 30 to 60 seconds, around exp and nbf. Make sure the clock of your device is correct before you suspect the token.',
      },
    ],
    related: ['base64-encoder-decoder', 'hash-generator', 'json-formatter', 'uuid-generator', 'password-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'hash-generator',
    title: 'Hash Generator',
    h1: 'MD5, SHA-1 and SHA-256 hash generator',
    description:
      'Hash generator for MD5, SHA-1, SHA-256, SHA-384 and SHA-512 checksums of text or any file. Paste an expected hash to verify a download.',
    keywords: [
      'md5 generator',
      'sha256 online',
      'checksum calculator',
      'file hash',
      'sha1 hash',
      'verify checksum',
      'sha512',
    ],
    category: 'dev',
    icon: 'Fingerprint',
    faqs: [
      {
        q: 'Can I hash a large ISO or archive?',
        a: 'Yes, with a limit. The tool reads files in 4 MB slices with a progress bar. MD5 is calculated slice by slice, so file size does not matter for it. WebCrypto has no streaming interface for SHA, so the SHA digests need the whole file in memory. A file of several gigabytes can use up the memory of the tab. For a file that large, select MD5 only.',
      },
      {
        q: 'Why offer MD5 and SHA-1 if they are broken?',
        a: 'Both are broken for signatures, but many downloads still publish them as checksums, and legacy databases store them. Use them to match an existing value, and use SHA-256 for anything new.',
      },
      {
        q: 'How do I verify a downloaded file?',
        a: 'Pick the algorithm the publisher used, drop the file in, and paste their published value into the compare box. The tool compares the two strings in constant-time style and reports a match or a mismatch.',
      },
      {
        q: 'Does the file get uploaded to check the hash?',
        a: 'No. WebAssembly workers in this tab hash the file on your device. The file stays on your machine.',
      },
      {
        q: 'Why does the same text give a different hash elsewhere?',
        a: 'Almost always a trailing newline or a different text encoding. This tool hashes the exact UTF-8 bytes in the box and adds no newline.',
      },
    ],
    related: ['uuid-generator', 'password-generator', 'base64-encoder-decoder', 'jwt-decoder', 'json-formatter', 'file-integrity-comparison'],
    updated: '2026-11-01',
  },
  {
    slug: 'uuid-generator',
    title: 'UUID Generator',
    h1: 'UUID generator (v4 and v7)',
    description:
      'UUID generator for random v4 and time-ordered v7 UUIDs in bulk, in the format you choose. It also validates any UUID and detects its version.',
    keywords: [
      'guid generator',
      'uuid v4',
      'uuid v7',
      'bulk uuid',
      'random id generator',
      'uuid validator',
      'nil uuid',
    ],
    category: 'dev',
    icon: 'Dices',
    faqs: [
      {
        q: 'What is the difference between UUID v4 and v7?',
        a: 'v4 is 122 random bits with no structure. v7 puts a 48-bit Unix millisecond timestamp first and fills the rest with random bits, so v7 values sort by time. That is better for a database B-tree index.',
      },
      {
        q: 'Are these UUIDs random enough to use in production?',
        a: 'Yes. The random bits come from crypto.getRandomValues, the cryptographically secure generator that is also used for key material. The tool never uses Math.random.',
      },
      {
        q: 'Could two generated UUIDs ever collide?',
        a: 'In practice, no. With 122 random bits, you must generate about 2.7 × 10^18 v4 UUIDs for a 50% chance of one collision. v7 values are also separated by millisecond.',
      },
      {
        q: 'Does a v7 UUID leak information?',
        a: 'It contains the creation time to the millisecond, and anyone who has the identifier can read it. That is usually harmless. Use v4 where the creation time is sensitive.',
      },
      {
        q: 'What does the validator check?',
        a: 'It checks that the string has 32 hexadecimal digits in the 8-4-4-4-12 layout (braces and missing hyphens are accepted). Then it reads the version nibble and the variant bits, and decodes the timestamp of v1, v6 and v7.',
      },
    ],
    related: ['hash-generator', 'password-generator', 'random-number-generator', 'json-formatter', 'jwt-decoder'],
    updated: '2026-11-01',
  },
  {
    slug: 'regex-tester',
    title: 'Regex Tester',
    h1: 'Regex tester and debugger',
    description:
      'Regex tester for JavaScript regular expressions. It highlights matches as you type and shows capture groups, named groups, flags and a replace preview.',
    keywords: [
      'regular expression tester',
      'regex debugger',
      'regex match',
      'regex replace',
      'named capture groups',
      'regex cheatsheet',
      'javascript regex',
    ],
    category: 'dev',
    icon: 'Regex',
    faqs: [
      {
        q: 'Which regex flavour does this use?',
        a: 'The JavaScript (ECMAScript) engine in your browser, so the results match your front-end or Node code. PCRE-only constructs such as atomic groups or recursion are not supported.',
      },
      {
        q: 'What happens if my pattern hangs the browser?',
        a: 'Nested quantifiers can cause catastrophic backtracking. Matching runs with a time budget and a match-count cap. When the budget runs out, the run stops and a warning names the likely cause, so the tab does not freeze.',
      },
      {
        q: 'How do I use named capture groups?',
        a: 'Write (?<name>…) in the pattern and use $<name> in the replacement. Named groups get their own column in the match table next to the numbered groups.',
      },
      {
        q: 'What does the y (sticky) flag do?',
        a: 'It anchors each attempt at lastIndex, so a match succeeds only if it starts exactly where the previous match ended. It is useful for hand-written tokenisers and gives far fewer matches than g on the same pattern.',
      },
      {
        q: 'Is my test data sent anywhere?',
        a: 'No. Your browser RegExp engine evaluates the pattern and the text. Nothing is logged or sent, so production log samples are safe to paste.',
      },
    ],
    related: ['find-and-replace', 'json-formatter', 'diff-checker-code', 'cron-expression-parser', 'url-encoder-decoder', 'html-entity-encoder'],
    updated: '2026-11-01',
  },
  {
    slug: 'color-converter',
    title: 'Color Converter',
    h1: 'HEX, RGB, HSL and OKLCH color converter',
    description:
      'Color converter for HEX, RGB, HSL, HSV, OKLCH and CMYK. It checks WCAG contrast against the AA and AAA levels and makes tint and shade scales.',
    keywords: [
      'hex to rgb',
      'rgb to hex',
      'hsl converter',
      'oklch converter',
      'cmyk converter',
      'wcag contrast checker',
      'color picker',
      'tints and shades',
    ],
    category: 'dev',
    icon: 'Palette',
    faqs: [
      {
        q: 'What is OKLCH and why should I care?',
        a: 'OKLCH is a perceptually uniform colour space: equal changes in lightness or chroma look equally different to the eye. Palettes and hover states made in OKLCH are more consistent than the same maths in HSL.',
      },
      {
        q: 'How is the contrast ratio calculated?',
        a: 'By the WCAG 2.1 formula: linearise each channel, take the relative luminance, then (L_lighter + 0.05) / (L_darker + 0.05). The result runs from 1:1 to 21:1 and is shown against the AA and AAA thresholds.',
      },
      {
        q: 'What contrast ratio do I need to pass?',
        a: 'AA needs 4.5:1 for normal text and 3:1 for large text (18pt, or 14pt bold) and UI components. AAA needs 7:1 and 4.5:1. Each level has its own pass or fail badge.',
      },
      {
        q: 'Why does my CMYK value not match my printer?',
        a: 'The tool uses the simple device-independent conversion with no ICC profile. Print output depends on ink, paper and profile, so use the CMYK values as a starting point and check a proof for important work.',
      },
      {
        q: 'Does it support alpha?',
        a: 'Yes. Eight-digit hex, rgba() and hsla() all parse, and each output format that can show alpha keeps it.',
      },
    ],
    related: ['css-gradient-generator', 'color-palette-generator', 'html-entity-encoder', 'json-formatter', 'svg-to-png'],
    updated: '2026-11-01',
  },
  {
    slug: 'html-entity-encoder',
    title: 'HTML Entity Encoder',
    h1: 'HTML entity encoder and decoder',
    description:
      'HTML entity encoder and decoder for named and numeric entities. A minimal mode escapes only the five characters that HTML requires.',
    keywords: [
      'html escape',
      'html unescape',
      'entity decoder',
      'nbsp',
      'html special characters',
      'numeric character reference',
      'xml escape',
    ],
    category: 'dev',
    icon: 'CodeXml',
    faqs: [
      {
        q: 'Which characters actually need escaping in HTML?',
        a: 'In element text, only the ampersand and the less-than sign. In a double-quoted attribute, also the double quote. Most people escape the ampersand, both angle brackets and both quote characters, and the minimal mode does exactly that.',
      },
      {
        q: 'Named or numeric entities: which should I use?',
        a: 'Numeric references such as &#8212; work in every parser and need no entity table. Named references such as &mdash; are easier to read. The tool decodes both. Use the form your codebase already uses.',
      },
      {
        q: 'Does escaping HTML make my page safe from XSS?',
        a: 'Escaping is necessary, but it is not enough. It stops text from being read as markup, but a value in a script block, an inline event handler or a URL attribute needs its own escaping for that context.',
      },
      {
        q: 'How are emoji and other astral characters handled?',
        a: 'Each one is treated as a whole code point, never as two UTF-16 halves, so an emoji becomes one numeric reference such as &#128512; and decodes back to the same character.',
      },
    ],
    related: ['url-encoder-decoder', 'base64-encoder-decoder', 'html-to-markdown', 'json-formatter', 'regex-tester'],
    updated: '2026-11-01',
  },
  {
    slug: 'cron-expression-parser',
    title: 'Cron Expression Parser',
    h1: 'Cron expression parser and builder',
    description:
      'Cron expression parser: translate a 5- or 6-field cron expression into plain English, check each field and see the next ten run times.',
    keywords: [
      'crontab generator',
      'cron schedule',
      'cron to english',
      'next run time',
      'cron validator',
      'quartz cron',
      'crontab guru alternative',
    ],
    category: 'dev',
    icon: 'AlarmClock',
    faqs: [
      {
        q: 'Does it support 6-field cron with seconds?',
        a: 'Yes. Five fields are read as minute, hour, day-of-month, month, day-of-week. Six fields put seconds at the front, the convention used by Quartz, Spring and node-cron.',
      },
      {
        q: 'How are day-of-month and day-of-week combined?',
        a: 'With classic Vixie cron rules: if both are restricted, a run happens when either one matches. The English description says so, because this rule surprises most people.',
      },
      {
        q: 'Which timezone are the next run times in?',
        a: 'In the local timezone of your device, which shows next to the list. A real cron daemon uses the server timezone or the CRON_TZ setting, so check that before you rely on the preview for a production schedule.',
      },
      {
        q: 'Are @daily and @hourly shortcuts supported?',
        a: 'Yes. @yearly, @annually, @monthly, @weekly, @daily, @midnight and @hourly expand to their standard five-field forms before parsing.',
      },
      {
        q: 'What syntax is accepted in each field?',
        a: 'Wildcards (*), lists (1,15), ranges (1-5), steps (*/15 and 0-30/5), three-letter month and day names, and ? treated as * in the day fields. Invalid ranges and out-of-bounds values are reported by field name.',
      },
    ],
    related: ['unix-timestamp-converter', 'time-duration-calculator', 'timezone-converter', 'uuid-generator', 'json-formatter'],
    updated: '2026-11-01',
  },
  {
    slug: 'diff-checker-code',
    title: 'Code Diff Checker',
    h1: 'Code diff checker with unified and split view',
    description:
      'Code diff checker: compare two versions of code line by line in unified or side-by-side view, with whitespace options and a unified patch to copy.',
    keywords: [
      'code compare',
      'diff tool',
      'unified diff',
      'side by side diff',
      'git patch generator',
      'compare two files',
      'source diff',
    ],
    category: 'dev',
    icon: 'GitCompare',
    faqs: [
      {
        q: 'How is this different from the text diff checker?',
        a: 'This one is for source code: line numbers on both sides, split view, whitespace options that understand indentation, and unified patch output for git apply. The text version shows word-level changes in prose.',
      },
      {
        q: 'What algorithm does it use?',
        a: 'A Myers longest-common-subsequence diff over lines. Git uses the same family of algorithm, so the hunks match what your version control shows.',
      },
      {
        q: 'Can I ignore reformatting noise?',
        a: 'Yes. You can ignore leading and trailing whitespace, collapse runs of internal whitespace, and ignore case. A re-indent or a lint pass then no longer hides the real change.',
      },
      {
        q: 'Is the patch output valid for git apply?',
        a: 'It is a standard unified diff with correct hunk headers and a configurable number of context lines. Set the two file paths in the header fields, and the result applies with git apply or patch -p1.',
      },
      {
        q: 'Are my files uploaded to compare them?',
        a: 'No. Your browser computes the diff, so you can compare proprietary or unreleased source and it stays on your machine.',
      },
    ],
    related: ['text-diff-checker', 'json-formatter', 'regex-tester', 'base64-encoder-decoder', 'word-counter'],
    updated: '2026-11-01',
  },
  {
    slug: 'number-base-converter',
    title: 'Number Base Converter',
    h1: 'Binary, octal, decimal and hex converter',
    description:
      'Number base converter for binary, octal, decimal, hex and any base from 2 to 36, with bitwise operations, byte grouping and a two’s-complement view.',
    keywords: [
      'binary to decimal',
      'hex to binary',
      'decimal to hex',
      'base converter',
      'bitwise calculator',
      'twos complement',
      'octal converter',
    ],
    category: 'dev',
    icon: 'Hash',
    faqs: [
      {
        q: 'How big a number can it convert?',
        a: 'Any size. Conversion uses BigInt, so 256-bit hashes and 64-bit identifiers convert exactly with no floating-point rounding.',
      },
      {
        q: 'How does the two’s-complement view work?',
        a: 'Pick a width of 8, 16, 32 or 64 bits, and the value shows as the machine stores it, with the signed value and the wrapped value if the number does not fit.',
      },
      {
        q: 'Which bitwise operations are available?',
        a: 'AND, OR, XOR, NOT, left shift, arithmetic right shift and logical right shift. Each runs at the chosen width, and the result shows in every base.',
      },
      {
        q: 'Can I convert negative or fractional values?',
        a: 'Negative integers, yes: enter a leading minus sign, and the two’s-complement panel shows the machine representation. Fractional values work for decimal and for power-of-two bases, up to 16 digits after the point.',
      },
      {
        q: 'Why is my hex value rejected?',
        a: 'Each base allows only its own digits: base 2 takes 0 and 1, base 16 takes 0-9 and a-f. The error names the first invalid character and its position. Prefixes such as 0x, 0b and 0o are removed automatically.',
      },
    ],
    related: ['hash-generator', 'base64-encoder-decoder', 'roman-numeral-converter', 'scientific-calculator', 'uuid-generator', 'data-storage-converter'],
    updated: '2026-11-01',
  },
]
