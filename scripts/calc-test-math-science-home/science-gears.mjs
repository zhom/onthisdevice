// Gear trains and meshing.
import { meshPhase, ratioText, train } from '../../src/components/tools/calc2/gears.ts'

export default (t) => {
  const g = train(20, 60, 1200, 10, false)
  t.near('20:60 at 1200 rpm = 400 rpm', g.outRpm, 400, 1e-9)
  t.near('torque × 3', g.outTorque, 30, 1e-9)
  t.eq('ratio text 20:60', ratioText(20, 60), '3 : 1')
  t.ok('idler keeps direction', train(20, 60, 1, 1, true).sameDirection)
  // A tooth of A on the line of centres (y ≈ rA φ) meets the centre of a gap of B (y ≈ −rB (θ − π)).
  for (const [zA, zB, phiA] of [[20, 60, 0], [20, 60, 0.37], [14, 31, -1.2], [9, 50, 2.5]]) {
    const thB = meshPhase(zA, phiA, zB)
    const pA = (2 * Math.PI) / zA
    const pB = (2 * Math.PI) / zB
    // offset of A's nearest tooth from the line, as arc length on a module-1 pitch circle (r = z / 2)
    const fa = ((((0 - phiA) / pA) % 1) + 1.5) % 1 - 0.5
    const yTooth = -(zA / 2) * fa * pA
    // B's gaps are centred at thB + (k + 0.5) pB; offset of the nearest gap from π
    const fb = ((((Math.PI - thB) / pB - 0.5) % 1) + 1.5) % 1 - 0.5
    const yGap = (zB / 2) * fb * pB
    t.near(`mesh ${zA}/${zB} at ${phiA}`, yTooth, yGap, 1e-9)
  }
}
