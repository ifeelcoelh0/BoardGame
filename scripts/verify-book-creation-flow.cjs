const fs = require('node:fs');
const assert = require('node:assert/strict');
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
const runtimeSource = readRuntimeSource();
assert.match(runtimeSource, /const startHostTransport = (?:async )?\(hostGame, attemptId\) =>/);
assert.match(runtimeSource, /const installHostGame = \(nextGame, hostIndex\) =>/);
/* O `setCharacterSelectionIntent` foi removido: a selecção deriva do stage. O
   que continua a importar é a ordem, o reino local instalado e a galeria aberta
   ANTES de o transporte arrancar, para o anfitrião não ficar à espera da rede
   para poder escolher a casa. */
assert.match(runtimeSource, /navigate\(APP_STAGE\.CHARACTER_SELECTION\);[\s\S]{0,160}startHostTransport\(g, requestId\)/);
assert.match(runtimeSource, /const localHostFlow = net\.current\.host === true/);
assert.doesNotMatch(runtimeSource, /installPreparedHostGame/);
assert.doesNotMatch(runtimeSource, /g = currentLocal/);
console.log('Fluxo prático do livro verificado: reino local e transporte PeerJS têm responsabilidades separadas.');
