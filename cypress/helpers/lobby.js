import { WIZARD_TUTORIAL_VERSION } from "../../src/tutorial/wizardJourney.js";

export const appUrl = "/?transport=mock";

const CYPRESS_SETTINGS_KEY = "reinos_dragao_settings_v1";
const CYPRESS_WIZARD_KEY = "reinos_dragao_wizard_v1";

export function seedCypressRuntimeSettings(win) {
  let current = {};
  try {
    current = JSON.parse(win.localStorage.getItem(CYPRESS_SETTINGS_KEY) || "{}");
  } catch {}
  win.localStorage.setItem(CYPRESS_SETTINGS_KEY, JSON.stringify({
    ...current,
    reducedMotion: true,
  }));
}

export function seedCypressWizardSkipped(win) {
  win.localStorage.setItem(CYPRESS_WIZARD_KEY, JSON.stringify({ version: WIZARD_TUTORIAL_VERSION, status: "skipped", welcomed: true }));
}

export function openApp() {
  cy.visit(appUrl, {
    onBeforeLoad(win) {
      seedCypressRuntimeSettings(win);
      seedCypressWizardSkipped(win);
    },
  });
  cy.get('[data-testid="lobby-experience"]').should("be.visible");
  cy.contains("button", "Open codex").should("be.visible").click();
  cy.get('[data-testid="lobby-codex"]').should("be.visible");
  cy.get('[data-testid="create-realm"]').should("be.visible");
}

export function createRealm(mode = "classico") {
  openApp();
  cy.get('[data-testid="create-realm"]').click();
  cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", "mode");
  cy.get(`[data-testid="mode-${mode}"]`).click();
  cy.get('[data-testid="create-realm-submit"]').click();
  cy.get('[data-testid="lobby-root"]').should("exist");
  cy.get('[data-testid="lobby-experience"]').should("have.attr", "data-stage", "character-selection");
}

export function chooseFirstAvailableCharacter() {
  cy.contains("button", /^View /).first().then(($button) => {
    $button[0].focus();
    cy.wrap($button).should("be.visible").click();
  });

  cy.contains("button", /^Seal the pact with /).then(($button) => {
    $button[0].focus();
    cy.wrap($button).should("be.visible").click();
  });

  cy.get('[data-testid="lobby-experience"]').should("have.attr", "data-stage", "lobby");
  cy.contains("button", "Open codex").should("be.visible");
}

export function openCodex() {
  cy.contains("button", "Open codex").should("be.visible").click();
  cy.get('[data-testid="lobby-codex"]').should("be.visible");
}

export function goToRealmSection(label) {
  openCodex();
  cy.contains("button", label).should("be.visible").click();
  const expectedPage = label === "Players" ? "players" : label === "Match" ? "realm" : null;
  if (expectedPage) cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", expectedPage);
}

export function addBots(count) {
  goToRealmSection("Players");
  for (let index = 0; index < count; index += 1) {
    cy.get('[data-testid="add-bot"]').first().should("be.visible").click();
  }
}

export function roomCode() {
  openCodex();
  return cy.get('[data-testid="room-code"] strong').invoke("text").then((value) => value.trim());
}

export function startRealmWithBots(mode, botCount = 2) {
  createRealm(mode);
  chooseFirstAvailableCharacter();
  addBots(botCount);

  cy.get('[data-testid="ready-toggle"]').should("be.enabled").click();
  cy.get('[data-testid="start-game"]').should("be.enabled").click();

  cy.get('[data-testid="game-screen"]', { timeout: 20_000 })
    .should("be.visible")
    .and("have.attr", "data-game-mode", mode);
}
