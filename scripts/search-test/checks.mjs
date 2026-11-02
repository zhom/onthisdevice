/**
 * Checks one engine case (scripts/search-test/engine.mjs) against a search function, for the
 * lexical runner (search-test.mjs) and the hybrid runner (search-semantic-test.mjs).
 * Returns null when the case waits for a tool that is not registered yet, else the problems.
 */
const match = (actual, expected) => (expected instanceof RegExp ? expected.test(actual ?? '') : actual === expected)

export function checkEngineCase(c, search, slugs) {
  const skip = [c.top, c.in].flat().filter(Boolean).filter((s) => !slugs.has(s))
  if (skip.length && !c.top?.length) return null
  const r = search(c.q)
  const got = r.tools.map((h) => h.tool.slug)
  const problems = []
  if (c.top) {
    const tops = [c.top].flat().filter((s) => slugs.has(s))
    if (tops.length && !tops.includes(got[0])) problems.push(`top ${got[0]} not in [${tops.join(', ')}]`)
  }
  if (c.in) {
    const within = c.within ?? 5
    for (const s of c.in) if (slugs.has(s) && !got.slice(0, within).includes(s)) problems.push(`${s} not in top ${within}`)
  }
  if (c.notIn) for (const s of c.notIn) if (got.slice(0, 5).includes(s)) problems.push(`${s} in top 5`)
  if (c.empty && got.length) problems.push(`expected no tools, got ${got.length}`)
  if (c.dym !== undefined && r.didYouMean !== c.dym) problems.push(`didYouMean ${JSON.stringify(r.didYouMean)} != ${JSON.stringify(c.dym)}`)
  if (c.complete !== undefined && !match(r.completion, c.complete)) problems.push(`completion ${JSON.stringify(r.completion)} != ${c.complete}`)
  if (c.cat !== undefined && ![c.cat].flat().includes(r.categories[0]?.category.slug)) {
    problems.push(`category ${r.categories[0]?.category.slug} != ${c.cat}`)
  }
  return { problems, shown: got.slice(0, 4).join(', ') }
}

/**
 * Checks one file case (scripts/search-test/files.mjs): detected extension and first tool.
 * `meaning` is the search-by-meaning similarity function, or undefined for words only.
 */
export async function checkFileCase(c, lib, meaning) {
  const parts = [c.bytes ?? new TextEncoder().encode(c.text)]
  if (c.tail) parts.push(new Uint8Array(200), new TextEncoder().encode(c.tail))
  const kind = await lib.detectFile(new File(parts, c.name))
  const words = lib.nameWords(c.name)
  const top = lib.toolsForFile(lib.catalog, kind, { meaning: words && meaning ? meaning(words) : null })[0]?.tool.slug
  const problems = []
  if (kind.ext !== c.ext) problems.push(`ext ${kind.ext} != ${c.ext}`)
  if (c.top && ![c.top].flat().includes(top)) problems.push(`top ${top} not in [${[c.top].flat().join(', ')}]`)
  return { problems, shown: `${kind.ext} (${kind.label}) -> ${top ?? 'none'}` }
}
