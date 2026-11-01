import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'password-generator',
    title: 'Password Generator',
    h1: 'Strong random password generator',
    description:
      'Password generator for strong random passwords. Set the length and character types, make many at once, and see the entropy in bits for each setting.',
    keywords: [
      'strong password generator',
      'random password generator',
      'secure password generator',
      'password creator',
      'generate password online',
      'bulk password generator',
      'password entropy calculator',
      '16 character password',
    ],
    category: 'security',
    icon: 'KeyRound',
    popular: true,
    faqs: [
      {
        q: 'Is this password generator actually safe to use online?',
        a: 'Yes. The page is static. After it loads, it makes no network requests, and each password comes from crypto.getRandomValues in your browser. Nothing is sent to a server, saved to storage or added to your history. To check, open the network panel of your browser and generate a few dozen passwords. You see no traffic.',
      },
      {
        q: 'How long should a password be?',
        a: 'Sixteen characters from a mixed alphabet is a sensible minimum for an account that you do not want to lose. Use twenty or more for email, banking and the master password of your password manager. Length counts for more than complexity: four more random characters multiply the search space far more than a symbol in place of one letter.',
      },
      {
        q: 'Why does the tool use crypto.getRandomValues and rejection sampling?',
        a: 'Math.random is not cryptographically secure: an observer can predict its output from a few values. This tool uses crypto.getRandomValues. It discards each draw that falls in the last partial bucket of the 32-bit range, because a plain modulo makes some characters slightly more likely than others.',
      },
      {
        q: 'What does the entropy figure mean?',
        a: 'It is the base-2 logarithm of the number of passwords that the settings can produce, so each extra bit doubles the work of an attacker. Under 28 bits is easy to break, 60 is fair, and 80 or more resists offline cracking with current hardware. With "include one of each type" on, the figure is the exact entropy of the restricted set.',
      },
      {
        q: 'Does copying the password leave it somewhere?',
        a: 'It goes to your system clipboard, because you paste it from there. The copy button overwrites the clipboard after 45 seconds, so the password does not stay there all day. The password is never put in the URL, in local storage or in your browser history.',
      },
    ],
    related: [
      'passphrase-generator',
      'password-strength-checker',
      'pin-generator',
      'random-string-generator',
      'uuid-generator',
      'encrypt-decrypt-text',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'passphrase-generator',
    title: 'Passphrase Generator',
    h1: 'Diceware passphrase generator',
    description:
      'Passphrase generator that picks random words from a 1,024-word diceware list. Choose the word count, separator and capitals, and see the entropy in bits.',
    keywords: [
      'diceware generator',
      'random word password',
      'memorable password generator',
      'xkcd password generator',
      'passphrase creator',
      'four word password',
      'word based password',
    ],
    category: 'security',
    icon: 'Dices',
    faqs: [
      {
        q: 'How many words do I actually need?',
        a: 'Each word from this 1,024-word list is worth exactly 10 bits, so four words give 40 bits, five give 50 and six give 60. Four words are enough for a rate-limited login. Use five or six for a password manager, a disk or a backup that an attacker can take away and attack offline.',
      },
      {
        q: 'Does it help to keep the word list secret?',
        a: 'No. The strength comes from the random selection, and the list can be public (Kerckhoffs’s principle). For this reason you can download the full list here. Count it, confirm that it has 1,024 entries and check the 10-bits-per-word claim yourself.',
      },
      {
        q: 'Why is a passphrase better than a mangled word?',
        a: '"P@ssw0rd!" is one dictionary word plus a few substitutions that cracking software applies automatically: about 15 bits of real strength. Five unrelated random words are 50 bits, and you can remember them.',
      },
      {
        q: 'Do capital letters make it stronger?',
        a: 'No. A capital first letter on each word is a rule, and an attacker applies the same rule. The option is there because some login forms require a capital letter. The bits shown on the page do not count it.',
      },
      {
        q: 'Can I type the separator I want?',
        a: 'Yes. Use hyphens, spaces, dots, underscores, no separator or a custom string. The separator adds no entropy, because the attacker knows the convention. Hyphens keep the phrase readable, and some forms reject spaces.',
      },
    ],
    related: [
      'password-generator',
      'password-strength-checker',
      'random-string-generator',
      'encrypt-decrypt-text',
      'pin-generator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'password-strength-checker',
    title: 'Password Strength Checker',
    h1: 'Password strength checker and crack-time estimator',
    description:
      'Password strength checker that finds dictionary words, keyboard runs, dates and leetspeak in a password, then estimates crack times at four attack speeds.',
    keywords: [
      'password strength test',
      'how strong is my password',
      'password entropy checker',
      'crack time calculator',
      'password checker',
      'test password security',
      'password meter',
    ],
    category: 'security',
    icon: 'Gauge',
    popular: true,
    faqs: [
      {
        q: 'Is it safe to type my real password in here?',
        a: 'Yes. The page makes no network requests, has no form submission and no analytics, and the dictionaries it uses are in the page itself. Nothing is stored, and when you close the tab everything is discarded. It is still a good habit to be careful with any box that asks for your password. If you prefer, type a password with the same shape: the same length and the same mix of words, digits and symbols.',
      },
      {
        q: 'Why is my score lower here than on other sites?',
        a: 'Most meters count character classes and length, so "P@ssw0rd1" gets a good score for its four classes. This checker looks for the structure that a cracker looks for (breached passwords, dictionary words, reversals, leetspeak, keyboard runs, sequences, repeats and dates) and gives each piece its own cost. The result is much closer to a real attack.',
      },
      {
        q: 'What is the difference between naive and adjusted entropy?',
        a: 'Naive entropy is log2(alphabet ^ length): the value if each character were chosen at random. Adjusted entropy is the cost of the cheapest way to describe your password with known patterns. For a randomly generated password the two are the same. For a password that a person made up, the adjusted figure is usually far lower, and it is the figure that matters.',
      },
      {
        q: 'Where do the crack times come from?',
        a: 'The adjusted guess count is divided by an assumed attack rate, then halved, because on average an attacker finds a password halfway through the search. The four rates are a rate-limited login form, an unprotected API, a slow hash such as bcrypt, and an eight-GPU rig against unsalted SHA-1.',
      },
      {
        q: 'How big is the dictionary it checks against?',
        a: 'About 1,500 entries: the most common breached passwords in rank order, plus everyday English words, first names, months, cities and teams. A real cracking rig loads tens of millions. Treat the score as a best case. Your password is never stronger than the number shown, and often weaker.',
      },
    ],
    related: [
      'password-generator',
      'passphrase-generator',
      'encrypt-decrypt-text',
      'pin-generator',
      'hash-generator',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'random-string-generator',
    title: 'Random String Generator',
    h1: 'Random string generator',
    description:
      'Generate random strings from hex, base64url, alphanumeric or custom character sets, in bulk, with prefixes, suffixes and an exact entropy readout.',
    keywords: [
      'random string generator',
      'random hex generator',
      'api key generator',
      'random token generator',
      'random alphanumeric',
      'base64url generator',
      'random character generator',
      'nonce generator',
    ],
    category: 'security',
    icon: 'Shuffle',
    faqs: [
      {
        q: 'Can I use these as API keys or session tokens?',
        a: 'Yes, if they are long enough. A 32-character base64url string is 192 bits, far beyond anything guessable. 22 characters is 132 bits and still ample. The randomness comes from crypto.getRandomValues, the same source that a server-side library uses, and rejection sampling makes each character equally likely.',
      },
      {
        q: 'Why does the tool remove duplicate characters from a custom set?',
        a: 'A character listed twice is twice as likely to appear. That reduces the entropy, and the figure on the page is then wrong. When the tool removes duplicates, the alphabet size and the bits-per-character figure stay correct.',
      },
      {
        q: 'What does "exclude ambiguous characters" remove?',
        a: 'i, I, l, L, 1, |, o, O and 0: the characters that people confuse when they read a code off a screen or say it on the phone. The alphabet gets smaller, so the entropy figure drops. Add a couple of characters to the length to compensate.',
      },
      {
        q: 'Do the prefix and suffix count towards the strength?',
        a: 'No, and the tool shows this. A prefix such as sk_live_ is public structure, so only the random middle section adds entropy. A prefix is still useful to make keys self-describing in logs and dashboards.',
      },
    ],
    related: [
      'password-generator',
      'uuid-generator',
      'passphrase-generator',
      'pin-generator',
      'hash-generator',
      'base64-encoder-decoder',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'pin-generator',
    title: 'PIN Generator',
    h1: 'Random PIN generator',
    description:
      'PIN generator for random 4 to 12 digit codes, in bulk. An optional filter rejects birthdays, years, repeats, runs and the codes that thieves try first.',
    keywords: [
      'random pin generator',
      '4 digit pin generator',
      '6 digit pin generator',
      'secure pin code',
      'random number code',
      'atm pin generator',
      'phone passcode generator',
    ],
    category: 'security',
    icon: 'LockKeyhole',
    faqs: [
      {
        q: 'Which PINs does the weak-pattern filter reject?',
        a: 'Codes made of one repeated digit, straight runs like 1234 or 9876, repeated blocks like 1212, palindromes, the thirty codes that dominate every leaked PIN dataset, and anything that reads as a year or a date at the relevant length. The page lists the exact rules that apply to the length you picked, along with how much of the search space they remove.',
      },
      {
        q: 'Does filtering weak PINs make the result less random?',
        a: 'No. The tool draws a rejected code again, so the remaining codes stay uniformly distributed: each allowed PIN is exactly as likely as any other. The only effect is a smaller search space, and the entropy figure on the page includes it.',
      },
      {
        q: 'Is a four-digit PIN enough?',
        a: 'Only because something limits the attempts: three tries at a cash machine, ten before a phone wipes. Four digits is 10,000 possibilities, which an offline attacker tries in a fraction of a second. If the PIN protects something that can be attacked offline, use six digits at minimum, or better, a password.',
      },
      {
        q: 'Why avoid dates when they are so easy to remember?',
        a: 'Thieves try them first for the same reason. A stolen wallet usually contains a date of birth, and DDMM plus MMDD covers only about 700 of the 10,000 four-digit codes. A stranger who has your ID can guess such a PIN.',
      },
    ],
    related: [
      'password-generator',
      'random-string-generator',
      'passphrase-generator',
      'password-strength-checker',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'encrypt-decrypt-text',
    title: 'Encrypt & Decrypt Text',
    h1: 'Encrypt and decrypt text with AES-256',
    description:
      'Encrypt and decrypt text with a password in your browser. AES-256-GCM with PBKDF2 makes one base64 block that you can paste into an email or a chat.',
    keywords: [
      'aes encryption online',
      'encrypt text with password',
      'decrypt text online',
      'aes 256 gcm',
      'text encryption tool',
      'password based encryption',
      'encrypt message',
      'pbkdf2',
    ],
    category: 'security',
    icon: 'Lock',
    popular: true,
    faqs: [
      {
        q: 'What exactly does the encryption do?',
        a: 'Your password is stretched into a 256-bit key with PBKDF2-HMAC-SHA256 over 200,000 iterations and a fresh 16-byte random salt. That key encrypts your text with AES-256-GCM under a fresh 12-byte random nonce. The salt, nonce, iteration count and ciphertext are packed into one binary envelope behind an "OTD1" marker and base64-encoded. The page publishes the byte layout so you can verify or re-implement it.',
      },
      {
        q: 'What happens if I lose the password?',
        a: 'The text cannot be recovered. There is no reset link, no recovery key and no back door. With 200,000 PBKDF2 iterations, even a well-funded attacker pays that cost on each guess, and so would you. Save the password in a password manager before you close the page.',
      },
      {
        q: 'Why does decryption not tell me whether the password was wrong or the text was damaged?',
        a: 'AES-GCM cannot tell the two apart. It checks an authentication tag over the whole ciphertext. If the tag does not match, the key was wrong or the bytes were changed, and there is no way to tell which. This is a security property: nobody can change your ciphertext without detection.',
      },
      {
        q: 'Is this as good as a full encryption program or an encrypted archive?',
        a: 'It uses the same primitives, in the audited implementations that are built into the browser. It does not give you public-key exchange, signatures, key management or metadata protection. Use it to send a short secret through a channel that you do not trust. It does not replace a full encryption suite.',
      },
      {
        q: 'Can I send the output over email or chat?',
        a: 'Yes. The base64 envelope is for this. It contains only printable ASCII, survives copy and paste, and decryption ignores line breaks. Send the password separately, through a different channel.',
      },
    ],
    related: [
      'password-generator',
      'passphrase-generator',
      'file-hash-checker',
      'base64-encoder-decoder',
      'hash-generator',
      'password-strength-checker',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'file-hash-checker',
    title: 'File Hash Checker',
    h1: 'File hash checker: verify a download’s checksum',
    description:
      'File hash checker for SHA-256, SHA-512, SHA-1 and MD5. Compare a download with its published checksum. Large files are read in 4 MB slices.',
    keywords: [
      'checksum verifier',
      'sha256 file hash',
      'verify download checksum',
      'md5 checksum',
      'file hash calculator',
      'sha256sum online',
      'iso checksum check',
      'file integrity check',
    ],
    category: 'security',
    icon: 'FileCheck2',
    accepts: ['any'],
    faqs: [
      {
        q: 'Is there a file size limit?',
        a: 'No. The tool reads the file from disk in 4 MB slices and adds each slice to the running hash, so memory use stays flat for a 40 KB file or a 40 GB file. The only limit is the read speed of your disk. The panel shows the throughput, and you can cancel at any time.',
      },
      {
        q: 'Why does an online checksum tool that uploads the file make no sense?',
        a: 'You would give the file whose integrity you doubt to a third party, and then trust their answer about it. A check has meaning only where the file already is. Here the bytes stay on your machine: this page makes no network requests after it loads.',
      },
      {
        q: 'How do I paste the expected checksum?',
        a: 'Any common form works: a bare hex string, a full sha256sum line such as "9fdc…  ubuntu.iso", a BSD-style "SHA256 (file) = 9fdc…" line, or a colon-separated fingerprint. The tool finds the algorithm from the digest length (32 hex characters is MD5, 40 is SHA-1, 64 is SHA-256 and 128 is SHA-512) and turns that algorithm on.',
      },
      {
        q: 'The checksums do not match. What should I do?',
        a: 'Do not open the file. A mismatch means the bytes on your disk are not the bytes the publisher hashed: an interrupted or corrupted download, a mirror serving an older build, or in the worst case a tampered file. Download it again from the original source and check it again before you run it.',
      },
      {
        q: 'Should I trust an MD5 or SHA-1 checksum?',
        a: 'For catching an accidentally corrupted download, either is fine. For proving that nobody tampered with a file, neither is: practical collision attacks exist against MD5 and SHA-1, so an attacker who controls the file can produce a different one with the same digest. Prefer SHA-256 whenever the publisher offers it.',
      },
    ],
    related: [
      'file-integrity-comparison',
      'hash-generator',
      'encrypt-decrypt-text',
      'password-generator',
      'base64-encoder-decoder',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'file-integrity-comparison',
    title: 'File Comparison',
    h1: 'Compare two files byte for byte',
    description:
      'Compare two files byte for byte to see if they are identical. The tool shows both SHA-256 digests and the offset of the first byte that differs.',
    keywords: [
      'compare two files',
      'are these files identical',
      'file diff binary',
      'duplicate file checker',
      'byte comparison tool',
      'compare file hashes',
      'binary file compare',
    ],
    category: 'security',
    icon: 'GitCompare',
    accepts: ['any'],
    faqs: [
      {
        q: 'What does "byte-identical" actually check?',
        a: 'Only the contents. The two files are read side by side and compared byte by byte while SHA-256 is computed for each, so filenames, folders, timestamps and permissions are all ignored. Two files with different names in different folders can still be identical, and that is what the verdict reports.',
      },
      {
        q: 'Why show the first differing byte offset?',
        a: 'Because it tells you what kind of difference you are looking at. An offset of zero usually means a completely different file or a different container format. A difference deep in the file with everything before it matching usually means a truncated download, an appended signature or a single corrupted block.',
      },
      {
        q: 'Can it compare files that are too big to fit in memory?',
        a: 'Yes. Both files are streamed in 4 MB slices, so peak memory stays in the low megabytes no matter how large the files are. Comparing two multi-gigabyte disk images or backups is limited only by your disk read speed, and progress is shown throughout.',
      },
      {
        q: 'The files look the same but the hashes differ. What changed?',
        a: 'Something invisible. The usual culprits are trailing whitespace or a final newline, CRLF versus LF line endings, embedded timestamps or metadata written by an exporting application, or a different compression level that produced the same visible content from different bytes. The first-difference offset narrows it down quickly.',
      },
    ],
    related: [
      'file-hash-checker',
      'hash-generator',
      'diff-checker-code',
      'encrypt-decrypt-text',
      'password-generator',
    ],
    updated: '2026-11-01',
  },
]
