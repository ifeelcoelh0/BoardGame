import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(full));
    else if (/\.(?:js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("game domain never imports multiplayer infrastructure", async () => {
  const files = await filesUnder(path.join(root, "game"));
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/from\s+["'][^"']*multiplayer\//.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);
});

test("App composes GameScreen and no legacy runtime remains", async () => {
  const gameScreen = await readFile(path.join(root, "ui/game/GameScreen.jsx"), "utf8");
  const app = await readFile(path.join(root, "app/App.jsx"), "utf8");
  assert.match(gameScreen, /export default function GameScreen/);
  assert.doesNotMatch(app, /function GameScreen\s*\(/);
  assert.match(app, /import GameScreen from "\.\.\/ui\/game\/GameScreen\.jsx"/);
  await assert.rejects(() => readFile(path.join(root, "legacy/ReinosDoDragao.jsx"), "utf8"));
});

test("GameScreen serializes authoritative game actions through the UI gate", async () => {
  const gameScreen = await readFile(path.join(root, "ui/game/GameScreen.jsx"), "utf8");
  assert.match(gameScreen, /createGameActionDispatchGate/);
  assert.match(gameScreen, /dispatchGameAction=\{runGameAction\}/);
  assert.doesNotMatch(gameScreen, /dispatchGameAction\(GAME_ACTION\./);
});

test("actions, cards and decisions share the same interaction guards", async () => {
  const actionModel = await readFile(path.join(root, "ui/game/gameActionModel.js"), "utf8");
  const decisionModel = await readFile(path.join(root, "ui/game/gameDecisionModel.js"), "utf8");
  const gameScreen = await readFile(path.join(root, "ui/game/GameScreen.jsx"), "utf8");
  assert.match(actionModel, /gameInteractionGuards\.js/);
  assert.match(decisionModel, /gameInteractionGuards\.js/);
  assert.match(gameScreen, /developmentCardPlayReason/);
  assert.match(gameScreen, /boardInteractionBlockReason/);
});

test("utility rail owns social and secondary utility interaction outside GameScreen", async () => {
  const gameScreen = await readFile(path.join(root, "ui/game/GameScreen.jsx"), "utf8");
  const rail = await readFile(path.join(root, "ui/game/hud/GameUtilityRail.jsx"), "utf8");
  const uiState = await readFile(path.join(root, "ui/game/gameUiState.js"), "utf8");
  assert.match(gameScreen, /<GameUtilityRail/);
  assert.doesNotMatch(gameScreen, /chatReadIds|EMOTES\.map|chatText|showEmotes/);
  assert.match(rail, /EMOTES/);
  assert.match(rail, /sendChat/);
  assert.match(rail, /HUD_UTILITY\.HISTORY/);
  assert.doesNotMatch(uiState, /showChat|showEmotes|emoteCooldown|chatText/);
});

test("endgame presentation owns its minimized state and derives a pure final model", async () => {
  const gameScreen = await readFile(path.join(root, "ui/game/GameScreen.jsx"), "utf8");
  const endgame = await readFile(path.join(root, "ui/game/endgame/EndgameExperience.jsx"), "utf8");
  const model = await readFile(path.join(root, "ui/game/endgame/gameEndgameModel.js"), "utf8");
  const uiState = await readFile(path.join(root, "ui/game/gameUiState.js"), "utf8");
  assert.match(gameScreen, /<EndgameExperience/); assert.doesNotMatch(gameScreen, /EndStats|endMinimized|Ver resultados finais/); assert.match(endgame, /buildEndgameModel/); assert.match(model, /export function buildEndgameModel/); assert.doesNotMatch(uiState, /endMinimized/);
});


test("session controller stays outside visual composition", async () => {
  const app = await readFile(path.join(root, "app/App.jsx"), "utf8");
  const session = await readFile(path.join(root, "app/useRealmSession.js"), "utf8");
  assert.match(app, /useRealmSession/);
  assert.doesNotMatch(app, /createBrowserHostPeerRuntime|createHostActionController|createClientSessionPresenceController/);
  assert.match(session, /createBrowserHostPeerRuntime/);
  assert.match(session, /createHostActionController/);
  assert.doesNotMatch(session, /return\s*\(?\s*</);
});

test("game audio is semantic instead of reconstructed from Chronicle text", async () => {
  const app = await readFile(path.join(root, "app/App.jsx"), "utf8");
  const session = await readFile(path.join(root, "app/useRealmSession.js"), "utf8");
  const audioLifecycle = await readFile(path.join(root, "app/useAppAudioLifecycle.js"), "utf8");
  const presenter = await readFile(path.join(root, "presentation/gamePresenter.js"), "utf8");
  assert.doesNotMatch(session, /function sfxForLog|delayedAudioTimers|latestCurrentAudioCue|AudioSys\.playCue/);
  assert.match(app, /useAppAudioLifecycle/);
  assert.match(audioLifecycle, /latestCurrentAudioCue/);
  assert.match(audioLifecycle, /audioSystem\.playCue/);
  assert.doesNotMatch(presenter, /audio\?\.|playCharacterVoice/);
  assert.match(presenter, /audio: sfxCue|voiceCue\(/);
});


test("production game UI no longer depends on legacy pixel portraits or the old social dock", async () => {
  const files = await filesUnder(path.join(root, "ui/game"));
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/PixelAvatar|PixelPortrait|GameSocialPanel/.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);
});

test("primary production game surfaces do not render platform emoji literals", async () => {
  const surfaces = [
    "ui/game/GameScreen.jsx",
    "ui/game/GameActionPanel.jsx",
    "ui/game/GameStoryToast.jsx",
    "ui/game/DevelopmentCardReveal.jsx",
    "ui/game/decisions/GameDecisionSystem.jsx",
    "ui/game/endgame/EndgameExperience.jsx",
    "ui/game/PlayerBanner.jsx",
    "ui/game/hud/GameHud.jsx",
    "ui/game/hud/GameEconomyStrip.jsx",
    "ui/game/hud/GameDevelopmentHand.jsx",
    "ui/game/hud/GameBottomDock.jsx",
    "ui/game/hud/GameUtilityRail.jsx",
  ];
  const offenders = [];
  for (const relative of surfaces) {
    const source = await readFile(path.join(root, relative), "utf8");
    if (/\\u\{1[0-9A-Fa-f]{4,5}\}|\p{Extended_Pictographic}/u.test(source)) offenders.push(relative);
  }
  assert.deepEqual(offenders, []);
});
