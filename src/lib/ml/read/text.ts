/** Trims trailing spaces, keeps blank lines between paragraphs, at most one in a row. */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
