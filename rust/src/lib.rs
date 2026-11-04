//! Compute kernels for onthisdevice.com. Built for wasm32 and called from
//! src/lib/engine. The module has no imports: every export is a pure kernel over
//! linear memory, and scheduling, progress and cancellation live in TypeScript.
//! Build with `npm run build:engine`.

pub mod bigint;
pub mod factor;
pub mod hash;
pub mod retire;
pub mod sieve;

use bigint::{Num, from_slice};
use factor::primes_to;
use hash::Hasher;
use retire::Plan;
use sieve::{Sieve, Stats};
use std::alloc::{Layout, alloc};
use std::cell::RefCell;
use std::slice;

const ALIGN: usize = 8;

/// Memory for the input and output of later calls. It lasts as long as the instance.
#[unsafe(no_mangle)]
pub extern "C" fn mem_alloc(len: usize) -> *mut u8 {
    // SAFETY: the alignment is a valid power of two and the size is not zero.
    unsafe { alloc(Layout::from_size_align_unchecked(len.max(1), ALIGN)) }
}

/// Calls `run` at the smallest supported width that holds `limbs` limbs.
macro_rules! sized {
    ($limbs:expr, $k:ident => $run:expr, [$($width:literal),+]) => {
        match $limbs {
            $(n if n <= $width => { const $k: usize = $width; $run })+
            _ => panic!("number too long"),
        }
    };
}

fn trimmed(n: *const u32, limbs: usize) -> &'static [u32] {
    // SAFETY: the caller passes `limbs` readable limbs that outlive the call.
    unsafe { slice::from_raw_parts(n, limbs) }
}

fn put<const K: usize>(found: Option<Num<K>>, out: *mut u32) -> bool {
    if let Some(f) = &found {
        // SAFETY: the caller reserves as many limbs as the input has, and a factor
        // is smaller than the input.
        unsafe { std::ptr::copy_nonoverlapping(f.as_ptr(), out, K.min(f.len())) };
    }
    found.is_some()
}

/// The smallest factor below `limit` (at most 2^16), or 0.
#[unsafe(no_mangle)]
pub extern "C" fn small_factor(n: *const u32, limbs: usize, limit: u32) -> u32 {
    factor::small_factor(trimmed(n, limbs), limit)
}

/// True for a prime, up to 1024 bits.
#[unsafe(no_mangle)]
pub extern "C" fn is_prime(n: *const u32, limbs: usize) -> bool {
    let n = trimmed(n, limbs);
    sized!(n.len(), K => factor::is_prime::<K>(&from_slice(n)), [4, 8, 16, 32])
}

/// Writes a factor of odd composite `n` to `out`. `out` holds 32 limbs.
#[unsafe(no_mangle)]
pub extern "C" fn rho(n: *const u32, limbs: usize, iterations: u32, seed: u64, out: *mut u32) -> bool {
    let n = trimmed(n, limbs);
    sized!(n.len(), K => put(factor::rho::<K>(&from_slice(n), iterations, seed), out), [4, 8, 16, 32])
}

thread_local! {
    static PRIMES: RefCell<(u32, Vec<u32>)> = const { RefCell::new((0, Vec::new())) };
    static SIEVE: RefCell<Option<Sieve>> = const { RefCell::new(None) };
}

/// Runs elliptic curves with stage 2 up to 100 b1. `out` holds 32 limbs.
#[unsafe(no_mangle)]
pub extern "C" fn ecm(n: *const u32, limbs: usize, b1: u32, curves: u32, seed: u64, out: *mut u32) -> bool {
    let n = trimmed(n, limbs);
    PRIMES.with_borrow_mut(|(bound, primes)| {
        if *bound != b1 {
            *primes = primes_to(b1.saturating_mul(100));
            *bound = b1;
        }
        sized!(n.len(), K => put(factor::ecm::<K>(&from_slice(n), b1, primes, curves, seed), out), [4, 8, 16, 32])
    })
}

/// Sieves lo..=hi. Writes the first `cap` primes to `list` and the totals to `stats`.
///
/// # Safety
/// `list` holds `cap` u64 values and `stats` holds one `Stats`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn sieve(lo: u64, hi: u64, list: *mut u64, cap: usize, stats: *mut Stats) {
    SIEVE.with_borrow_mut(|s| {
        let s = s.get_or_insert_with(Sieve::new);
        // SAFETY: see the contract above.
        unsafe { stats.write(s.run(lo, hi, slice::from_raw_parts_mut(list, cap))) };
    });
}

/// A digest state, or null for an unknown id. Ids are listed in `Hasher::new`.
#[unsafe(no_mangle)]
pub extern "C" fn hash_new(id: u32) -> *mut Hasher {
    Hasher::new(id).map_or(std::ptr::null_mut(), |h| Box::into_raw(Box::new(h)))
}

/// # Safety
/// `h` comes from `hash_new` and `data` holds `len` bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hash_update(h: *mut Hasher, data: *const u8, len: usize) {
    // SAFETY: see the contract above.
    unsafe { (*h).update(slice::from_raw_parts(data, len)) };
}

/// Consumes the state, writes the digest to `out` and returns its length.
///
/// # Safety
/// `h` comes from `hash_new` and `out` holds 64 bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn hash_finish(h: *mut Hasher, out: *mut u8) -> usize {
    // SAFETY: see the contract above.
    unsafe { Box::from_raw(h).finish(slice::from_raw_parts_mut(out, 64)) }
}

/// Histogram bins per year of `retire`.
#[unsafe(no_mangle)]
pub extern "C" fn retire_bins() -> usize {
    retire::BINS
}

/// The balance at the lower edge of a histogram bin.
#[unsafe(no_mangle)]
pub extern "C" fn retire_bin_floor(i: usize) -> f64 {
    retire::bin_floor(i)
}

/// Adds `paths` simulated paths to `hist` and `ruined`.
///
/// # Safety
/// `returns` holds `months` f64 values, `plan` is one `Plan`, `hist` holds
/// `years * BINS` u32 values and `ruined` holds `years` u32 values.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn retire(returns: *const f64, months: usize, plan: *const Plan, paths: u32, seed: u64, hist: *mut u32, ruined: *mut u32) {
    // SAFETY: see the contract above.
    unsafe {
        let plan = &*plan;
        let hist = slice::from_raw_parts_mut(hist, plan.years() * retire::BINS);
        let ruined = slice::from_raw_parts_mut(ruined, plan.years());
        retire::simulate(slice::from_raw_parts(returns, months), plan, paths, seed, hist, ruined);
    }
}

/// How many of `paths` simulated paths never run out.
///
/// # Safety
/// `returns` holds `months` f64 values and `plan` is one `Plan`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn retire_survivors(returns: *const f64, months: usize, plan: *const Plan, paths: u32, seed: u64) -> u32 {
    // SAFETY: see the contract above.
    unsafe { retire::survivors(slice::from_raw_parts(returns, months), &*plan, paths, seed) }
}
