import { getLobbyModeMeta } from "./lobbyModeCatalog.js";

const PHASE_LABELS = Object.freeze({
  lobby: "No salão",
  setup: "A preparar o reino",
  play: "Em partida",
  ended: "Partida terminada",
});

export function phaseLabel(phase) {
  return PHASE_LABELS[phase] || "Estado desconhecido";
}

export function formatSavedRealmDate(value, locale = "pt-PT") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data desconhecida";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function savedRealmStatus(entry) {
  if (!entry?.valid) return { label: "Save inválido", recoverable: false };
  return { label: phaseLabel(entry.game?.phase || entry.phase), recoverable: true };
}

/*
   A página de Arquivos não deve conhecer o schema interno do jogo. Converte-se
   aqui um save inspeccionado numa pequena ficha editorial pronta para a UI.
*/
export function savedRealmSummary(entry) {
  const game = entry?.game ?? null;
  const status = savedRealmStatus(entry);
  const mode = game ? getLobbyModeMeta(game.mode) : null;
  const playerCount = Array.isArray(game?.players) ? game.players.length : null;
  const round = Number.isInteger(game?.round) ? game.round : null;
  return {
    code: entry?.code ?? "—",
    valid: entry?.valid === true,
    recoverable: status.recoverable,
    statusLabel: status.label,
    modeLabel: mode?.name ?? "Modo desconhecido",
    playerCount,
    round,
    updatedLabel: formatSavedRealmDate(entry?.updatedAt),
    appVersion: entry?.appVersion || game?.appVersion || null,
    reason: entry?.reason || null,
    concluded: game?.phase === "ended" || entry?.phase === "ended",
  };
}
