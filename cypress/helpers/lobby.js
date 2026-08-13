export const appUrl = "/?transport=mock";

export function openApp() {
  cy.visit(appUrl);
  cy.get('[data-testid="lobby-experience"]').should("be.visible");
  cy.contains("button", "Abrir o códice").should("be.visible").click();
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
  cy.contains("button", /^Ver /).first().then(($button) => {
    $button[0].focus();
    cy.wrap($button).should("be.visible").click();
  });

  cy.contains("button", /^Selar o pacto com /).then(($button) => {
    $button[0].focus();
    cy.wrap($button).should("be.visible").click();
  });

  cy.get('[data-testid="lobby-experience"]').should("have.attr", "data-stage", "lobby");
  cy.contains("button", "Abrir o códice").should("be.visible");
}

export function openCodex() {
  cy.contains("button", "Abrir o códice").should("be.visible").click();
  cy.get('[data-testid="lobby-codex"]').should("be.visible");
}

export function goToRealmSection(label) {
  openCodex();
  cy.contains("button", label).should("be.visible").click();
  const expectedPage = label === "Jogadores" ? "players" : label === "Partida" ? "realm" : null;
  if (expectedPage) cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", expectedPage);
}

export function addBots(count) {
  goToRealmSection("Jogadores");
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
