import {
  createRealm,
  chooseFirstAvailableCharacter,
  openApp,
  roomCode,
  seedCypressRuntimeSettings,
} from "../helpers/lobby.js";

describe("Lobby base", () => {

  it("apresenta o mago na primeira visita e inicia o guia sem bloquear o salão", () => {
    cy.visit("/?transport=mock", {
      onBeforeLoad(win) {
        seedCypressRuntimeSettings(win);
        win.localStorage.removeItem("reinos_dragao_wizard_v1");
      },
    });

    cy.get('[data-testid="wizard-guide"]').should("be.visible");
    cy.contains("button", "Show me").click();
    cy.get('[data-testid="lobby-codex"]').should("be.visible").and("have.attr", "data-book-page", "home");
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Codex pages");
    cy.contains("button", "Next").click();
    cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", "join");
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Join with a code");
    cy.contains("button", "Next").click();
    cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", "saved-realms");
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Your Archives");
    cy.contains("button", "Next").click();
    cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", "settings");
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "More useful pages");
    cy.contains("button", "Next").click();
    cy.get('[data-testid="lobby-codex"]').should("have.attr", "data-book-page", "home");
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Founding a Realm");
    cy.get('[data-testid="create-realm"]').should("be.visible").click();
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Choose the rules");
    cy.get('[data-testid="mode-classico"]').click();
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Found the Realm");
    cy.contains("button", "Skip tour").click();
    cy.get('[data-testid="wizard-orb"]').should("be.visible");
  });
  it("retoma o mesmo passo depois de fechar o mago ou saltar uma ação guiada", () => {
    cy.visit("/?transport=mock", {
      onBeforeLoad(win) {
        seedCypressRuntimeSettings(win);
        win.localStorage.removeItem("reinos_dragao_wizard_v1");
      },
    });

    cy.contains("button", "Show me").click();
    cy.get('[aria-label="Close the wizard"]').click();
    cy.get('[data-testid="wizard-orb"]').click();
    cy.contains("button", "Continue guided tour").click();
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Codex pages");

    cy.contains("button", "Next").click();
    cy.contains("button", "Next").click();
    cy.contains("button", "Next").click();
    cy.contains("button", "Next").click();
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Founding a Realm");
    cy.contains("button", "Skip tour").click();
    cy.get('[data-testid="wizard-orb"]').click();
    cy.contains("button", "Continue guided tour").click();
    cy.get('[data-testid="wizard-guide"]').should("contain.text", "Founding a Realm");
  });

  it("abre diretamente no salão com o livro como entrada", () => {
    openApp();
    cy.get('[data-testid="lobby-experience"]').should("have.attr", "data-stage", "title");
    cy.get('[data-testid="create-realm"]').click();
    cy.contains("h1, h2, h3", "Game mode").should("be.visible");
    cy.get('[data-testid="create-realm-submit"]').should("be.disabled");
  });

  it("funda um reino, escolhe casa e cria uma sessão estável", () => {
    createRealm("classico");
    chooseFirstAvailableCharacter();

    roomCode().should("match", /^[A-Z]{6}$/);
    cy.window().then((win) => {
      const session = win.sessionStorage.getItem("reinos_dragao_player_sessions_v1");
      expect(session).to.be.a("string").and.not.be.empty;
    });
    cy.get('[data-testid="lobby-player-row"]').should("have.length", 1);
  });
});
