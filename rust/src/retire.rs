//! Monte Carlo retirement paths by block bootstrap of real market history.
//!
//! A path is a chain of multi-year blocks, each starting at a random month of history,
//! so bad years still cluster as they did. Months inside a year are compounded once up
//! front: a year then is one step, and a sum, not twelve.

/// Sub-bins per power of two: 2^(1/32) wide, 2.2%.
const SUB_BITS: u32 = 5;
const FIRST_EXPONENT: u64 = 1023 + 4; // 16
const OCTAVES: usize = 36; // up to 2^40, about 1.1 trillion
pub const BINS: usize = OCTAVES << SUB_BITS;

#[repr(C)]
pub struct Plan {
    pub start: f64,
    /// Added each month while saving.
    pub saving: f64,
    /// Taken each month in retirement.
    pub spending: f64,
    /// Share of the portfolio in stocks.
    pub stocks: f64,
    /// Monthly real return on the rest.
    pub other: f64,
    pub years_saving: u32,
    pub years_retired: u32,
    pub block_years: u32,
}

impl Plan {
    pub fn years(&self) -> usize {
        (self.years_saving + self.years_retired) as usize
    }
}

/// xoroshiro128++.
struct Rng(u64, u64);

impl Rng {
    fn new(seed: u64) -> Self {
        let mut mix = crate::factor::Rng::new(seed);
        Self(mix.next() | 1, mix.next())
    }

    #[inline(always)]
    fn next(&mut self) -> u64 {
        let (s0, mut s1) = (self.0, self.1);
        let out = s0.wrapping_add(s1).rotate_left(17).wrapping_add(s0);
        s1 ^= s0;
        self.0 = s0.rotate_left(49) ^ s1 ^ (s1 << 21);
        self.1 = s1.rotate_left(28);
        out
    }

    /// Uniform in 0..n. The multiply-shift bias is far below the sampling error.
    #[inline(always)]
    fn below(&mut self, n: u32) -> u32 {
        (((self.next() >> 32) * n as u64) >> 32) as u32
    }
}

/// Bin of a balance: the exponent and top mantissa bits of the float are a piecewise
/// linear log2, read off in one shift.
#[inline(always)]
fn bin(v: f64) -> usize {
    let at = (v.to_bits() >> (52 - SUB_BITS)) as i64 - ((FIRST_EXPONENT as i64) << SUB_BITS);
    at.clamp(0, BINS as i64 - 1) as usize
}

/// The balance at the lower edge of a bin.
pub fn bin_floor(i: usize) -> f64 {
    f64::from_bits(((FIRST_EXPONENT << SUB_BITS) + i as u64) << (52 - SUB_BITS))
}

/// One year from a given start month, in closed form.
#[derive(Clone, Copy)]
struct Year {
    /// A balance grows by this factor.
    grow: f64,
    /// A monthly flow of 1 adds up to this by year end.
    flow: f64,
    /// A monthly spend of 1 hits zero within the year for a balance below this.
    floor: f64,
}

fn year_table(returns: &[f64], plan: &Plan, blocks: usize) -> Vec<Year> {
    let growth = |m: usize| 1.0 + plan.stocks * returns[m % returns.len()] + (1.0 - plan.stocks) * plan.other;
    let mut table: Vec<Year> = (0..returns.len())
        .map(|from| {
            let (mut grow, mut flow, mut floor) = (1.0f64, 0.0f64, 0.0f64);
            for m in from..from + 12 {
                let g = growth(m);
                grow *= g;
                flow = flow * g + 1.0;
                floor = floor.max(flow / grow);
            }
            Year { grow, flow, floor }
        })
        .collect();
    // Repeat the head so a block may run past the last month without a modulo.
    let tail = table[..blocks * 12].to_vec();
    table.extend(tail);
    table
}

/// Runs paths and reports each year end to `solvent` and each ruin to `ruin`.
#[inline(always)]
fn walk(returns: &[f64], plan: &Plan, paths: u32, seed: u64, mut solvent: impl FnMut(usize, f64), mut ruin: impl FnMut(usize)) {
    let total = plan.years();
    let saving_years = plan.years_saving as usize;
    let block = (plan.block_years.max(1) as usize).min(returns.len() / 12);
    let table = year_table(returns, plan, block);
    let starts = returns.len() as u32;
    let mut rng = Rng::new(seed);

    'path: for _ in 0..paths {
        let mut balance = plan.start;
        let mut year = 0;
        while year < total {
            let from = rng.below(starts) as usize;
            let run = block.min(total - year);
            for (i, t) in table[from..].iter().step_by(12).take(run).enumerate() {
                let y = year + i;
                if y < saving_years {
                    balance = balance * t.grow + t.flow * plan.saving;
                } else if balance < t.floor * plan.spending {
                    ruin(y);
                    continue 'path;
                } else {
                    balance = balance * t.grow - t.flow * plan.spending;
                }
                solvent(y, balance);
            }
            year += run;
        }
    }
}

/// Adds `paths` paths. `hist`: `years * BINS` counts of the balance at each year end,
/// among solvent paths. `ruined`: `years` counts of paths that ran out in that year.
pub fn simulate(returns: &[f64], plan: &Plan, paths: u32, seed: u64, hist: &mut [u32], ruined: &mut [u32]) {
    walk(returns, plan, paths, seed, |y, b| hist[y * BINS + bin(b)] += 1, |y| ruined[y] += 1);
}

/// How many of `paths` paths never run out.
pub fn survivors(returns: &[f64], plan: &Plan, paths: u32, seed: u64) -> u32 {
    let mut ruined = 0;
    walk(returns, plan, paths, seed, |_, _| {}, |_| ruined += 1);
    paths - ruined
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan() -> Plan {
        Plan { start: 1000.0, saving: 0.0, spending: 0.0, stocks: 1.0, other: 0.0, years_saving: 0, years_retired: 10, block_years: 1 }
    }

    fn run(returns: &[f64], plan: &Plan, paths: u32) -> (Vec<u32>, Vec<u32>) {
        let mut hist = vec![0; plan.years() * BINS];
        let mut ruined = vec![0; plan.years()];
        simulate(returns, plan, paths, 1, &mut hist, &mut ruined);
        (hist, ruined)
    }

    #[test]
    fn bins_round_trip() {
        for v in [16.0, 100.0, 12_345.0, 9.9e11] {
            let lo = bin_floor(bin(v));
            assert!(lo <= v && v < lo * 1.023, "{v} {lo}");
        }
    }

    #[test]
    fn a_year_step_matches_twelve_month_steps() {
        let returns: Vec<f64> = (0..48).map(|i| ((i * 7919 % 101) as f64 - 45.0) / 1000.0).collect();
        let plan = Plan { saving: 7.0, ..plan() };
        let table = year_table(&returns, &plan, 2);
        let (mut slow, mut one) = (1000.0, 0.0);
        for m in 5..17 {
            slow = slow * (1.0 + returns[m]) + 7.0;
            one = one * (1.0 + returns[m]) + 1.0;
        }
        assert!((table[5].grow * 1000.0 + table[5].flow * 7.0 - slow).abs() < 1e-9);
        assert!((table[5].flow - one).abs() < 1e-12);
    }

    #[test]
    fn floor_is_the_exact_ruin_line() {
        let returns = [0.02, -0.5, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03];
        let plan = plan();
        let y = year_table(&returns, &plan, 1)[0];
        let survives = |start: f64| {
            let mut b = start;
            returns[..12].iter().all(|r| {
                b = b * (1.0 + r) - 1.0;
                b >= -1e-9
            })
        };
        assert!(survives(y.floor));
        assert!(!survives(y.floor - 1e-6));
    }

    #[test]
    fn constant_return_is_deterministic() {
        let plan = plan();
        let (hist, ruined) = run(&[0.01; 24], &plan, 1000);
        assert_eq!(hist[9 * BINS + bin(1000.0 * 1.01f64.powi(120))], 1000);
        assert_eq!(ruined.iter().sum::<u32>(), 0);
    }

    #[test]
    fn overspending_runs_out_in_the_right_year() {
        let plan = Plan { spending: 20.0, ..plan() };
        // 1000 at 20 a month lasts 50 months: the fifth year runs out.
        let (_, ruined) = run(&[0.0; 24], &plan, 500);
        assert_eq!(ruined[4], 500);
        assert_eq!(survivors(&[0.0; 24], &plan, 500, 1), 0);
    }

    #[test]
    fn zero_spending_with_nothing_saved_is_not_ruin() {
        let plan = Plan { start: 0.0, ..plan() };
        assert_eq!(survivors(&[0.0; 24], &plan, 100, 1), 100);
    }

    #[test]
    fn same_seed_same_result() {
        let plan = Plan { spending: 4.0, block_years: 3, ..plan() };
        let returns: Vec<f64> = (0..240).map(|i| ((i * 7919 % 101) as f64 - 45.0) / 1000.0).collect();
        assert_eq!(run(&returns, &plan, 2000), run(&returns, &plan, 2000));
    }
}
