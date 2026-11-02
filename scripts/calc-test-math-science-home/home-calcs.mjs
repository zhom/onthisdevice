// Home and construction calculators: published rules and hand-worked examples.
import { roof, roofMaterials, pitchFactor, riseFromDegrees } from '../../src/components/tools/calc2/roof.ts'
import { bedArea, bedVolume, bagsFor, MULCH_BAGS, weightOf, FT3_M3 } from '../../src/components/tools/calc2/landscape.ts'
import { drywall } from '../../src/components/tools/calc2/drywall.ts'
import { baseBtu, cooling, heating } from '../../src/components/tools/calc2/btu.ts'
import { applianceCost, totalCost, discRevPerSecond } from '../../src/components/tools/calc2/electricity.ts'
import { stairs } from '../../src/components/tools/calc2/stairs.ts'
import { wallpaper } from '../../src/components/tools/calc2/wallpaper.ts'
import { boardFeet, dressed, BF_M3 } from '../../src/components/tools/calc2/boardfoot.ts'
import { solar, dayShare } from '../../src/components/tools/calc2/solar.ts'

const FT = 0.3048
const IN = 0.0254

export default (t) => {
  // Roofing: pitch factor √(1 + (6/12)²) = 1.1180; 30 × 40 ft gable at 6/12 = 1,341.6 ft², 13.42 squares.
  t.near('pitch factor 6/12', pitchFactor(6), 1.1180, 0.0001)
  t.near('pitch factor 12/12 = √2', pitchFactor(12), Math.SQRT2, 1e-12)
  t.near('45° is 12 in 12', riseFromDegrees(45), 12, 1e-9)
  const g = roof({ length: 40, width: 30, rise: 6, overhang: 0, type: 'gable' })
  t.near('gable 30 × 40 at 6/12 area', g.area, 1341.64, 0.01)
  t.near('gable ridge = long side', g.ridge, 40, 1e-9)
  t.near('gable rafter = 15 × 1.118', g.rafter, 16.7705, 0.0001)
  const m = roofMaterials(g.area, 0)
  t.near('squares', m.squares, 13.4164, 0.0001)
  t.eq('bundles = ceil(13.42 × 3)', m.bundles, 41)
  t.eq('underlayment rolls (1,000 ft²)', m.underlayment, 2)
  const h = roof({ length: 40, width: 30, rise: 6, overhang: 0, type: 'hip' })
  t.near('hip area equals gable area at one pitch', h.area, g.area, 1e-9)
  t.near('hip ridge = 40 − 30', h.ridge, 10, 1e-9)
  // hip rafter: √(2 × 15² + 7.5²) = 22.5 ft, four of them
  t.near('hip lengths', h.hips, 90, 1e-9)
  const s = roof({ length: 20, width: 10, rise: 3, overhang: 1, type: 'shed' })
  t.near('shed with 1 ft overhang: 22 × 12 × √(1 + 0.0625)', s.area, 264 * Math.sqrt(1.0625), 1e-9)

  // Gravel: 10 × 10 ft at 3 in = 25 ft³ = 0.926 yd³.
  const v = bedVolume(bedArea('rect', 10 * FT, 10 * FT), 3 * IN)
  t.near('gravel ft³', v.ft3, 25, 1e-9)
  t.near('gravel yd³', v.yd3, 0.9259, 0.0001)
  t.near('circle bed area, 10 ft across', bedArea('circle', 10, 0), 78.5398, 0.0001)
  // 1 yd³ of 1,680 kg/m³ gravel = 1,284.4 kg = 1.416 US tons
  t.near('gravel tons per yd³', weightOf(0.764554857984, 1680).tons, 1.4159, 0.0001)

  // Mulch: 100 ft² at 3 in = 25 ft³ = 12.5 bags of 2 ft³ -> 13.
  const mv = bedVolume(100 * FT * FT, 3 * IN)
  t.near('mulch ft³', mv.ft3, 25, 1e-9)
  t.eq('mulch 2 ft³ bags', bagsFor(mv.m3, MULCH_BAGS[0].m3), 13)
  t.eq('mulch 3 ft³ bags', bagsFor(mv.m3, MULCH_BAGS[1].m3), 9)
  t.eq('exact fit does not round up: 24 ft³ in 2 ft³ bags', bagsFor(24 * FT3_M3, MULCH_BAGS[0].m3), 12)

  // Drywall: 12 × 12 room, 8 ft walls = 384 ft² = 12 sheets of 4 × 8 before openings.
  const d = drywall({ length: 12, width: 12, height: 8, ceiling: false, doors: 0, windows: 0, sheetArea: 32, waste: 0 })
  t.near('drywall wall area', d.walls, 384, 1e-9)
  t.eq('drywall sheets 4 × 8', d.sheets, 12)
  const d2 = drywall({ length: 12, width: 12, height: 8, ceiling: true, doors: 1, windows: 1, sheetArea: 32, waste: 10 })
  // 384 + 144 − 21 − 15 = 492 ft² × 1.1 = 541.2 / 32 = 16.9 -> 17
  t.near('drywall net with ceiling and openings', d2.net, 492, 1e-9)
  t.eq('drywall sheets with 10 % waste', d2.sheets, 17)
  t.near('joint tape 370 ft per 1,000 ft²', d2.tapeFt, 182.04, 1e-9)

  // BTU: ENERGY STAR table. 400 ft² = 9,000; 401 = 10,000; sunny +10 %; 4 people +1,200.
  t.eq('400 ft²', baseBtu(400), 9000)
  t.eq('401 ft²', baseBtu(401), 10000)
  t.eq('100 ft²', baseBtu(100), 5000)
  t.eq('2,500 ft²', baseBtu(2500), 34000)
  t.eq('above the table', baseBtu(2501), null)
  const c = cooling({ areaFt2: 400, sun: 'sunny', people: 4, kitchen: false })
  t.near('sunny +10 %', c.sunAdj, 900, 1e-9)
  t.near('4 people +1,200', c.peopleAdj, 1200, 1e-9)
  t.near('total 9,000 + 900 + 1,200', c.total, 11100, 1e-9)
  t.near('kitchen +4,000, shaded −10 %', cooling({ areaFt2: 300, sun: 'shaded', people: 2, kitchen: true }).total, 7000 - 700 + 4000, 1e-9)
  t.near('heating 12 × 15 × 8 ft, 40 °F rise, good insulation', heating(1440, 40, 'good'), 7660.8, 1e-6)

  // Electricity: 1,500 W × 3 h × 30 d at $0.15 = 135 kWh = $20.25.
  const e = applianceCost({ watts: 1500, hours: 3, quantity: 1 }, 30, 0.15)
  t.near('kWh in 30 days', e.kwhPeriod, 135, 1e-9)
  t.near('cost in 30 days', e.costPeriod, 20.25, 1e-9)
  t.near('cost per year', e.costYear, 0.675 * 365, 1e-9)
  t.near('two appliances', totalCost([{ watts: 1500, hours: 3, quantity: 1 }, { watts: 10, hours: 5, quantity: 4 }], 30, 0.15).kwhDay, 4.7, 1e-9)
  // Kh 7.2: 1,000 W turns the disc 1000 / 7.2 = 138.9 times per hour.
  t.near('disc rev/h at 1 kW', discRevPerSecond(1000) * 3600, 138.889, 0.001)

  // Stairs: 108 in rise -> 14 risers of 7.714 in; 13 treads of 10 in = 130 in run.
  const st = stairs({ rise: 108, maxRiser: 7.75, tread: 10 })
  t.eq('risers', st.risers, 14)
  t.near('riser height', st.riser, 7.7143, 0.0001)
  t.eq('treads', st.treads, 13)
  t.near('total run', st.run, 130, 1e-9)
  t.near('stringer √(108² + 130²)', st.stringer, 169.0089, 0.0001)
  t.near('angle atan(7.714/10)', st.angle, 37.648, 0.001)
  t.eq('exact rise of 7 × 7.75 keeps 7 risers', stairs({ rise: 54.25, maxRiser: 7.75, tread: 10 }).risers, 7)

  // Wallpaper: 96 in wall, 21 in repeat, 4 in trim -> 105 in drops; a 33 ft (396 in) roll gives 3.
  const w = wallpaper({ perimeter: 48 * FT, height: 96 * IN, repeat: 21 * IN, trim: 4 * IN, rollWidth: 27 * IN, rollLength: 33 * FT, doors: 0, doorWidth: 0 })
  t.near('drop 105 in', w.drop / IN, 105, 1e-9)
  t.eq('strips per roll', w.perRoll, 3)
  t.eq('strips for 48 ft of wall at 27 in', w.strips, 22)
  t.eq('rolls', w.rolls, 8)
  const w0 = wallpaper({ perimeter: 10, height: 2.4, repeat: 0, trim: 0.1, rollWidth: 0.53, rollLength: 10.05, doors: 1, doorWidth: 0.9 })
  t.eq('euro roll, no repeat: 4 strips of 2.5 m', w0.perRoll, 4)
  t.eq('euro roll strips after one door', w0.strips, 18)

  // Board feet: 2 × 6 × 8 ft = 8 bf; 1 bf = 144 in³ = 0.00236 m³.
  t.near('2 × 6 × 8', boardFeet(2, 6, 8), 8, 1e-12)
  t.near('4/4 × 12 in × 12 ft, 3 boards', boardFeet(1, 12, 12, 3), 36, 1e-12)
  t.near('1 bf in m³', BF_M3, 0.002359737, 1e-9)
  t.eq('2 × 6 dressed', [dressed(2), dressed(6)], [1.5, 5.5])
  t.eq('1 × 8 and 2 × 10 dressed', [dressed(1), dressed(8), dressed(10)], [0.75, 7.25, 9.25])

  // Solar: 30 kWh/day at 5 sun hours and 0.8 -> 7.5 kW -> 19 panels of 400 W.
  const so = solar({ dailyKwh: 30, sunHours: 5, derate: 0.8, panelW: 400, panelArea: 1.95 })
  t.near('system kW', so.kw, 7.5, 1e-12)
  t.eq('panels', so.panels, 19)
  t.near('installed kW', so.installedKw, 7.6, 1e-12)
  t.near('yearly kWh', so.yearlyOut, 7.6 * 5 * 0.8 * 365, 1e-9)
  t.near('half the energy by noon', dayShare(0.5), 0.5, 1e-12)
}
