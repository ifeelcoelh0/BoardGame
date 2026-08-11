# Autoridade do lobby

## Regra

Durante a fase `lobby`, os clientes não enviam estados completos. Enviam apenas intenções. O host associa cada mensagem à ligação autenticada, valida-a contra o estado oficial e publica o estado seguinte.

## Envelope

```js
{
  t: "lobby-action",
  protocolVersion: 4,
  lobbyProtocolVersion: 1,
  actionId: "action_...",
  expectedRevision: 12,
  action: {
    type: "SET_READY",
    ready: true
  }
}
```

As ações suportadas nesta fase são:

- `SELECT_CHARACTER`
- `SET_READY`
- `SET_PERKS`
- `BEGIN_START`

Entrada e saída usam ainda os pedidos autoritativos `claim-seat` e `leave-seat`.

## Processamento no host

1. Validar versão, tamanho, `actionId`, revisão e tipo.
2. Resolver `actorId` através da ligação autenticada.
3. Deduplicar por `actorId + actionId`.
4. Colocar a ação na fila sequencial do lobby.
5. Rejeitar se `expectedRevision` não corresponder à revisão oficial.
6. Aplicar `applyLobbyAction` a uma cópia do estado.
7. Incrementar a revisão, guardar e transmitir apenas se a ação for válida.
8. Responder com `lobby-action-result`.

## Início da partida

`BEGIN_START` não espera dentro do handler do botão. O estado oficial recebe:

```js
lobbyStarting: {
  actionId,
  startedAt,
  introEndsAt
}
```

Enquanto este campo existe, novas entradas, saídas e alterações de lobby são bloqueadas. O host finaliza a transição quando `introEndsAt` é atingido. Como o prazo está no estado guardado, uma reentrada do host pode retomar a transição.

## Limite atual

A autoridade descrita neste documento termina quando a partida entra em `setup`. As ações do tabuleiro ainda usam temporariamente snapshots completos e serão migradas por grupos nas fases seguintes. O snapshot também continua a conter informação privada; vistas públicas e privadas ainda não foram implementadas.
