//! Fixed-width odd modulus arithmetic in Montgomery form, on 32-bit limbs.
//!
//! wasm has a 64-bit multiply but no 64x64->128 multiply, so 32-bit limbs are the
//! fastest choice there. Values are little-endian `[u32; K]`.

pub type Num<const K: usize> = [u32; K];

pub fn from_u32<const K: usize>(v: u32) -> Num<K> {
    let mut out = [0; K];
    out[0] = v;
    out
}

pub fn from_slice<const K: usize>(v: &[u32]) -> Num<K> {
    let mut out = [0; K];
    out[..v.len()].copy_from_slice(v);
    out
}

pub fn is_zero<const K: usize>(a: &Num<K>) -> bool {
    a.iter().all(|&x| x == 0)
}

pub fn is_one<const K: usize>(a: &Num<K>) -> bool {
    a[0] == 1 && a[1..].iter().all(|&x| x == 0)
}

fn is_even<const K: usize>(a: &Num<K>) -> bool {
    a[0] & 1 == 0
}

pub fn less<const K: usize>(a: &Num<K>, b: &Num<K>) -> bool {
    for i in (0..K).rev() {
        if a[i] != b[i] {
            return a[i] < b[i];
        }
    }
    false
}

/// a + b, and the carry out of the top limb.
#[inline(always)]
pub fn add<const K: usize>(a: &Num<K>, b: &Num<K>) -> (Num<K>, bool) {
    let mut out = [0; K];
    let mut carry = 0u64;
    for i in 0..K {
        let v = a[i] as u64 + b[i] as u64 + carry;
        out[i] = v as u32;
        carry = v >> 32;
    }
    (out, carry != 0)
}

/// a - b, and the borrow out of the top limb.
#[inline(always)]
pub fn sub<const K: usize>(a: &Num<K>, b: &Num<K>) -> (Num<K>, bool) {
    let mut out = [0; K];
    let mut borrow = 0u64;
    for i in 0..K {
        let v = (a[i] as u64).wrapping_sub(b[i] as u64 + borrow);
        out[i] = v as u32;
        borrow = (v >> 63) & 1;
    }
    (out, borrow != 0)
}

/// a >> 1, with `top` shifted into the highest bit.
fn shr1<const K: usize>(a: &Num<K>, top: bool) -> Num<K> {
    let mut out = [0; K];
    for i in 0..K {
        let next = if i + 1 < K { a[i + 1] } else { top as u32 };
        out[i] = (a[i] >> 1) | (next << 31);
    }
    out
}

/// a >> bits, for bits < 32.
pub fn shr_limbs<const K: usize>(a: &Num<K>, bits: u32) -> Num<K> {
    let mut out = [0; K];
    for i in 0..K {
        let next = if i + 1 < K { a[i + 1] } else { 0 };
        out[i] = (a[i] >> bits) | if bits == 0 { 0 } else { next << (32 - bits) };
    }
    out
}

pub struct Mont<const K: usize> {
    pub n: Num<K>,
    /// -n^-1 mod 2^32.
    n0: u32,
    /// R^2 mod n.
    r2: Num<K>,
    /// R mod n: the number 1 in Montgomery form.
    pub one: Num<K>,
}

impl<const K: usize> Mont<K> {
    /// `n` must be odd and greater than 1.
    pub fn new(n: Num<K>) -> Self {
        let mut inv = 1u32;
        for _ in 0..5 {
            inv = inv.wrapping_mul(2u32.wrapping_sub(n[0].wrapping_mul(inv)));
        }
        let mut m = Self { n, n0: inv.wrapping_neg(), r2: [0; K], one: [0; K] };
        // 1 < n, so doubling 32K times gives R mod n, and 32K more gives R^2 mod n.
        let mut x = from_u32::<K>(1);
        for i in 0..64 * K {
            x = m.add(&x, &x);
            if i + 1 == 32 * K {
                m.one = x;
            }
        }
        m.r2 = x;
        m
    }

    #[inline(always)]
    pub fn add(&self, a: &Num<K>, b: &Num<K>) -> Num<K> {
        let (sum, carry) = add(a, b);
        if carry || !less(&sum, &self.n) { sub(&sum, &self.n).0 } else { sum }
    }

    #[inline(always)]
    pub fn sub(&self, a: &Num<K>, b: &Num<K>) -> Num<K> {
        let (diff, borrow) = sub(a, b);
        if borrow { add(&diff, &self.n).0 } else { diff }
    }

    /// Montgomery product a * b / R mod n (coarsely integrated operand scanning).
    pub fn mul(&self, a: &Num<K>, b: &Num<K>) -> Num<K> {
        let mut t = [0u32; K];
        let mut hi = 0u32;
        for &ai in a {
            let ai = ai as u64;
            let mut carry = 0u64;
            let mut reduce = 0u64;
            let v = t[0] as u64 + ai * b[0] as u64;
            let m = (v as u32).wrapping_mul(self.n0) as u64;
            carry += v >> 32;
            reduce += (v as u32 as u64 + m * self.n[0] as u64) >> 32;
            for j in 1..K {
                let v = t[j] as u64 + ai * b[j] as u64 + carry;
                carry = v >> 32;
                let w = v as u32 as u64 + m * self.n[j] as u64 + reduce;
                reduce = w >> 32;
                t[j - 1] = w as u32;
            }
            let v = hi as u64 + carry + reduce;
            t[K - 1] = v as u32;
            hi = (v >> 32) as u32;
        }
        if hi != 0 || !less(&t, &self.n) { sub(&t, &self.n).0 } else { t }
    }

    #[inline]
    pub fn sqr(&self, a: &Num<K>) -> Num<K> {
        self.mul(a, a)
    }

    pub fn enter(&self, a: &Num<K>) -> Num<K> {
        self.mul(a, &self.r2)
    }

    pub fn leave(&self, a: &Num<K>) -> Num<K> {
        self.mul(a, &from_u32(1))
    }

    /// Left-to-right square and multiply with a 4-bit window. `base` is in Montgomery form.
    pub fn pow(&self, base: &Num<K>, exp: &Num<K>) -> Num<K> {
        let mut table = [self.one; 16];
        for i in 1..16 {
            table[i] = self.mul(&table[i - 1], base);
        }
        let mut out = self.one;
        for i in (0..K * 8).rev() {
            let digit = (exp[i / 8] >> (i % 8 * 4)) & 15;
            for _ in 0..4 {
                out = self.sqr(&out);
            }
            out = self.mul(&out, &table[digit as usize]);
        }
        out
    }

    /// (x + n) / 2 when x is odd, x / 2 when it is even: halving mod n.
    fn halve(&self, x: &Num<K>) -> Num<K> {
        if is_even(x) {
            return shr1(x, false);
        }
        let (sum, carry) = add(x, &self.n);
        shr1(&sum, carry)
    }

    /// The inverse of a mod n, or `Err(g)` with g = gcd(a, n) when it has none.
    pub fn invert(&self, a: &Num<K>) -> Result<Num<K>, Num<K>> {
        if is_zero(a) {
            return Err(self.n);
        }
        let (mut u, mut v) = (*a, self.n);
        let (mut x1, mut x2) = (from_u32::<K>(1), [0; K]);
        while !is_one(&u) && !is_one(&v) {
            if is_zero(&u) {
                return Err(v);
            }
            while is_even(&u) {
                u = shr1(&u, false);
                x1 = self.halve(&x1);
            }
            while is_even(&v) {
                v = shr1(&v, false);
                x2 = self.halve(&x2);
            }
            if less(&u, &v) {
                v = sub(&v, &u).0;
                x2 = self.sub(&x2, &x1);
            } else {
                u = sub(&u, &v).0;
                x1 = self.sub(&x1, &x2);
            }
        }
        Ok(if is_one(&u) { x1 } else { x2 })
    }

    /// gcd(a, n). 1 when a and n share no factor.
    pub fn gcd(&self, a: &Num<K>) -> Num<K> {
        match self.invert(a) {
            Ok(_) => from_u32(1),
            Err(g) => g,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multiply_and_invert_near_the_top_of_the_range() {
        // 2^128 - 159 is prime, so the top bit of the modulus is set.
        let n: Num<4> = [0xffff_ff61, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff];
        let m = Mont::new(n);
        let a = m.enter(&[0xdead_beef, 0x0123_4567, 0x89ab_cdef, 0xfedc_ba98]);
        let inv = m.enter(&m.invert(&m.leave(&a)).unwrap());
        assert_eq!(m.mul(&a, &inv), m.one);
    }

    #[test]
    fn gcd_finds_a_shared_factor() {
        let m = Mont::new([15, 0, 0, 0]);
        assert_eq!(m.gcd(&[10, 0, 0, 0]), [5, 0, 0, 0]);
        assert_eq!(m.gcd(&[7, 0, 0, 0]), [1, 0, 0, 0]);
    }
}
