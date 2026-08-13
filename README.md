# Reinos do Dragão — v0.99.31

## v0.99.31 — Settings + Playtest Polish

- Definições passam a ser reais e persistentes: mute, Música/Efeitos/Vozes independentes, High/Medium/Low, movimento reduzido, escala UI e fullscreen.
- A mesma superfície `GameSettingsControls` é usada no códice do lobby e nas Opções da partida; a persistência/aplicação vive em `src/settings/`.
- Fullscreen pode ser pedido automaticamente através do gesto de Pronto/Iniciar Partida e também controlado manualmente.
- Player Rail, Utility Rail e Economy Strip recebem a ronda de alinhamento observada em partidas reais; notificações deixam de ser cortadas e os custos distinguem melhor ação de recursos.
- Nomes de recursos/construções nas principais superfícies semânticas passam a ganhar os ícones canónicos através de `GameRichText`.
- O banner do Dragão deixa de esperar artificialmente depois do cue sonoro; prémios mostram a personagem conquistadora em maior destaque e as mini-cartas laterais crescem.
- O Endgame ganha **Jogar outra vez** como intenção multiplayer autoritativa: o lobby reabre apenas quando todos os jogadores ainda ligados optaram pelo rematch. Código, modo, personagens e identidades são preservados.
- O protocolo de jogo passa para a versão 7 por causa de `REMATCH_READY`; saves/schema permanecem inalterados.

## v0.99.30 — Game UI Composition Pass

- A UI persistente da partida passa a usar progressive disclosure em quatro fronteiras explícitas: `GameUtilityRail`, `GameEconomyStrip`, `PlayerRail` e estados de apresentação do `GameActionPanel`.
- O dock fixo Mapa/Recursos/Grimório/Crónicas/Opções desaparece: Mapa e Recursos deixam de ser utilitários; Reações/Conversa ficam expostos e Crónicas/Grimório/Opções surgem ao expandir a rail.
- Recursos e cartas ficam sempre visíveis numa Economy Strip maior; os custos de Estrada/Aldeia/Palácio/Carta aparecem por hover/foco e ficam abertos no turno ativo.
- Lançar Dados passa para um botão quadrado compacto; o Action System recolhe durante placement e pode ser minimizado, enquanto Terminar Turno deixa de ocupar uma faixa inteira.
- Player banners passam a três níveis de informação: glance compacto, overview de todos por hover/foco e detalhe rico por clique. Todos usam `CharacterSprite` atual.
- Resultados normais dos dados usam um toast compacto com sprites e ícones de recursos; reveal de Carta de Desenvolvimento e Endgame deixam os últimos retratos/coroas antigos.
- Portos do Board3D usam os ícones canónicos 36×36; as principais superfícies de produção ficam protegidas contra o regresso de emojis de plataforma.
- A identidade geométrica do Board3D deixa de depender de revisões/edifícios: construir ou receber snapshots não recria a cena nem repõe a câmara. Se uma recriação real for necessária, a câmara local é preservada e restaurada.
- A seleção inicial de personagem passa a regressar automaticamente ao salão depois da confirmação; uma troca deliberada de Casa conserva o fluxo explícito.
- CSS morto dos antigos banners de dados/jogadores, dados 3D em CSS e reveal antigo de cartas é removido em vez de ficar em paralelo.

## v0.99.29 — Global Performance Pass + Graphics Profiles

- Remove as falas 3D redundantes do lobby e deixa as gravuras do livro sempre claras.
- Board3D deixa de ler layout em cada frame e agrupa animações ambientais.
- Perfis internos High/Medium/Low centralizam DPR, FPS, sombras, água e detalhe cosmético.
- High preserva a qualidade visual atual; Medium/Low ficam preparados para as Definições reais.



## v0.99.28 — Social Icons + Sound Pack I

- As oito reações deixam de usar emojis e passam para a família final de máscaras pixel art 36×36; a caneca medieval passa a representar Conversa tanto no lobby como durante a partida.
- `UI.wav`, `YOUR TURN.wav`, `Porposta_troca.wav`, `GANANCIA.wav`, `PESTE.wav` e `tributo_real.wav` entram no runtime convertidos para M4A, sem conservar WAV duplicado.
- O clique UI passa a ser universal para botões da aplicação através de um único listener na fronteira da sessão, substituindo o clique antigo específico do lobby.
- O aviso de turno é local: apenas o browser do jogador ativo o ouve, através de `gameAudioSelectors.js`; não é sincronizado como evento público.
- Propostas de troca e Ganância/Peste/Tributo usam cues semânticos dedicados; Tsunami mantém o seu asset próprio.
- `lobby-ui-click.m4a` deixa o pacote por já não ter consumidores.
- A soundtrack futura fica deliberadamente fora desta patch: `main-theme` mantém o comportamento atual até existirem faixas de partida, evitando introduzir uma playlist vazia/silêncio por antecipação.


## v0.99.27 — Audio Foundation

- O áudio da partida deixa de inferir SFX a partir de emojis/texto das Crónicas; logs importantes transportam cues semânticos opcionais (`sfx`, `voice`, `troop`).
- Snapshots com vários logs novos deixam de agendar filas históricas de som: só o cue atual mais recente é considerado e cues atrasados expiram.
- Vozes passam a um canal exclusivo e substituem a voz anterior, evitando duas personagens a falar simultaneamente.
- Efeitos têm cooldown por categoria e pedidos de samples que demorem demasiado a carregar deixam de tocar fora de contexto.
- Sequências de áudio das cartas de tropa podem ser invalidadas por uma sequência nova.
- `gamePresenter` volta a ser puro: descreve cues sincronizados, sem tocar áudio diretamente no host.
- `docs/AUDIO_SYSTEM_AUDIT.md` documenta os 255 assets atuais, reutilizações e backlog de sons a escolher/gerar.


## v0.99.26 — Lobby interaction polish

- As páginas do livro 3D deixam de ficar cobertas pelo sombreado forte da goteira/curvatura: a gravura cenográfica mantém-se, mas o pergaminho permanece claro no salão.
- O indicador de pronto sobe para acompanhar a nova escala dos personagens e usa verde saturado sem tone mapping, evitando o clipping para branco.
- `Trocar de casa` passa para a primeira página do reino; Opções deixa de esconder essa ação de uso frequente.
- O pergaminho de assinatura passa a ser modal: desde o início da abertura, os retratos da parede deixam de entrar no raycast e só Assinar/Voltar respondem.
- A política de interação da parede vive em `lobbySelectionInteraction.js` e tem testes puros, evitando depender de WebGL para validar o lock.

## v0.99.25 — Hotfix do ritual do livro

- Corrige o `ReferenceError: ritualState is not defined` introduzido no Lobby Final Pass.
- O livro 3D já não conserva um estado textual do ritual: guarda apenas o reforço de emissive necessário enquanto o códice está aberto.
- `lobbySceneBook.js` e `lobbySceneController.js` passam a integrar a verificação semântica de referências livres.

Jogo de estratégia para PC inspirado em Catan, desenvolvido em React, Vite, Three.js e PeerJS. A versão atual separa claramente o ritual 3D do salão da interface do códice, preservando o núcleo autoritativo e a linguagem visual comum do lobby e da partida.

## v0.99.25 — Lobby Final Pass

- O livro 3D é reduzido novamente e fica aberto/flutuante sem folha suspensa; as duas páginas recebem gravuras decorativas discretas, sem voltar a misturar UI com Three.js.
- Personagens e cadeiras ganham escala no salão, preservando a relação de assento; os indicadores de prontidão sobem e usam verde emissivo mais legível.
- `Abrir o códice`, `Estou pronto` e, para o host, `Começar partida` ficam disponíveis diretamente no salão; os controlos equivalentes dentro do códice continuam válidos.
- O chat do lobby deixa de ocupar uma barra permanente: passa a um controlo compacto e as mensagens recentes podem surgir temporariamente sobre o lugar/personagem 3D correspondente. O ícone de caneca será trocado quando o asset final estiver disponível.
- A iconografia própria de Reinos do Dragão passa por `customGameIcons.js`; os novos PNG 36×36 substituem emojis/ícones provisórios em ações, opções, códice, modos, porto, todos os jogadores e reações sempre que já existe arte final.
- A navegação do códice é endurecida: Fechar/Anterior/Seguinte ficam acima da camada das folhas, bloqueiam duplos comandos durante a viragem e suportam `Esc`, `←/→` e `PageUp/PageDown` com proteção para campos de texto.
- Código morto do antigo livro 3D interativo e CSS de ações do lobby deixam o runtime ativo.

## v0.99.23 — Lobby Codex

- O livro 3D deixa de ser uma superfície de interface e passa a ser exclusivamente ritual/cenografia do salão.
- O volume fica menor, aberto e a flutuar, com uma folha intermédia suspensa a meio da viragem; durante a entrada no códice essa folha completa o movimento.
- `LobbyCodex.jsx` é uma interface 2D própria, responsiva e fixa ao viewport: duas páginas em desktop e composição de uma coluna em ecrãs estreitos.
- A sala permanece visível atrás do códice através de escurecimento e blur suaves, preservando o contexto sem competir com a leitura.
- O fluxo passa a ter fases explícitas (`salon`, `book-entering`, `codex`, `book-leaving`, `character-transition`, `character-selection`) em `lobbyCodexFlow.js`.
- Abrir faz câmara → livro → transição curta → códice; fechar faz a sequência inversa. A ida à seleção de personagem passa por Livro → vista geral do salão → parede.
- Enquanto o códice está aberto, o salão reduz o render 3D para 12 fps; transições continuam a 60 fps e o idle do salão mantém ~30 fps.
- Foram removidos `LobbyBook.jsx`, `bookViewport.js`, projeção de cantos Three.js para CSS, conteúdo textual no modelo 3D e callbacks/estado que existiam apenas para sincronizar as duas superfícies.
- A v0.99.21 Performance Foundation permanece ativa, incluindo pausa por `visibilitychange`, cache de texturas, instancing, cadência de sombras e `?perf=1`.

## v0.99.21 — Performance Foundation 3D

Esta patch reduz trabalho redundante no lobby e melhora o lifecycle das duas cenas Three.js sem alterar regras, saves, protocolo ou qualidade gráfica configurada.

- lobby e tabuleiro passam a usar `visibilityAwareFrameLoop`: a cena deixa de manter RAF quando a página está escondida e retoma sem aplicar um delta gigante às animações.
- o lobby renderiza a 60 fps durante movimento de câmara/pergaminho e cerca de 30 fps quando apenas existem animações ambientais; o tabuleiro mantém 60 fps quando visível.
- sombras PCFSoft continuam ativas, incluindo a lareira, mas o shadow map passa a ser atualizado explicitamente a 12 Hz em vez de em todos os renders.
- a textura procedural de madeira 1024² é criada uma vez por cena e partilhada por mesa, mantel da lareira e troféus. Isto elimina três famílias redundantes de `map + bump + roughness` sem mudar o material visível.
- os 72 fios do rebordo do tapete passam para um único `InstancedMesh`, preservando posições/rotações/variação de comprimento com uma fração dos draw calls.
- `rendererPerformanceSnapshot` expõe métricas de draw calls, triângulos, geometrias, texturas, programas, pixel ratio e cadência do loop. Com `?perf=1`, `__RDD_PERF__.snapshot()` permite medir lobby/tabuleiro no hardware real.
- o pixel ratio, antialiasing, geometria principal, iluminação, materiais e conteúdo visual não foram reduzidos nesta passagem.

## v0.99.20 — fim da camada legacy

Esta patch conclui a migração iniciada na v52 sem alterar regras, saves ou protocolo multiplayer.

- `src/legacy/ReinosDoDragao.jsx` deixa de existir; `src/main.jsx` carrega `src/app/App.jsx`.
- `App.jsx` fica responsável apenas por navegação/composição visual e permanece pequeno; a sessão persistente vive em `src/app/useRealmSession.js`, sem JSX.
- autoridade, transporte, presença, ACK/retry e routers continuam nos controllers de `src/multiplayer/`; regras e reducers continuam em `src/game/`.
- `src/styles/legacy.css` passa a `src/styles/app.css`, removendo o último nome legacy do runtime ativo.
- o HTML v52 preservado e o script de recuperação deixam a árvore de trabalho; a recuperação histórica continua no Git, em vez de permanecer como dependência operacional.
- `verify-runtime-architecture.cjs` substitui o antigo verificador de migração e faz transpile + CheckJS das fronteiras ativas, além de proibir o regresso de `src/legacy/`.
- os verificadores estruturais do livro, sessão e autoridade passam a ler `App.jsx` + `useRealmSession.js` como runtime, sem aliases de compatibilidade.

O maior ponto de orquestração restante é `useRealmSession.js`: é deliberadamente um controller sem UI, enquanto os comportamentos concretos de rede permanecem nos módulos especializados de `src/multiplayer/`. Uma divisão futura só deve acontecer quando existir uma fronteira funcional real (por exemplo host/client), não apenas para reduzir linhas.




## v0.99.19 — Social + Endgame

Esta patch retira as duas últimas experiências visuais grandes do `GameScreen` sem alterar regras, saves ou protocolo.

- `GameSocialPanel` passa a ser dono de chat, mensagens não lidas, reações, atalhos 1–8/E e cooldown local; o transporte social continua na camada multiplayer e o componente apenas consome `sendChat`/`sendEmote`.
- chat e reações recebem uma única linguagem visual discreta: dock compacto em madeira/bronze e conteúdo aberto em pergaminho, sem competir com o tabuleiro.
- as bolhas de reação dos jogadores usam o mesmo Social System e deixam de depender do CSS antigo `embubble/empanel/chatbox`.
- `EndgameExperience` passa a ser dono do estado “ver mapa final / voltar aos resultados”; `GameScreen` já não guarda `endMinimized`.
- `gameEndgameModel.js` deriva de forma pura vencedor, classificação, edifícios, estradas, tropas, cartas PV, dados e métricas finais a partir do estado terminado.
- o ecrã de vitória recebe tratamento cerimonial próprio: retrato, título, assinatura, quote, placar e Crónicas finais; o vencedor pode recolher o painel para observar o mapa final.
- `EndStats` deixa de recalcular domínio e passa a renderizar o modelo final; os prémios usam os ícones pixel canónicos.
- `?dev=ui` mostra Social e Endgame usando os componentes de produção em modo embutido.

## v0.99.18 — Hardening da interação de partida

Esta patch consolida Action System, cartas, tabuleiro e Decision System sem alterar regras nem protocolo.

- `src/ui/game/gameInteractionGuards.js` passa a ser a fonte comum das condições de interação visíveis: turno, dados, decisões, troca, Dragão, destaque de tropas e disponibilidade das cartas.
- `src/ui/game/gameActionDispatchGate.js` mantém no máximo uma mutação autoritativa iniciada pela UI em voo, evitando revisões stale provocadas por cliques concorrentes.
- seleções de tabuleiro, carruagens e modos só são limpos depois de um ACK aceite pelo host; rejeições preservam o contexto local para nova tentativa.
- mudanças de turno/fase e bloqueios autoritativos limpam estado transitório antigo (`decision`, seleção de recursos, proposta local, unidade/carruagem e modo).
- decisões de Monopólio, Trabalhadores e propostas de troca só fecham depois de confirmação positiva; decisões locais stale deixam de sobreviver a alterações de turno/estado.
- a mão e o zoom das Cartas de Desenvolvimento usam a mesma regra de jogabilidade do resto da UI, incluindo troca em curso, deploy pendente, Peste e falta de espaço para tropas.
- o tabuleiro deixa de expor hotspots enquanto existe troca ou decisão/roubo pendente.


## v0.99.17 — Decision System unificado

- Banco, proposta/resposta de trocas, descarte do Dragão, Tsunami, Tributo, Bênçãos, roubo, Monopólio, Trabalhadores e Espião passam por uma única família `GameDecisionSystem`.
- `gameDecisionModel.js` traduz estado autoritativo + intenção local para um modelo de decisão puro; o componente não decide regras de validade do jogo.
- Decisões locais deixam de usar `showBank`, `showTrade` e `resourcePicker` independentes e passam a ocupar um único slot exclusivo `decision` no `gameUiReducer`.
- A prioridade visual é fixa: decisão obrigatória → roubo do Dragão → proposta recebida → decisão local, impedindo modais concorrentes ou decisões locais a reaparecer depois de uma interrupção autoritativa.
- O sistema usa pergaminho, lettering e ícones pixel canónicos, com layouts comuns para escolha de recursos, contadores, jogadores, trocas e confirmação.
- Propostas de troca já não permitem selecionar jogadores desligados e os contadores de oferta respeitam os limites aceites pelo reducer.
- `verify-runtime-architecture` inclui o Decision System no transpile/CheckJS e os verificadores de autoridade reconhecem as ações ligadas por esta nova fronteira.


## v0.99.16 — Action System declarativo

- O painel normal do turno passa a ser renderizado por `GameActionPanel`, uma única família visual para ações de construção, Reino, Guerra e Exploração.
- `gameActionModel.js` deixa de cobrir apenas Estrada/Aldeia/Palácio e passa a descrever as ações normais com `enabled`, `reason`, `cost`, `active`, `badge`, `meta`, `tone`, ícone e comando declarativo.
- `GameScreen` executa comandos genéricos do modelo em vez de repetir regras de disponibilidade no JSX; o reducer autoritativo continua a ser a fonte final de validação.
- Estados que o painel antigo podia apresentar como clicáveis apesar de o reducer os rejeitar — troca em curso, decisão obrigatória, Dragão por colocar ou tropa por destacar — passam a ser bloqueados de forma coerente e com explicação visível.
- Guerra recebe um grupo próprio para Cavaleiro, Catapulta, Arqueiro e Suborno quando aplicável; Exploração recebe Carruagem, seleção/movimento, Colonos e Fundar Aldeia.
- Os ícones das ações passam pelo catálogo neutro `gameUiIcons.js`; os dados mantêm um glyph deliberado porque o pack atual não contém um dado adequado.
- O `?dev=ui` usa o `GameActionPanel` real em modo embutido, permitindo validar densidade, estados ativos, custos e motivos de bloqueio sem manter uma maqueta paralela.
- Os verificadores de autoridade reconhecem a cadeia declarativa `gameActionModel → command → dispatchGameAction`, em vez de exigir chamadas diretas artificiais no componente React.

## v0.99.15 — consolidação estrutural do GameScreen

- `GameScreen` deixa de viver em `src/legacy/ReinosDoDragao.jsx` e passa a `src/ui/game/GameScreen.jsx`; o legacy fica responsável sobretudo pela composição raiz, lobby e orquestração de sessão.
- O estado transitório da partida passa por `gameUiReducer`, reduzindo dezenas de `useState` independentes e criando uma fronteira explícita para overlays, interação de tabuleiro, social e decisões.
- `gameActionModel.js` introduz um modelo testável de disponibilidade para Estrada, Aldeia e Palácio, incluindo o motivo de bloqueio; esta é a base do próximo Action System.
- Ícones de recursos e ferramentas passam para `src/assets/gameUiIcons.js`, uma camada neutra consumida por HUD, banners e custos, em vez de o domínio visual dos recursos pertencer ao HUD.
- Os últimos reexports `game → multiplayer` são removidos: sessão é importada diretamente de `multiplayer/sessionStore.js` e o cache de resultados pertence apenas à camada multiplayer.
- Helpers visuais da partida (`EndStats`, pixel art, shell da aplicação, perks e emotes) recebem módulos próprios; o antigo tabuleiro SVG 2D morto é removido do runtime raiz.
- Os verificadores estáticos passam a reconhecer `GameScreen` como a camada de UI da partida em vez de exigir que integrações permaneçam no ficheiro legacy.

## v0.99.14 — HUD persistente e ferramentas da partida

- O antigo header improvisado da partida é substituído por `GameHud`, com identidade do reino, ronda e dados num único chrome persistente de madeira/bronze.
- Mapa, Recursos, Grimório, Crónicas e Opções passam a viver num único dock de ferramentas com ícones do pack canónico e estados ativos coerentes.
- Recursos e Opções recebem painéis contextuais próprios; Opções concentra áudio e saída da sessão sem inventar controlos gráficos ainda não implementados.
- A barra inferior de recursos passa a usar os mesmos ícones pixel dos `PlayerBanner`; o catálogo visual de recursos/HUD deixa de estar duplicado.
- Custos de construção passam a usar os ícones canónicos através de `ResourceCost`, eliminando emojis nessa camada de informação.
- O painel de ações recebe uma estrutura própria do HUD e mantém o tabuleiro visualmente dominante; em mobile o dock move-se para baixo e o conteúdo reserva espaço para não ser tapado.
- O `?dev=ui` mostra o componente `GameHud` real em modo embutido, evitando uma maqueta paralela.

## v0.99.13 — composição correta da overlay do lobby

- `DragonLobby` passa a ser uma overlay transparente sobre a `LobbyScene`, em vez de uma segunda superfície opaca de ecrã inteiro.
- A overlay deixa de interceptar os eventos de ponteiro da galeria 3D; apenas chat, acesso ao livro e controlos acessíveis reativam `pointer-events`.
- O fluxo E2E de criação de reino passa a validar que o canvas continua visível depois da escolha do modo e que a overlay React permanece transparente e não bloqueante.
- O teste de versão deixou de duplicar a versão literal e valida apenas formato + sincronização entre runtime, package, lockfile e saves.

## v0.99.12 — correção de arranque e assinatura dos títulos

- Corrigida a regressão `iceP is not defined` introduzida ao remover a antiga arte procedural das Cartas de Desenvolvimento.
- Corrigida também a referência residual `tname` no recrutamento do modo Guerra; os nomes das tropas passam a vir de `presentation/gameLabels.js`, a fonte canónica já usada pelo presenter.
- A recoloração do Dragão de Gelo passa por `src/ui/pixel/pixelPalette.js`, uma utilidade explícita, imutável e coberta por testes.
- Estrada Mais Longa e Maior Exército passam a transportar a assinatura semântica do novo titular no modelo do acontecimento e a mostrá-la no canto inferior direito do banner.
- Nos dois banners de título, a indicação de continuação ocupa o canto inferior esquerdo para não competir com a assinatura.

## v0.99.11 — Crónicas e acontecimentos cerimoniais

- Dragão/7, Ganância, Peste Negra, Tsunami, Tributo Real, Estrada Mais Longa e Maior Exército passam a usar uma única família de banners cerimoniais com as artes 148×148.
- O catálogo `src/presentation/gameEventCatalog.js` traduz estado semântico de apresentação para modelos visuais sem colocar regras do jogo nos componentes React.
- `ImportantEventBanner` substitui os antigos banners específicos de prémios/desastres e respeita reduced motion.
- A prioridade visual passa a ser carta jogada → desastre → prémio → Dragão → narrativa normal, impedindo overlays importantes sobrepostos.
- As Crónicas do Reino passam a ser um componente próprio em pergaminho, com autoria por Casa, hierarquia e filtros contextuais para eventos, Guerra, trocas e Exploração.
- Entradas do log passam a aceitar `kind` e `emphasis`; saves/logs antigos continuam a normalizar para `realm` + `ambient`.
- O `?dev=ui` demonstra os componentes reais de banners e Crónicas em modo embutido.

## v0.99.10 — linguagem tipográfica e Cartas de Desenvolvimento

- O sistema tipográfico oficial fica reduzido a IM Fell English SC, Mrs Saint Delafield, VT323, Fondamento, UnifrakturCook e Cinzel.
- Crimson Pro, Cormorant Garamond e Tangerine deixam de fazer parte do projeto; VT323 fica reservado a códigos de reino e diagnóstico.
- As Cartas de Desenvolvimento passam a ser um objeto visual próprio em `src/ui/game/DevelopmentCard.jsx`, sem reutilizar um painel genérico.
- 24 artes de tropa são resolvidas pela personagem dona da carta, sem alterar o estado canónico do baralho.
- PV, Monopólio, Trabalhadores e Construtor de Estradas usam as novas artes 64×64.
- Marcha Forçada e Espião ficam explicitamente registadas como as duas únicas artes de carta ainda em falta.
- As artes grandes de Dragão, quatro desastres, Maior Exército e Estrada Mais Longa entram num manifesto separado para a futura fase de banners.
- O `?dev=ui` passa a incluir uma galeria das cartas reais e um exemplo deliberado de arte pendente.


## v0.99.0 — livro funcional paginado

- O livro passa a ter um único reducer para `open` + `page`, controlado acima da cena.
- O foyer tem uma sequência funcional de páginas: início, modos, código e reinos guardados.
- O livro de uma sala autenticada tem páginas próprias para Partida, Jogadores, Opções e Regras.
- As páginas podem ser folheadas para a frente e para trás sem alterar o `APP_STAGE`.
- Fechar e reabrir o livro preserva a página atual.
- A seleção de personagem continua a fechar o livro e regressa ao salão sem reabrir overlays antigos.
- A paginação é funcional e acessível; a animação física de virar folhas fica deliberadamente para a próxima fase visual.

## v0.98.1 — merge visual do lobby

Esta release mantém a consolidação arquitetural da v0.98.0 e integra a revisão visual dos personagens e adereços do salão: personagens facetadas/texturadas, armas e acessórios revistos, troféus de veado e javali reconstruídos e mesa ajustada para as novas proporções. O fluxo, o `LobbyExperience` único e a separação entre criação local e transporte PeerJS permanecem da v0.98.0.

## v0.98.0 — consolidação da experiência do lobby

- Uma única `LobbyScene` permanece montada desde o foyer até ao lobby autenticado.
- Páginas do livro (`BOOK_PAGE`) deixaram de ser estados globais da aplicação.
- A seleção de personagem usa uma intenção explícita (`initial` / `change`) em vez de `swapUi`.
- `LobbyEntryShell` foi removido; `LobbyExperience` compõe cena, livro, galeria e controlos.
- Criação local do reino e arranque do transporte PeerJS têm responsabilidades separadas.
- O transporte já não reinstala snapshots do jogo nem precisa do antigo fallback `g = currentLocal`.
- Adicionados testes puros para páginas do livro e view-model do lobby.


## Estado da arquitetura

- A migração do monólito v52 está concluída: não existe `src/legacy/` no runtime.
- `src/app/App.jsx` compõe navegação, livro, lobby e `GameScreen`; não contém regras nem handlers PeerJS.
- `src/app/useRealmSession.js` adapta a sessão React aos controllers especializados de `src/multiplayer/`, sem JSX.
- `src/game/` contém regras/reducers puros e não depende de infraestrutura multiplayer.
- `src/presentation/` traduz eventos semânticos para modelos de apresentação sem depender de React.
- `src/ui/` contém lobby, partida, HUD, decisões, ações, social e endgame.
- `src/audio/` contém o sistema de áudio e cache próprios.
- As 25 ações autoritativas passam por `applyGameAction`; clientes enviam intenções e o host produz o estado.
- Saves, vistas privadas, protocolos, reconexão, ACK/retry e presença continuam protegidos por testes e verificadores estruturais.
- A linguagem visual, cartas, acontecimentos, HUD, Action System, Decision System, Social e Endgame já usam fronteiras próprias.

A prioridade deixa de ser “extrair do legacy”. A partir daqui, novas refatorações devem responder a uma responsabilidade concreta ou a uma necessidade de produto.

## Executar

É necessário Node.js 18 ou superior.

```bash
npm install
npm run dev
```

Para criar uma versão de produção:

```bash
npm run build
npm run preview
```

## Verificar a recuperação

```bash
npm run verify
```

## Regra principal

Novas funcionalidades devem entrar na camada que é dona da responsabilidade: regras em `src/game/`, transporte/sessão em `src/multiplayer/` ou `src/app/`, apresentação semântica em `src/presentation/` e interface em `src/ui/`. Não criar wrappers de compatibilidade só para preservar nomes da migração concluída.

## Próximo marco

Com a arquitetura base consolidada, o próximo trabalho deve voltar a ser orientado por produto: bots/jogo a solo, opções reais de áudio/gráficos/acessibilidade, temporizador opcional e maior resiliência da autoridade/host, por essa ordem de impacto.

O plano técnico detalhado está em `docs/TECHNICAL_ROADMAP.md`.

## Galeria interna de assets

A galeria interna continua a centralizar os assets pixel art. As Cartas de Desenvolvimento já usam o conjunto canónico 64×64; os novos eventos 148×148 estão registados para a fase de banners.
Para abrir a galeria de desenvolvimento:

```bash
npm run dev:assets
```

Ou, com `npm run dev` já ativo, visita `http://localhost:5173/?dev=assets`.
Consulta `docs/ASSET_FOUNDATION.md` para a estrutura e os componentes disponíveis.

## Alteração v0.70 — entrada direta no lobby

A escolha de personagem anterior ao lobby foi removida.

- Ao escolher o modo, o anfitrião cria imediatamente o reino e entra no lobby.
- Ao introduzir o código, um novo convidado recebe automaticamente um lugar livre.
- A personagem atribuída durante a reserva é temporária e tem de ser confirmada na galeria 3D do lobby.
- `characterConfirmed` faz parte do jogador e sobrevive a atualizações/reconexões.
- Uma sessão válida regressa diretamente ao mesmo jogador sem voltar a forçar a galeria.
- Uma nova ligação com o mesmo token substitui a ligação antiga, evitando o erro de reentrada logo após atualizar a página.
- O jogo não pode começar enquanto todos os jogadores não confirmarem a personagem.
- O protocolo de identidade está agora na versão 7; versões anteriores são rejeitadas explicitamente.

Cenários manuais recomendados:

1. Criar cada modo e confirmar que o lobby abre diretamente com a galeria.
2. Entrar por código num navegador sem sessão e confirmar que não aparece o menu antigo.
3. Atualizar a página antes de escolher personagem e confirmar que a galeria continua obrigatória.
4. Atualizar depois de escolher personagem e confirmar que a galeria não abre automaticamente.
5. Tentar entrar num lobby cheio e confirmar a mensagem de erro.
6. Tentar começar com uma personagem ainda por confirmar e confirmar que o início permanece bloqueado.

## Alteração v0.71 — lobby autoritativo

As alterações do lobby deixaram de ser snapshots completos produzidos pelos convidados.

- Selecionar personagem, marcar pronto, alterar poderes e iniciar a partida usam mensagens `lobby-action`.
- Cada ação contém um `actionId` único e a revisão esperada do estado.
- O host associa a ação à ligação autenticada, valida-a e é o único a criar o estado seguinte.
- Ações repetidas são deduplicadas e ações baseadas numa revisão antiga são rejeitadas com `STALE_STATE`.
- Snapshots enviados por convidados são sempre rejeitados enquanto o reino está no lobby.
- Entradas e saídas continuam a usar os pedidos autoritativos `claim-seat` e `leave-seat`.
- O início grava `startedAt` e `introEndsAt` no estado; a cerimónia visual já não controla diretamente a regra.
- A ordem inicial e a geração específica do modo Guerra são executadas apenas pelo host.
- O protocolo de identidade está agora na versão 7 e o protocolo específico do lobby mantém-se na versão 1.

As ações do lobby continuam integralmente autoritativas; a Parte 04B aplica o mesmo modelo ao restante ciclo da partida.

Cenários manuais recomendados:

1. Dois jogadores tentarem escolher a mesma personagem ao mesmo tempo.
2. Dois jogadores marcarem pronto quase simultaneamente; uma ação desatualizada deve ser rejeitada sem apagar a outra.
3. Um convidado tentar alterar poderes ou iniciar a partida.
4. Atualizar o host durante a animação de início e confirmar que a partida continua para a colocação.
5. Tentar entrar ou sair durante a cerimónia de início.
6. Confirmar que versões anteriores recebem incompatibilidade de protocolo em vez de misturarem estados.


## Alteração v0.72 — núcleo autoritativo da partida (Parte 04A)

O ciclo base deixou de confiar no estado completo produzido pelo cliente. Estas operações usam agora mensagens `game-action`:

- colocação inicial de aldeia/palácio e estrada;
- lançamento dos dados;
- construção de estrada, aldeia e palácio;
- colocação do Dragão e escolha da vítima;
- compra de carta de desenvolvimento;
- troca com o banco;
- fim do turno;
- descarte obrigatório;
- escolha de porto no tsunami;
- escolhas de recurso em tributo e bênção.

Cada ação inclui `actionId`, `expectedRevision` e `gameProtocolVersion`. O host associa a mensagem à sessão autenticada, processa-a numa fila única, valida fase, turno, recursos, limites e alvos, aplica a regra e transmite o estado oficial. Ações repetidas são deduplicadas; ações antigas são rejeitadas com `STALE_STATE`.

O lançamento dos dados, o roubo aleatório, a produção e os desastres desencadeados por estas ações são agora calculados apenas no host.

A Parte 04B elimina o canal transitório que ainda permitia snapshots de convidados durante a partida. O estado oficial passa a ser produzido exclusivamente pelo host.

Cenários manuais recomendados:

1. Completar a colocação inicial com quatro clientes e atualizar um convidado a meio da colocação.
2. Dois clientes tentarem agir sobre a mesma revisão; uma ação deve ser rejeitada sem desfazer a aceite.
3. Um convidado tentar lançar dados ou construir fora do seu turno.
4. Forçar um 7, resolver descartes, mover o Dragão e roubar uma carta.
5. Comprar uma carta e confirmar que o cliente não escolhe qual carta sai do baralho.
6. Tentar trocar no banco sem recursos ou construir numa posição inválida.
7. Terminar o turno com uma decisão obrigatória pendente e confirmar a rejeição.


## Alteração v0.73 — restante partida autoritativa (Parte 04B)

As funcionalidades que ainda usavam mutações locais foram migradas para `game-action`:

- recrutamento, destaque, movimento e combate de tropas;
- poder de Suborno da casa de Romeo;
- construção, movimento, carga e fundação através de carruagens;
- jogar cartas de tropa, estradas, marcha, espião, monopólio e descoberta;
- propor, aceitar, recusar e cancelar trocas entre jogadores.

O host valida modo, fase, turno, identidade, revisão, recursos, posse de cartas/unidades/carruagens, destinos e decisões pendentes. Aceitar ou recusar uma troca é uma exceção controlada à regra do jogador atual: apenas destinatários válidos podem responder e cada proposta tem um `tradeId` estável.

Nessa entrega, o protocolo de jogo passou para a versão 2 e o de identidade para a versão 6. A Parte 05 eleva-os para 3 e 7; clientes antigos continuam a ser rejeitados em vez de misturarem protocolos.

O helper local `mut(...)` foi removido. Convidados já não conseguem executar `commit` nem enviar `{t: "state", g}`; mensagens legacy desse tipo são ignoradas pelo host e recebem novamente o estado oficial. O dispatcher do cliente espera agora pelo ACK do host antes de resolver a ação, evitando que sequências como “jogar Construtor de Estradas → construir” usem a mesma revisão.

Cenários manuais recomendados:

1. Recrutar e destacar cada tipo de tropa no modo Guerra.
2. Mover, atacar, usar ataques de arqueiro e confirmar o controlo de ações militares.
3. Usar Suborno com alvo válido, ouro insuficiente e tentativa repetida no mesmo turno.
4. Construir uma carruagem, revelar terreno, carregar colonos e fundar uma aldeia distante.
5. Jogar todas as categorias de cartas, incluindo escolhas de alvo/recurso.
6. Enviar uma troca a um jogador e a todos; testar aceitação simultânea, recusa, cancelamento e recursos que mudam antes da resposta.
7. Abrir um cliente da Parte 04A e confirmar a incompatibilidade explícita de protocolo.
8. Tentar enviar manualmente uma mensagem `{t: "state"}` e confirmar que o host mantém o estado oficial.

A fronteira de confidencialidade descrita acima foi implementada na alteração v0.74.

## Alteração v0.74 — vistas públicas e privadas (Parte 05)

O host continua a guardar o estado canónico completo, mas cada ligação recebe agora uma vista própria criada em `src/game/gameStateView.js`.

- Ligações ainda não autenticadas recebem apenas uma vista pública.
- O jogador autenticado recebe os seus recursos e cartas completos.
- Os adversários expõem apenas `resourceCount` e a quantidade total de cartas de desenvolvimento.
- `sessionTokenHash` nunca é enviado aos clientes, incluindo ao próprio jogador.
- O baralho mantém apenas o número de cartas; ordem, tipos e identificadores ficam ocultos.
- Hexágonos e portos sob nevoeiro mantêm a topologia necessária à cena, mas não revelam terreno, número ou tipo real.
- No fim da partida, cartas, recursos, baralho e mapa são revelados para permitir as estatísticas finais; hashes de sessão permanecem sempre ocultos.
- A carta Espião recebe a mão alvo através de `privateResult`, enviada exclusivamente ao jogador que a utilizou.
- O protocolo de identidade passou para a versão 7 e o protocolo de jogo para a versão 3.

Cenários manuais recomendados:

1. Abrir as ferramentas de desenvolvimento de um convidado e confirmar que os rivais têm recursos a zero, mas `resourceCount` correto.
2. Confirmar que apenas a mão do próprio jogador contém os tipos reais das cartas.
3. Inspecionar `deck` e verificar que contém apenas placeholders `hidden`.
4. No modo Terras do Além, confirmar que um hexágono sob nevoeiro não contém o terreno/número real e que fica correto após ser revelado.
5. Usar Espião e confirmar que o relatório aparece apenas no cliente que jogou a carta.
6. Terminar uma partida e confirmar que as estatísticas finais revelam as cartas secretas.


## Alteração v0.75 — presença do lobby, sessões por tab e kick (Parte 06A.1)

A identidade ativa passou de `localStorage` para `sessionStorage`. Cada separador normal pode agora representar um jogador diferente, mantendo a mesma sessão durante um refresh da própria tab.

- Cada jogador tem `connected`, `disconnectedAt`, `reconnectDeadline` e `controller`.
- Ao perder a ligação no lobby, o jogador deixa de estar pronto e o lugar fica reservado durante 30 segundos.
- Uma reconexão com o token correto recupera o mesmo `playerId` e limpa o estado de desconexão.
- Quando o prazo termina, o host remove automaticamente a participação e liberta a personagem/lugar.
- O anfitrião dispõe de **Expulsar** para remover imediatamente qualquer convidado do lobby.
- O kick não é um banimento: invalida a participação removida, limpa a sessão no cliente ligado e permite nova entrada com o mesmo código.
- Se alguém se desligar durante a cerimónia de início, a transição é cancelada e todos regressam ao estado não pronto.
- Depois de a partida começar, o jogador não é apagado: fica `connected: false`, mantém as peças/recursos e `controller: "human"`, preparando a futura substituição temporária por bot.
- Lobby, jogo, entradas, saídas, presença e finalização do início passam pela mesma fila autoritativa.
- O protocolo de identidade passou para a versão 8 e o protocolo do lobby para a versão 2.

Cenários manuais recomendados:

1. Abrir quatro tabs normais, entrar com quatro jogadores diferentes e confirmar IDs distintos.
2. Atualizar uma tab convidada e confirmar que recupera o mesmo lugar dentro dos 30 segundos.
3. Fechar uma tab no lobby e observar o estado desligado e a contagem decrescente.
4. Esperar o prazo e confirmar que o lugar fica livre para uma entrada nova.
5. Usar **Expulsar** num jogador ligado e confirmar que esse cliente regressa ao ecrã de entrada e pode voltar.
6. Usar **Expulsar** num jogador desligado e confirmar libertação imediata.
7. Desligar um jogador durante a animação de início e confirmar que a partida não avança.
8. Perder a ligação depois do início e confirmar que o jogador permanece no estado para futura reconexão/bot.

## Alteração v0.76 — presença durante a partida e preparação do bot (Parte 06A.2)

A desconexão durante uma partida deixa de ser apenas uma marca visual. O host passa a controlar uma janela de reconexão associada ao jogador que tem realmente de tomar a próxima decisão.

- O jogador exigido é a pessoa no turno atual ou, quando existe uma decisão obrigatória na fila, o dono dessa decisão.
- Se esse jogador estiver desligado e ainda for controlado por humano, começa uma janela de 90 segundos.
- Jogadores desligados que ainda não têm de agir permanecem reservados, mas não bloqueiam a partida nem iniciam um cronómetro prematuramente.
- A contagem decrescente aparece no estado central e nos painéis dos jogadores.
- Ao terminar o prazo, o lugar muda autoritativamente para `controller: "bot"` e deixa de aceitar ações humanas antigas.
- A IA ainda não executa jogadas nesta entrega. O estado fica preparado para o motor de bot da fase seguinte, sem apagar recursos, cartas, peças ou identidade.
- Uma reconexão antes do prazo cancela o temporizador e devolve imediatamente o controlo ao humano.
- Uma reconexão depois do takeover recupera o controlo num ponto seguro. O campo `botActionInProgress` já permite adiar essa devolução caso uma futura IA esteja a meio de uma ação.
- Ao retomar um save como host, os convidados ficam desligados e o prazo só começa para aquele que estiver efetivamente a bloquear a próxima decisão.
- O protocolo de identidade passou para a versão 9 e o protocolo de jogo para a versão 4.

Cenários manuais recomendados:

1. Fechar a tab do jogador atual e confirmar a contagem de 90 segundos em todos os clientes.
2. Fechar a tab de um jogador que ainda não tem o turno e confirmar que não aparece contagem até chegar a vez dele.
3. Forçar um descarte obrigatório de outro jogador, desligá-lo e confirmar que o prazo acompanha a decisão da fila, não o dono do turno.
4. Reconectar antes do fim do prazo e confirmar que o turno/decisão continua sem perder estado.
5. Deixar o prazo terminar e confirmar que o jogador aparece como BOT e que o cliente antigo não consegue enviar ações humanas.
6. Reconectar depois do takeover e confirmar que o mesmo `playerId`, recursos e peças são preservados.
7. Retomar um save em que o próximo jogador é um convidado desligado e confirmar que o prazo começa apenas depois de o host voltar a abrir o reino.

Nota: esta fase prepara o controlo por bot, mas ainda não implementa a estratégia de IA. Até essa fase existir, uma partida continua parada quando o prazo termina e o lugar passa para BOT.


## Alteração v0.77 — skip AFK progressivo e recuperação de ações (Parte 06B)

A preparação experimental de bots da Parte 06A.2 foi substituída por uma política temporária mais simples. Nenhum jogador passa agora para controlo automático.

- Quando um jogador desligado se torna responsável pela próxima ação, a primeira espera é de 90 segundos.
- Se o prazo terminar, o host salta autoritativamente apenas a decisão ou turno que está a bloquear a partida.
- Enquanto o jogador continuar ausente, cada nova vez em que tenha de agir usa um prazo reduzido de 30 segundos.
- Uma reconexão válida mantém o mesmo `playerId`, cancela o cronómetro e reinicia o ciclo; uma futura desconexão volta a começar nos 90 segundos.
- Decisões da fila, como descarte, tsunami, tributo ou bênção, são removidas quando expiram.
- Durante a fundação inicial, a colocação pendente é saltada e a sequência avança.
- Durante o jogo normal, decisões temporárias do turno são canceladas e `endTurn` avança para o jogador seguinte.
- `afkSkipCount` e `lastAfkSkipAt` registam o ciclo AFK sem alterar a identidade ou os bens do jogador.

A recuperação de mensagens também foi reforçada:

- Se uma resposta se perder, o cliente reenvia uma vez o mesmo envelope com o mesmo `actionId`.
- A deduplicação do host impede que dados, compras, movimentos ou outras ações sejam aplicados duas vezes.
- Depois de duas tentativas sem resposta, a ação é limpa e a UI deixa de ficar bloqueada.
- Alterações idempotentes do lobby (`SELECT_CHARACTER`, `SET_READY` e `SET_PERKS`) são repetidas uma vez com uma revisão nova após `STALE_STATE`.
- Ações de jogo dependentes do tabuleiro não são repetidas automaticamente após `STALE_STATE`; o cliente adota o estado oficial e pede ao utilizador que confirme novamente.

Protocolos desta entrega:

```text
IDENTITY_PROTOCOL_VERSION = 10
GAME_PROTOCOL_VERSION = 5
LOBBY_PROTOCOL_VERSION = 2
```

Cenários manuais recomendados:

1. Desligar o jogador atual e confirmar a primeira contagem de 90 segundos.
2. Deixar o prazo terminar e confirmar que o turno avança sem aparecer qualquer BOT.
3. Manter o jogador ausente até à ronda seguinte e confirmar uma espera de 30 segundos.
4. Reconectar antes do prazo e confirmar que o turno/decisão continua normalmente.
5. Reconectar depois de um skip, voltar a desligar e confirmar que a nova ausência começa novamente nos 90 segundos.
6. Testar um descarte obrigatório, tsunami ou bênção pertencente a um jogador desligado.
7. Interromper momentaneamente a rede durante uma ação e confirmar que o mesmo `actionId` é reenviado sem duplicar o resultado.
8. Marcar pronto simultaneamente em duas tabs e confirmar a recuperação automática de `STALE_STATE` no lobby.

Nota: saltar uma colocação durante a fase inicial pode deixar esse jogador em desvantagem caso regresse mais tarde. É uma política provisória para manter a partida desbloqueada até ser definida uma substituição mais sofisticada.

## Alteração v0.78 — testes automatizados do núcleo (Parte 07)

Foi adicionada uma suite sem dependências externas, usando `node:test` e `node:assert/strict`.

- 27 testes comportamentais cobrem protocolos, identidade, sessões por separador, lobby, kick, presença/AFK e vistas privadas.
- Os testes confirmam que reducers e criadores de vistas não mutam o estado canónico.
- `npm run verify` executa agora as verificações estáticas e a suite de testes.
- `npm run check` executa verificações, testes e build de produção.
- `TESTING.md` documenta a cobertura e o processo para transformar cada bug futuro num teste de regressão.

As regras completas da partida ainda residem no componente legacy; a sua cobertura comportamental será acrescentada à medida que forem extraídas para módulos puros em `src/game/`.


## Alteração v0.79 — extração de recursos e construção (Parte 08A)

A primeira fatia das regras saiu de `src/legacy/ReinosDoDragao.jsx` sem alterar o protocolo ou a interface.

- `src/game/resources.js` contém os cinco recursos, custos, limites, tamanho da mão e operações de pagamento.
- `src/game/buildingRules.js` contém estradas/aldeias/palácios válidos, contagem de peças, portos ativos e rácios do banco.
- O componente legacy importa estas regras em vez de manter cópias locais.
- A suite passou de 27 para 41 testes, incluindo exploração, províncias de Guerra, bloqueio por construções rivais e portos desativados.
- `scripts/verify-extracted-resource-building-rules.cjs` impede que as declarações voltem a ser duplicadas no JSX.

A aplicação das construções ainda permanece no componente legacy porque dispara logs, áudio, prémios e animações. Essa mutação será extraída numa fase posterior, depois de separar os efeitos visuais dos resultados de domínio.


## Parte 8B — núcleo extraído

Construções e produção passam agora por reducers puros em `src/game/`, com efeitos visuais mantidos no componente legacy. Consulta `docs/CORE_EXTRACTION_8B.md`.


## Alteração v0.79 — lançamento dos dados e resultado 7 (Parte 08C)

O lançamento dos dados deixou de atualizar diretamente turno, estatísticas, produção e filas obrigatórias dentro do componente legacy.

- `src/game/diceReducer.js` gera dados através de RNG injetável e aplica o resultado de forma imutável.
- Estatísticas de lançamentos e setes têm agora uma função pura dedicada.
- O 7 clássico prepara descartes e ativa o Dragão de Fogo.
- O 7 de Guerra desperta o Dragão de Gelo, ativa poderes e prepara as Bênçãos.
- Produção normal continua a reutilizar `productionReducer.js`.
- Resultados 2/12 devolvem sinais semânticos para Presságio ou Desastre; a implementação detalhada dos desastres permanece temporariamente no legacy.
- Logs, áudio e animações continuam no componente, consumindo o evento devolvido pelo reducer.

A suite inclui testes determinísticos para dados, imutabilidade, produção, Dragões, Muriel, Bones e gatilhos extremos por modo. O total atual é de 68 testes.

## Alteração v0.79 — reducers dos quatro desastres (Parte 08D)

Ganância, Peste Negra, Tsunami e Tributo Real deixaram de alterar diretamente o estado dentro do componente legacy.

- `src/game/disasterReducer.js` identifica os jogadores protegidos pelo número sagrado e aplica cada desastre de forma imutável.
- O RNG é injetável, permitindo reproduzir perdas, distribuição de saque e seleção do desastre nos testes.
- Jogadores com Trindade/imunidade deixam de sofrer desastres, sem serem tratados como beneficiários do número sagrado.
- As escolhas posteriores de Tsunami e Tributo também usam reducers puros.
- Logs, retratos, texto narrativo e overlay continuam no componente, construídos a partir de eventos semânticos.
- Foi corrigido um bug antigo: `tributo` tinha implementação e interface, mas não constava da lista sorteável e nunca podia ocorrer.

A suite totaliza agora 82 testes, incluindo imutabilidade, Ganância, quarentena, portos, escolhas pendentes, imunidade e RNG inválido.

## Alteração v0.79 — cartas de desenvolvimento (Parte 08E)

A compra, maturação e utilização das cartas de desenvolvimento deixaram de alterar diretamente o estado dentro do componente legacy.

- `src/game/developmentCardReducer.js` aplica a compra e desconta o custo da carta de forma imutável.
- Cartas recém-compradas permanecem em `devNew` e só passam para `devOld` no fim do turno do proprietário.
- Tropas, Construtor de Estradas, Marcha Forçada, Monopólio, Trabalhadores e Espião são resolvidos pelo reducer puro.
- O relatório do Espião permanece um resultado privado e não entra nos eventos partilhados.
- A Trindade das Armas e o Maior Exército são atualizados como resultados de domínio; logs, retratos e animações continuam no componente.
- Cartas de Ponto de Vitória continuam secretas e não podem ser jogadas ativamente.

A suite totaliza agora 95 testes, incluindo imutabilidade, maturação, escolhas inválidas, Monopólio, Trabalhadores, Espião e diferenças entre tropas clássicas e de Guerra.

## Alteração v0.79 — reducers de trocas (Parte 08F)

As trocas bancárias e entre jogadores deixaram de alterar diretamente o estado dentro do componente legacy.

- `src/game/tradeReducer.js` normaliza ofertas e aplica trocas de forma imutável.
- Rácios 2:1, 3:1 e 4:1 continuam a usar os portos ativos do jogador.
- Propostas guardam identidades estáveis e um `tradeId` autoritativo.
- A aceitação revalida os recursos de ambos os participantes no momento da conclusão.
- Recusas dirigidas encerram a proposta; propostas globais permanecem até todos recusarem.
- Cancelamento continua reservado ao proponente.
- Estatísticas de banco/porto e trocas P2P são atualizadas no reducer.
- Logs permanecem no componente, consumindo eventos semânticos.

A suite totaliza agora 110 testes, incluindo imutabilidade, portos, ofertas inválidas, recursos alterados antes da aceitação, destinatários, recusa global e cancelamento.

## Alteração v0.79 — núcleo do modo Guerra (Parte 08G)

Recrutamento, destaque, movimento, combate, Troll e Suborno foram extraídos para `src/game/warReducer.js`. O componente legacy apresenta os eventos, mas deixou de decidir custos, alvos, resultados de combate, ressurreições e libertações de cercos.

A suite inclui agora 126 testes, dos quais 16 cobrem diretamente o modo Guerra. O ciclo automático da horda e os cercos processados no início do turno permanecem temporariamente no legacy.


## Alteração v0.79.1 — paridade da névoa e robustez de ações

Esta revisão corrige uma divergência entre o estado canónico do host e a vista filtrada dos convidados.

- Hexágonos sob névoa usam agora o sentinela `terr: "oculto"`, em vez de fingirem ser `deserto`.
- As regras de terreno baldio ignoram explicitamente hexágonos escondidos.
- Um teste compara `validRoads` no estado canónico e na vista redigida na fronteira de exploração.
- O cache de deduplicação guarda apenas confirmações aceites, sem snapshots, durante 60 segundos.
- Rejeições `STALE_STATE` transportam apenas a revisão e levam o cliente a pedir uma nova vista através de `state-request`.
- Rajadas de ações inválidas já não conseguem expulsar do cache a confirmação de uma ação válida.
- Um segundo clique numa ação já pendente reutiliza a mesma Promise e apresenta feedback imediato.
- Trocas dirigidas a jogadores desligados são rejeitadas; propostas globais consideram esses jogadores recusados.
- Se um participante de uma troca perder a ligação, a proposta é cancelada ou atualizada automaticamente.

Protocolos desta revisão:

```text
IDENTITY_PROTOCOL_VERSION = 11
GAME_PROTOCOL_VERSION = 6
STATE_VIEW_VERSION = 2
```


## Alteração v0.79.2 — automatismos do modo Guerra (Parte 08H)

O ciclo automático do modo Guerra deixou de alterar diretamente o estado dentro do componente legacy.

- `src/game/warAutomationReducer.js` controla cercos no início do turno, ocupações, Glória de Guerra e contrabando.
- O despertar da horda, o Troll Gigante, ondas de saqueadores, movimento, pilhagem e reposição no Coração usam RNG injetável.
- O varrimento do Gigante no fim do turno passa por um reducer imutável.
- Destruições automáticas de catapultas revalidam ocupações e libertam imediatamente edifícios sem cerco suficiente.
- `endTurn` devolve agora explicitamente o estado resultante, permitindo encadear reducers imutáveis também no skip AFK.
- Logs, retratos, overlays e falas continuam no componente, produzidos a partir de eventos semânticos.

A suite totaliza agora 148 testes. A geração do mapa de Guerra, exploração por carruagens, ciclo geral de turnos e pontuação ainda permanecem parcialmente no legacy.

## Alteração v0.79.3 — exploração e carruagens (Parte 08I)

O modo Exploração deixou de alterar diretamente carruagens, nevoeiro, portos e colónias dentro do componente legacy.

- `src/game/explorationReducer.js` controla construção e limite vitalício das carruagens.
- Movimento vazio/ carregado, reposição por turno e paragem ao entrar no nevoeiro são imutáveis e testáveis.
- A revelação atribui o recurso do terreno e revela portos costeiros apenas no estado canónico do host.
- Carregamento de colonos e fundação de aldeias remotas passam pelo reducer.
- Os alvos de movimento são iguais no estado canónico e na vista redigida, sem revelar o conteúdo do nevoeiro.
- Logs, falas, Estrada Mais Longa e vitória continuam na camada de apresentação.

A suite totaliza agora 159 testes. Geração de mapas, Dragão/decisões obrigatórias, ciclo geral de turnos e pontuação continuam parcialmente no legacy.

## Alteração v0.79.4 — Dragão e decisões obrigatórias (Parte 08J)

- `src/game/mandatoryDecisionReducer.js` centraliza colocação do Dragão, vítimas, roubo, descarte, Tsunami, Tributo e bênçãos.
- O recurso roubado é devolvido apenas numa resposta privada ao jogador que executou a ação.
- `requiredGameActorIndex` e o skip AFK da fila obrigatória deixam de viver no componente React.
- A paridade de destinos do Dragão é testada entre o estado canónico e a vista redigida.
- O componente legacy conserva apenas logs, modais, sons e o avanço geral de turno que será extraído na Parte 08K.

A suite totaliza agora 172 testes.
- Colocar o Dragão e concluir o roubo exigem agora explicitamente que o ator autenticado seja o jogador do turno.

## Alteração v0.79.5 — ciclo completo de turnos (Parte 08K)

O avanço entre jogadores deixou de alterar diretamente cartas, efeitos temporários, carruagens e automatismos dentro do componente legacy.

- `src/game/turnCycleReducer.js` centraliza o fim e o início de cada turno.
- Cartas compradas amadurecem no fim do turno do proprietário e estradas grátis não utilizadas expiram.
- Peste e portos desativados avançam apenas quando começa o turno do jogador afetado.
- O novo turno limpa dados temporários militares, Dragão, Suborno, bónus e ações já usadas.
- Carruagens são repostas apenas para o jogador que inicia o turno.
- Varrimento do Gigante, cercos, horda, despertar do Dragão de Gelo e Guarda do Coração passam pela mesma transição pura.
- O limite de rondas do modo Guerra é sinalizado pelo reducer; a escolha do vencedor permanece temporariamente na apresentação até à Parte 08L.
- O botão de fim de turno e o skip AFK usam exatamente o mesmo caminho de domínio.

A suite totaliza agora 186 testes. Pontuação, vitória e desempates serão extraídos na Parte 08L.


## Alteração v0.79.6 — pontuação e fim da partida (Parte 08L)

A pontuação deixou de ser calculada em funções soltas dentro do componente legacy.

- `src/game/scoringReducer.js` centraliza pontos públicos e secretos, Estrada Mais Longa e Maior Exército.
- Aldeias, palácios, ocupações, Glória de Guerra e cartas secretas usam uma única decomposição de pontos.
- A Estrada Mais Longa respeita bloqueios por edifícios adversários e nunca reutiliza uma aresta.
- O detentor atual conserva Estrada/Maior Exército em caso de empate, mantendo a regra anterior.
- Modos normais terminam autoritativamente quando o jogador ativo alcança 10 pontos, incluindo cartas secretas.
- Guerra continua sem vitória imediata aos 10 pontos e termina apenas no limite de rondas.
- O vencedor por rondas é calculado com todos os pontos já revelados.
- Em empate absoluto no fim das rondas, foi formalizada a regra anterior: prevalece a ordem estável dos lugares (`playerIndex`).
- O placar público e as estatísticas finais usam o mesmo ranking do domínio.
- `developmentCardReducer.js` e `warAutomationReducer.js` deixaram de manter cópias próprias da pontuação.

A suite totaliza agora 202 testes. Permanecem por extrair sobretudo a geração/configuração dos mapas e o dispatcher central `applyAction`.


## Parte 08M — criação inicial, mapas e baralhos

A criação das partidas deixou de viver no componente React. Foram extraídos:

- `src/game/gameModes.js` — configuração canónica dos cinco modos e capacidade do lobby;
- `src/game/random.js` — seleção e baralhamento com RNG injetável;
- `src/game/boardGeometry.js` — anéis hexagonais e grafo do tabuleiro;
- `src/game/gameFactory.js` — jogadores, estado inicial, mapas e baralhos;
- `src/game/gameSetupReducer.js` — transição autoritativa do lobby para a colocação inicial.

A geração do modo Guerra volta a usar o número real de jogadores ao começar, marca o covil do Troll e cria a ordem espelhada da fundação. A geração do modo Exploração conserva o cinturão de Terras Ardidas, o anel oculto e os portos escondidos. Todos os geradores aceitam RNG injetável e são testados deterministicamente.


## Alteração v0.79.8 — `applyGameAction` central (Parte 08N)

O grande dispatcher autoritativo deixou de viver em `ReinosDoDragao.jsx`.

- `src/game/gameActionReducer.js` recebe estado, `actorId`, intenção e dependências injetáveis.
- As 25 ações de `GAME_ACTION` passam pela mesma fronteira pura.
- O módulo devolve novo estado, eventos semânticos e, quando necessário, resultados privados.
- React conserva apenas apresentação, áudio, animações, rede e persistência transitória.
- RNG, relógio, dados e criação de IDs podem ser injetados nos testes.
- A aceitação de trocas por destinatários fora do turno continua suportada explicitamente.
- Ações desconhecidas, jogadores desligados ou identidades inválidas são rejeitados sem mutar o estado.

Esta fronteira é a peça que permitirá mover futuramente a autoridade do navegador do host para um backend sem reescrever as regras ou a UI.


## Alteração v0.79.9 — runtime multiplayer, Parte 09A

A infraestrutura de rede que não pertence às regras do jogo foi movida para `src/multiplayer/`:

- `runtimeState.js`: estado do transporte, registo/autenticação de ligações, substituição de sessões e fila autoritativa;
- `pendingActionStore.js`: pedidos pendentes, deduplicação por tipo, ACK, timeout e um retry com o mesmo envelope;
- `sessionStore.js`: persistência da identidade por separador em `sessionStorage`;
- `protocolMessages.js`: construção dos envelopes de lobby, jogo e sincronização;
- `stateTransport.js`: vista privada/pública por ligação e broadcast filtrado;
- `actionResultCache.js`: cache compacto e temporal de confirmações aceites.

`ReinosDoDragao.jsx` continua a iniciar PeerJS e a apresentar erros/eventos, mas deixou de implementar diretamente estas estruturas. A Parte 09B moverá os handlers de host e cliente para `hostRuntime.js` e `clientRuntime.js`.

Cenários manuais recomendados:

1. Criar uma sala, ligar quatro tabs e atualizar cada convidado.
2. Atualizar rapidamente uma tab e confirmar que a ligação nova substitui a antiga.
3. Simular uma resposta perdida e confirmar apenas um retry com o mesmo `actionId`.
4. Confirmar que cada convidado continua a receber apenas a sua vista privada.
5. Sair para o título durante uma ação pendente e confirmar que timers e promessas são limpos.


## Alteração v0.79.10 — runtimes PeerJS, Parte 09B

A criação do transporte PeerJS e os seus callbacks deixaram de viver em `ReinosDoDragao.jsx`.

- `src/multiplayer/hostRuntime.js` controla criação do peer anfitrião, timeout de abertura, novas ligações, filtragem das respostas por jogador, mensagens, fecho e erros.
- `src/multiplayer/clientRuntime.js` controla criação do peer convidado, ligação ao código da sala, timeouts de abertura/boas-vindas, mensagens, fecho e erros.
- `src/multiplayer/browserPeerRuntime.js` é o único adaptador que importa `peerjs`; os runtimes puros aceitam um construtor injetável e podem ser testados sem browser.
- `destroyMultiplayerRuntime` limpa também os timers e o controller de transporte antes de destruir ligações e peer.
- Fechos provocados por cleanup já não são confundidos com desconexões reais de jogadores.
- Todas as respostas do host continuam a passar por `payloadForConnection`, preservando as vistas privadas.
- O componente React já não contém `new Peer`, `peer.on(...)` ou `conn.on(...)`.

A interpretação das mensagens e a ligação destas aos estados React ainda permanecem temporariamente no componente. Essa camada será o alvo da Parte 09C.

Cenários manuais recomendados:

1. Criar e entrar numa sala com quatro tabs.
2. Atualizar rapidamente um convidado e confirmar substituição da ligação antiga.
3. Fechar voluntariamente uma sala e confirmar que o cleanup não marca jogadores como AFK.
4. Simular código inexistente e confirmar os dois timeouts distintos: serviço PeerJS e boas-vindas do host.
5. Confirmar que cada convidado continua a receber apenas a sua vista privada.


## Alteração v0.79.12 — sessão e presença, Parte 09D

Os handlers de aplicação responsáveis por identidade e presença deixaram de viver diretamente em `ReinosDoDragao.jsx`.

- `src/multiplayer/hostSessionPresenceController.js` trata autenticação, substituição da ligação antiga, reserva de lugar, saída voluntária, perda de transporte e efeito de kick.
- `src/multiplayer/clientSessionPresenceController.js` mantém a pequena máquina de sessão do convidado e traduz respostas de rede em eventos de aplicação como `SESSION_ACCEPTED`, `CLAIM_REQUIRED`, `SESSION_REPLACED` e `KICKED_FROM_LOBBY`.
- O React consome esses eventos para atualizar ecrãs, mensagens e identidade local; já não valida envelopes de identidade nem decide o fluxo de reconexão.
- Os controladores consultam sempre o runtime atualmente ativo, evitando guardar uma referência antiga quando uma tentativa de ligação substitui `net.current`.
- Reconexões continuam a cancelar timers de lobby/jogo e a substituir em segurança a ligação anterior.
- O kick continua a notificar apenas o alvo, revoga a participação atual e permite uma entrada nova posterior.

Cenários manuais recomendados:

1. Atualizar rapidamente um convidado e confirmar que a tab antiga recebe “sessão substituída”.
2. Fechar e reabrir um convidado dentro dos 30 segundos do lobby.
3. Sair voluntariamente e confirmar que o lugar é removido imediatamente.
4. Expulsar um jogador ligado e confirmar que regressa ao ecrã de entrada.
5. Tentar reentrar após expiração e confirmar que é necessário reservar um lugar novo.


## Parte 09E — ações de lobby e partida

A validação e aplicação autoritativa das ações saiu de `ReinosDoDragao.jsx`:

- `hostActionController.js` valida envelopes, identidade, revisão e deduplicação, aplica os reducers e produz os ACKs;
- `clientActionController.js` constrói intenções, gere ações pendentes, retry com o mesmo `actionId`, sincronização após `STALE_STATE` e tradução de erros para eventos React;
- ações locais do anfitrião e ações remotas dos convidados passam pelo mesmo caminho de confirmação;
- resultados privados continuam separados dos eventos partilhados;
- o componente conserva apenas logs, toasts, áudio, animações e atualização visual.

A suite tem agora 265 testes, incluindo nove cenários específicos destes controladores.

## Parte 9F — estado, chat e emotes

A adoção de snapshots recebidos, a autoria de chat/emotes, os rate limits e a deduplicação social foram extraídos para `src/multiplayer/stateSyncController.js` e `src/multiplayer/socialEventController.js`. O host reconstrói sempre a autoria a partir da ligação autenticada.

## Parte 10A — lobby dividido

O lobby 3D deixou de estar concentrado num único ficheiro:

- `DragonLobby.jsx` contém apenas composição e estado de interface;
- `LobbyScene.jsx` contém a cena Three.js e o controller imperativo;
- `LobbyPanels.jsx` contém os lugares e o chat;
- o timer de feedback ao copiar o código é limpo no unmount.

`DragonLobby` é a única interface que gere jogadores já dentro de um lobby. Os ecrãs de título, escolha de modo e entrada por código continuam apenas como fluxo de acesso à sala, não como uma segunda gestão de lugares.


## Parte 10A.1 — saneamento de lifecycle

- Board3D atualiza apenas quando muda a revisão ou os alvos interativos.
- Timers visuais são cancelados no unmount.
- Lobby e tabuleiro usam disposal comum de geometrias, materiais e texturas.
- Configuração PeerJS está centralizada em `src/multiplayer/config.js`.
- IDs sociais usam `createStableId`.

## Alteração v0.79.15 — LobbyScene modular

- `LobbyScene.jsx` ficou responsável apenas pelo lifecycle React.
- `lobbySceneController.js` concentra renderer, câmara, interação e animação.
- texturas, decoração, atores e galeria vivem em módulos próprios.
- o verificador impede que Three.js volte para a camada React.

## Parte 11 — Board3D modular e incremental

O adaptador React do tabuleiro vive agora em `src/ui/board/Board3D.jsx`, o controller Three.js em `boardSceneController.js` e a configuração visual em `boardVisualConfig.js`. O componente legacy deixou de importar Three.js. As assinaturas estáveis dos conjuntos interativos evitam sincronizar a cena por alterações de UI sem impacto no tabuleiro.

## Parte 12 — StrictMode

- `React.StrictMode` está ativo em desenvolvimento.
- Runtime multiplayer, ações pendentes, timers de presença, emotes e ferramentas internas têm cleanup idempotente.
- A suite inclui verificações específicas para desmontagem repetida.

## Parte 13 — saves versionados

Os saves locais usam agora `saveSchemaVersion`, `appVersion`, migrações explícitas e validação de invariantes antes de serem aceites. Saves sem versão são migrados para o schema 1; saves futuros ou corrompidos são rejeitados de forma segura.

### Testes de integração sem browser

A Parte 14A acrescenta cenários completos em `tests/integration-flow.test.js`. Execute `npm test` ou `npm run verify` para validar o fluxo de quatro jogadores, o pipeline autoritativo cliente/host e a deduplicação de entregas.


## Parte 14A.1 — vozes e efeitos de tropas

- 176 novas falas: 22 por personagem.
- Eventos específicos: aldeia, palácio, Estrada Mais Longa, Maior Exército, vitória, roubo e troca concluída.
- Os oito emotes usam as novas gravações.
- Cartas de Arqueiro e Catapulta usam efeitos dedicados.
- A carta de Cavaleiro toca o galope em paralelo com três golpes de espada em sequência.
- As vozes são carregadas sob demanda; não são descarregadas todas no arranque.

## Browser E2E

A camada E2E atual usa Cypress. O servidor Vite é arrancado separadamente com `npm run e2e:serve`; noutro terminal, `npm run test:e2e` valida o lobby e o arranque de Clássico, Cerco Relâmpago e Dragão com `?transport=mock`. `npm run test:e2e:open` abre o runner visual para diagnóstico. Fluxos que exigem dois browsers humanos em simultâneo permanecem cobertos pelos testes de integração e pela matriz manual, porque o Cypress controla um browser de cada vez.


## v0.88.0

A criação e entrada numa sala conduzem agora a uma etapa explícita de seleção de personagem. A câmara foca a parede e só regressa ao lobby depois da confirmação autoritativa da escolha.



## v0.92.0

- A antiga suite Playwright foi a primeira camada E2E do salão e do livro.
- Na v0.99.37, a camada ativa migrou para Cypress devido a bloqueios persistentes do runner Playwright no ambiente Windows de desenvolvimento.
- GitHub Actions usa `npm ci`, arranca Vite separadamente e guarda screenshots/log do Cypress em caso de falha.
- A compatibilidade de sessão mantém-se em `1`, porque esta versão não altera o protocolo de rede.

## v0.91.0

Os jogadores ocupam agora um lugar sem personagem provisória. A casa permanece por escolher até à confirmação autoritativa na galeria; prontidão e troca de casa ficam bloqueadas enquanto essa escolha estiver pendente.


## v0.94.0

- O módulo 3D do tabuleiro é pré-carregado durante tempo ocioso quando os jogadores chegam à seleção de personagem ou ao lobby.
- O carregamento inicial continua limitado ao salão; uma falha de preload nunca impede o lazy import normal.
- O livro mostra discretamente a versão exata da build para facilitar diagnóstico e compatibilidade.
- `vercel.json` define fallback SPA, cache curto para assets públicos, HTML sem cache e headers básicos de segurança.
- Foram adicionados testes do agendador de preload e um verificador dedicado à configuração de deploy.
- A compatibilidade de rede permanece em `1`.


## Diagnóstico de produção

A versão 0.94.0 mantém localmente os 50 eventos técnicos mais recentes, incluindo erros fatais, falhas PeerJS, perda/retoma de rede e versão da build. Dados com aspeto de tokens são removidos antes do registo. Um endpoint opcional pode ser configurado com `VITE_DIAGNOSTICS_ENDPOINT`; sem essa variável, nenhum relatório é enviado para fora do navegador.


## v0.97.2 — partidas normais com 3 ou 4 jogadores

Os modos normais podem iniciar com 3 ou 4 jogadores. Para facilitar testes práticos, um **Reino de teste** pode iniciar com 2, 3 ou 4 jogadores, desde que todos os jogadores presentes tenham casa confirmada, estejam ligados e prontos. Reinos normais permitem 3 ou 4 jogadores; apenas o modo de teste permite iniciar com 2.

O Reino de teste continua também a atribuir 99 recursos aos jogadores. Esta exceção existe apenas quando `game.test === true` e não altera `GAME_MODE_CONFIG.minPlayers`.

## v0.97.0 — configuração de rede por ambiente

A configuração PeerJS e ICE deixou de conter credenciais TURN públicas no bundle. Em desenvolvimento, o jogo usa apenas STUN como fallback. Produção e previews podem definir signaling próprio e servidores STUN/TURN através das variáveis documentadas em `.env.example`. A configuração é validada antes da criação do peer e o resumo de diagnóstico nunca inclui credenciais.

### Persistência local (v0.96)
O anfitrião mantém agora um índice local de reinos, ordenado pela última gravação. Saves antigos são importados automaticamente e cada código passa a ter uma chave própria, permitindo recuperação seletiva sem perder outras partidas locais.


## v0.97.3 — entrada livre no salão

O livro inicial pode ser fechado para explorar o salão e reaberto sem abandonar o fluxo de entrada.

## v0.97.6 — fluxo livro → seleção de personagem

- Ao escolher um modo, o reino e o lugar do anfitrião são instalados imediatamente antes de aguardar pelo PeerJS.
- Um reino com lugar local válido deixa de poder ficar escondido por páginas antigas do fluxo de entrada.
- Depois de fundar o reino, a UI entra obrigatoriamente na seleção de personagem e a galeria fica interativa.
- `Voltar` já não pode deixar um reino ativo preso atrás do livro inicial; para regressar ao início é necessário sair/desfazer o reino pelo lobby.

## v0.97.4 — criação de reino desacoplada da rede

Fundar um reino instala imediatamente o lobby local e leva o anfitrião para a seleção de personagem. O handshake PeerJS decorre em paralelo; atrasos ou falhas de signaling deixam de bloquear a escolha de casa ou devolver automaticamente o utilizador à página de modos.

## v0.97.6 — confirmação de casa regressa ao salão

- A assinatura do contrato aguarda agora a confirmação autoritativa da ação de escolha antes de abandonar a parede.
- Depois da ação aceite, o fluxo muda explicitamente para o lobby e a câmara regressa à vista normal.
- `Escape` pode sair da vista de seleção quando a casa já está confirmada.
- A autoridade local do anfitrião deixa de depender do signaling PeerJS estar aberto, evitando escolhas perdidas durante o arranque da rede.
- O arranque do host preserva um estado local mais recente em vez de reinstalar um snapshot anterior sem a casa já escolhida.
