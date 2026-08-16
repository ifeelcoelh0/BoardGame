import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, getLocale, setLocale, t } from "../src/locales/i18n.js";
import { localizeLegacyGameText } from "../src/locales/legacyGameText.js";
import { characterQuote, characterTitle } from "../src/game/characterCatalog.js";
import { resourceName } from "../src/game/resources.js";

test("English is the default product locale and interpolation stays deterministic", () => {
  setLocale(DEFAULT_LOCALE, { persist: false });
  assert.equal(getLocale(), "en");
  assert.equal(t("resources.madeira"), "Wood");
  assert.equal(t("game.won", { name: "Vlad Drácula" }), "Vlad Drácula won the realm!");
});

test("Portuguese remains available without changing domain identifiers", () => {
  setLocale("pt-PT", { persist: false });
  assert.equal(resourceName("madeira"), "Madeira");
  assert.equal(characterTitle("artheria"), "A Guardiã dos Bosques");
  assert.match(characterQuote("vlad", 0), /noite/i);
  setLocale("en", { persist: false });
});

test("unknown keys degrade to readable copy instead of leaking translation ids", () => {
  setLocale("en", { persist: false });
  assert.equal(t("future.someReadableLabel"), "Some Readable Label");
});

test("legacy synchronized story prose is localized at the presentation boundary", () => {
  assert.equal(localizeLegacyGameText("Saiu o 5!", "en"), "Rolled 5!");
  assert.equal(localizeLegacyGameText("O Dragão Desperta!", "en"), "The Dragon Awakens!");
  assert.equal(
    localizeLegacyGameText("“GRAOOOR! Tragam-me os vossos sacrifícios!” O Dragão será guiado por Feiticeira Muriel.", "en"),
    "“GRAOOOR! Bring me your sacrifices!” The Dragon will be guided by Feiticeira Muriel.",
  );
  assert.equal(localizeLegacyGameText("Saiu o 5!", "pt-PT"), "Saiu o 5!");
});

test("social utility uses the concise Chat label", () => {
  setLocale("en", { persist: false });
  assert.equal(t("utility.conversation"), "Chat");
  assert.equal(t("utility.realmConversation"), "Chat");
  setLocale("pt-PT", { persist: false });
  assert.equal(t("utility.conversation"), "Chat");
  setLocale("en", { persist: false });
});
