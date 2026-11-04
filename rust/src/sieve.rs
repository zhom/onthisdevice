//! Segmented sieve of Eratosthenes over odd numbers, one bit each.

use crate::factor::primes_to;

/// Bits per segment. 2^20 bits is 128 KiB, which fits L2 on every target.
const SEGMENT_BITS: usize = 1 << 20;
const SEGMENT_WORDS: usize = SEGMENT_BITS / 64;
/// Primes struck by the repeating pattern instead of one at a time.
const PATTERN_PRIMES: [u64; 5] = [3, 5, 7, 11, 13];
const PERIOD: usize = 3 * 5 * 7 * 11 * 13;

#[repr(C)]
#[derive(Default, Debug, PartialEq)]
pub struct Stats {
    pub count: u64,
    /// Pairs (p, p + 2) with both inside the range.
    pub twins: u64,
    pub max_gap: u64,
    /// The prime that opens the largest gap.
    pub max_gap_at: u64,
    pub first: u64,
    pub last: u64,
}

/// Word w of the pattern starts `64 w mod PERIOD` bits into the repeating stream, so
/// any start bit can be served by a word offset.
fn pattern() -> Vec<u64> {
    let mut struck = vec![false; PERIOD];
    for i in 0..PERIOD {
        let n = 2 * i as u64 + 1;
        struck[i] = PATTERN_PRIMES.iter().any(|p| n % p == 0);
    }
    (0..PERIOD + SEGMENT_WORDS)
        .map(|w| (0..64).fold(0, |word, b| word | (struck[(64 * w + b) % PERIOD] as u64) << b))
        .collect()
}

/// The word offset whose first bit sits at position `bit` of the stream.
fn pattern_word(bit: usize) -> usize {
    // 64^-1 mod 15015 is 9619.
    bit % PERIOD * 9619 % PERIOD
}

pub struct Sieve {
    pattern: Vec<u64>,
    /// Odd primes above the pattern, up to `limit`.
    base: Vec<u32>,
    limit: u32,
}

impl Sieve {
    pub fn new() -> Self {
        Self { pattern: pattern(), base: Vec::new(), limit: 0 }
    }

    fn prepare(&mut self, limit: u32) {
        if limit > self.limit {
            self.base = primes_to(limit).into_iter().filter(|&p| p > 13).collect();
            self.limit = limit;
        }
    }

    /// Primes in lo..=hi. The first `list.len()` of them go to `list`.
    pub fn run(&mut self, lo: u64, hi: u64, list: &mut [u64]) -> Stats {
        let mut stats = Stats::default();
        let mut listed = 0usize;
        let mut prev = 0u64;
        let mut take = |p: u64, s: &mut Stats| {
            s.count += 1;
            if listed < list.len() {
                list[listed] = p;
                listed += 1;
            }
            if s.first == 0 {
                s.first = p;
            } else {
                let gap = p - prev;
                s.twins += (gap == 2) as u64;
                if gap > s.max_gap {
                    s.max_gap = gap;
                    s.max_gap_at = prev;
                }
            }
            prev = p;
            s.last = p;
        };

        if lo <= 2 && hi >= 2 {
            take(2, &mut stats);
        }
        let start = lo.max(3) | 1;
        if start > hi {
            return stats;
        }
        for p in [3, 5, 7, 11, 13] {
            if p >= start && p <= hi {
                take(p, &mut stats);
            }
        }
        let start = start.max(17);
        if start > hi {
            return stats;
        }
        self.prepare((hi as f64).sqrt() as u32 + 1);

        let bits = ((hi - start) / 2 + 1) as usize;
        let reach = self.base.partition_point(|&p| (p as u64) * (p as u64) <= hi);
        let primes = &self.base[..reach];
        let mut next: Vec<u64> = primes
            .iter()
            .map(|&p| {
                let p = p as u64;
                let mut first = (p * p).max(start.div_ceil(p) * p);
                if first & 1 == 0 {
                    first += p;
                }
                (first - start) / 2
            })
            .collect();

        let mut words = vec![0u64; SEGMENT_WORDS];
        let mut done = 0usize;
        // Bit 0 of the pattern is the number 1, and bit i is 2 i + 1.
        // Reduce before narrowing: usize is 32 bits on wasm and start is not.
        let origin = (start / 2 % PERIOD as u64) as usize;
        while done < bits {
            let span = SEGMENT_BITS.min(bits - done);
            let at = pattern_word(origin + done % PERIOD);
            words.copy_from_slice(&self.pattern[at..at + SEGMENT_WORDS]);
            for (&p, n) in primes.iter().zip(next.iter_mut()) {
                let (p, mut i) = (p as u64, *n);
                while i < span as u64 {
                    // SAFETY: i < span <= SEGMENT_BITS, the bit length of `words`.
                    unsafe { *words.get_unchecked_mut((i >> 6) as usize) |= 1 << (i & 63) };
                    i += p;
                }
                *n = i - span as u64;
            }
            let base = start + 2 * done as u64;
            for (w, &word) in words.iter().enumerate() {
                let mut clear = !word;
                if (w + 1) * 64 > span {
                    let keep = span.saturating_sub(w * 64);
                    clear &= if keep >= 64 { !0 } else { (1u64 << keep) - 1 };
                }
                while clear != 0 {
                    let bit = clear.trailing_zeros() as u64;
                    clear &= clear - 1;
                    take(base + 2 * (w as u64 * 64 + bit), &mut stats);
                }
            }
            done += span;
        }
        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slow(lo: u64, hi: u64) -> Vec<u64> {
        (lo..=hi).filter(|&n| n >= 2 && (2..).take_while(|d| d * d <= n).all(|d| n % d != 0)).collect()
    }

    #[test]
    fn matches_trial_division() {
        let mut s = Sieve::new();
        for (lo, hi) in [(0, 2), (1, 200), (2, 3), (14, 20), (17, 17), (1000, 3000), (999_983, 1_001_000), (1 << 40, (1 << 40) + 5000)] {
            let want = slow(lo, hi);
            let mut list = vec![0; want.len() + 1];
            let stats = s.run(lo, hi, &mut list);
            assert_eq!(&list[..want.len()], &want[..], "{lo}..{hi}");
            assert_eq!(stats.count, want.len() as u64);
            assert_eq!(stats.twins, want.windows(2).filter(|w| w[1] - w[0] == 2).count() as u64);
            assert_eq!(stats.max_gap, want.windows(2).map(|w| w[1] - w[0]).max().unwrap_or(0));
        }
    }

    #[test]
    fn known_counts() {
        let mut s = Sieve::new();
        assert_eq!(s.run(0, 1_000_000_000, &mut []).count, 50_847_534);
        assert_eq!(s.run(1_000_000_000_000, 1_000_000_100_000, &mut []).count, 3_614);
    }

    #[test]
    fn crosses_segment_edges() {
        let mut s = Sieve::new();
        let lo = 2 * SEGMENT_BITS as u64 - 1000;
        let want = slow(lo, lo + 2000);
        let mut list = vec![0; want.len()];
        s.run(lo, lo + 2000, &mut list);
        assert_eq!(list, want);
    }
}
