/**
 * Interaction contract for the character wall.
 *
 * Once the signature scroll starts opening, the portraits behind it are no
 * longer interactive. Only explicit scroll controls may act until the preview
 * is cancelled/closed. Keeping this as a pure model makes the raycast policy
 * testable without a WebGL/Three.js runtime.
 */
export function getLobbySelectionInteraction({
  selectionEnabled = false,
  scrollOpen = false,
  scrollReady = false,
  scrollSigning = false,
} = {}) {
  const signatureLocked = selectionEnabled && scrollOpen;
  return {
    signatureLocked,
    portraitsInteractive: selectionEnabled && !signatureLocked,
    scrollTargetsInteractive: signatureLocked && scrollReady,
    canCancelSignature: signatureLocked && !scrollSigning,
    canConfirmSignature: signatureLocked && scrollReady && !scrollSigning,
  };
}
