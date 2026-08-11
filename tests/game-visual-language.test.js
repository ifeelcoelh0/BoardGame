import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GAME_UI_COLORS,
  GAME_UI_EMPHASIS,
  GAME_UI_FONTS,
  GAME_UI_MATERIALS,
  GAME_UI_MOTION_MS,
  GAME_UI_RULES,
  GAME_UI_Z,
  GAME_VISUAL_LANGUAGE_VERSION,
} from "../src/ui/theme/gameVisualLanguage.js";
import { INK, INK_FONTS } from "../src/ui/lobby/lobbyQuillInk.js";

function cssVariables(source) {
  return new Map([...source.matchAll(/(--rd-[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

test("visual language v2 has stable semantic roles", () => {
  assert.equal(GAME_VISUAL_LANGUAGE_VERSION, 2);
  assert.deepEqual(Object.values(GAME_UI_MATERIALS), ["parchment", "parchment-raised", "oak", "bronze", "inset", "veil"]);
  assert.deepEqual(Object.values(GAME_UI_EMPHASIS), ["ambient", "interactive", "important", "ceremonial"]);
  assert.deepEqual(GAME_UI_MOTION_MS, { press: 90, fast: 160, standard: 240, reveal: 420, ceremonial: 640 });
  assert.deepEqual(GAME_UI_Z, { board: 0, hud: 30, floating: 45, modal: 60, toast: 80, event: 95, fatal: 110 });
  assert.ok(GAME_UI_RULES.length >= 7);
});

test("lobby quill engine shares the canonical typography and ink roles", () => {
  assert.equal(INK_FONTS.black, GAME_UI_FONTS.blackletter);
  assert.equal(INK_FONTS.hand, GAME_UI_FONTS.hand);
  assert.equal(INK_FONTS.print, GAME_UI_FONTS.display);
  assert.equal(INK_FONTS.sign, GAME_UI_FONTS.signature);
  assert.equal(INK.iron, GAME_UI_COLORS.ink);
  assert.equal(INK.ironSoft, GAME_UI_COLORS.inkSoft);
  assert.equal(INK.rubric, GAME_UI_COLORS.rubric);
  assert.equal(INK.rubricSoft, GAME_UI_COLORS.rubricSoft);
});

test("CSS and canvas share canonical core colours", async () => {
  const css = await readFile(new URL("../src/styles/game-ui-system.css", import.meta.url), "utf8");
  const vars = cssVariables(css);
  const expected = {
    "--rd-ink": GAME_UI_COLORS.ink,
    "--rd-ink-soft": GAME_UI_COLORS.inkSoft,
    "--rd-rubric": GAME_UI_COLORS.rubric,
    "--rd-rubric-bright": GAME_UI_COLORS.rubricSoft,
    "--rd-paper-light": GAME_UI_COLORS.paperLight,
    "--rd-paper": GAME_UI_COLORS.paper,
    "--rd-paper-shadow": GAME_UI_COLORS.paperShadow,
    "--rd-paper-edge": GAME_UI_COLORS.paperEdge,
    "--rd-night": GAME_UI_COLORS.night,
    "--rd-oak-deep": GAME_UI_COLORS.oakDeep,
    "--rd-oak": GAME_UI_COLORS.oak,
    "--rd-oak-raised": GAME_UI_COLORS.oakRaised,
    "--rd-bronze-dark": GAME_UI_COLORS.bronzeDark,
    "--rd-bronze": GAME_UI_COLORS.bronze,
    "--rd-bronze-bright": GAME_UI_COLORS.bronzeBright,
    "--rd-gold": GAME_UI_COLORS.gold,
    "--rd-gold-bright": GAME_UI_COLORS.goldBright,
    "--rd-ivory": GAME_UI_COLORS.ivory,
    "--rd-muted": GAME_UI_COLORS.muted,
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(vars.get(name), value, name);

  const fonts = {
    "--rd-font-display": GAME_UI_FONTS.display,
    "--rd-font-body": GAME_UI_FONTS.body,
    "--rd-font-label": GAME_UI_FONTS.label,
    "--rd-font-hand": GAME_UI_FONTS.hand,
    "--rd-font-signature": GAME_UI_FONTS.signature,
    "--rd-font-blackletter": GAME_UI_FONTS.blackletter,
    "--rd-font-technical": GAME_UI_FONTS.technical,
  };
  for (const [name, value] of Object.entries(fonts)) assert.equal(vars.get(name), value, name);
});

test("technical lettering is explicitly separate from structural UI fonts", () => {
  assert.match(GAME_UI_FONTS.technical, /VT323/);
  assert.doesNotMatch(GAME_UI_FONTS.display, /VT323/);
  assert.doesNotMatch(GAME_UI_FONTS.body, /VT323/);
  assert.doesNotMatch(GAME_UI_FONTS.label, /VT323/);
  assert.equal(GAME_UI_FONTS.body, GAME_UI_FONTS.hand);
});

test("the canonical font bundle contains only the six approved typefaces", async () => {
  const systemCss = await readFile(new URL("../src/styles/game-ui-system.css", import.meta.url), "utf8");
  const lobbyCss = await readFile(new URL("../src/styles/dragon-lobby.css", import.meta.url), "utf8");
  const codexCss = await readFile(new URL("../src/styles/lobby-codex.css", import.meta.url), "utf8");
  const appCss = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
  const allCss = `${systemCss}\n${lobbyCss}\n${codexCss}\n${appCss}`;
  for (const removed of ["Crimson Pro", "Cormorant Garamond", "Tangerine"]) assert.doesNotMatch(allCss, new RegExp(removed));
  for (const approved of ["IM Fell English SC", "Mrs Saint Delafield", "VT323", "Fondamento", "UnifrakturCook", "Cinzel"]) assert.match(systemCss, new RegExp(approved));
  assert.doesNotMatch(appCss, /VT323/);
  assert.equal(((lobbyCss + codexCss).match(/VT323/g) || []).length, 2, "VT323 no lobby deve aparecer apenas nos dois códigos de reino");
});
