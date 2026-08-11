export const HUD_UTILITY = Object.freeze({
  GRIMOIRE: "grimoire",
  HISTORY: "history",
  OPTIONS: "options",
});

export function toggleHudUtility(current, requested) {
  if (!Object.values(HUD_UTILITY).includes(requested)) {
    throw new TypeError(`Utilitário de HUD desconhecido: ${String(requested)}`);
  }
  return current === requested ? null : requested;
}

export function resourceHandTotal(resources = {}) {
  return Object.values(resources).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
}
