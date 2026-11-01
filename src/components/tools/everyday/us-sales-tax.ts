/**
 * US state-level sales tax base rates.
 *
 * These are the *state* rates only. Cities, counties and special districts add
 * their own rates on top in most states, which is why the calculator keeps a
 * separate "local rate" field. `typicalLocal` is a rough, widely-cited average
 * of those local add-ons — it is a starting point, not an authority for a
 * specific address.
 *
 * Rates change by legislation; check your state revenue department before
 * relying on these for filing.
 */
export interface StateRate {
  /** USPS abbreviation. */
  code: string
  name: string
  /** State base rate, percent. */
  rate: number
  /** Typical additional local rate, percent. 0 where local sales tax is not levied. */
  typicalLocal: number
  note?: string
}

export const US_STATE_RATES: StateRate[] = [
  { code: 'AL', name: 'Alabama', rate: 4.0, typicalLocal: 5.3 },
  { code: 'AK', name: 'Alaska', rate: 0.0, typicalLocal: 1.8, note: 'No state sales tax; many boroughs and cities levy their own.' },
  { code: 'AZ', name: 'Arizona', rate: 5.6, typicalLocal: 2.8 },
  { code: 'AR', name: 'Arkansas', rate: 6.5, typicalLocal: 2.9 },
  { code: 'CA', name: 'California', rate: 7.25, typicalLocal: 1.6, note: 'The 7.25% state rate already includes a 1.25% mandatory local component.' },
  { code: 'CO', name: 'Colorado', rate: 2.9, typicalLocal: 4.9 },
  { code: 'CT', name: 'Connecticut', rate: 6.35, typicalLocal: 0 },
  { code: 'DE', name: 'Delaware', rate: 0.0, typicalLocal: 0, note: 'No sales tax at any level.' },
  { code: 'DC', name: 'District of Columbia', rate: 6.0, typicalLocal: 0 },
  { code: 'FL', name: 'Florida', rate: 6.0, typicalLocal: 1.0 },
  { code: 'GA', name: 'Georgia', rate: 4.0, typicalLocal: 3.4 },
  { code: 'HI', name: 'Hawaii', rate: 4.0, typicalLocal: 0.5, note: 'A general excise tax on the seller, usually passed on to the buyer.' },
  { code: 'ID', name: 'Idaho', rate: 6.0, typicalLocal: 0.03 },
  { code: 'IL', name: 'Illinois', rate: 6.25, typicalLocal: 2.6 },
  { code: 'IN', name: 'Indiana', rate: 7.0, typicalLocal: 0 },
  { code: 'IA', name: 'Iowa', rate: 6.0, typicalLocal: 0.9 },
  { code: 'KS', name: 'Kansas', rate: 6.5, typicalLocal: 2.2 },
  { code: 'KY', name: 'Kentucky', rate: 6.0, typicalLocal: 0 },
  { code: 'LA', name: 'Louisiana', rate: 5.0, typicalLocal: 5.1, note: 'State rate rose to 5% in January 2025.' },
  { code: 'ME', name: 'Maine', rate: 5.5, typicalLocal: 0 },
  { code: 'MD', name: 'Maryland', rate: 6.0, typicalLocal: 0 },
  { code: 'MA', name: 'Massachusetts', rate: 6.25, typicalLocal: 0 },
  { code: 'MI', name: 'Michigan', rate: 6.0, typicalLocal: 0 },
  { code: 'MN', name: 'Minnesota', rate: 6.875, typicalLocal: 1.2 },
  { code: 'MS', name: 'Mississippi', rate: 7.0, typicalLocal: 0.06 },
  { code: 'MO', name: 'Missouri', rate: 4.225, typicalLocal: 4.2 },
  { code: 'MT', name: 'Montana', rate: 0.0, typicalLocal: 0, note: 'No general sales tax; some resort towns levy local option taxes.' },
  { code: 'NE', name: 'Nebraska', rate: 5.5, typicalLocal: 1.4 },
  { code: 'NV', name: 'Nevada', rate: 6.85, typicalLocal: 1.4 },
  { code: 'NH', name: 'New Hampshire', rate: 0.0, typicalLocal: 0, note: 'No sales tax.' },
  { code: 'NJ', name: 'New Jersey', rate: 6.625, typicalLocal: 0 },
  { code: 'NM', name: 'New Mexico', rate: 4.875, typicalLocal: 2.8, note: 'A gross receipts tax rather than a classic sales tax.' },
  { code: 'NY', name: 'New York', rate: 4.0, typicalLocal: 4.5 },
  { code: 'NC', name: 'North Carolina', rate: 4.75, typicalLocal: 2.2 },
  { code: 'ND', name: 'North Dakota', rate: 5.0, typicalLocal: 2.0 },
  { code: 'OH', name: 'Ohio', rate: 5.75, typicalLocal: 1.5 },
  { code: 'OK', name: 'Oklahoma', rate: 4.5, typicalLocal: 4.5 },
  { code: 'OR', name: 'Oregon', rate: 0.0, typicalLocal: 0, note: 'No sales tax.' },
  { code: 'PA', name: 'Pennsylvania', rate: 6.0, typicalLocal: 0.34 },
  { code: 'RI', name: 'Rhode Island', rate: 7.0, typicalLocal: 0 },
  { code: 'SC', name: 'South Carolina', rate: 6.0, typicalLocal: 1.5 },
  { code: 'SD', name: 'South Dakota', rate: 4.2, typicalLocal: 1.9 },
  { code: 'TN', name: 'Tennessee', rate: 7.0, typicalLocal: 2.6 },
  { code: 'TX', name: 'Texas', rate: 6.25, typicalLocal: 2.0 },
  { code: 'UT', name: 'Utah', rate: 6.1, typicalLocal: 1.1, note: 'Includes the 1.25% mandatory statewide local component.' },
  { code: 'VT', name: 'Vermont', rate: 6.0, typicalLocal: 0.4 },
  { code: 'VA', name: 'Virginia', rate: 5.3, typicalLocal: 0.5, note: 'Includes a 1% mandatory local component.' },
  { code: 'WA', name: 'Washington', rate: 6.5, typicalLocal: 2.9 },
  { code: 'WV', name: 'West Virginia', rate: 6.0, typicalLocal: 0.6 },
  { code: 'WI', name: 'Wisconsin', rate: 5.0, typicalLocal: 0.7 },
  { code: 'WY', name: 'Wyoming', rate: 4.0, typicalLocal: 1.4 },
]
