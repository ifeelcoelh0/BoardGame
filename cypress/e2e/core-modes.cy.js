import { startRealmWithBots } from "../helpers/lobby.js";

const CORE_MODES = [
  ["classico", "Classic Mode"],
  ["rapido", "Lightning Siege"],
  ["dragao", "Dragon Mode"],
];

describe("Modos-base", () => {
  for (const [mode, label] of CORE_MODES) {
    it(`${label}: lobby completo entra numa partida com humano + 2 bots`, () => {
      startRealmWithBots(mode, 2);
      cy.get('[data-testid="game-screen"]')
        .should("have.attr", "data-game-phase")
        .and("match", /setup|play/);
      cy.get(".rdb-player-banner").should("have.length", 3);
      cy.get(".rd-game-bottom-dock").should("be.visible");
    });
  }
});
