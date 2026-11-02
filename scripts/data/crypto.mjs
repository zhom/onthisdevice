/**
 * Daily USD prices of the largest cryptocurrencies, from a CC0 daily exchange-rate dataset
 * (one snapshot per day since 2 March 2024). Tier: daily.
 *
 *   src/data/crypto.json                   latest USD price per coin + meta
 *   public/data/crypto/<hash>/<COIN>.json  one price per calendar day from `start` (null = no snapshot)
 *
 * The first run (or --backfill) downloads every day since the start; later runs add the days
 * that are missing and keep the history already on disk.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, check, checkJump, checkRange, chunkedArray, commit, flags, get, meta, readJson, run, sig } from './lib.mjs'

const START = '2024-03-02'
const DAY = 86_400_000

/** code in the source -> [symbol, name]. Stablecoins stay in: people convert them too. */
export const COINS = [
  ['btc', 'BTC', 'Bitcoin'],
  ['eth', 'ETH', 'Ethereum'],
  ['usdt', 'USDT', 'Tether'],
  ['xrp', 'XRP', 'XRP'],
  ['bnb', 'BNB', 'BNB'],
  ['sol', 'SOL', 'Solana'],
  ['usdc', 'USDC', 'USD Coin'],
  ['doge', 'DOGE', 'Dogecoin'],
  ['trx', 'TRX', 'TRON'],
  ['ada', 'ADA', 'Cardano'],
  ['link', 'LINK', 'Chainlink'],
  ['xlm', 'XLM', 'Stellar'],
  ['bch', 'BCH', 'Bitcoin Cash'],
  ['avax', 'AVAX', 'Avalanche'],
  ['sui', 'SUI', 'Sui'],
  ['ltc', 'LTC', 'Litecoin'],
  ['hbar', 'HBAR', 'Hedera'],
  ['dot', 'DOT', 'Polkadot'],
  ['xmr', 'XMR', 'Monero'],
  ['shib', 'SHIB', 'Shiba Inu'],
  ['uni', 'UNI', 'Uniswap'],
  ['near', 'NEAR', 'NEAR Protocol'],
  ['apt', 'APT', 'Aptos'],
  ['icp', 'ICP', 'Internet Computer'],
  ['etc', 'ETC', 'Ethereum Classic'],
  ['atom', 'ATOM', 'Cosmos'],
  ['fil', 'FIL', 'Filecoin'],
  ['aave', 'AAVE', 'Aave'],
]

const STABLE = new Set(['USDT', 'USDC'])

const urlsFor = (date) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`,
  `https://${date}.currency-api.pages.dev/v1/currencies/usd.min.json`,
]

/**
 * Removes single-day glitches in the source: a value more than 2x away from the median of
 * the 3 days on each side becomes null. Real moves last longer than one day and stay.
 */
export function despike(values, factor = 2) {
  const out = values.slice()
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null) continue
    const around = []
    for (let j = Math.max(0, i - 3); j <= Math.min(values.length - 1, i + 3); j++) if (j !== i && values[j] !== null) around.push(values[j])
    if (around.length < 2) continue
    around.sort((a, b) => a - b)
    const mid = around[Math.floor(around.length / 2)]
    if (v > mid * factor || v < mid / factor) out[i] = null
  }
  return out
}

const iso = (t) => new Date(t).toISOString().slice(0, 10)
const dayIndex = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${START}T00:00:00Z`)) / DAY)

/** USD per coin from one snapshot ({ date, usd: { btc: coins per USD } }). */
export function pricesFromSnapshot(snap) {
  const out = {}
  for (const [code, sym] of COINS) {
    const perUsd = snap?.usd?.[code]
    if (typeof perUsd === 'number' && perUsd > 0) out[sym] = sig(1 / perUsd, 6)
  }
  return out
}

async function snapshot(date) {
  for (const url of urlsFor(date)) {
    try {
      const j = await get(url, { as: 'json', allow404: true, retries: 2, timeoutMs: 30_000 })
      if (j && j.usd) return j
    } catch {
      // try the mirror
    }
  }
  return null
}

function readHistory(prevManifest) {
  const history = {}
  if (!prevManifest?.files) return history
  for (const [, sym] of COINS) {
    const file = path.join(ROOT, 'public', prevManifest.files, `${sym}.json`)
    if (existsSync(file)) history[sym] = JSON.parse(readFileSync(file, 'utf8'))
  }
  return history
}

async function main() {
  const opts = flags()
  const prev = readJson('src/data/crypto.json')
  const history = opts.backfill ? {} : readHistory(prev)
  const latest = await snapshot('latest')
  check(latest?.date, 'crypto: no latest snapshot')
  const lastIdx = dayIndex(latest.date)
  check(lastIdx > 900, `crypto: latest snapshot date ${latest.date} is too early`)
  const ageDays = (Date.now() - Date.parse(`${latest.date}T00:00:00Z`)) / DAY
  check(ageDays < 4, `crypto: latest snapshot is ${ageDays.toFixed(1)} days old`)

  for (const [, sym] of COINS) {
    const h = history[sym] ?? []
    while (h.length <= lastIdx) h.push(null)
    history[sym] = h.slice(0, lastIdx + 1)
  }
  // Days still missing in BTC (the reference coin) are fetched; the newest 3 days always are.
  const want = []
  for (let i = 0; i <= lastIdx; i++) if (history.BTC[i] === null || i > lastIdx - 3) want.push(i)
  check(want.length < 1200, `crypto: ${want.length} days to fetch`)
  console.log(`crypto: fetching ${want.length} day(s)`)

  let cursor = 0
  let fetched = 0
  async function worker() {
    while (cursor < want.length) {
      const i = want[cursor++]
      const date = iso(Date.parse(`${START}T00:00:00Z`) + i * DAY)
      const snap = i === lastIdx ? latest : await snapshot(date)
      if (!snap) continue
      const prices = pricesFromSnapshot(snap)
      for (const [, sym] of COINS) if (prices[sym] !== undefined) history[sym][i] = prices[sym]
      fetched++
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  // Glitches are removed from the history, but never from the newest day: that one must pass the jump check.
  for (const [, sym] of COINS) {
    const h = history[sym]
    const clean = despike(h)
    clean[lastIdx] = h[lastIdx]
    history[sym] = clean
  }
  const prices = pricesFromSnapshot(latest)
  checkRange(prices.BTC, 1000, 10_000_000, 'crypto BTC')
  checkRange(prices.ETH, 10, 1_000_000, 'crypto ETH')
  for (const s of STABLE) checkRange(prices[s], 0.9, 1.1, `crypto ${s}`)
  const coins = COINS.filter(([, sym]) => prices[sym] !== undefined)
  check(coins.length >= 20, `crypto: only ${coins.length} coins priced`)
  for (const [, sym] of coins) {
    const h = history[sym]
    const filled = h.filter((v) => v !== null).length
    check(filled > h.length * 0.9 || sym === 'SUI' || sym === 'APT', `crypto ${sym}: only ${filled} of ${h.length} days`)
    const before = h.slice(0, lastIdx).reverse().find((v) => v !== null)
    if (before) checkJump(before, prices[sym], STABLE.has(sym) ? 0.08 : 0.6, `crypto ${sym} day on day`)
  }
  const btcFilled = history.BTC.filter((v) => v !== null).length
  check(btcFilled > lastIdx * 0.95, `crypto: BTC history has ${btcFilled} of ${lastIdx + 1} days`)

  const lazy = new Map()
  for (const [, sym] of coins) lazy.set(`${sym}.json`, chunkedArray(history[sym], 64))
  commit(
    'crypto',
    {
      meta: meta({
        source: { name: 'Free Currency Exchange Rates API by Fawaz Ahmed (daily snapshot)', url: 'https://github.com/fawazahmed0/exchange-api' },
        licence: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        validFor: latest.date,
      }),
      date: latest.date,
      start: START,
      coins: coins.map(([, sym, name]) => ({ symbol: sym, name, usd: prices[sym] })),
    },
    lazy,
  )
  console.log(`crypto: ${fetched} snapshot(s) read`)
}

if (import.meta.url === `file://${process.argv[1]}`) run('crypto', main)
