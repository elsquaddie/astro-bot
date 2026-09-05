export const wrapDegrees = (angle: number) => ((angle % 360) + 360) % 360;
export const turnTo = (target: number, heading: number) => ((target - heading + 540) % 360) - 180;
export function compassHeading(absolute: boolean, alpha: number | null, beta: number | null, gamma: number | null, screenAngle = 0) {
  if (!absolute || alpha === null || beta === null || gamma === null ||
      ![alpha, beta, gamma, screenAngle].every(Number.isFinite)) return null;
  // Telegram reports radians; alpha rotates counterclockwise from magnetic north.
  // Only use a nearly horizontal phone, where its top edge has a stable bearing.
  if (Math.abs(beta) > Math.PI / 6 || Math.abs(gamma) > Math.PI / 6) return null;
  return wrapDegrees(-alpha * 180 / Math.PI + screenAngle);
}
