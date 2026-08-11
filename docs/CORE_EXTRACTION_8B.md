# Parte 8B — reducers de construção e produção

Esta fase retira do componente legacy as mutações centrais de construção e produção.

## Novos módulos

- `src/game/constructionReducer.js`
  - aplica estradas, aldeias e palácios sem alterar o estado recebido;
  - gere custos e estradas grátis;
  - gere capital, segunda fundação e colheita inicial;
  - conclui a colocação inicial e cria o primeiro turno.
- `src/game/productionReducer.js`
  - calcula ganhos de um lançamento;
  - aplica recursos e estatísticas de produção imutavelmente;
  - respeita nevoeiro, Dragão, imunidade, ocupação e saqueadores.

Os reducers devolvem estado e eventos semânticos. Logs, falas, áudio, animações e anúncios continuam temporariamente no componente legacy.

## Garantias

- o estado de entrada não é alterado;
- custos usam `BUILD_COSTS` de `resources.js`;
- a relação terreno → recurso tem uma única fonte canónica;
- as regras autoritativas continuam a validar a ação antes de chamar o reducer;
- os efeitos visuais são aplicados apenas depois de o reducer aceitar a transição.
