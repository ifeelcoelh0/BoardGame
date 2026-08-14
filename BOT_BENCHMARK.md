# Balance Lab dos bots

O Balance Lab é uma ferramenta de desenvolvimento para correr partidas completas apenas com bots usando o mesmo caminho autoritativo do jogo:

- visão censurada de cada jogador (`createGameStateView`);
- política normal dos bots (`chooseBotAction`);
- reducer autoritativo (`applyGameAction`).

Não altera regras e não dá aos bots acesso ao estado secreto do host. As conclusões descrevem o comportamento da estratégia de bot atual; não provam, por si só, equilíbrio humano nem causalidade.

## Modos base

Para correr Clássico, Relâmpago e Dragão na mesma experiência:

```bash
npm run benchmark:bots -- --mode core --players 4 --games 280 --out balance-reports/core-280.json
```

Com 8 personagens e 4 jogadores, um ciclo completo tem 280 jogos por modo: todas as 70 combinações de quatro personagens são usadas e cada combinação roda pelos quatro player slots. Usa múltiplos de 280 para manter esse sampling exatamente equilibrado.

A pasta `balance-reports/` é ignorada pelo Git e pelos checksums.

## Reprodutibilidade

Cada jogo recebe uma seed derivada da seed base e do `gameIndex`. O JSON guarda a seed, roster, índice e casos de duração anómala/falha. Um jogo pode ser reproduzido com os valores indicados no bloco `replay`.

O número de workers não altera o resultado determinístico da mesma seed.

## Player slot, ordem de turno e diagnóstico do setup

`seatIndex`/`Seat` identifica o slot interno do jogador no estado. Não deve ser confundido com a ordem real da partida, que é baralhada em `game.order`.

O relatório v2 regista ambos separadamente:

- win rate, score e produção por player slot;
- win rate, score e produção por posição real na ordem de turno/setup;
- duas colocações iniciais de cada jogador;
- pips de produção da posição escolhida;
- diversidade de recursos e números;
- quantidade de vértices legais disponíveis no momento da escolha;
- melhor posição disponível segundo a mesma heurística usada pelo bot;
- rank da escolha e perda de score relativamente à melhor posição.

A fórmula de potencial de produção usada pelo bot e pelo diagnóstico está centralizada em `src/game/productionPotential.js`, evitando que o relatório e a política atribuam valores diferentes ao mesmo vértice.

## Desastres

As métricas por jogador distinguem conceitos que anteriormente estavam agregados:

- `disastersProtected`: estava protegido pelo número sagrado;
- `disastersExposed`: estava sem proteção/imunidade quando o evento foi avaliado;
- `disastersAppliedToPlayer`: um desastre foi realmente aplicado e o jogador estava no grupo afetado;
- `disasterHarmEvents`: consequências negativas efetivas registadas (`RESOURCE_LOST`, `QUARANTINED`, `PORT_DISABLED` ou `PORT_CHOICE_REQUIRED`);
- `disastersImmune`: imunidade retirou o jogador do grupo afetado.

Isto evita contar um resultado `NO_PROTECTED` como se o jogador tivesse sofrido um desastre aplicado.

## Trindade das Armas

A Trindade é contabilizada quando o evento autoritativo marca `trinityCompleted`; possuir as cartas não conta.

Além de taxa de conclusão e win rate, o relatório mede benefícios observáveis da imunidade depois de completar a Trindade:

- desastres evitados por imunidade;
- oportunidades de roubo do Dragão evitadas quando o jogador ainda tinha recursos;
- unidades de produção salvas quando um número do hex do Dragão é lançado e uma construção imune continua a produzir.

Estas métricas ajudam a separar o valor mecânico da imunidade da simples correlação entre "comprou muitas cartas" e "ganhou".

## Números 2 / 12

O relatório mantém quatro coortes: `Nenhum`, `Só 2`, `Só 12` e `2 e 12`, bem como win rate dentro do número final de edifícios e uma comparação padronizada por esse estrato. Isso reduz parte do enviesamento de comparar jogadores que terminaram com quantidades muito diferentes de construções.

"Construiu no 2/12" significa que, em algum momento da partida, o jogador teve um edifício num vértice adjacente ao número. A condição permanece registada mesmo que o edifício desapareça mais tarde.

## Perfis de estratégia (v3)

A lógica do bot continua a ser única; os perfis são dados de prioridade aplicados ao mesmo motor de scoring:

- `balanced`: comportamento geral, próximo da estratégia histórica;
- `expander`: favorece aldeias, estradas e expansão territorial;
- `developer`: favorece compra/uso de cartas de desenvolvimento;
- `economist`: favorece eficiência de recursos, palácios e trocas;
- `diverse`: coloca os quatro perfis na mesma mesa e roda a associação às personagens.

Exemplo:

```bash
npm run benchmark:bots -- --mode core --players 4 --games 280 --strategies diverse --out balance-reports/core-diverse-280.json
```

Num ciclo de 280 jogos com quatro jogadores, cada personagem aparece exatamente 35 vezes com cada um dos quatro perfis. O JSON também regista a distribuição de perfis por player slot para permitir controlar qualquer efeito residual de posição.

Para isolar uma estratégia, usa diretamente `--strategies balanced`, `expander`, `developer` ou `economist`.

## Trocas entre jogadores

Os bots podem agora propor trocas P2P de forma limitada. As propostas são 1:1 e broadcast (`all`) porque o bot não conhece os recursos privados dos adversários. O proponente usa apenas a sua própria mão/objetivos; cada destinatário decide aceitar ou recusar através da sua própria visão censurada.

A memória de negociação pertence à policy do bot e não ao `GameState`. Serve para limitar tentativas por turno e impedir ciclos de proposta → rejeição → proposta idêntica, sem adicionar flags artificiais aos reducers, saves ou regras disponíveis aos humanos.

O relatório inclui propostas, aceitações/recusas e `p2pTrades` por personagem/perfil.

## Streams de RNG

A partir do RNG Lab v2, o benchmark separa:

- RNG do motor/regras (tabuleiro, dados e efeitos aleatórios);
- RNG de decisão dos bots;
- um stream de decisão independente por player slot.

Assim, uma alteração na personalidade do bot não desloca por si só a sequência aleatória usada pelas regras. A combinação `baseSeed + gameIndex + strategySet` continua a ser suficiente para reproduzir a experiência.
