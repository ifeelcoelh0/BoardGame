# Extração do núcleo — Parte 8C

Esta fase retira de `src/legacy/ReinosDoDragao.jsx` as mutações centrais do lançamento dos dados.

## Novo módulo

`src/game/diceReducer.js` contém agora funções puras para:

- gerar um ou dois dados através de um RNG injetável;
- validar resultados de dois dados;
- atualizar estatísticas de lançamentos sem mutar o estado recebido;
- aplicar produção num lançamento normal;
- resolver o resultado 7 nos modos clássicos;
- resolver o resultado 7 no modo Guerra;
- ativar o Dragão de Gelo e os poderes das Casas;
- preparar bênçãos e descartes obrigatórios;
- indicar, através de eventos semânticos, quando o legacy deve resolver Presságio ou Desastre.

## Fronteira mantida no legacy

Continuam temporariamente em `ReinosDoDragao.jsx`:

- logs narrativos;
- áudio e eventos visuais;
- `trollOmen`;
- os quatro desastres de resultados 2/12;
- animação e interface dos dados.

O reducer não chama React, PeerJS, Three.js, áudio, relógio nem `Math.random` diretamente durante os testes. O host injeta o RNG através de `rollDicePair()`.

## Compatibilidade

A ordem observável foi preservada:

1. definir dados e `rolled`;
2. atualizar estatísticas;
3. aplicar Presságio em Guerra para 2/12;
4. resolver o 7 ou a produção;
5. pedir a resolução de Desastre quando aplicável.

## Testes

`tests/dice-reducer.test.js` cobre RNG determinístico, imutabilidade, estatísticas, produção, Dragão de Fogo, Dragão de Gelo, Muriel, Bones e gatilhos 2/12 por modo.
