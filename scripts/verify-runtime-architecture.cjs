const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const files = {
  main: path.join(root, "src/main.jsx"),
  app: path.join(root, "src/app/App.jsx"),
  session: path.join(root, "src/app/useRealmSession.js"),
  gameScreen: path.join(root, "src/ui/game/GameScreen.jsx"),
  actionPanel: path.join(root, "src/ui/game/GameActionPanel.jsx"),
  decisionSystem: path.join(root, "src/ui/game/decisions/GameDecisionSystem.jsx"),
  utilityRail: path.join(root, "src/ui/game/hud/GameUtilityRail.jsx"),
  endgame: path.join(root, "src/ui/game/endgame/EndgameExperience.jsx"),
  lobbyExperience: path.join(root, "src/ui/lobby/LobbyExperience.jsx"),
  lobbyCodex: path.join(root, "src/ui/lobby/LobbyCodex.jsx"),
  lobbyScene: path.join(root, "src/ui/lobby/LobbyScene.jsx"),
  lobbySceneBook: path.join(root, "src/ui/lobby/lobbySceneBook.js"),
  lobbySceneController: path.join(root, "src/ui/lobby/lobbySceneController.js"),
  boardSceneController: path.join(root, "src/ui/board/boardSceneController.js"),
  graphicsQualityProfiles: path.join(root, "src/ui/three/graphicsQualityProfiles.js"),
  audioSystem: path.join(root, "src/audio/audioSystem.js"),
  audioPolicy: path.join(root, "src/audio/audioPlaybackPolicy.js"),
  appAudioLifecycle: path.join(root, "src/app/useAppAudioLifecycle.js"),
  musicPlayback: path.join(root, "src/audio/musicPlaybackController.js"),
  musicCatalog: path.join(root, "src/audio/musicCatalog.js"),
  gameMusicState: path.join(root, "src/audio/gameMusicState.js"),
  gameEntryTransition: path.join(root, "src/app/useGameEntryTransition.js"),
  gameEntryOverlay: path.join(root, "src/ui/app/GameEntryTransition.jsx"),
  gameScreenRuntime: path.join(root, "src/ui/game/useGameScreenRuntime.js"),
  gameScreenRuntimeModel: path.join(root, "src/ui/game/gameScreenRuntimeModel.js"),
  gameScreenAudio: path.join(root, "src/ui/game/useGameScreenAudio.js"),
  gameOverlayVisibility: path.join(root, "src/ui/game/gameOverlayVisibility.js"),
  gamePresenter: path.join(root, "src/presentation/gamePresenter.js"),
  gameSettings: path.join(root, "src/settings/gameSettings.js"),
  gameSettingsHook: path.join(root, "src/settings/useGameSettings.js"),
  settingsControls: path.join(root, "src/ui/settings/GameSettingsControls.jsx"),
  gameRichText: path.join(root, "src/ui/game/GameRichText.jsx"),
  rematch: path.join(root, "src/game/rematch.js"),
  css: path.join(root, "src/styles/app.css"),
};

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Ficheiro obrigatório ausente (${label}): ${path.relative(root, file)}`);
}
if (fs.existsSync(path.join(root, "src/legacy"))) throw new Error("src/legacy ainda existe; a aplicação deve usar a arquitetura final.");
if (fs.existsSync(path.join(root, "legacy"))) throw new Error("A árvore de trabalho ainda contém a origem legacy v52.");

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]));

if (!source.main.includes('lazy(() => import("./app/App.jsx"))')) throw new Error("main.jsx não carrega App.jsx.");
if (source.main.includes("legacy/")) throw new Error("main.jsx ainda referencia a camada legacy.");
if (!source.app.includes('useRealmSession from "./useRealmSession.js"')) throw new Error("App não compõe a sessão canónica.");
if (!source.app.includes("<LobbyExperience") || !source.app.includes("<GameScreen")) throw new Error("App deixou de compor as duas experiências principais.");
if (!source.app.includes("useAppAudioLifecycle") || !source.app.includes("useGameEntryTransition") || !source.app.includes("<GameEntryTransition")) throw new Error("App perdeu a orquestração dedicada de áudio/transição para o jogo.");
if (source.session.includes("AudioSys") || source.session.includes("freshLogEntries") || source.session.includes("latestCurrentAudioCue") || source.session.includes('document.addEventListener("pointerdown"')) throw new Error("useRealmSession voltou a absorver responsabilidades de áudio.");
if (!source.gameScreen.includes("useGameScreenRuntime") || !source.gameScreen.includes("useGameScreenAudio") || !source.gameScreen.includes("deriveGameOverlayVisibility")) throw new Error("GameScreen voltou a concentrar runtime, áudio ou prioridade de overlays.");
if (source.app.length > 18000) throw new Error(`App.jsx voltou a concentrar demasiada lógica (${source.app.length} caracteres).`);
if (/return\s*\(?\s*</.test(source.session)) throw new Error("useRealmSession contém JSX; a sessão deve ser apenas orquestração.");
for (const symbol of [
  "createBrowserHostPeerRuntime", "createBrowserClientPeerRuntime", "createHostActionController",
  "createClientActionController", "createHostSessionPresenceController", "createClientSessionPresenceController",
  "createGamePresenter", "createInitialGame", "reduceLobbyToSetup",
]) {
  if (!source.session.includes(symbol)) throw new Error(`useRealmSession perdeu a integração essencial: ${symbol}`);
}
if (source.css.length < 20000) throw new Error("A folha de estilos principal parece incompleta.");

const checkFiles = [files.app, files.session, files.gameScreen, files.actionPanel, files.decisionSystem, files.utilityRail, files.endgame, files.lobbyExperience, files.lobbyCodex, files.lobbyScene, files.lobbySceneBook, files.lobbySceneController, files.boardSceneController, files.graphicsQualityProfiles, files.audioSystem, files.audioPolicy, files.appAudioLifecycle, files.musicPlayback, files.musicCatalog, files.gameMusicState, files.gameEntryTransition, files.gameEntryOverlay, files.gameScreenRuntime, files.gameScreenRuntimeModel, files.gameScreenAudio, files.gameOverlayVisibility, files.gamePresenter, files.gameSettings, files.gameSettingsHook, files.settingsControls, files.gameRichText, files.rematch];
for (const file of checkFiles) {
  const text = fs.readFileSync(file, "utf8");
  const diagnostics = ts.transpileModule(text, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, allowJs: true },
    reportDiagnostics: true,
    fileName: file,
  }).diagnostics || [];
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    for (const error of errors) console.error(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
    process.exit(1);
  }
}

const semanticProgram = ts.createProgram(checkFiles, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  noResolve: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
});
const freeSymbols = semanticProgram.getSemanticDiagnostics().filter((item) =>
  checkFiles.includes(item.file?.fileName) && (item.code === 2304 || item.code === 2552)
);
if (freeSymbols.length) {
  for (const error of freeSymbols) {
    const position = error.file?.getLineAndCharacterOfPosition(error.start || 0);
    const where = position ? `${path.relative(root, error.file.fileName)}:${position.line + 1}:${position.character + 1}` : "?";
    console.error(`${where} ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
  }
  process.exit(1);
}

console.log("Arquitetura runtime verificada: App de composição, sessão sem JSX e camada legacy removida.");
console.log(`App.jsx: ${source.app.length.toLocaleString("pt-PT")} caracteres`);
console.log(`useRealmSession.js: ${source.session.length.toLocaleString("pt-PT")} caracteres`);
console.log(`GameScreen.jsx: ${source.gameScreen.length.toLocaleString("pt-PT")} caracteres`);
console.log("Erros JSX/referências livres: 0");
