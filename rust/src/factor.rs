//! Primality and factor finding: Miller-Rabin, Pollard rho (Brent) and the
//! elliptic curve method. Each kernel works on one modulus and returns one
//! factor at most; the caller recurses and schedules the work.

use crate::bigint::{Mont, Num, from_u32, is_one, is_zero, shr_limbs, sub};

/// Bases that make Miller-Rabin exact below 3.3e24.
const BASES: [u32; 13] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
/// Extra pseudo-random bases for larger numbers. 4^-20 error for a random composite.
const EXTRA_BASES: u32 = 20;

/// Smallest factor below `limit` (at most 2^16) by trial division, or 0.
pub fn small_factor(n: &[u32], limit: u32) -> u32 {
    let mut p = 2u32;
    while p < limit.min(1 << 16) {
        let mut rem = 0u64;
        for &limb in n.iter().rev() {
            rem = ((rem << 32) | limb as u64) % p as u64;
        }
        if rem == 0 {
            let is_n = n[0] == p && n[1..].iter().all(|&x| x == 0);
            return if is_n { 0 } else { p };
        }
        p += if p == 2 { 1 } else { 2 };
    }
    0
}

pub fn is_prime<const K: usize>(n: &Num<K>) -> bool {
    if n[0] & 1 == 0 {
        return n[0] == 2 && n[1..].iter().all(|&x| x == 0);
    }
    if n[1..].iter().all(|&x| x == 0) && n[0] < 2 {
        return false;
    }
    if n[1..].iter().all(|&x| x == 0) && BASES.contains(&n[0]) {
        return true;
    }
    let m = Mont::new(*n);
    let minus_one = sub(&m.n, &m.one).0;
    let n_minus_1 = sub(n, &from_u32(1)).0;
    let (mut d, mut s) = (n_minus_1, 0u32);
    while d[0] & 1 == 0 {
        d = shr_limbs(&d, 1);
        s += 1;
    }
    let bits = 32 * K - n.iter().rev().map(|x| x.leading_zeros() as usize).take_while(|&z| z == 32).count() * 32;
    let mut rng = Rng::new(n.iter().fold(0x9e37_79b9_7f4a_7c15, |h, &x| (h ^ x as u64).wrapping_mul(0x100_0000_01b3)));
    let extra = if bits > 80 { EXTRA_BASES } else { 0 };
    let bases = BASES.iter().copied().chain((0..extra).map(|_| (rng.next() as u32) | 3));
    'witness: for base in bases {
        let a = m.enter(&from_u32(base));
        if is_zero(&a) {
            continue;
        }
        let mut x = m.pow(&a, &d);
        if x == m.one || x == minus_one {
            continue;
        }
        for _ in 1..s {
            x = m.sqr(&x);
            if x == minus_one {
                continue 'witness;
            }
        }
        return false;
    }
    true
}

pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self(seed)
    }

    /// SplitMix64.
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }
}

fn useful<const K: usize>(g: Num<K>, n: &Num<K>) -> Option<Num<K>> {
    (!is_one(&g) && g != *n).then_some(g)
}

/// Pollard rho with Brent's cycle finding, for `iterations` steps at most.
pub fn rho<const K: usize>(n: &Num<K>, iterations: u32, seed: u64) -> Option<Num<K>> {
    const BATCH: u32 = 128;
    let m = Mont::new(*n);
    let mut rng = Rng::new(seed);
    let c = m.enter(&from_u32(rng.next() as u32 | 1));
    let mut y = m.enter(&from_u32(rng.next() as u32 | 2));
    let f = |v: &Num<K>| m.add(&m.sqr(v), &c);
    let (mut r, mut done) = (1u32, 0u32);
    while done < iterations {
        let x = y;
        for _ in 0..r {
            y = f(&y);
        }
        let mut k = 0;
        while k < r {
            let saved = y;
            let mut q = m.one;
            let lim = BATCH.min(r - k);
            for _ in 0..lim {
                y = f(&y);
                q = m.mul(&q, &m.sub(&x, &y));
            }
            done += lim;
            let g = m.gcd(&q);
            if !is_one(&g) {
                if g != *n {
                    return Some(g);
                }
                // The batch swallowed every factor at once: replay it step by step.
                let mut z = saved;
                for _ in 0..lim {
                    z = f(&z);
                    let g = m.gcd(&m.sub(&x, &z));
                    if !is_one(&g) {
                        return useful(g, n);
                    }
                }
                return None;
            }
            k += BATCH;
        }
        done += r;
        r = r.saturating_mul(2);
    }
    None
}

#[derive(Clone, Copy)]
struct Point<const K: usize> {
    x: Num<K>,
    z: Num<K>,
}

struct Curve<const K: usize> {
    m: Mont<K>,
    a24: Num<K>,
}

impl<const K: usize> Curve<K> {
    fn double(&self, p: &Point<K>) -> Point<K> {
        let m = &self.m;
        let s = m.sqr(&m.add(&p.x, &p.z));
        let d = m.sqr(&m.sub(&p.x, &p.z));
        let t = m.sub(&s, &d);
        Point { x: m.mul(&s, &d), z: m.mul(&t, &m.add(&d, &m.mul(&self.a24, &t))) }
    }

    /// p + q, given p - q.
    fn add(&self, p: &Point<K>, q: &Point<K>, diff: &Point<K>) -> Point<K> {
        let m = &self.m;
        let u = m.mul(&m.sub(&p.x, &p.z), &m.add(&q.x, &q.z));
        let v = m.mul(&m.add(&p.x, &p.z), &m.sub(&q.x, &q.z));
        Point { x: m.mul(&diff.z, &m.sqr(&m.add(&u, &v))), z: m.mul(&diff.x, &m.sqr(&m.sub(&u, &v))) }
    }

    /// ([k]p, [k+1]p) by the Montgomery ladder. k >= 1.
    fn ladder(&self, k: u32, p: &Point<K>) -> (Point<K>, Point<K>) {
        let (mut r0, mut r1) = (*p, self.double(p));
        for bit in (0..31 - k.leading_zeros()).rev() {
            let sum = self.add(&r0, &r1, p);
            if k >> bit & 1 == 0 {
                r0 = self.double(&r0);
                r1 = sum;
            } else {
                r1 = self.double(&r1);
                r0 = sum;
            }
        }
        (r0, r1)
    }
}

/// Giant-step width of stage 2. 2310 = 2 x 3 x 5 x 7 x 11.
const D: usize = 2310;

fn coprime_to_d(j: usize) -> bool {
    [2, 3, 5, 7, 11].iter().all(|p| j % p != 0)
}

/// Primes up to `limit`. One bit per odd number, so a 100M table costs 6 MB to build.
pub fn primes_to(limit: u32) -> Vec<u32> {
    if limit < 2 {
        return Vec::new();
    }
    let bits = (limit as usize - 1) / 2 + 1;
    let mut composite = vec![0u64; bits.div_ceil(64)];
    let mut i = 1;
    while (2 * i + 1) * (2 * i + 1) <= limit as usize {
        if composite[i >> 6] >> (i & 63) & 1 == 0 {
            let p = 2 * i + 1;
            let mut j = (p * p) / 2;
            while j < bits {
                composite[j >> 6] |= 1 << (j & 63);
                j += p;
            }
        }
        i += 1;
    }
    let mut out = vec![2];
    out.extend((1..bits).filter(|&i| composite[i >> 6] >> (i & 63) & 1 == 0).map(|i| 2 * i as u32 + 1));
    out
}

/// One curve with stage 1 up to `b1` and stage 2 up to the last entry of `primes`.
fn curve<const K: usize>(n: &Num<K>, b1: u32, primes: &[u32], sigma: u32) -> Option<Num<K>> {
    let m = Mont::new(*n);
    // Suyama's parametrization: the group order is divisible by 12.
    let s = m.enter(&from_u32(sigma));
    let small = |v: u32| m.enter(&from_u32(v));
    let u = m.sub(&m.sqr(&s), &small(5));
    let v = m.mul(&s, &small(4));
    let u3 = m.mul(&u, &m.sqr(&u));
    let v3 = m.mul(&v, &m.sqr(&v));
    let vmu = m.sub(&v, &u);
    let num = m.mul(&m.mul(&vmu, &m.sqr(&vmu)), &m.add(&m.add(&m.add(&u, &u), &u), &v));
    let den = m.mul(&m.mul(&u3, &v), &small(16));
    let inv = match m.invert(&m.leave(&den)) {
        Ok(inv) => m.enter(&inv),
        Err(g) => return useful(g, n),
    };
    let curve = Curve { a24: m.mul(&num, &inv), m };
    let m = &curve.m;

    let mut p = Point { x: u3, z: v3 };
    let stage1 = primes.partition_point(|&q| q <= b1);
    for &q in &primes[..stage1] {
        let mut power = q as u64;
        while power <= b1 as u64 {
            p = curve.ladder(q, &p).0;
            power *= q as u64;
        }
    }
    let g = m.gcd(&p.z);
    if !is_one(&g) {
        return useful(g, n);
    }

    // Stage 2: a prime q = t D +- j divides the order when [t D]P and [j]P agree mod the factor.
    let mut baby = vec![p; D / 2 + 2];
    baby[2] = curve.double(&p);
    baby[3] = curve.add(&baby[2], &p, &p);
    for j in (5..=D / 2).step_by(2) {
        baby[j] = curve.add(&baby[j - 2], &baby[2], &baby[j - 4]);
    }
    let mut cross = vec![[0u32; K]; D / 2 + 2];
    for j in (1..=D / 2).step_by(2) {
        if coprime_to_d(j) {
            cross[j] = m.mul(&baby[j].x, &baby[j].z);
        }
    }
    let step = curve.ladder(D as u32, &p).0;
    let first = (b1 as usize / D).max(1);
    let (mut prev, mut cur) = if first == 1 {
        (p, step)
    } else {
        curve.ladder(first as u32 - 1, &step)
    };
    if first == 1 {
        // `prev` stands for [0]: the walk below needs the two points before the first window.
        let two = curve.double(&step);
        prev = step;
        cur = two;
    }
    let mut t = if first == 1 { 2 } else { first };
    let mut acc = m.one;
    let mut next = stage1;
    while next < primes.len() {
        let center = t * D;
        let top = center + D / 2;
        let cz = m.mul(&cur.x, &cur.z);
        while next < primes.len() && (primes[next] as usize) <= top {
            let q = primes[next] as usize;
            next += 1;
            let j = q.abs_diff(center);
            if j > D / 2 || cross[j] == [0; K] {
                continue;
            }
            // (Xt - Xj)(Zt + Zj) - XtZt + XjZj = Xt Zj - Xj Zt
            let w = m.mul(&m.sub(&cur.x, &baby[j].x), &m.add(&cur.z, &baby[j].z));
            acc = m.mul(&acc, &m.add(&m.sub(&w, &cz), &cross[j]));
        }
        let following = curve.add(&cur, &step, &prev);
        prev = cur;
        cur = following;
        t += 1;
    }
    useful(m.gcd(&acc), n)
}

/// Up to `curves` curves. `primes` must reach past `b1`; its last entry is stage 2's bound.
pub fn ecm<const K: usize>(n: &Num<K>, b1: u32, primes: &[u32], curves: u32, seed: u64) -> Option<Num<K>> {
    let mut rng = Rng::new(seed);
    (0..curves).find_map(|_| curve(n, b1, primes, (rng.next() as u32).max(6)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bigint::from_slice;

    fn num(v: u128) -> Num<4> {
        from_slice(&[v as u32, (v >> 32) as u32, (v >> 64) as u32, (v >> 96) as u32])
    }

    fn value(v: &Num<4>) -> u128 {
        v.iter().rev().fold(0, |a, &x| (a << 32) | x as u128)
    }

    #[test]
    fn exact_on_small_numbers() {
        let sieve = primes_to(20_000);
        for v in 0..20_000u32 {
            assert_eq!(is_prime(&num(v as u128)), sieve.binary_search(&v).is_ok(), "{v}");
        }
    }

    #[test]
    fn known_large_values() {
        assert!(is_prime(&num((1 << 127) - 1)));
        assert!(is_prime(&num(340282366920938463463374607431768211297))); // 2^128 - 159
        assert!(!is_prime(&num(3317044064679887385961981))); // strong pseudoprime to the first 13 bases
        assert!(!is_prime(&num(1000000007 * 1000000009)));
    }

    #[test]
    fn trial_division() {
        assert_eq!(small_factor(&[9], 1 << 16), 3);
        assert_eq!(small_factor(&[65_521], 1 << 16), 0);
        assert_eq!(small_factor(&[0, 1], 1 << 16), 2);
        assert_eq!(small_factor(&[1009 * 1013], 1000), 0);
    }

    #[test]
    fn rho_splits_a_semiprime() {
        let (p, q) = (1_000_000_007u128, 998_244_353u128);
        let f = rho(&num(p * q), 1 << 20, 1).map(|f| value(&f)).unwrap();
        assert!(f == p || f == q);
    }

    #[test]
    fn ecm_splits_two_twenty_digit_primes() {
        let (p, q) = (18446744073709551557u128, 18446744073709551533u128);
        let primes = primes_to(1_100_000);
        let f = ecm(&num(p * q), 11_000, &primes, 2000, 7).map(|f| value(&f)).unwrap();
        assert!(f == p || f == q);
    }

    #[test]
    fn ecm_finds_a_small_factor_with_a_tiny_bound() {
        let (p, q) = (999999999989u128, 10000000000000000000000013u128);
        let primes = primes_to(100_000);
        let f = ecm(&num(p * q), 1_000, &primes, 200, 3).map(|f| value(&f)).unwrap();
        assert_eq!(f % p, 0);
    }
}
