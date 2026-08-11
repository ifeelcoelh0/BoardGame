# Runtime multiplayer

Esta pasta contém transporte, sessão e coordenação que não pertencem às regras do jogo:

- `runtimeState.js`: ligações, autenticação, fila autoritativa e cleanup central;
- `hostRuntime.js`: lifecycle PeerJS do anfitrião e ligações recebidas;
- `clientRuntime.js`: lifecycle PeerJS do convidado e ligação ao anfitrião;
- `browserPeerRuntime.js`: adaptador browser que fornece a implementação `Peer`;
- `pendingActionStore.js`: ACK, retry e timeout de pedidos;
- `sessionStore.js`: sessão por separador através de `sessionStorage`;
- `protocolMessages.js`: construção e reconhecimento de envelopes;
- `stateTransport.js`: vistas privadas e broadcast de snapshots;
- `actionResultCache.js`: deduplicação compacta de ações aceites.
- `hostActionController.js`: validação, revisão, aplicação autoritativa e ACKs no host;
- `clientActionController.js`: despacho, pedidos pendentes, retry, sincronização e eventos de resultado no cliente.

`hostRuntime.js` e `clientRuntime.js` não importam React nem PeerJS diretamente. Recebem o construtor do transporte por injeção, o que permite testar todo o lifecycle com peers falsos. Apenas `browserPeerRuntime.js` conhece a biblioteca PeerJS.

As tabelas de rotas já vivem fora do JSX. Os handlers de sessão e presença também foram extraídos; o componente legacy conserva sobretudo efeitos React, persistência e apresentação.

## Routers de mensagens — Parte 09C

- `messageRouter.js`: valida o envelope, encaminha pela tabela de tipos e isola mensagens inválidas/desconhecidas;
- `hostMessageController.js`: rotas recebidas pelo anfitrião — sessão, lugares, lobby, ações, estado, chat e emotes;
- `clientMessageController.js`: rotas recebidas pelo convidado — boas-vindas, resultados, snapshots, kick, chat e emotes.

Os routers não importam React nem PeerJS. O componente fornece apenas handlers de aplicação para atualizar a interface, persistir o estado e apresentar eventos.


## Sessão e presença — Parte 09D

- `hostSessionPresenceController.js`: autenticação, reconexão, reserva, saída, desconexão e side effect de kick no host.
- `clientSessionPresenceController.js`: máquina de sessão do convidado e eventos consumidos pelo React.

Estes controladores não importam React nem PeerJS. O controller do host recebe dependências de domínio/apresentação por injeção e consulta o runtime ativo através de `getRuntime`, para continuar correto quando uma nova tentativa substitui a instância anterior.


## Ações de lobby e partida — Parte 09E

`hostActionController.js` é a fronteira de autoridade entre o transporte e os reducers de domínio. `clientActionController.js` é a fronteira entre a UI e o protocolo de intenções. Nenhum dos dois importa React, PeerJS, Three.js, áudio ou componentes visuais. O React recebe apenas eventos de aceitação, rejeição, sincronização e ação duplicada pendente.

## Parte 9F — sincronização e eventos sociais

`stateSyncController.js` normaliza snapshots recebidos e resolve o lugar local apenas através de `playerId` e `seatId` estáveis.

`socialEventController.js` separa chat e emotes da UI: o host substitui qualquer identidade fornecida pelo cliente pela identidade autenticada da ligação; o cliente aplica rate limits, deduplicação limitada e emite eventos sociais para o React.
