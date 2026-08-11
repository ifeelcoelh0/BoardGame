# Game core

Esta pasta é a fronteira canónica das regras e dados puros da partida. Não depende de React nem da infraestrutura de transporte; alterações de domínio devem permanecer testáveis e autoritativas aqui.

## Módulos já extraídos

- `lobbyRules.js`: pré-condições de arranque do lobby.
- `playerIdentity.js`: criação de `playerId`/`seatId`, tokens de sessão, SHA-256 e armazenamento da sessão por tab.
- `playerPresence.js`: presença no lobby e na partida, prazos de reconexão e política de skip AFK 90 s → 30 s.
- `lobbyProtocol.js`: envelopes de ações, validação e reducer autoritativo para personagem, pronto, poderes, kick e início.
- `gameProtocol.js`: catálogo e validação dos envelopes de ações autoritativas da partida.
- `gameStateView.js`: vistas públicas/privadas por jogador, incluindo ocultação de mãos, baralho e mapa sob nevoeiro.
- `resources.js`: catálogo canónico de recursos, custos, limites e operações de pagamento.
- `buildingRules.js`: posições válidas, contagem de peças, portos ativos e rácios bancários.
- `constructionReducer.js`: aplicação imutável de estradas, aldeias, palácios e avanço da fundação.
- `productionReducer.js`: cálculo/aplicação imutável da produção, incluindo Dragão, ocupação e saqueadores.
- `diceReducer.js`: RNG injetável, estatísticas, produção do lançamento e resolução base do resultado 7.
- `disasterReducer.js`: Ganância, Peste, Tsunami, Tributo e decisões pendentes.
- `developmentCardReducer.js`: compra, maturação e utilização das cartas de desenvolvimento.
- `tradeReducer.js`: banco e trocas entre jogadores com revalidação no momento da resposta.
- `warReducer.js`: custos, recrutamento, destaque, alvos, movimento, combate contra tropas/Troll, libertação de cercos e Suborno.
- `warAutomationReducer.js`: cercos de início de turno, ocupações, despertar/marcha da horda, saqueadores, Gigante e revalidação automática de ocupações.
- `explorationReducer.js`: carruagens, movimento, revelação de nevoeiro/portos, colonos, aldeias remotas e reposição por turno.
- `mandatoryDecisionReducer.js`: Dragão, roubo, descartes, Tsunami, Tributo, bênçãos e skip obrigatório.
- `turnCycleReducer.js`: ciclo de início/fim de turno, efeitos temporários e automatismos.
- `scoringReducer.js`: pontuação, prémios, vitória e ranking final.
- `gameModes.js`: configuração canónica dos modos e capacidade do lobby.
- `random.js`: utilitários determinísticos de RNG.
- `boardGeometry.js`: coordenadas, anéis e grafo hexagonal.
- `gameFactory.js`: criação de jogadores, mapas, baralhos e estado inicial.
- `gameSetupReducer.js`: transição do lobby para a fundação inicial.
- `gameActionReducer.js`: fronteira central `applyGameAction` para as 25 intenções autoritativas da partida.

Lobby e partida seguem a regra “clientes enviam intenções; o host produz o estado”. A criação inicial, as regras concretas e o dispatcher autoritativo já vivem em módulos puros testáveis. A camada legacy foi removida em v0.99.20. A composição vive em `src/app/App.jsx`, a sessão React em `src/app/useRealmSession.js`, o transporte/controllers em `src/multiplayer/`, a apresentação semântica em `src/presentation/` e a UI em `src/ui/`.
