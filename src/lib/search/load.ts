/**
 * Client entry to search: loads the index and the instant answers on first use, once per page.
 */
import type { SearchIndex } from './data'
import type { Searcher } from './engine'
import { createSearcher } from './engine'
import type { Answer } from './answers/index'
import { pageInfo } from './runtime'

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

export type { Answer }
