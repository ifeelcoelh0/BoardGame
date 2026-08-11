# Extração do runtime multiplayer — Parte 09A

## Objetivo

Retirar de `ReinosDoDragao.jsx` a infraestrutura reutilizável de rede sem alterar o protocolo nem o comportamento das partidas existentes.

## Fronteiras criadas

### `src/multiplayer/runtimeState.js`

Mantém o estado efémero do transporte:

- peer atual;
- ligações de convidados;
- ligação ao host;
- associação `connection -> playerId`;
- substituição da ligação anterior numa reconexão;
- fila sequencial de autoridade;
- caches de confirmações aceites;
- destruição e limpeza do runtime.

O módulo não importa React nem PeerJS. As ligações são objetos injetados, o que permite testes com doubles simples.

### `src/multiplayer/pendingActionStore.js`

Unifica o comportamento antes duplicado entre lobby e partida:

- registo de promessas pendentes;
- deteção de ação igual em curso;
- envio e timeout;
- um retry com o mesmo envelope e `actionId`;
- resolução ou falha única;
- cancelamento de todas as ações ao sair.

### `src/multiplayer/sessionStore.js`

É a única implementação da sessão por separador. `playerIdentity.js` mantém reexports temporários para compatibilidade com imports anteriores.

### `src/multiplayer/protocolMessages.js`

Constrói envelopes compatíveis para:

- ações de lobby;
- ações de partida;
- pedido de sincronização da vista oficial.

Também reconhece respostas apenas quando a versão específica do protocolo coincide.

### `src/multiplayer/stateTransport.js`

Escolhe a vista pública ou privada através da ligação autenticada e aplica essa vista tanto a respostas diretas como a broadcasts.

### `src/multiplayer/actionResultCache.js`

Passou a ser a implementação canónica da cache temporal e compacta de ACKs. O caminho antigo em `src/game/` é apenas um reexport de compatibilidade.

## O que ainda permanece no legacy

- criação dos objetos `Peer`;
- handlers `open`, `connection`, `data`, `close` e `error`;
- tradução dos eventos de rede para estado React;
- mensagens de erro e feedback visual;
- chat e emotes.

A Parte 09B deve criar `hostRuntime.js` e `clientRuntime.js`, recebendo callbacks da UI em vez de importar React.
