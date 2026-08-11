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
