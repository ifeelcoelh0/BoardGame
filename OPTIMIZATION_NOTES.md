# v0.99.31 — Settings + Playtest Polish

## Settings como infraestrutura
As preferências deixam de pertencer ao `GameScreen`/lobby e vivem em `src/settings/`: normalização, persistência e aplicação têm uma única fonte de verdade. Música, efeitos e vozes usam ganhos independentes no sistema de áudio; qualidade gráfica consome os perfis High/Medium/Low já medidos na v0.99.29. A escala da UI altera apenas superfícies React, nunca o canvas Three.js.

## Fullscreen
O browser não permite fullscreen arbitrário no carregamento. A preferência `fullscreenOnPlay` usa o gesto explícito de Pronto/Iniciar Partida para pedir fullscreen, e existe controlo manual nas Definições. Falhas/recusas não bloqueiam a partida.

## Rematch
`REMATCH_READY` é uma intenção autoritativa de protocolo. Cada jogador ligado opta individualmente; o host só recria o lobby quando todos os jogadores atualmente ligados aceitaram. O novo lobby preserva código, modo, personagens e identidades estáveis, mas recomeça prontidão/partida.

## Playtest polish
Esta ronda também fecha problemas observados em partida completa: badges da Utility Rail, hierarquia dos custos, ícones semânticos em texto, timing do banner do Dragão, personagem nos prémios, escala das cartas e pequenos alinhamentos dos player banners.

---

# v0.99.30 — Game UI Composition Pass

## Princípio
Esta versão não empilha pequenos patches de posicionamento. A composição da partida passa a ter quatro fronteiras próprias e reutilizáveis:
- `GameUtilityRail`: ferramentas secundárias e Social por progressive disclosure.
- `GameEconomyStrip`: recursos persistentes + consulta contextual de custos.
- `PlayerRail`: glance → overview → inspect dos jogadores.
- `gameUiComposition.js`: estados `hidden / roll / full / minimized / placement` do Action System.

## Câmara do Board3D
A antiga dependência implícita entre snapshots e lifecycle da cena foi removida. `stableBoardGeometryKey()` inclui apenas topologia/terreno/portos que realmente exigem reconstrução. Builds, recursos, turno e revisão não recriam o controller. Antes de uma recriação legítima, `Board3D` guarda `theta/phi/dist/target` e entrega-os como `initialCameraState` ao novo controller.

## Limpeza visual
Portos carregam assets canónicos sem React; Story Toast, Development Card Reveal, decisões e Endgame usam `CharacterSprite`; textos históricos passam por uma fronteira de limpeza antes da UI. O CSS morto da geração anterior é eliminado.

## Tamanho do pacote vs performance
O peso do ZIP não é uma boa aproximação do custo por frame. Na base v0.99.29, o áudio representa ~8,39 MB e `main-theme.m4a` sozinho ~4,95 MB, enquanto JS+JSX ronda ~1,5 MB. As otimizações da v0.99.29 atacam CPU/GPU/draw calls/DPR e, por isso, podem melhorar bastante a fluidez sem reduzir significativamente os MB do pacote.
