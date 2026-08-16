/**
 * Decide whether road placement should remain active after a successful road.
 *
 * Normal construction is a single visual action and returns to the build menu.
 * Road Builder is the deliberate exception: while more than one free road was
 * available before the click, the player is still resolving the same two-road
 * card sequence and should immediately be allowed to place the second road.
 */
export function shouldContinueRoadPlacement({ setupMode = false, freeRoadsBefore = 0 } = {}) {
  if (setupMode) return true;
  return Math.max(0, Number(freeRoadsBefore) || 0) > 1;
}
