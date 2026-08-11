# Parte 8F — trocas extraídas

As trocas bancárias e entre jogadores passam agora por `src/game/tradeReducer.js`.

## Fronteira pura

O módulo exporta:

- `normalizeResourceBundle`
- `reduceBankTrade`
- `reduceTradeProposal`
- `reduceTradeAcceptance`
- `reduceTradeDecline`
- `reduceTradeCancellation`

Os reducers não escrevem logs, não reproduzem áudio e não dependem de React ou PeerJS. Recebem o estado atual e devolvem um novo estado acompanhado por um evento semântico.

## Garantias preservadas

- Rácios bancários 2:1, 3:1 e 4:1 continuam derivados dos portos ativos.
- A proposta guarda `tradeId`, `fromPlayerId` e `toPlayerId` estáveis.
- A aceitação revalida os recursos de ambos os jogadores no momento da conclusão.
- Uma proposta global permanece aberta até todos os outros jogadores recusarem.
- Uma proposta dirigida fecha na primeira recusa.
- Apenas o proponente pode cancelar.
- Estatísticas `portTrades` e `p2pTrades` são atualizadas de forma imutável.

## Apresentação

`presentTradeEvent` permanece temporariamente no componente legacy para transformar os eventos de domínio em entradas do diário. Esta função não decide recursos, destinatários, fecho da proposta ou estatísticas.
