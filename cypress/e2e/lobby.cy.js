import {
  createRealm,
  chooseFirstAvailableCharacter,
  openApp,
  roomCode,
} from "../helpers/lobby.js";

describe("Lobby base", () => {
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
