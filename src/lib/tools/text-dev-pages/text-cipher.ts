import type { Def, Section } from './types'
import { def } from './types'

const NOT_SECURE: Section = {
  h: 'Not for secrets',
  p: [
    'Classical ciphers are puzzles, not protection. Each can be broken by hand or by trying every key in a fraction of a second. To protect a message, use encrypt and decrypt text, which uses AES-256-GCM.',
  ],
}

export const CIPHER_DEFS: Def[] = [
  def({
    slug: 'rot13-encoder-decoder',
    title: 'ROT13 Encoder and Decoder',
    h1: 'ROT13 encoder and decoder',
    description: 'Encode or decode ROT13 text: each letter moves 13 places in the alphabet, so the same step encodes and decodes. For spoilers, puzzles and answers.',
    keywords: ['rot13', 'rot13 decoder', 'rot 13 translator', 'rotate 13'],
    category: 'text',
    icon: 'RotateCw',
    family: 'text',
    faqs: [
      { q: 'Why is there no separate decode button?', a: 'The alphabet has 26 letters, so moving 13 places twice brings each letter back. Encoding and decoding are the same operation.' },
      { q: 'Are numbers changed?', a: 'No. ROT13 changes only the letters A to Z. Use ROT47 to also rotate digits and punctuation.' },
      { q: 'Is ROT13 encryption?', a: 'No. It hides text from a casual glance, such as a spoiler or a puzzle answer, but anyone can reverse it.' },
    ],
    related: ['rot47-encoder-decoder', 'caesar-cipher', 'atbash-cipher', 'vigenere-cipher'],
    explainer: [
      {
        h: 'How ROT13 works',
        p: ['ROT13 is a Caesar cipher with a shift of 13. A becomes N, B becomes O, and N becomes A again. Case is kept and every other character passes through unchanged.'],
        table: { head: ['Plain', 'A B C D E F G H I J K L M'], rows: [['ROT13', 'N O P Q R S T U V W X Y Z']] },
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'rot47-encoder-decoder',
    title: 'ROT47 Encoder and Decoder',
    h1: 'ROT47 encoder and decoder',
    description: 'Encode or decode ROT47, which rotates all 94 printable ASCII characters, so letters, digits and punctuation are all hidden. One step encodes and decodes.',
    keywords: ['rot47', 'rot47 decoder', 'rot 47 cipher', 'ascii rotation'],
    category: 'text',
    icon: 'RotateCw',
    family: 'text',
    faqs: [
      { q: 'How is ROT47 different from ROT13?', a: 'ROT13 rotates only the 26 letters. ROT47 rotates the 94 characters from ! (33) to ~ (126), so digits and symbols change too.' },
      { q: 'What happens to spaces and accents?', a: 'Spaces, line breaks and characters outside printable ASCII, such as é or emoji, stay as they are.' },
      { q: 'Is it safe for passwords?', a: 'No. ROT47 has no key. Anyone can decode it with this page.' },
    ],
    related: ['rot13-encoder-decoder', 'caesar-cipher', 'base64-encoder-decoder', 'encrypt-decrypt-text'],
    explainer: [
      {
        h: 'How ROT47 works',
        p: ['Each character with code 33 to 126 is replaced by the character 47 places later in that range, wrapping around after ~. Because the range has 94 characters, applying it twice gives the original.'],
        code: 'out = 33 + ((code - 33 + 47) mod 94)',
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'caesar-cipher',
    title: 'Caesar Cipher',
    h1: 'Caesar cipher encoder, decoder and solver',
    description: 'Encode and decode Caesar cipher text with any shift, or crack an unknown shift: all 26 shifts are ranked by how close they are to English.',
    keywords: ['caesar cipher decoder', 'caesar shift', 'shift cipher', 'caesar cipher solver', 'caesar code'],
    category: 'text',
    icon: 'KeyRound',
    family: 'text',
    popular: true,
    faqs: [
      { q: 'How do I decode a message when I do not know the shift?', a: 'Choose Find the shift. The tool tries all 26 shifts and ranks them by letter frequency, so the readable one is usually first.' },
      { q: 'What shift did Julius Caesar use?', a: 'According to Suetonius, a shift of 3: A became D.' },
      { q: 'Can the shift be negative?', a: 'Yes. A shift of -3 is the same as a shift of 23.' },
    ],
    related: ['rot13-encoder-decoder', 'vigenere-cipher', 'atbash-cipher', 'letters-to-numbers'],
    explainer: [
      {
        h: 'How the Caesar cipher works',
        p: ['Each letter moves a fixed number of places along the alphabet, wrapping from Z back to A. With shift 3, HELLO becomes KHOOR. Decoding moves the letters back.'],
        code: 'E(x) = (x + n) mod 26\nD(x) = (x - n) mod 26',
      },
      {
        h: 'How the solver finds the shift',
        p: [
          'There are only 26 shifts, so the solver tries them all. For each, it counts the letters and computes the chi-squared distance to the letter frequencies of English (E 12.7%, T 9.1%, A 8.2% ...). The shift with the smallest distance is most likely right. Short messages of a few words can rank the wrong shift first, so read the top rows of the table.',
        ],
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'vigenere-cipher',
    title: 'Vigenère Cipher',
    h1: 'Vigenère cipher encoder and decoder',
    description: 'Encrypt and decrypt text with the Vigenère cipher and a keyword. Case and punctuation are kept, and the key skips non-letters as in classic tables.',
    keywords: ['vigenere cipher decoder', 'vigenere encrypt', 'polyalphabetic cipher', 'keyword cipher'],
    category: 'text',
    icon: 'KeyRound',
    family: 'text',
    faqs: [
      { q: 'How does the key work?', a: 'Each letter of the key is a Caesar shift: A is 0, B is 1, Z is 25. The key repeats along the message, one key letter per message letter.' },
      { q: 'Do spaces use up key letters?', a: 'No. Only letters of the message move the key forward, which matches the usual textbook examples.' },
      { q: 'Is the Vigenère cipher secure?', a: 'No. It was broken in the 19th century by finding the key length (Kasiski examination) and then solving one Caesar cipher per key letter.' },
    ],
    related: ['caesar-cipher', 'rot13-encoder-decoder', 'encrypt-decrypt-text', 'atbash-cipher'],
    explainer: [
      {
        h: 'How the Vigenère cipher works',
        p: ['The key is repeated under the message. Each message letter is shifted by the alphabet position of the key letter under it. With the key LEMON, ATTACKATDAWN becomes LXFOPVEFRNHR.'],
        code: 'C[i] = (P[i] + K[i mod m]) mod 26\nP[i] = (C[i] - K[i mod m]) mod 26',
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'atbash-cipher',
    title: 'Atbash Cipher',
    h1: 'Atbash cipher translator',
    description: 'Encode or decode the Atbash cipher, which reverses the alphabet: A becomes Z and B becomes Y. The same step encodes and decodes. Case is kept.',
    keywords: ['atbash', 'atbash decoder', 'reverse alphabet cipher', 'mirror alphabet code'],
    category: 'text',
    icon: 'ArrowLeftRight',
    family: 'text',
    faqs: [
      { q: 'Where does Atbash come from?', a: 'It was first used with the Hebrew alphabet: the first letter (aleph) swaps with the last (tav), the second (bet) with the second-last (shin).' },
      { q: 'Why is there one button for both directions?', a: 'Reversing the alphabet twice gives the original letter, so encoding and decoding are the same step.' },
      { q: 'Are numbers changed?', a: 'No. Only the letters A to Z change.' },
    ],
    related: ['caesar-cipher', 'rot13-encoder-decoder', 'letters-to-numbers', 'reverse-text'],
    explainer: [
      {
        h: 'The Atbash table',
        table: {
          head: ['Plain', 'A B C D E F G H I J K L M'],
          rows: [['Atbash', 'Z Y X W V U T S R Q P O N']],
        },
        code: 'E(x) = 25 - x',
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'letters-to-numbers',
    title: 'Letters to Numbers',
    h1: 'Convert letters to numbers (A1Z26)',
    description: 'Convert letters to their alphabet positions (A=1, B=2 ... Z=26) and numbers back to letters. The A1Z26 cipher, for puzzles and escape rooms.',
    keywords: ['a1z26', 'letter to number converter', 'alphabet position', 'numbers to letters', 'a=1 b=2 cipher'],
    category: 'text',
    icon: 'Binary',
    family: 'text',
    faqs: [
      { q: 'How are words separated?', a: 'Letters of a word are joined with dashes (or your choice) and words are separated by a slash: 8-9 / 25-15-21.' },
      { q: 'What happens to numbers above 26?', a: 'When decoding, a number outside 1 to 26 is reported as an error, because it is not a letter.' },
      { q: 'Is this the same as character codes?', a: 'No. Character codes (ASCII) give A=65. Use the ASCII table or text to binary for those.' },
    ],
    related: ['caesar-cipher', 'atbash-cipher', 'ascii-table', 'number-to-words-converter'],
    explainer: [
      {
        h: 'The alphabet positions',
        table: {
          head: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
          rows: [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
            ['N 14', 'O 15', 'P 16', 'Q 17', 'R 18', 'S 19', 'T 20', 'U 21', 'V 22', 'W 23', 'X 24', 'Y 25', 'Z 26'],
          ],
        },
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'rail-fence-cipher',
    title: 'Rail Fence Cipher',
    h1: 'Rail fence cipher encoder and decoder',
    description: 'Encrypt and decrypt the rail fence (zigzag) transposition cipher with any number of rails. The letters stay the same; only their order changes.',
    keywords: ['rail fence', 'zigzag cipher', 'transposition cipher', 'rail fence decoder'],
    category: 'text',
    icon: 'Fence',
    family: 'text',
    faqs: [
      { q: 'How does it differ from a Caesar cipher?', a: 'A Caesar cipher replaces letters. A rail fence keeps every letter and only changes the order, so it is a transposition cipher.' },
      { q: 'What if I do not know the number of rails?', a: 'Decrypt with 2, 3, 4 and so on. The key is small, so trying each takes seconds.' },
      { q: 'Should spaces be removed?', a: 'Classic examples remove them before encrypting. Keep them if you encrypted with spaces.' },
    ],
    related: ['caesar-cipher', 'vigenere-cipher', 'baconian-cipher', 'reverse-text'],
    explainer: [
      {
        h: 'How the zigzag works',
        p: ['The message is written diagonally down and up across the rails, then read rail by rail. With 3 rails, WEAREDISCOVERED becomes the three rows read left to right.'],
        code: 'W . . . E . . . C . . . R . .\n. E . R . D . S . O . E . E .\n. . A . . . I . . . V . . . D',
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'baconian-cipher',
    title: 'Baconian Cipher',
    h1: 'Baconian cipher encoder and decoder',
    description: "Encode and decode Francis Bacon's cipher: each letter becomes five A and B characters. Choose the 24-letter classic alphabet or the 26-letter version.",
    keywords: ['bacon cipher', 'baconian code', 'aabbb cipher', 'bacon cipher decoder'],
    category: 'text',
    icon: 'Binary',
    family: 'text',
    faqs: [
      { q: 'Why two alphabets?', a: "Bacon's original alphabet had 24 letters: I and J share a code, and so do U and V. The 26-letter version gives every letter its own code." },
      { q: 'How was it used to hide messages?', a: 'The A and B were shown by two typefaces in an innocent text, so the cover text carried the hidden message. It is an early form of steganography.' },
      { q: 'Can I decode text with other characters?', a: 'Yes. Everything except A and B is ignored, and slashes separate words.' },
    ],
    related: ['rail-fence-cipher', 'letters-to-numbers', 'binary-translator', 'morse-code-translator'],
    explainer: [
      {
        h: 'How the codes are made',
        p: ['Each letter gets the five-digit binary form of its position, with A for 0 and B for 1. In the 26-letter alphabet, A is AAAAA, B is AAAAB and Z is BBAAB.'],
        table: {
          head: ['Letter', 'A', 'B', 'C', 'D', 'E', 'F'],
          rows: [['Code', 'AAAAA', 'AAAAB', 'AAABA', 'AAABB', 'AABAA', 'AABAB']],
        },
      },
      NOT_SECURE,
    ],
  }),
  def({
    slug: 'pig-latin-translator',
    title: 'Pig Latin Translator',
    h1: 'Pig Latin translator',
    description: 'Translate English into Pig Latin: the first consonant sound moves to the end and gets "ay". Choose the ending for vowel words. Case and punctuation stay.',
    keywords: ['pig latin', 'english to pig latin', 'pig latin converter', 'pig latin generator'],
    category: 'text',
    icon: 'PiggyBank',
    family: 'text',
    faqs: [
      { q: 'What are the rules?', a: 'A word that starts with consonants moves them to the end and adds ay (string becomes ingstray). A word that starts with a vowel adds way, yay or ay (apple becomes appleway).' },
      { q: 'How is qu handled?', a: 'qu moves as one unit, so queen becomes eenquay and square becomes aresquay.' },
      { q: 'Is y a vowel?', a: 'At the start of a word y is a consonant (yellow becomes ellowyay). Inside a word it acts as a vowel (rhythm becomes ythmrhay).' },
    ],
    related: ['leetspeak-translator', 'reverse-text', 'upside-down-text', 'morse-code-translator'],
    explainer: [
      {
        h: 'Examples',
        table: {
          head: ['English', 'Pig Latin'],
          rows: [
            ['pig', 'igpay'],
            ['latin', 'atinlay'],
            ['string', 'ingstray'],
            ['apple', 'appleway'],
            ['quiet', 'ietquay'],
          ],
        },
      },
    ],
  }),
  def({
    slug: 'leetspeak-translator',
    title: 'Leetspeak Translator',
    h1: 'Leetspeak translator',
    description: 'Convert text to leetspeak (1337) with digits for letters, or use the advanced alphabet with symbols. Decode simple leetspeak back to plain text.',
    keywords: ['leet speak', '1337 translator', 'leet converter', 'hacker text generator'],
    category: 'text',
    icon: 'Terminal',
    family: 'text',
    faqs: [
      { q: 'Which letters change?', a: 'Basic leet replaces A with 4, E with 3, I with 1, O with 0, S with 5, T with 7, B with 8 and G with 9. The advanced alphabet also draws letters with symbols, such as |-| for H.' },
      { q: 'Can it decode any leetspeak?', a: 'It reverses the basic substitutions inside words. Advanced symbol letters have many variants and are not decoded.' },
      { q: 'Is leetspeak a good password trick?', a: 'No. Password crackers try these substitutions first, so P4ssw0rd is as weak as Password.' },
    ],
    related: ['pig-latin-translator', 'fancy-text-generator', 'password-generator', 'password-strength-checker'],
    explainer: [
      {
        h: 'The substitution table',
        table: {
          head: ['Letter', 'A', 'B', 'E', 'G', 'I', 'O', 'S', 'T'],
          rows: [['Leet', '4', '8', '3', '9', '1', '0', '5', '7']],
        },
      },
    ],
  }),
]
