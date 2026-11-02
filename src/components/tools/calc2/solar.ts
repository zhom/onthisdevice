/** Solar array size from electricity use and sun hours. Pure; the tests import it. */

export interface SolarIn {
  /** Electricity to cover per day, kWh. */
  dailyKwh: number
  /** Peak sun hours per day (kWh/m² per day of sunlight). */
  sunHours: number
  /** Share of the panel rating that reaches the home after losses, 0..1. */
  derate: number
  /** Panel rating in watts. */
  panelW: number
  /** Panel area in m². */
  panelArea: number
}

export interface SolarOut {
  /** System size needed, kW: daily kWh ÷ (sun hours × derate). */
  kw: number
  panels: number
  /** Size with whole panels, kW. */
  installedKw: number
  /** Energy per day and per year from the installed panels, kWh. */
  dailyOut: number
  yearlyOut: number
  /** Panel area, m². */
  area: number
}

export function solar(i: SolarIn): SolarOut {
  const kw = i.dailyKwh / (i.sunHours * i.derate)
  const panels = Math.ceil((kw * 1000) / i.panelW - 1e-9)
  const installedKw = (panels * i.panelW) / 1000
  const dailyOut = installedKw * i.sunHours * i.derate
  return { kw, panels, installedKw, dailyOut, yearlyOut: dailyOut * 365, area: panels * i.panelArea }
}

/** Share of a day's energy made by time f of the daylight (0..1), for a sine-shaped output. */
export function dayShare(f: number): number {
  const x = Math.min(1, Math.max(0, f))
  return (1 - Math.cos(Math.PI * x)) / 2
}
