import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/dragon-lobby.css", import.meta.url), "utf8");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Regra CSS em falta: ${selector}`);
  return match[1].replace(/\s+/g, " ");
}

test("DragonLobby is a transparent non-blocking overlay above the 3D scene", () => {
  const body = ruleBody(".rd-lobby");
  assert.match(body, /position\s*:\s*absolute/);
  assert.match(body, /inset\s*:\s*0/);
  assert.match(body, /background\s*:\s*transparent/);
  assert.match(body, /pointer-events\s*:\s*none/);
});

test("interactive React lobby controls explicitly receive pointer events", () => {
  const body = ruleBody(".rd-lobby-chat,.rd-lobby-book-access,.rd-lobby-sr:focus-within");
  assert.match(body, /pointer-events\s*:\s*auto/);
});


test("codex navigation controls sit above the page interaction layer", () => {
  const codexCss = readFileSync(new URL("../src/styles/lobby-codex.css", import.meta.url), "utf8");
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = codexCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `Regra CSS em falta: ${selector}`);
    return match[1].replace(/\s+/g, " ");
  };
  assert.match(rule(".rd-lobby-book-ui__foot"), /z-index\s*:\s*7/);
  assert.match(rule(".rd-lobby-book-ui__foot"), /pointer-events\s*:\s*auto/);
  assert.match(rule(".rd-lobby-book-ui__close"), /z-index\s*:\s*8/);
});
