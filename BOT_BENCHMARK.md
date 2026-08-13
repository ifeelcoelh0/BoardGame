# Benchmark dos bots

Este benchmark é uma ferramenta de desenvolvimento. Corre partidas completas apenas com bots usando:

- a visão censurada de cada jogador (`createGameStateView`);
- a política normal dos bots (`chooseBotAction`);
- o reducer autoritativo normal (`applyGameAction`).

Não altera regras e não dá aos bots acesso ao estado secreto do host.

## Modo Dragão — 1000 jogos

```bash
npm run benchmark:bots -- --mode dragao --players 4 --games 1000
```

Por defeito usa até 4 worker threads para reduzir o tempo de execução. O resultado é determinístico para a mesma seed, mesmo mudando o número de workers.

Para guardar todo o relatório, incluindo cada jogo e as seeds necessárias para reproduzir uma anomalia:

```bash
npm run benchmark:bots -- --mode dragao --players 4 --games 1000 --out benchmark-dragao-1000.json
```

## Métricas específicas do Modo Dragão

O resumo dá prioridade a percentagens para permitir comparar amostras grandes:

- percentagem de todos os lançamentos que deram 2 ou 12;
- percentagem de jogos em que saiu pelo menos um 2 ou 12;
- percentagem dessas saídas que produziram recursos;
- percentagem de jogadores que chegaram a construir junto de um 2, de um 12, de qualquer um ou de ambos;
- win rate com e sem presença no 2/12, e diferença em pontos percentuais;
- percentagem de vencedores que tinham presença no 2/12;
- percentagem de jogadores que completaram Arqueiro + Cavaleiro + Catapulta;
- percentagem de jogos com pelo menos uma Trindade das Armas;
- win rate com e sem Trindade e diferença em pontos percentuais;
- ronda média e ordem de conclusão da Trindade;
- cortes por personagem.

"Construiu no 2/12" significa que, em algum momento da partida, o jogador teve um edifício num vértice adjacente a um hexágono com esse número. A condição fica registada mesmo que esse edifício desapareça mais tarde.

A Trindade é contabilizada apenas quando o evento autoritativo marca `trinityCompleted`; possuir cartas na mão não conta.

## Reprodutibilidade

A rotação de personagens é determinística e distribui os oito personagens pela amostra. Cada jogo recebe a sua própria seed derivada da seed base. Se houver uma simulação incompleta, o JSON inclui `gameIndex`, `seed` e o motivo.

As diferenças de win rate são associações observadas na simulação; não demonstram, por si só, que uma mecânica causou a vitória.

## Leitura 2 / 12 com controlo por edifícios

O relatório separa agora quatro coortes: `Nenhum`, `Só 2`, `Só 12` e `2 e 12`. Também mostra a win rate dentro de cada número final de edifícios e uma comparação padronizada por esse estrato. Isto reduz parte do enviesamento de simplesmente comparar jogadores que acabaram com quantidades muito diferentes de aldeias/palácios. Continua a ser análise descritiva: associação não prova causalidade.
