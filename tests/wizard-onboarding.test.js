import test from "node:test";
import assert from "node:assert/strict";
import {
  FOYER_WIZARD_STEPS,
  GUIDED_ONBOARDING_STEPS,
  REALM_WIZARD_STEPS,
  WIZARD_SCOPE,
  WIZARD_STATUS,
  WIZARD_STEP,
  WIZARD_TUTORIAL_VERSION,
  answerGameTutorialOffer,
  beginWizardTour,
  chooseTrainingMode,
  completeWizardStep,
  createWizardProgress,
  currentWizardStep,
  normalizeWizardProgress,
  restartWizardScope,
  resumeWizardTour,
  skipWizardTour,
} from "../src/tutorial/wizardJourney.js";
import { WIZARD_STORAGE_KEY, loadWizardProgress, saveWizardProgress } from "../src/tutorial/wizardStorage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function completeSteps(progress, steps) {
  return steps.reduce((current, step) => completeWizardStep(current, step), progress);
}

function progressAt(step) {
  let progress = beginWizardTour(createWizardProgress());
  for (const candidate of GUIDED_ONBOARDING_STEPS) {
    if (candidate === step) return progress;
    progress = completeWizardStep(progress, candidate);
  }
  return progress;
}

test("wizard v4 tours the Codex before starting the real realm-founding flow", () => {
  const progress = createWizardProgress();
  assert.equal(WIZARD_TUTORIAL_VERSION, 4);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.WELCOME);

  let guided = beginWizardTour(progress);
  assert.equal(guided.status, WIZARD_STATUS.GUIDED);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_PAGES);

  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_PAGES);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_JOIN);
  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_JOIN);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_ARCHIVES);
  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_ARCHIVES);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_MORE);
  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_MORE);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_CREATE);
  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_CREATE);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_MODE);
  guided = completeWizardStep(guided, WIZARD_STEP.FOYER_MODE);
  assert.equal(currentWizardStep(guided, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_FOUND_REALM);
});

test("realm chapter explains Ready and Start Match before the final Leave Realm step", () => {
  let progress = completeSteps(beginWizardTour(createWizardProgress()), FOYER_WIZARD_STEPS);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_SELECT_CHARACTER);

  progress = completeWizardStep(progress, WIZARD_STEP.REALM_SELECT_CHARACTER);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_SIGN_CHARACTER);
  progress = completeWizardStep(progress, WIZARD_STEP.REALM_SIGN_CHARACTER);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_READY);
  progress = completeWizardStep(progress, WIZARD_STEP.REALM_READY);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_START);
  progress = completeWizardStep(progress, WIZARD_STEP.REALM_START);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_CHANGE_HOUSE);
  progress = completeWizardStep(progress, WIZARD_STEP.REALM_CHANGE_HOUSE);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_DISBAND);

  // Leave Realm atravessa Realm -> foyer e continua a ser o objetivo atual até
  // a transição real ficar confirmada.
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.REALM_DISBAND);
  progress = completeWizardStep(progress, WIZARD_STEP.REALM_DISBAND);
  assert.equal(progress.realmComplete, true);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.GAME_TUTORIAL_OFFER);
});

test("closing/reloading mid-tour resumes from the first incomplete persisted step", () => {
  const storage = memoryStorage();
  let progress = beginWizardTour(createWizardProgress());
  progress = completeWizardStep(progress, WIZARD_STEP.FOYER_PAGES);
  progress = completeWizardStep(progress, WIZARD_STEP.FOYER_JOIN);
  saveWizardProgress(progress, storage);

  const reloaded = loadWizardProgress(storage);
  assert.equal(currentWizardStep(reloaded, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_ARCHIVES);

  const inRealm = progressAt(WIZARD_STEP.REALM_READY);
  saveWizardProgress(inRealm, storage);
  assert.equal(currentWizardStep(loadWizardProgress(storage), { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_READY);
});

test("skip on a forced foyer action is reversible and resumes that exact action", () => {
  const atCreate = progressAt(WIZARD_STEP.FOYER_CREATE);
  const skipped = skipWizardTour(atCreate);
  assert.equal(currentWizardStep(skipped, { scope: WIZARD_SCOPE.FOYER }), null);

  const resumed = resumeWizardTour(skipped, { scope: WIZARD_SCOPE.FOYER });
  assert.equal(resumed.status, WIZARD_STATUS.GUIDED);
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_CREATE);
});

test("skip on a forced Realm action resumes that exact action while the Realm still exists", () => {
  const atSignature = progressAt(WIZARD_STEP.REALM_SIGN_CHARACTER);
  const skipped = skipWizardTour(atSignature);
  assert.equal(currentWizardStep(skipped, { scope: WIZARD_SCOPE.REALM }), null);

  const resumed = resumeWizardTour(skipped, { scope: WIZARD_SCOPE.REALM });
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_SIGN_CHARACTER);
});

test("if the Realm disappears mid chapter, explicit resume keeps the Codex tour and rewinds only Realm creation", () => {
  const atReady = progressAt(WIZARD_STEP.REALM_READY);
  assert.equal(currentWizardStep(atReady, { scope: WIZARD_SCOPE.FOYER }), null);

  const recovered = resumeWizardTour(atReady, { scope: WIZARD_SCOPE.FOYER });
  assert.equal(currentWizardStep(recovered, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.FOYER_CREATE);
  for (const step of [WIZARD_STEP.FOYER_PAGES, WIZARD_STEP.FOYER_JOIN, WIZARD_STEP.FOYER_ARCHIVES, WIZARD_STEP.FOYER_MORE]) {
    assert.ok(recovered.completedSteps.includes(step));
  }
  for (const step of [WIZARD_STEP.FOYER_CREATE, WIZARD_STEP.FOYER_MODE, WIZARD_STEP.FOYER_FOUND_REALM, ...REALM_WIZARD_STEPS]) {
    assert.ok(!recovered.completedSteps.includes(step));
  }
});

test("if Leave Realm already happened while paused, resume recognizes the completed exit", () => {
  const atLeave = progressAt(WIZARD_STEP.REALM_DISBAND);
  const skipped = skipWizardTour(atLeave);
  const resumed = resumeWizardTour(skipped, { scope: WIZARD_SCOPE.FOYER });
  assert.ok(resumed.completedSteps.includes(WIZARD_STEP.REALM_DISBAND));
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.GAME_TUTORIAL_OFFER);
});

test("a Realm created while the final create confirmation was not persisted can resume inside the Realm", () => {
  const atFound = progressAt(WIZARD_STEP.FOYER_FOUND_REALM);
  const resumed = resumeWizardTour(atFound, { scope: WIZARD_SCOPE.REALM });
  assert.ok(resumed.completedSteps.includes(WIZARD_STEP.FOYER_FOUND_REALM));
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_SELECT_CHARACTER);
});


test("resume aligns with a Realm reached while the wizard was hidden", () => {
  const atCreate = progressAt(WIZARD_STEP.FOYER_CREATE);
  const hidden = skipWizardTour(atCreate);
  const resumed = resumeWizardTour(hidden, { scope: WIZARD_SCOPE.REALM });
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_SELECT_CHARACTER);
  assert.ok(FOYER_WIZARD_STEPS.every((step) => resumed.completedSteps.includes(step)));
});

test("resume does not replay character selection or signature when the House is already confirmed", () => {
  const atSelect = progressAt(WIZARD_STEP.REALM_SELECT_CHARACTER);
  const hidden = skipWizardTour(atSelect);
  const resumed = resumeWizardTour(hidden, {
    scope: WIZARD_SCOPE.REALM,
    hasConfirmedCharacter: true,
    isSelectingCharacter: false,
  });
  assert.ok(resumed.completedSteps.includes(WIZARD_STEP.REALM_SELECT_CHARACTER));
  assert.ok(resumed.completedSteps.includes(WIZARD_STEP.REALM_SIGN_CHARACTER));
  assert.equal(currentWizardStep(resumed, { scope: WIZARD_SCOPE.REALM }), WIZARD_STEP.REALM_READY);
});

test("gameplay tutorial choice only appears after the complete onboarding circuit", () => {
  let progress = beginWizardTour(createWizardProgress());
  progress = completeSteps(progress, GUIDED_ONBOARDING_STEPS);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.REALM }), null);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.GAME_TUTORIAL_OFFER);

  progress = answerGameTutorialOffer(progress, true);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), WIZARD_STEP.GAME_TUTORIAL_MODE);
  assert.equal(chooseTrainingMode(progress, "exploracao").preferredTrainingMode, null);
  progress = chooseTrainingMode(progress, "dragao");
  assert.equal(progress.preferredTrainingMode, "dragao");
  assert.equal(progress.status, WIZARD_STATUS.COMPLETE);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), null);
});

test("declining gameplay tutorial completes onboarding after returning to the foyer", () => {
  const base = completeSteps(beginWizardTour(createWizardProgress()), GUIDED_ONBOARDING_STEPS);
  const progress = answerGameTutorialOffer(base, false);
  assert.equal(progress.gameTutorialWanted, false);
  assert.equal(progress.preferredTrainingMode, null);
  assert.equal(progress.status, WIZARD_STATUS.COMPLETE);
  assert.equal(currentWizardStep(progress, { scope: WIZARD_SCOPE.FOYER }), null);
});

test("scoped restart does not erase the other chapter", () => {
  const progress = completeSteps(beginWizardTour(createWizardProgress()), GUIDED_ONBOARDING_STEPS);
  const restarted = restartWizardScope(progress, WIZARD_SCOPE.REALM);
  assert.equal(restarted.foyerComplete, true);
  assert.equal(restarted.realmComplete, false);
  assert.ok(FOYER_WIZARD_STEPS.every((step) => restarted.completedSteps.includes(step)));
  assert.ok(REALM_WIZARD_STEPS.every((step) => !restarted.completedSteps.includes(step)));
});

test("wizard progress is versioned and older state resets into the guided v4 contract", () => {
  const storage = memoryStorage();
  const completed = completeSteps(beginWizardTour(createWizardProgress()), GUIDED_ONBOARDING_STEPS);
  const saved = saveWizardProgress(chooseTrainingMode(answerGameTutorialOffer(completed, true), "classico"), storage);
  assert.equal(saved.preferredTrainingMode, "classico");
  assert.ok(storage.getItem(WIZARD_STORAGE_KEY));
  assert.deepEqual(loadWizardProgress(storage), saved);

  storage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ version: 3, status: "complete", welcomed: true }));
  assert.deepEqual(loadWizardProgress(storage), createWizardProgress());
  assert.deepEqual(normalizeWizardProgress({ version: WIZARD_TUTORIAL_VERSION, completedSteps: ["a", "a", null] }).completedSteps, ["a"]);
});
