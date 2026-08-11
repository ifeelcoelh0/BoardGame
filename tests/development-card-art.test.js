import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CHARACTERS } from "../src/game/characterCatalog.js";
import {
  DEVELOPMENT_CARD_ART_STATUS,
  DEVELOPMENT_CARD_MISSING_ART,
  developmentCardArt,
} from "../src/assets/developmentCardArt.js";
import { GAME_EVENT_ART, gameEventArtUrl } from "../src/assets/gameEventArt.js";
import { developmentCardPresentation } from "../src/presentation/developmentCardCatalog.js";

function repoAssetUrl(runtimeUrl) {
  return new URL(`../public${runtimeUrl}`, import.meta.url);
}

async function pngSize(runtimeUrl) {
  const bytes = await readFile(repoAssetUrl(runtimeUrl));
  assert.equal(bytes.toString("ascii", 1, 4), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("every character has canonical 64px art for the three troop cards", async () => {
  for (const character of CHARACTERS) {
    for (const troopType of ["cavaleiro", "arqueiro", "catapulta"]) {
      const art = developmentCardArt({ kind: "tropa", sub: troopType }, character.id, { base: "/" });
      assert.equal(art.status, DEVELOPMENT_CARD_ART_STATUS.READY, `${character.id}/${troopType}`);
      assert.deepEqual(await pngSize(art.url), { width: 64, height: 64 }, art.url);
    }
  }
});

test("all non-war development card illustrations are canonical 64px assets", async () => {
  const cards = [
    { kind: "vp", sub: "🧠 Inteligência" },
    { kind: "vp", sub: "📜 Conhecimento" },
    { kind: "vp", sub: "✝️ Fé" },
    { kind: "vp", sub: "🍀 Sorte" },
    { kind: "vp", sub: "🦊 Astúcia" },
    { kind: "monopolio" },
    { kind: "descoberta" },
    { kind: "estradas" },
  ];
  for (const card of cards) {
    const art = developmentCardArt(card, "makuru", { base: "/" });
    assert.equal(art.status, DEVELOPMENT_CARD_ART_STATUS.READY, JSON.stringify(card));
    assert.deepEqual(await pngSize(art.url), { width: 64, height: 64 }, art.url);
    assert.ok(developmentCardPresentation(card).title);
  }
});

test("Marcha Forçada and Espião are explicitly tracked as the only missing card art", () => {
  assert.deepEqual(DEVELOPMENT_CARD_MISSING_ART.map((entry) => entry.kind), ["marcha", "espiao"]);
  for (const kind of ["marcha", "espiao"]) {
    assert.equal(developmentCardArt({ kind }, "vlad", { base: "/" }).status, DEVELOPMENT_CARD_ART_STATUS.MISSING);
  }
});

test("large event art is kept separate from card art and remains 148px", async () => {
  assert.deepEqual(Object.keys(GAME_EVENT_ART).sort(), [
    "awardLargestArmy",
    "awardLongestRoad",
    "disasterGreed",
    "disasterPlague",
    "disasterTribute",
    "disasterTsunami",
    "dragonSeven",
  ]);
  for (const key of Object.keys(GAME_EVENT_ART)) {
    const url = gameEventArtUrl(key, { base: "/" });
    assert.deepEqual(await pngSize(url), { width: 148, height: 148 }, key);
  }
});
