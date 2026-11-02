/**
 * Search by meaning model: potion-base-32M static embeddings (MIT, Minish Lab), the first
 * 40,000 tokens and the first 176 of 512 dimensions, int8. About 7.5 MB, vendored by
 * scripts/vendor-models.mjs. A new cut gets a new file name, so no cache keeps an old one.
 * The choice is measured in scripts/search-semantic-test.mjs.
 */
export const SEARCH_MODEL = '/models/minishlab/potion-base-32M/search-176d-40k.bin'
export const SEARCH_MODEL_REPO = 'minishlab/potion-base-32M'
export const SEARCH_MODEL_TOKENS = 40000
export const SEARCH_MODEL_DIMS = 176
