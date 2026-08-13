import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("application shell exposes a keyboard skip target and localized accessible name", () => {
  const source = read("src/ui/app/AppShell.jsx");
  assert.match(source, /rd-skip-link/);
  assert.match(source, /rd-primary-content/);
  assert.match(source, /a11y\.skipToGame/);
});

test("player banners preserve private VP presentation and character subtitles as separate UI concerns", () => {
  const screen = read("src/ui/game/GameScreen.jsx");
  const banner = read("src/ui/game/PlayerBanner.jsx");
  assert.match(screen, /CharacterSubtitle/);
  assert.match(banner, /playerBannerScore/);
  assert.match(banner, /secret-total/);
});

test("locale foundation keeps English default while retaining pt-PT", () => {
  const source = read("src/locales/i18n.js");
  assert.match(source, /DEFAULT_LOCALE = "en"/);
  assert.match(source, /"pt-PT"/);
});
