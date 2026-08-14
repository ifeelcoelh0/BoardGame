import { startRealmWithBots } from "../helpers/lobby.js";
import {
  createEndedRecoveryGame,
  createJournalRecoveryGame,
  createMandatoryDecisionRecoveryGame,
  createMidSetupRecoveryGame,
  createModeRecoveryGame,
  createTradeRecoveryGame,
  readPersistedRealm,
  resumeLatestRealm,
  visitWithSavedRealm,
} from "../helpers/recovery.js";

describe("Save / resume recovery", () => {
  it("reloads a real autosave during setup and resumes the same realm", () => {
    startRealmWithBots("classico", 2);
    cy.get('[data-testid="game-screen"]').should("have.attr", "data-game-phase", "setup");

    cy.reload();
    cy.get('[data-testid="lobby-experience"]').should("be.visible");
    resumeLatestRealm();

    cy.get('[data-testid="game-screen"]')
      .should("have.attr", "data-game-mode", "classico")
      .and("have.attr", "data-game-phase", "setup");
    cy.get(".rdb-player-banner").should("have.length", 3);
  });

  it("preserves the exact setup step and rebuilds only live presence state", () => {
    const saved = createMidSetupRecoveryGame();
    const expectedSetup = structuredClone(saved.setup);
    visitWithSavedRealm(saved);
    resumeLatestRealm();

    readPersistedRealm().then((resumed) => {
      expect(resumed.setup).to.deep.equal(expectedSetup);
      expect(resumed.players[0].connected).to.equal(true);
      expect(resumed.players[1].connected).to.equal(false);
      expect(resumed.players[1].turnReconnectDeadline).to.equal(null);
      expect(resumed.players[2].controller).to.equal("bot");
      expect(resumed.players[2].connected).to.equal(true);
    });
  });

  it("keeps mandatory decisions intact and closes a trade to a disconnected guest", () => {
    const mandatory = createMandatoryDecisionRecoveryGame();
    const expectedQueue = structuredClone(mandatory.queue);
    const expectedTurn = structuredClone(mandatory.turn);
    visitWithSavedRealm(mandatory);
    resumeLatestRealm();

    readPersistedRealm().then((resumed) => {
      expect(resumed.queue).to.deep.equal(expectedQueue);
      expect(resumed.turn).to.deep.equal(expectedTurn);
      expect(resumed.players[1].connected).to.equal(false);
      expect(resumed.players[1].turnReconnectDeadline).to.be.a("number");
    });

    const trade = createTradeRecoveryGame();
    visitWithSavedRealm(trade);
    resumeLatestRealm();
    readPersistedRealm().then((resumed) => {
      expect(resumed.trade).to.equal(null);
    });
  });

  it("keeps ended results final while clearing stale rematch readiness", () => {
    const saved = createEndedRecoveryGame();
    visitWithSavedRealm(saved);
    resumeLatestRealm();

    cy.get(".rd-endgame-overlay").should("be.visible");
    readPersistedRealm().then((resumed) => {
      expect(resumed.phase).to.equal("ended");
      expect(resumed.winner).to.equal(0);
      expect(resumed.endReason).to.equal("VICTORY_POINTS");
      expect(resumed.players.map((player) => player.ready)).to.deep.equal([false, false, false]);
    });
  });

  it("continues the Action Journal after resume with a recovery checkpoint", () => {
    const saved = createJournalRecoveryGame();
    visitWithSavedRealm(saved);
    resumeLatestRealm();

    cy.contains("button", "End Turn").should("be.enabled").click();
    readPersistedRealm().then((resumed) => {
      expect(resumed.actionJournal.entries).to.have.length(2);
      expect(resumed.actionJournal.entries[1].actionType).to.equal("END_TURN");
      expect(resumed.actionJournal.entries[1].checkpointState).to.be.an("object");
    });
  });

  for (const mode of ["guerra", "exploracao"]) {
    it(`${mode}: preserves mode-specific authoritative state through resume`, () => {
      const saved = createModeRecoveryGame(mode);
      const expected = mode === "guerra"
        ? { units: structuredClone(saved.units), occ: structuredClone(saved.occ), glory: structuredClone(saved.glory), troll: structuredClone(saved.troll), gelo: structuredClone(saved.gelo) }
        : { wagons: structuredClone(saved.wagons), wbuilt: structuredClone(saved.wbuilt), wseq: saved.wseq };
      visitWithSavedRealm(saved);
      resumeLatestRealm();

      cy.get('[data-testid="game-screen"]').should("have.attr", "data-game-mode", mode);
      readPersistedRealm().then((resumed) => {
        for (const [key, value] of Object.entries(expected)) expect(resumed[key], key).to.deep.equal(value);
      });
    });
  }
});
