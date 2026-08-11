const fs = require('fs');
const path = require('path');
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
const root = path.resolve(__dirname, '..');
const legacy = readRuntimeSource(root);
const social = fs.readFileSync(path.join(root, 'src/multiplayer/socialEventController.js'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'src/multiplayer/stateSyncController.js'), 'utf8');
const fail = (msg) => { console.error(msg); process.exit(1); };
for (const token of ['createHostSocialController', 'createClientSocialController', 'createStateSyncController']) {
  if (!legacy.includes(token)) fail(`Integração em falta: ${token}`);
}
for (const obsolete of ['chatSeen.current', 'const applyChat =', 'const handleHostChat = ({', 'const handleHostEmote = ({']) {
  if (legacy.includes(obsolete)) fail(`Implementação social legacy ainda presente: ${obsolete}`);
}
if (!social.includes('authenticatedIndexForConnection')) fail('Autoria autenticada não encontrada.');
if (!social.includes('while (seen.size > maxSeen)')) fail('Limite de deduplicação social não encontrado.');
if (!sync.includes('seatId') || !sync.includes('STATE_ADOPTED')) fail('Sincronização de identidade incompleta.');
console.log('Sincronização de estado, chat e emotes verificada.');
