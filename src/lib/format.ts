/**
 * Turkish number formatting for the UI: decimal comma, whole numbers as-is.
 * Class stats such as speed (2.2) and range (1.5) were printed with a point,
 * next to timings on the landing that already read "0,25 sn".
 */
export function formatStat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
