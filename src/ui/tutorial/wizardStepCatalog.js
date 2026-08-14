import { BOOK_PAGE } from "../lobby/bookPages.js";
import { WIZARD_SCOPE, WIZARD_STEP } from "../../tutorial/wizardJourney.js";

export const WIZARD_INTERACTION = Object.freeze({
  MANUAL: "manual",
  ACTION: "action",
});

/*
 * Catálogo declarativo do onboarding. A primeira metade é uma visita guiada
 * pelas áreas do Códice; a segunda passa para objetivos reais do fluxo de jogo.
 * O componente visual só interpreta página, alvo, posição e condição de fim.
 */
export const WIZARD_STEP_CATALOG = Object.freeze({
  [WIZARD_STEP.WELCOME]: Object.freeze({
    id: WIZARD_STEP.WELCOME,
    titleKey: "wizard.welcomeTitle",
    bodyKey: "wizard.welcomeBody",
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.FOYER_PAGES]: Object.freeze({
    id: WIZARD_STEP.FOYER_PAGES,
    titleKey: "wizard.pagesTitle",
    bodyKey: "wizard.pagesBody",
    page: BOOK_PAGE.HOME,
    target: '[data-tutorial-anchor="book-sections"]',
    padding: 6,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.FOYER_JOIN]: Object.freeze({
    id: WIZARD_STEP.FOYER_JOIN,
    titleKey: "wizard.joinTitle",
    bodyKey: "wizard.joinBody",
    page: BOOK_PAGE.JOIN,
    target: '[data-tutorial-anchor="join-panel"]',
    padding: 8,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.FOYER_ARCHIVES]: Object.freeze({
    id: WIZARD_STEP.FOYER_ARCHIVES,
    titleKey: "wizard.archivesTitle",
    bodyKey: "wizard.archivesBody",
    page: BOOK_PAGE.SAVED_REALMS,
    target: '[data-tutorial-anchor="archives-panel"]',
    padding: 8,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.FOYER_MORE]: Object.freeze({
    id: WIZARD_STEP.FOYER_MORE,
    titleKey: "wizard.settingsTitle",
    bodyKey: "wizard.settingsBody",
    page: BOOK_PAGE.SETTINGS,
    target: '[data-tutorial-anchor="settings-panel"]',
    padding: 8,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.FOYER_CREATE]: Object.freeze({
    id: WIZARD_STEP.FOYER_CREATE,
    titleKey: "wizard.createTitle",
    bodyKey: "wizard.createGuidedBody",
    page: BOOK_PAGE.HOME,
    target: '[data-testid="create-realm"]',
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "target-click", value: '[data-testid="create-realm"]' }),
  }),
  [WIZARD_STEP.FOYER_MODE]: Object.freeze({
    id: WIZARD_STEP.FOYER_MODE,
    titleKey: "wizard.modesTitle",
    bodyKey: "wizard.modeGuidedBody",
    page: BOOK_PAGE.MODE,
    target: '[data-tutorial-anchor="mode-list"]',
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "selector", value: '[data-testid^="mode-"][aria-pressed="true"]' }),
  }),
  [WIZARD_STEP.FOYER_FOUND_REALM]: Object.freeze({
    id: WIZARD_STEP.FOYER_FOUND_REALM,
    titleKey: "wizard.foundNowTitle",
    bodyKey: "wizard.foundNowBody",
    page: BOOK_PAGE.MODE,
    target: '[data-testid="create-realm-submit"]',
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "scope", value: WIZARD_SCOPE.REALM }),
  }),
  [WIZARD_STEP.REALM_SELECT_CHARACTER]: Object.freeze({
    id: WIZARD_STEP.REALM_SELECT_CHARACTER,
    titleKey: "wizard.characterTitle",
    bodyKey: "wizard.characterSelectBody",
    position: "top-right",
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "character-preview" }),
  }),
  [WIZARD_STEP.REALM_SIGN_CHARACTER]: Object.freeze({
    id: WIZARD_STEP.REALM_SIGN_CHARACTER,
    titleKey: "wizard.signatureTitle",
    bodyKey: "wizard.signatureBody",
    position: "top-right",
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "character-confirmed" }),
  }),
  [WIZARD_STEP.REALM_READY]: Object.freeze({
    id: WIZARD_STEP.REALM_READY,
    titleKey: "wizard.readyTitle",
    bodyKey: "wizard.readyBody",
    page: BOOK_PAGE.REALM,
    target: '[data-testid="ready-toggle"]',
    padding: 7,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.REALM_START]: Object.freeze({
    id: WIZARD_STEP.REALM_START,
    titleKey: "wizard.startMatchTitle",
    bodyKey: "wizard.startMatchBody",
    page: BOOK_PAGE.REALM,
    target: '[data-testid="start-game"]',
    padding: 7,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.REALM_CHANGE_HOUSE]: Object.freeze({
    id: WIZARD_STEP.REALM_CHANGE_HOUSE,
    titleKey: "wizard.changeHouseTitle",
    bodyKey: "wizard.changeHouseBody",
    page: BOOK_PAGE.REALM,
    target: '[data-tutorial-anchor="character-action"]',
    padding: 7,
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.REALM_DISBAND]: Object.freeze({
    id: WIZARD_STEP.REALM_DISBAND,
    titleKey: "wizard.disbandTitle",
    bodyKey: "wizard.disbandBody",
    page: BOOK_PAGE.REALM,
    target: '[data-testid="leave-realm"]',
    interaction: WIZARD_INTERACTION.ACTION,
    completion: Object.freeze({ type: "scope", value: WIZARD_SCOPE.FOYER }),
  }),
  [WIZARD_STEP.GAME_TUTORIAL_OFFER]: Object.freeze({
    id: WIZARD_STEP.GAME_TUTORIAL_OFFER,
    titleKey: "wizard.gameTutorialTitle",
    bodyKey: "wizard.gameTutorialBody",
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
  [WIZARD_STEP.GAME_TUTORIAL_MODE]: Object.freeze({
    id: WIZARD_STEP.GAME_TUTORIAL_MODE,
    titleKey: "wizard.trainingModeTitle",
    bodyKey: "wizard.trainingModeBody",
    interaction: WIZARD_INTERACTION.MANUAL,
  }),
});
