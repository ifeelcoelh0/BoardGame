const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/app/App.jsx'), 'utf8');
const session = fs.readFileSync(path.join(root, 'src/app/useRealmSession.js'), 'utf8');
const experience = fs.readFileSync(path.join(root, 'src/ui/lobby/LobbyExperience.jsx'), 'utf8');
const scene = fs.readFileSync(path.join(root, 'src/ui/lobby/LobbyScene.jsx'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src/ui/lobby/lobbySceneController.js'), 'utf8');
const journey = fs.readFileSync(path.join(root, 'src/ui/lobby/characterSelectionJourney.js'), 'utf8');
const required = [
  [session, 'const swapCharacter = async (chId) =>'],
  [app, 'const accepted = await session.swapCharacter(characterId);'],
  [app, 'onCharacterSelectionExit={() => navigate(APP_STAGE.LOBBY)}'],
  [app, 'navigate(APP_STAGE.LOBBY);'],
  [app, 'shouldAutoExitCharacterSelection'],
  [journey, 'CHARACTER_SELECTION_ENTRY.INITIAL'],
  [journey, 'player?.characterConfirmed === true'],
  [experience, 'onCharacterSelectionExit={onCharacterSelectionExit}'],
  [scene, 'onSelectionExit: () => bookActionsRef.current.onCharacterSelectionExit?.()'],
  [controller, 'else if (options.selectionEnabled) options.onSelectionExit?.();'],
  [session, 'const startHostTransport ='],
];
for (const [source, token] of required) {
  if (!source.includes(token)) {
    console.error(`Character confirmation exit check failed: missing ${token}`);
    process.exit(1);
  }
}
if (session.includes('g = currentLocal')) {
  console.error('Character confirmation exit check failed: stale snapshot reconciliation hack should no longer exist.');
  process.exit(1);
}
console.log('Character confirmation exit OK');
