export const signedAngle = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;
// Keep the angle continuous across 0° so CSS never spins the long way round.
export function smoothHeading(previous: number | null, next: number) {
  return previous === null ? next : previous + signedAngle(next - previous) * 0.22;
}
