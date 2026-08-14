export const WIZARD_TUTORIAL_VERSION = 4;

export const WIZARD_STATUS = Object.freeze({
  NEW: "new",
  GUIDED: "guided",
  SKIPPED: "skipped",
  COMPLETE: "complete",
});

export const WIZARD_SCOPE = Object.freeze({
  FOYER: "foyer",
  REALM: "realm",
  ANY: "any",
});

export const WIZARD_STEP = Object.freeze({
  WELCOME: "welcome",
  FOYER_PAGES: "foyer-pages",
  FOYER_JOIN: "foyer-join",
  FOYER_ARCHIVES: "foyer-archives",
  FOYER_MORE: "foyer-more",
  FOYER_CREATE: "foyer-create",
  FOYER_MODE: "foyer-mode",
  FOYER_FOUND_REALM: "foyer-found-realm",
  REALM_SELECT_CHARACTER: "realm-select-character",
  REALM_SIGN_CHARACTER: "realm-sign-character",
  REALM_READY: "realm-ready",
  REALM_START: "realm-start",
  REALM_CHANGE_HOUSE: "realm-change-house",
  REALM_DISBAND: "realm-disband",
  GAME_TUTORIAL_OFFER: "game-tutorial-offer",
  GAME_TUTORIAL_MODE: "game-tutorial-mode",
});

export const WIZARD_TRAINING_MODES = Object.freeze(["classico", "rapido", "dragao"]);

/*
 * O onboarding v4 é uma viagem única e retomável. Primeiro percorre as áreas
 * principais do Códice; depois funda um Reino, escolhe/assina uma Casa,
 * explica Ready/Start Match e desfaz o Reino para regressar ao ponto inicial.
 * Os passos de ação só terminam quando o estado real confirma a ação.
 */
export const FOYER_WIZARD_STEPS = Object.freeze([
  WIZARD_STEP.FOYER_PAGES,
  WIZARD_STEP.FOYER_JOIN,
  WIZARD_STEP.FOYER_ARCHIVES,
  WIZARD_STEP.FOYER_MORE,
  WIZARD_STEP.FOYER_CREATE,
  WIZARD_STEP.FOYER_MODE,
  WIZARD_STEP.FOYER_FOUND_REALM,
]);

export const REALM_WIZARD_STEPS = Object.freeze([
  WIZARD_STEP.REALM_SELECT_CHARACTER,
  WIZARD_STEP.REALM_SIGN_CHARACTER,
  WIZARD_STEP.REALM_READY,
  WIZARD_STEP.REALM_START,
  WIZARD_STEP.REALM_CHANGE_HOUSE,
  WIZARD_STEP.REALM_DISBAND,
]);

export const GUIDED_ONBOARDING_STEPS = Object.freeze([
  ...FOYER_WIZARD_STEPS,
  ...REALM_WIZARD_STEPS,
]);

const REALM_SETUP_STEPS = Object.freeze([
  WIZARD_STEP.FOYER_CREATE,
  WIZARD_STEP.FOYER_MODE,
  WIZARD_STEP.FOYER_FOUND_REALM,
  ...REALM_WIZARD_STEPS,
]);

const STEP_SCOPES = Object.freeze({
  [WIZARD_STEP.FOYER_PAGES]: WIZARD_SCOPE.FOYER,
  [WIZARD_STEP.FOYER_JOIN]: WIZARD_SCOPE.FOYER,
  [WIZARD_STEP.FOYER_ARCHIVES]: WIZARD_SCOPE.FOYER,
  [WIZARD_STEP.FOYER_MORE]: WIZARD_SCOPE.FOYER,
  [WIZARD_STEP.FOYER_CREATE]: WIZARD_SCOPE.FOYER,
  [WIZARD_STEP.FOYER_MODE]: WIZARD_SCOPE.FOYER,
  // Estes passos atravessam uma mudança de âmbito e ficam visíveis até a
  // transição real confirmar que o Reino nasceu/foi desfeito.
  [WIZARD_STEP.FOYER_FOUND_REALM]: WIZARD_SCOPE.ANY,
  [WIZARD_STEP.REALM_SELECT_CHARACTER]: WIZARD_SCOPE.REALM,
  [WIZARD_STEP.REALM_SIGN_CHARACTER]: WIZARD_SCOPE.REALM,
  [WIZARD_STEP.REALM_READY]: WIZARD_SCOPE.REALM,
  [WIZARD_STEP.REALM_START]: WIZARD_SCOPE.REALM,
  [WIZARD_STEP.REALM_CHANGE_HOUSE]: WIZARD_SCOPE.REALM,
  [WIZARD_STEP.REALM_DISBAND]: WIZARD_SCOPE.ANY,
});

export function wizardStepScope(step) {
  return STEP_SCOPES[step] ?? WIZARD_SCOPE.ANY;
}

export function createWizardProgress(overrides = {}) {
  return {
    version: WIZARD_TUTORIAL_VERSION,
    status: WIZARD_STATUS.NEW,
    welcomed: false,
    completedSteps: [],
    foyerComplete: false,
    realmComplete: false,
    gameTutorialOfferSeen: false,
    gameTutorialWanted: null,
    preferredTrainingMode: null,
    ...overrides,
  };
}

function uniqueSteps(steps) {
  return [...new Set(Array.isArray(steps) ? steps.filter((step) => typeof step === "string") : [])];
}

export function normalizeWizardProgress(value) {
  if (!value || typeof value !== "object" || Number(value.version) !== WIZARD_TUTORIAL_VERSION) {
    return createWizardProgress();
  }
  const status = Object.values(WIZARD_STATUS).includes(value.status) ? value.status : WIZARD_STATUS.NEW;
  const preferredTrainingMode = WIZARD_TRAINING_MODES.includes(value.preferredTrainingMode)
    ? value.preferredTrainingMode
    : null;
  const completedSteps = uniqueSteps(value.completedSteps);
  const foyerComplete = FOYER_WIZARD_STEPS.every((candidate) => completedSteps.includes(candidate));
  const realmComplete = REALM_WIZARD_STEPS.every((candidate) => completedSteps.includes(candidate));
  return createWizardProgress({
    status,
    welcomed: value.welcomed === true,
    completedSteps,
    foyerComplete,
    realmComplete,
    gameTutorialOfferSeen: value.gameTutorialOfferSeen === true,
    gameTutorialWanted: value.gameTutorialWanted === true ? true : value.gameTutorialWanted === false ? false : null,
    preferredTrainingMode,
  });
}

export function beginWizardTour(progress) {
  return normalizeWizardProgress({
    ...progress,
    version: WIZARD_TUTORIAL_VERSION,
    status: WIZARD_STATUS.GUIDED,
    welcomed: true,
  });
}

export function skipWizardTour(progress) {
  return normalizeWizardProgress({
    ...progress,
    version: WIZARD_TUTORIAL_VERSION,
    status: WIZARD_STATUS.SKIPPED,
    welcomed: true,
  });
}

export function completeWizardStep(progress, step) {
  const current = normalizeWizardProgress(progress);
  const completedSteps = uniqueSteps([...current.completedSteps, step]);
  return normalizeWizardProgress({ ...current, completedSteps });
}

export function completeWizardSteps(progress, steps) {
  return (Array.isArray(steps) ? steps : []).reduce((current, step) => completeWizardStep(current, step), progress);
}

export function answerGameTutorialOffer(progress, wanted) {
  const current = normalizeWizardProgress(progress);
  return normalizeWizardProgress({
    ...current,
    gameTutorialOfferSeen: true,
    gameTutorialWanted: wanted === true,
    status: wanted === true ? WIZARD_STATUS.GUIDED : WIZARD_STATUS.COMPLETE,
  });
}

export function chooseTrainingMode(progress, mode) {
  if (!WIZARD_TRAINING_MODES.includes(mode)) return normalizeWizardProgress(progress);
  const current = normalizeWizardProgress(progress);
  return normalizeWizardProgress({
    ...current,
    gameTutorialOfferSeen: true,
    gameTutorialWanted: true,
    preferredTrainingMode: mode,
    status: WIZARD_STATUS.COMPLETE,
  });
}

export function restartWizardScope(progress, scope) {
  const current = normalizeWizardProgress(progress);
  const resetSteps = scope === WIZARD_SCOPE.REALM ? REALM_WIZARD_STEPS : FOYER_WIZARD_STEPS;
  const completedSteps = current.completedSteps.filter((step) => !resetSteps.includes(step));
  return normalizeWizardProgress({
    ...current,
    status: WIZARD_STATUS.GUIDED,
    completedSteps,
    gameTutorialOfferSeen: scope === WIZARD_SCOPE.FOYER ? false : current.gameTutorialOfferSeen,
    gameTutorialWanted: scope === WIZARD_SCOPE.FOYER ? null : current.gameTutorialWanted,
  });
}

export function resetWizardProgress() {
  return createWizardProgress();
}

function firstIncomplete(sequence, completedSteps) {
  return sequence.find((step) => !completedSteps.includes(step)) ?? null;
}

/*
 * Reentrada explícita pelo orbe. O progresso normal nunca é rebobinado só
 * porque houve um render transitório no foyer durante recovery. Só quando o
 * jogador pede para continuar é que corrigimos uma viagem incompatível com o
 * estado atual.
 *
 * Caso típico: saltou/fechou durante a escolha ou assinatura e entretanto o
 * Reino deixou de existir. Mantemos a visita ao Códice concluída e voltamos
 * apenas a "Fundar Reino", evitando obrigar a repetir START/PLAY/ARCHIVES/MORE.
 */
export function resumeWizardTour(progress, {
  scope = WIZARD_SCOPE.FOYER,
  isSelectingCharacter = false,
  previewCharacterId = null,
  hasConfirmedCharacter = false,
} = {}) {
  let current = beginWizardTour(progress);
  let next = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);

  // Se já existe um Realm, a realidade é mais forte do que eventos de UI que
  // possam ter ocorrido enquanto o mago estava fechado/saltado. Avançamos o
  // capítulo do foyer e retomamos no estado real do Realm.
  if (scope === WIZARD_SCOPE.REALM && FOYER_WIZARD_STEPS.includes(next)) {
    current = completeWizardSteps(current, FOYER_WIZARD_STEPS);
    next = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);
  }

  // O mesmo princípio vale para a parede/pergaminho: se a Casa já ficou
  // confirmada enquanto o mago estava escondido, não pedimos para repetir a
  // animação. Se há apenas um retrato aberto, damos por concluída a seleção.
  if (scope === WIZARD_SCOPE.REALM && hasConfirmedCharacter) {
    current = completeWizardStep(current, WIZARD_STEP.REALM_SELECT_CHARACTER);
    current = completeWizardStep(current, WIZARD_STEP.REALM_SIGN_CHARACTER);
    next = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);
  } else if (scope === WIZARD_SCOPE.REALM && isSelectingCharacter && previewCharacterId) {
    current = completeWizardStep(current, WIZARD_STEP.REALM_SELECT_CHARACTER);
    next = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);
  }

  if (scope === WIZARD_SCOPE.FOYER && REALM_WIZARD_STEPS.includes(next) && next !== WIZARD_STEP.REALM_DISBAND) {
    const completedSteps = current.completedSteps.filter((step) => !REALM_SETUP_STEPS.includes(step));
    current = normalizeWizardProgress({
      ...current,
      status: WIZARD_STATUS.GUIDED,
      completedSteps,
      gameTutorialOfferSeen: false,
      gameTutorialWanted: null,
    });
    next = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);
  }

  // Se o último objetivo era sair do Reino e já estamos no foyer quando o
  // jogador pede ajuda novamente, essa ação já cumpriu o objetivo sem dúvida.
  if (scope === WIZARD_SCOPE.FOYER && next === WIZARD_STEP.REALM_DISBAND) {
    current = completeWizardStep(current, WIZARD_STEP.REALM_DISBAND);
  }

  return current;
}

export function currentWizardStep(progress, { scope = WIZARD_SCOPE.FOYER } = {}) {
  const current = normalizeWizardProgress(progress);
  if (!current.welcomed) return WIZARD_STEP.WELCOME;
  if (current.status === WIZARD_STATUS.SKIPPED) return null;

  const onboardingStep = firstIncomplete(GUIDED_ONBOARDING_STEPS, current.completedSteps);
  if (onboardingStep) {
    const expectedScope = wizardStepScope(onboardingStep);
    return expectedScope === WIZARD_SCOPE.ANY || expectedScope === scope ? onboardingStep : null;
  }

  // A proposta de tutorial de gameplay aparece só depois de o jogador desfazer
  // o Reino de treino e regressar ao salão, fechando o circuito do onboarding.
  if (scope === WIZARD_SCOPE.FOYER) {
    if (!current.gameTutorialOfferSeen) return WIZARD_STEP.GAME_TUTORIAL_OFFER;
    if (current.gameTutorialWanted === true && !current.preferredTrainingMode) return WIZARD_STEP.GAME_TUTORIAL_MODE;
  }
  return null;
}
