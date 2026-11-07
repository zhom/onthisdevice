/** Unicode style pages. Each one is the fancy text generator with its own styles first (ids from DevEncodeFancyText). */
export const FANCY: Record<string, { featured: string[]; sample: string }> = {
  'italic-text-generator': { featured: ['italic', 'sans-italic', 'bold-italic', 'sans-bold-italic'], sample: 'Read this first' },
  'underline-text-generator': { featured: ['underline', 'double-underline', 'overline'], sample: 'Important note' },
  'bubble-text-generator': { featured: ['circled', 'circled-negative', 'parenthesized'], sample: 'Hello there' },
  'square-text-generator': { featured: ['squared', 'squared-negative', 'regional'], sample: 'NEW DROP' },
  'wide-text-generator': { featured: ['fullwidth', 'spaced'], sample: 'aesthetic' },
  'cursive-text-generator': { featured: ['script', 'script-bold'], sample: 'With love' },
  'gothic-text-generator': { featured: ['fraktur', 'fraktur-bold'], sample: 'Dark Ages' },
  'double-struck-text-generator': { featured: ['double-struck'], sample: 'Real Numbers 2026' },
  'monospace-text-generator': { featured: ['monospace'], sample: 'console.log(hello)' },
}
