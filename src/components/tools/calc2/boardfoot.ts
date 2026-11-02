/** Board feet of lumber. Pure; the tests import it. */

/** One board foot: 12 × 12 × 1 in = 144 in³, in m³. */
export const BF_M3 = 144 * 0.0254 ** 3

/** Board feet = thickness (in) × width (in) × length (ft) ÷ 12, times the quantity. */
export function boardFeet(thicknessIn: number, widthIn: number, lengthFt: number, quantity = 1): number {
  return ((thicknessIn * widthIn * lengthFt) / 12) * quantity
}

/**
 * Dressed (actual) size of softwood dimension lumber from its nominal size,
 * per the American Softwood Lumber Standard: 1 → ¾, 2 to 6 → minus ½,
 * 8 and up → minus ¾ in.
 */
export function dressed(nominalIn: number): number {
  if (nominalIn <= 1) return nominalIn - 0.25
  if (nominalIn < 8) return nominalIn - 0.5
  return nominalIn - 0.75
}
