/**
 * Client entry to search: loads the index, the instant answers and search by meaning on first
 * use, once per page.
 */
import type { SearchIndex } from './data'
import type { Searcher } from './engine'
import { createSearcher } from './engine'
import type { Answer } from './answers/index'
import { pageInfo } from './runtime'
import type { Similarity } from './semantic/client'

let searcher: Promise<Searcher> | null = null
let answers: Promise<(query: string) => Answer | null> | null = null

export function loadSearcher(): Promise<Searcher> {
  searcher ??= fetch(pageInfo().index)
    .then((res) => {
      if (!res.ok) throw new Error(`search index: HTTP ${res.status}`)
      return res.json() as Promise<SearchIndex>
    })
    .then((index) => {
      if (index.v !== 1) throw new Error('search index: unknown format')
      return createSearcher(index)
    })
    .catch((error: unknown) => {
      searcher = null
      throw error
    })
  return searcher
}

export function loadAnswers(): Promise<(query: string) => Answer | null> {
  answers ??= import('./answers/index')
    .then((m) => (query: string) => m.getAnswer(query))
    .catch((error: unknown) => {
      answers = null
      throw error
    })
  return answers
}

let meaning: Promise<Similarity> | null = null
let meaningNow: Similarity | null = null

/** Search by meaning (model and tool vectors), loaded once; rejects offline before the first load. */
export function loadMeaning(): Promise<Similarity> {
  meaning ??= Promise.all([loadSearcher(), import('./semantic/client')])
    .then(([s, m]) => m.openMeaning(s.tools.length, pageInfo().vectors))
    .then((fn) => (meaningNow = fn))
    .catch((error: unknown) => {
      meaning = null
      throw error
    })
  return meaning
}

/** Search by meaning when it has loaded already, else null. Never starts a download. */
export function meaningReady(): Similarity | null {
  return meaningNow
}

/**
 * Whether to fetch the model as soon as a search field is used. Not when the visitor asked
 * the browser to save data or the link is 2G: then it loads only when words alone find little.
 */
export function meaningEagerly(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !c?.saveData && !/(^|-)2g$/.test(c?.effectiveType ?? '')
}

export type { Answer, Similarity }
