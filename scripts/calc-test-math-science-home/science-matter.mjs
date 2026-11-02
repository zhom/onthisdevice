// Half-life, ideal gas, gears, density, molarity and molar mass (IUPAC 2021 abridged weights).
import { elapsed, halfLife, initial, remaining } from '../../src/components/tools/calc2/halflife.ts'
import { solveGas, R } from '../../src/components/tools/calc2/gas.ts'
import { train } from '../../src/components/tools/calc2/gears.ts'
import { density, submerged } from '../../src/components/tools/calc2/density.ts'
import { dilute, massNeeded, molarity } from '../../src/components/tools/calc2/molarity.ts'
import { molarMass, parseFormula } from '../../src/components/tools/calc2/chem.ts'
import { ELEMENTS } from '../../src/components/tools/calc2/elements.ts'

export default (t) => {
  t.near('C-14 after 11460 y = 25 %', remaining(100, 11460, 5730), 25, 1e-9)
  t.near('C-14 time for 30 % = 9952.8 y', elapsed(100, 30, 5730), 9952.8, 0.05)
  t.near('initial from remaining', initial(25, 11460, 5730), 100, 1e-9)
  t.near('half-life from data', halfLife(100, 12.5, 24.06), 8.02, 1e-9)
  t.near('I-131 after 30 d', remaining(1, 30, 8.02), 0.07481, 0.00001)

  t.near('R', R, 8.314462618)
  const v = solveGas('V', { P: 101325, n: 1, T: 273.15 })
  t.near('1 mol at STP = 22.414 L', v.V * 1000, 22.414, 0.0005)
  t.near('P from nRT/V', solveGas('P', { V: 0.0224, n: 1, T: 273.15 }).P, 101388.2, 0.1)
  t.near('n from PV/RT', solveGas('n', { P: 200000, V: 0.01, T: 300 }).n, 0.80182, 0.00001)
  t.near('T from PV/nR', solveGas('T', { P: 101325, V: 0.024465, n: 1 }).T, 298.15, 0.01)

  const g = train(20, 60, 1200, 10, false)
  t.near('gear 20:60 at 1200 rpm = 400 rpm', g.outRpm, 400)
  t.near('gear 20:60 torque ×3', g.outTorque, 30)
  t.ok('idler keeps the direction', train(20, 60, 1200, 10, true).sameDirection)

  t.near('water 1 kg in 1 L = 1000 kg/m³', density(1, 0.001), 1000)
  t.near('ice floats 91.7 % under', submerged(917, 1000), 0.917, 1e-9)
  t.near('steel sinks', submerged(7850, 1000), 1)

  t.near('58.44 g NaCl in 1 L = 1.000 M', molarity(58.44, molarMass('NaCl'), 1), 1.0, 0.0001)
  t.near('mass for 0.5 M NaCl in 250 mL', massNeeded(0.5, 58.44, 0.25), 7.305, 1e-9)
  t.near('dilution 1 M × 100 mL to 0.5 M = 200 mL', dilute('V2', { M1: 1, V1: 0.1, M2: 0.5, V2: 0 }).V2, 0.2, 1e-12)
  t.near('dilution 12 M × 50 mL in 500 mL = 1.2 M', dilute('M2', { M1: 12, V1: 50, M2: 0, V2: 500 }).M2, 1.2, 1e-12)

  t.eq('118 elements', ELEMENTS.length, 118)
  t.eq('element 118 is Og', ELEMENTS[117].symbol, 'Og')
  t.eq('element 26 is Fe', ELEMENTS[25].symbol, 'Fe')
  t.near('H2O 18.015', molarMass('H2O'), 18.015, 0.0005)
  t.near('NaCl 58.44', molarMass('NaCl'), 58.44, 0.0005)
  t.near('C6H12O6 180.156', molarMass('C6H12O6'), 180.156, 0.0005)
  t.near('Ca(OH)2 74.092', molarMass('Ca(OH)2'), 74.092, 0.0005)
  t.near('CuSO4·5H2O 249.68', molarMass('CuSO4·5H2O'), 249.68, 0.005)
  t.near('CuSO4.5H2O with a full stop', molarMass('CuSO4.5H2O'), 249.68, 0.005)
  t.near('CuSO4*5H2O with a star', molarMass('CuSO4*5H2O'), 249.68, 0.005)
  t.near('K4[Fe(CN)6] 368.35', molarMass('K4[Fe(CN)6]'), 368.35, 0.005)
  t.near('(NH4)2SO4 132.134', molarMass('(NH4)2SO4'), 132.134, 0.0005)
  t.near('subscripts H₂SO₄ 98.072', molarMass('H₂SO₄'), 98.072, 0.0005)
  const p = parseFormula('C6H12O6')
  t.near('C share of glucose 40.00 %', p.parts[0].percent, 40.002, 0.001)
  t.ok('unknown element is an error', parseFormula('Xy2').ok === false)
  t.ok('lowercase start is an error', parseFormula('h2o').ok === false)
  t.ok('missing bracket is an error', parseFormula('Ca(OH2').ok === false)
}
