import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyResources } from "../src/game/resources.js";
import {
  normalizeResourceBundle,
  reduceBankTrade,
  reduceTradeAcceptance,
  reduceTradeCancellation,
  reduceTradeDecline,
  reduceTradeForDisconnectedPlayer,
  reduceTradeProposal,
} from "../src/game/tradeReducer.js";

function resources(overrides = {}) {
  return { ...createEmptyResources(), ...overrides };
}

function player(playerId, overrides = {}) {
  return {
    playerId,
    res: resources(),
    portOff: [],
    ...overrides,
    res: resources(overrides.res),
  };
}

function game(overrides = {}) {
  return {
    mode: "classico",
    players: [player("p0"), player("p1"), player("p2")],
    builds: {},
    roads: {},
    board: { ports: [], hexes: [] },
    trade: null,
    stats: {},
    ...overrides,
  };
}

function graph() {
  return {
    edges: {
      AB: { a: "A", b: "B", hexes: [] },
      AC: { a: "A", b: "C", hexes: [] },
    },
    verts: {
      A: { edges: ["AB", "AC"], hexes: [] },
      B: { edges: ["AB"], hexes: [] },
      C: { edges: ["AC"], hexes: [] },
    },
  };
}

function targetedTrade(overrides = {}) {
  return {
    id: "trade_0123456789abcdef01234567",
    from: 0,
    fromPlayerId: "p0",
    to: 1,
    toPlayerId: "p1",
    give: { madeira: 2 },
    get: { ouro: 1 },
    declined: [],
    ...overrides,
  };
}

test("resource bundles are normalized to canonical positive integer entries", () => {
  assert.deepEqual(normalizeResourceBundle({ madeira: 2, tijolo: 0, ouro: 1 }), { madeira: 2, ouro: 1 });
  assert.deepEqual(normalizeResourceBundle({}), {});
});

test("resource bundle validation rejects unknown, negative, fractional and oversized values", () => {
  assert.equal(normalizeResourceBundle({ rubis: 1 }), null);
  assert.equal(normalizeResourceBundle({ madeira: -1 }), null);
  assert.equal(normalizeResourceBundle({ madeira: 0.5 }), null);
  assert.equal(normalizeResourceBundle({ madeira: 100 }), null);
  assert.equal(normalizeResourceBundle(null), null);
});

test("a 4:1 bank trade is immutable and increments port trade statistics", () => {
  const original = game({ players: [player("p0", { res: { madeira: 4 } }), player("p1"), player("p2")] });
  const result = reduceBankTrade(original, graph(), 0, "madeira", "ouro");
  assert.equal(result.game.players[0].res.madeira, 0);
  assert.equal(result.game.players[0].res.ouro, 1);
  assert.deepEqual(result.game.stats.portTrades, [1, 0, 0]);
  assert.equal(result.event.ratio, 4);
  assert.equal(original.players[0].res.madeira, 4);
  assert.equal(original.stats.portTrades, undefined);
});

test("bank trades honor specific 2:1 and generic 3:1 ports", () => {
  const gr = graph();
  const specific = game({
    players: [player("p0", { res: { madeira: 2 } }), player("p1"), player("p2")],
    builds: { A: { p: 0, t: 1 } },
    board: { ports: [{ e: "AB", type: "madeira", hid: false }], hexes: [] },
  });
  assert.equal(reduceBankTrade(specific, gr, 0, "madeira", "ouro").event.ratio, 2);

  const generic = game({
    players: [player("p0", { res: { tijolo: 3 } }), player("p1"), player("p2")],
    builds: { A: { p: 0, t: 1 } },
    board: { ports: [{ e: "AC", type: "any", hid: false }], hexes: [] },
  });
  assert.equal(reduceBankTrade(generic, gr, 0, "tijolo", "cavalos").event.ratio, 3);
});

test("bank trades reject invalid resources and unaffordable ratios", () => {
  const original = game({ players: [player("p0", { res: { madeira: 3 } }), player("p1"), player("p2")] });
  assert.throws(() => reduceBankTrade(original, graph(), 0, "madeira", "madeira"), /Recursos inválidos/);
  assert.throws(() => reduceBankTrade(original, graph(), 0, "madeira", "ouro"), /não consegue pagar/);
});

test("a targeted proposal stores stable player identities and canonical bundles", () => {
  const original = game({ players: [player("p0", { res: { madeira: 3 } }), player("p1"), player("p2")] });
  const result = reduceTradeProposal(original, 0, {
    tradeId: "trade_0123456789abcdef01234567",
    toPlayerId: "p1",
    give: { madeira: 2, tijolo: 0 },
    get: { ouro: 1 },
  });
  assert.deepEqual(result.game.trade, targetedTrade());
  assert.equal(result.event.targetIndex, 1);
  assert.equal(original.trade, null);
});

test("a broadcast proposal targets all other players", () => {
  const result = reduceTradeProposal(game({ players: [player("p0", { res: { madeira: 1 } }), player("p1"), player("p2")] }), 0, {
    tradeId: "trade_0123456789abcdef01234567",
    toPlayerId: "all",
    give: { madeira: 1 },
    get: {},
  });
  assert.equal(result.game.trade.to, "all");
  assert.equal(result.game.trade.toPlayerId, "all");
  assert.deepEqual(result.game.trade.declined, []);
});

test("proposals reject empty, unaffordable, self-targeted and unknown-target offers", () => {
  const original = game({ players: [player("p0", { res: { madeira: 1 } }), player("p1"), player("p2")] });
  const base = { tradeId: "trade_0123456789abcdef01234567", give: {}, get: {} };
  assert.throws(() => reduceTradeProposal(original, 0, base), /inválida/);
  assert.throws(() => reduceTradeProposal(original, 0, { ...base, give: { madeira: 2 } }), /não consegue pagar/);
  assert.throws(() => reduceTradeProposal(original, 0, { ...base, toPlayerId: "p0", give: { madeira: 1 } }), /Destinatário inválido/);
  assert.throws(() => reduceTradeProposal(original, 0, { ...base, toPlayerId: "missing", give: { madeira: 1 } }), /Destinatário inválido/);
});

test("accepting a trade transfers both bundles, closes it and increments both players statistics", () => {
  const original = game({
    players: [
      player("p0", { res: { madeira: 3 } }),
      player("p1", { res: { ouro: 2 } }),
      player("p2"),
    ],
    trade: targetedTrade(),
    stats: { p2pTrades: [4, 2, 0] },
  });
  const result = reduceTradeAcceptance(original, 1, original.trade.id);
  assert.equal(result.game.players[0].res.madeira, 1);
  assert.equal(result.game.players[0].res.ouro, 1);
  assert.equal(result.game.players[1].res.madeira, 2);
  assert.equal(result.game.players[1].res.ouro, 1);
  assert.deepEqual(result.game.stats.p2pTrades, [5, 3, 0]);
  assert.equal(result.game.trade, null);
  assert.equal(original.players[0].res.madeira, 3);
  assert.equal(original.trade.id, targetedTrade().id);
});

test("acceptance revalidates resources at the moment of completion", () => {
  const original = game({
    players: [player("p0", { res: { madeira: 1 } }), player("p1", { res: { ouro: 1 } }), player("p2")],
    trade: targetedTrade(),
  });
  assert.throws(() => reduceTradeAcceptance(original, 1, original.trade.id), /Recursos insuficientes/);
  assert.notEqual(original.trade, null);
});

test("only the addressed player can accept and stale trade identifiers are rejected", () => {
  const original = game({
    players: [player("p0", { res: { madeira: 2 } }), player("p1", { res: { ouro: 1 } }), player("p2", { res: { ouro: 1 } })],
    trade: targetedTrade(),
  });
  assert.throws(() => reduceTradeAcceptance(original, 2, original.trade.id), /não é destinatário/);
  assert.throws(() => reduceTradeAcceptance(original, 1, "trade_other"), /mudou ou terminou/);
});

test("declining a targeted proposal closes it immediately", () => {
  const original = game({ trade: targetedTrade() });
  const result = reduceTradeDecline(original, 1, original.trade.id);
  assert.equal(result.game.trade, null);
  assert.equal(result.event.closed, true);
  assert.equal(result.event.broadcast, false);
  assert.notEqual(original.trade, null);
});

test("a broadcast proposal remains open until every other player declines", () => {
  const original = game({ trade: targetedTrade({ to: "all", toPlayerId: "all" }) });
  const first = reduceTradeDecline(original, 1, original.trade.id);
  assert.deepEqual(first.game.trade.declined, [1]);
  assert.equal(first.event.closed, false);
  const second = reduceTradeDecline(first.game, 2, original.trade.id);
  assert.equal(second.game.trade, null);
  assert.equal(second.event.closed, true);
  assert.equal(second.event.broadcast, true);
});

test("a player who already declined cannot answer the same broadcast proposal again", () => {
  const original = game({ trade: targetedTrade({ to: "all", toPlayerId: "all", declined: [1] }) });
  assert.throws(() => reduceTradeDecline(original, 1, original.trade.id), /não é destinatário/);
  assert.throws(() => reduceTradeAcceptance(original, 1, original.trade.id), /não é destinatário/);
});

test("only the proposer can cancel an active trade", () => {
  const original = game({ trade: targetedTrade() });
  const result = reduceTradeCancellation(original, 0, original.trade.id);
  assert.equal(result.game.trade, null);
  assert.equal(result.event.type, "PLAYER_TRADE_CANCELLED");
  assert.throws(() => reduceTradeCancellation(original, 1, original.trade.id), /Apenas o proponente/);
});


test("targeted proposals reject disconnected recipients", () => {
  const original = game({
    players: [player("p0", { res: { madeira: 1 } }), player("p1", { connected: false }), player("p2")],
  });
  assert.throws(() => reduceTradeProposal(original, 0, {
    tradeId: "trade_0123456789abcdef01234567",
    toPlayerId: "p1",
    give: { madeira: 1 },
    get: {},
  }), /desligado/);
});

test("broadcast proposals auto-decline disconnected recipients and require one live recipient", () => {
  const original = game({
    players: [player("p0", { res: { madeira: 1 } }), player("p1", { connected: false }), player("p2")],
  });
  const result = reduceTradeProposal(original, 0, {
    tradeId: "trade_0123456789abcdef01234567",
    toPlayerId: "all",
    give: { madeira: 1 },
    get: {},
  });
  assert.deepEqual(result.game.trade.declined, [1]);
  assert.equal(reduceTradeDecline(result.game, 2, result.game.trade.id).game.trade, null);

  const nobody = game({
    players: [player("p0", { res: { madeira: 1 } }), player("p1", { connected: false }), player("p2", { connected: false })],
  });
  assert.throws(() => reduceTradeProposal(nobody, 0, {
    tradeId: "trade_0123456789abcdef01234567",
    toPlayerId: "all",
    give: { madeira: 1 },
    get: {},
  }), /Não existem destinatários ligados/);
});

test("disconnecting a trade participant cancels or declines the proposal", () => {
  const directed = game({ trade: targetedTrade() });
  const recipientLeft = reduceTradeForDisconnectedPlayer(directed, 1);
  assert.equal(recipientLeft.game.trade, null);
  assert.equal(recipientLeft.event.type, "PLAYER_TRADE_DECLINED_DISCONNECT");

  const proposerLeft = reduceTradeForDisconnectedPlayer(directed, 0);
  assert.equal(proposerLeft.game.trade, null);
  assert.equal(proposerLeft.event.type, "PLAYER_TRADE_CANCELLED_DISCONNECT");

  const broadcast = game({ trade: targetedTrade({ to: "all", toPlayerId: "all" }) });
  const oneLeft = reduceTradeForDisconnectedPlayer(broadcast, 1);
  assert.deepEqual(oneLeft.game.trade.declined, [1]);
  const allLeft = reduceTradeForDisconnectedPlayer(oneLeft.game, 2);
  assert.equal(allLeft.game.trade, null);
  assert.equal(allLeft.event.closed, true);
});
