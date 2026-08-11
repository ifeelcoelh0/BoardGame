# Parte 8D — reducers dos desastres

Esta fase retira do componente legacy as mutações dos quatro desastres acionados por resultados 2 e 12.

## Módulo

`src/game/disasterReducer.js` contém:

- definições canónicas de Ganância, Peste Negra, Tsunami e Tributo Real;
- deteção dos jogadores que reclamam o número sagrado;
- exclusão dos jogadores imunes dos alvos;
- seleção determinística do desastre através de RNG injetável;
- aplicação imutável de perdas, saque, quarentena, portos desativados e filas de escolha;
- resolução posterior da escolha de porto do Tsunami;
- resolução recurso a recurso do Tributo.

## Fronteira de apresentação

O reducer devolve eventos semânticos como `RESOURCE_LOST`, `QUARANTINED`, `PORT_CHOICE_REQUIRED` e `TRIBUTE_CHOICE_REQUIRED`. O componente legacy converte-os em texto, logs e overlay, sem decidir as alterações de domínio.

## Correções incluídas

- `tributo` passou a fazer parte da lista sorteável; anteriormente o ramo existia mas era inalcançável.
- jogadores imunes deixam de sofrer os efeitos de um desastre;
- o estado recebido e os arrays de recursos, portos e fila não são mutados.
