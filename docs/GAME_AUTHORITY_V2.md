# Autoridade da partida — protocolo v2

## Regra

Clientes enviam intenções. Apenas o host valida regras, executa aleatoriedade, incrementa a revisão e transmite o estado oficial.

## Ações adicionadas na Parte 04B

- `RECRUIT_TROOP`, `DEPLOY_UNIT`, `UNIT_ACTION`, `BRIBE_UNIT`
- `BUILD_WAGON`, `MOVE_WAGON`, `LOAD_COLONISTS`, `FOUND_REMOTE_VILLAGE`
- `PLAY_DEV_CARD`
- `PROPOSE_TRADE`, `ACCEPT_TRADE`, `DECLINE_TRADE`, `CANCEL_TRADE`

Todas usam `actionId`, `expectedRevision` e `gameProtocolVersion`. O host processa os pedidos na mesma fila das ações da Parte 04A e guarda resultados recentes para deduplicação.

## Trocas

Cada proposta recebe um `tradeId`. O proponente é identificado pela ligação autenticada; o destinatário é enviado como `playerId`. Respostas validam o `tradeId`, o destinatário e os recursos atuais antes da transferência.

## Cartas

O cliente envia a carta possuída e todas as escolhas necessárias numa única ação. A carta só é removida depois de a escolha completa ser validada. Isto evita decisões parcialmente locais que se perdiam em refreshes.

## Snapshots

O helper `mut` foi removido e `commit` retorna sem alterar o estado quando chamado num convidado. O host rejeita qualquer snapshot recebido de uma ligação e responde com o estado oficial.

## Limite atual

A autoridade de escrita está fechada, mas a confidencialidade não. O estado completo continua a ser transmitido e deve ser substituído por uma vista pública e uma vista privada por jogador numa fase posterior.
