export const ACTION_PRESENTATION = Object.freeze({
  HIDDEN: "hidden",
  ROLL: "roll",
  FULL: "full",
  MINIMIZED: "minimized",
  PLACEMENT: "placement",
});

const MAP_SELECTION = Object.freeze({
  estrada: Object.freeze({ label: "A construir: Estrada", hint: "Escolhe uma aresta válida no mapa." }),
  aldeia: Object.freeze({ label: "A construir: Aldeia", hint: "Escolhe um ponto válido no mapa." }),
  palacio: Object.freeze({ label: "A construir: Palácio", hint: "Escolhe uma aldeia tua para a elevar." }),
  suborno: Object.freeze({ label: "A escolher alvo do Suborno", hint: "Escolhe uma unidade válida no mapa." }),
  carruagem: Object.freeze({ label: "A colocar Carruagem", hint: "Escolhe um hexágono válido no mapa." }),
  mover: Object.freeze({ label: "A mover Carruagem", hint: "Escolhe um hexágono vizinho." }),
  fundar: Object.freeze({ label: "A fundar Aldeia", hint: "Escolhe um canto válido do hexágono." }),
});

export function mapSelectionPresentation(mode) {
  return mode ? MAP_SELECTION[mode] ?? null : null;
}

export function deriveActionPresentation({ myTurn, phase, winner, actionModel, interactionMode, minimized = false, forcedBoardChoice = false }) {
  if (!myTurn || phase !== "play" || winner != null || !actionModel) return Object.freeze({ mode: ACTION_PRESENTATION.HIDDEN });
  if (forcedBoardChoice) return Object.freeze({ mode: ACTION_PRESENTATION.HIDDEN });
  const placement = mapSelectionPresentation(interactionMode);
  if (placement) return Object.freeze({ mode: ACTION_PRESENTATION.PLACEMENT, ...placement });
  if (actionModel.phase === "roll") return Object.freeze({ mode: ACTION_PRESENTATION.ROLL });
  if (minimized) return Object.freeze({ mode: ACTION_PRESENTATION.MINIMIZED });
  return Object.freeze({ mode: ACTION_PRESENTATION.FULL });
}
