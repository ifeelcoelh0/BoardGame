import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HUD_UTILITY, resourceHandTotal, toggleHudUtility } from "../src/ui/game/hud/hudCatalog.js";
import { GAME_ACTION_ICONS, GAME_UTILITY_ICONS as HUD_UTILITY_ICONS, RESOURCE_ICON_BY_KEY } from "../src/assets/gameUiIcons.js";
import { CUSTOM_GAME_ICONS } from "../src/assets/customGameIcons.js";

const RESOURCE_KEYS = ["madeira", "tijolo", "cavalos", "ouro", "obsidiana"];

test("HUD utility catalog has one canonical icon for every persistent control", () => {
  assert.deepEqual(Object.keys(HUD_UTILITY_ICONS).sort(), ["cards", "grimoire", "history", "options"]);
  for (const icon of Object.values(HUD_UTILITY_ICONS)) assert.match(icon, /^(?:[A-Z]_.*|RDD_[A-Za-z0-9_]+)$/);
});

test("resource icon catalog covers the complete resource domain", () => {
  assert.deepEqual(Object.keys(RESOURCE_ICON_BY_KEY).sort(), RESOURCE_KEYS.slice().sort());
  for (const resource of RESOURCE_KEYS) assert.match(RESOURCE_ICON_BY_KEY[resource], /^(?:I_|RDD_)/);
  assert.equal(RESOURCE_ICON_BY_KEY.madeira, "RDD_ResourceWood");
  assert.equal(RESOURCE_ICON_BY_KEY.cavalos, "RDD_ResourceHorses");
  assert.equal(RESOURCE_ICON_BY_KEY.obsidiana, "RDD_ResourceObsidian");
});


test("action icon catalog centralizes the visual vocabulary of turn controls", () => {
  for (const [key, icon] of Object.entries(GAME_ACTION_ICONS)) {
    assert.equal(typeof icon, "string", key);
    assert.match(icon, /^(?:[A-Z]_.*|RDD_[A-Za-z0-9_]+)$/, key);
  }
  assert.equal(GAME_ACTION_ICONS.rollDice, "RDD_Dice");
  assert.equal(GAME_ACTION_ICONS.road, "RDD_Road");
  assert.equal(GAME_ACTION_ICONS.village, "RDD_Village");
  assert.equal(GAME_ACTION_ICONS.palace, "RDD_Palace");
});


test("custom Reinos icons are canonical 36x36 PNG assets", async () => {
  assert.ok(Object.keys(CUSTOM_GAME_ICONS).length >= 16);
  for (const entry of Object.values(CUSTOM_GAME_ICONS)) {
    assert.equal(entry.width, 36, entry.id);
    assert.equal(entry.height, 36, entry.id);
    const buffer = await readFile(new URL(`../public/${entry.path}`, import.meta.url));
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", entry.id);
    assert.equal(buffer.readUInt32BE(16), 36, `${entry.id} PNG width`);
    assert.equal(buffer.readUInt32BE(20), 36, `${entry.id} PNG height`);
  }
});

test("HUD utility toggling is exclusive and deterministic", () => {
  assert.equal(toggleHudUtility(null, HUD_UTILITY.GRIMOIRE), HUD_UTILITY.GRIMOIRE);
  assert.equal(toggleHudUtility(HUD_UTILITY.GRIMOIRE, HUD_UTILITY.GRIMOIRE), null);
  assert.equal(toggleHudUtility(HUD_UTILITY.GRIMOIRE, HUD_UTILITY.HISTORY), HUD_UTILITY.HISTORY);
  assert.throws(() => toggleHudUtility(null, "unknown"), /desconhecido/i);
});

test("resource total ignores missing and non-numeric values safely", () => {
  assert.equal(resourceHandTotal({ madeira: 2, tijolo: 3, ouro: 1 }), 6);
  assert.equal(resourceHandTotal({ madeira: 2, tijolo: undefined, ouro: "2" }), 4);
  assert.equal(resourceHandTotal(), 0);
});

test("GameScreen consumes the canonical HUD and Action System instead of ad-hoc controls", async () => {
  const source = await readFile(new URL("../src/ui/game/GameScreen.jsx", import.meta.url), "utf8");
  const actionPanel = await readFile(new URL("../src/ui/game/GameActionPanel.jsx", import.meta.url), "utf8");
  assert.match(source, /<GameHud/);
  assert.match(source, /<GameBottomDock/);
  assert.match(source, /<GameUtilityRail/);
  assert.match(source, /<GameActionPanel/);
  assert.match(actionPanel, /<ResourceCost/);
  assert.doesNotMatch(source, /const header\s*=/);
  assert.doesNotMatch(source, /setShowLog\(/);
  assert.doesNotMatch(source, /setShowCosts\(/);
  assert.doesNotMatch(source, /constructionActions\./);
  assert.doesNotMatch(source, /className=\{"handcol"\}/);
});

test("HUD v2 keeps development cards visible in the bottom hand and Chronicle entries out of legacy toasts", async () => {
  const bottomDock = await readFile(new URL("../src/ui/game/hud/GameBottomDock.jsx", import.meta.url), "utf8");
  const devHand = await readFile(new URL("../src/ui/game/hud/GameDevelopmentHand.jsx", import.meta.url), "utf8");
  const session = await readFile(new URL("../src/app/useRealmSession.js", import.meta.url), "utf8");
  const audioLifecycle = await readFile(new URL("../src/app/useAppAudioLifecycle.js", import.meta.url), "utf8");
  assert.match(bottomDock, /<GameDevelopmentHand/);
  assert.match(bottomDock, /<GameEconomyStrip/);
  assert.match(devHand, /<DevelopmentCard/);
  assert.match(devHand, /cards\.length === 0\) return null/);
  assert.match(bottomDock, /showCosts=\{showCosts\}/);
  assert.match(bottomDock, /<GameMatchStrip/);
  assert.doesNotMatch(session, /setToast\(top\)|latestCurrentAudioCue/);
  assert.match(audioLifecycle, /latestCurrentAudioCue/);
});


test("fullscreen icon is registered as a canonical Reinos asset", () => {
  assert.ok(CUSTOM_GAME_ICONS.RDD_Fullscreen);
  assert.equal(CUSTOM_GAME_ICONS.RDD_Fullscreen.width, 36);
  assert.equal(CUSTOM_GAME_ICONS.RDD_Fullscreen.height, 36);
});


test("GameScreen shows a dedicated throw animation instead of animating the carried previous dice result", async () => {
  const source = await readFile(new URL("../src/ui/game/GameScreen.jsx", import.meta.url), "utf8");
  const overlay = await readFile(new URL("../src/ui/game/DiceRollOverlay.jsx", import.meta.url), "utf8");
  assert.match(source, /<DiceRollOverlay game=\{g\}/);
  assert.match(overlay, /diceRollPresentationKey/);
  assert.match(overlay, /seenKey/);
});

test("resource production has a visual flight target and road placement cannot stay suggested after affordability is lost", async () => {
  const screen = await readFile(new URL("../src/ui/game/GameScreen.jsx", import.meta.url), "utf8");
  const economy = await readFile(new URL("../src/ui/game/hud/GameEconomyStrip.jsx", import.meta.url), "utf8");
  const board = await readFile(new URL("../src/ui/board/boardSceneController.js", import.meta.url), "utf8");
  assert.match(economy, /data-rd-resource-target/);
  assert.match(board, /spawnResourceFlights/);
  assert.match(board, /gain\.sources/);
  assert.match(screen, /canContinueRoadPlacement/);
  assert.match(screen, /\(me\.freeRoads \|\| 0\) <= 1/);
});

test("compact player banners rely on larger icons and accessible labels instead of tiny stat text", async () => {
  const banner = await readFile(new URL("../src/ui/game/PlayerBanner.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles/player-banner.css", import.meta.url), "utf8");
  assert.match(banner, /aria-label=\{`\$\{label\}: \$\{value\}`\}/);
  assert.doesNotMatch(banner, /compactLabel/);
  assert.match(styles, /rdb-player-banner__stat small\{display:none\}/);
  assert.match(styles, /font:800 13px/);
});

test("steal player choices emphasize the public resource hand count", async () => {
  const source = await readFile(new URL("../src/ui/game/decisions/GameDecisionSystem.jsx", import.meta.url), "utf8");
  assert.match(source, /emphasizeResourceCount/);
  assert.match(source, /rd-decision-player__resource-count/);
});

test("session feedback is ephemeral and authentication success clears stale warnings", async () => {
  const source = await readFile(new URL("../src/app/useRealmSession.js", import.meta.url), "utf8");
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*setToast/);
  assert.match(source, /WELCOME_AUTHENTICATED[\s\S]*setToast\(null\)/);
  assert.match(source, /GAME_ACTION_ACCEPTED[\s\S]*setToast\(null\)/);
});
