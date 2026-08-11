# Parte 08J — Dragão e decisões obrigatórias

Esta fase retira do componente legacy as transições relacionadas com o Dragão de Fogo e as decisões obrigatórias que bloqueiam a partida.

## Módulo novo

`src/game/mandatoryDecisionReducer.js` contém:

- resolução do jogador que tem realmente de agir;
- destinos válidos para o Dragão sem confundir nevoeiro com terreno;
- colocação do Dragão e cálculo de vítimas elegíveis;
- roubo aleatório com RNG injetável;
- descarte obrigatório do resultado 7;
- escolha de porto no Tsunami;
- escolhas de recurso de Tributo e Bênção;
- skip AFK da decisão no topo da fila.

## Privacidade

O evento partilhado de roubo informa apenas ator e vítima. O tipo do recurso roubado é devolvido em `privateResult`, exclusivamente ao jogador que executou a ação.

## Limite desta fase

O avanço completo de turnos, a colocação inicial e o fim de turno permanecem na camada legacy até à Parte 08K. O reducer 08J centraliza a fila obrigatória e a seleção do ator, enquanto o skip de um turno inteiro continua a chamar temporariamente `endTurn` no componente.

## Endurecimento de autoridade

As ações `PLACE_DRAGON` e `STEAL_RESOURCE` verificam explicitamente que o ator autenticado é o jogador do turno. A identidade do cliente não é inferida pela vítima nem pelo estado da modal.
