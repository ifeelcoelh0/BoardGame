const fs = require('node:fs');
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
function fail(message) { console.error(message); process.exit(1); }
const main = fs.readFileSync('src/main.jsx', 'utf8');
const runtimeSource = readRuntimeSource();
const gallery = fs.readFileSync('src/ui/assets/AssetGallery.jsx', 'utf8');
if (!main.includes('<StrictMode>') || !main.includes('</StrictMode>')) fail('StrictMode não está ativo em src/main.jsx.');
if (main.includes('StrictMode fica deliberadamente desligado')) fail('Comentário antigo de StrictMode ainda presente.');
if (!runtimeSource.includes('destroyMultiplayerRuntime(net.current);')) fail('Cleanup global do runtime multiplayer em falta.');
if (!runtimeSource.includes('pendingLobbyActions.current.clearAll(false)')) fail('Cleanup de ações pendentes do lobby em falta.');
if (!runtimeSource.includes('pendingGameActions.current.clearAll(false)')) fail('Cleanup de ações pendentes do jogo em falta.');
if (!gallery.includes('copyTimerRef') || !gallery.includes('window.clearTimeout(copyTimerRef.current)')) fail('Timer da galeria de assets sem cleanup.');
console.log('StrictMode verificado: lifecycle idempotente e cleanups essenciais presentes.');
