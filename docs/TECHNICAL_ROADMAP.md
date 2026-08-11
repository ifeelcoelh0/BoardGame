# Roadmap técnico — Reinos do Dragão

## Objetivo atual

Substituir o fluxo legado de páginas por uma experiência contínua no lobby 3D, sem alterar o núcleo autoritativo das regras da partida.

## Princípio arquitetural

Três estados independentes devem permanecer separados:

- **Fluxo visual:** livro, ligação, parede de personagens, lobby geral, início e jogo.
- **Sessão de rede:** sem sessão, host, ligação, autenticação, reconexão, expulsão e erro.
- **Estado canónico:** lobby, preparação, partida e fim da partida.

Uma transição visual nunca deve, por si só, criar ou alterar o estado canónico.

## Marco 0 — Baseline estável

- [x] Uniformizar a versão como `0.85.0`.
- [x] Atualizar o manifesto SHA-256.
- [x] Adicionar CI para `npm ci` e `npm run check`.
- [ ] Confirmar uma instalação limpa e a build no GitHub Actions.
- [ ] Criar uma tag Git `v0.85.0-baseline` após o CI passar.

## Marco 1 — Controlador do fluxo

Criar um reducer independente de React visual com etapas explícitas:

```text
book-home
book-create-mode
book-join-code
connecting
character-wall
lobby
starting
game
error
```

Resultados esperados:

- eliminar decisões de navegação dispersas;
- tornar transições testáveis;
- distinguir erro recuperável de erro fatal;
- preservar o fluxo atual enquanto a migração decorre.

## Marco 2 — Lobby permanente

- montar o lobby logo no arranque;
- manter a cena Three.js viva entre etapas;
- iniciar a câmara no livro;
- criar uma API declarativa de vistas da câmara;
- apresentar os formulários do livro em React/DOM sobre a cena.

## Marco 3 — Livro funcional

Páginas iniciais:

- criar reino;
- entrar com código;
- retomar reino, quando existir sessão válida;
- escolha de modo durante a criação;
- detalhes da sala e gestão de jogadores para o host.

## Marco 4 — Parede de personagens

- reservar primeiro um lugar de rede;
- permitir temporariamente `characterId: null`;
- confirmar a personagem por ação autoritativa;
- impedir escolhas simultâneas da mesma personagem;
- regressar à vista geral após confirmação.

## Marco 5 — Resiliência

- recuperação explícita do host;
- período de reconexão dos convidados;
- identificação da build no protocolo;
- mensagens claras para versões incompatíveis;
- testes entre browsers e redes distintas;
- estratégia TURN controlada antes de matchmaking público.

## Regra de desenvolvimento

A camada `src/legacy/` foi eliminada em v0.99.20. Novas funcionalidades devem respeitar as fronteiras atuais: domínio em `src/game/`, transporte/controllers em `src/multiplayer/`, composição/sessão em `src/app/`, apresentação semântica em `src/presentation/` e interface em `src/ui/`.

## Concluído em v0.86.0

- Estado de navegação extraído para `src/ui/appFlow.js`.
- Etapas legadas centralizadas em `APP_STAGE`.
- Transições controladas por reducer, com histórico e revisão.
- Comportamento visual e protocolo existentes preservados.
- Testes específicos adicionados ao comando principal de testes.

## Concluído em v0.98.0 — consolidação do lobby

- [x] `LobbyScene` montada uma única vez através de `LobbyExperience`.
- [x] Removido `LobbyEntryShell` e a segunda montagem da cena.
- [x] Páginas do livro separadas de `APP_STAGE` através de `BOOK_PAGE`.
- [x] Removidos `swapUi` e `showEntryFlow`.
- [x] Seleção de personagem representada por intenção explícita: `initial` ou `change`.
- [x] View-model do lobby extraído para `lobbyViewModel.js`.
- [x] Criação local do reino separada do arranque do transporte PeerJS.
- [x] Removido o fallback de reconciliação `g = currentLocal`.
- [x] Testes puros adicionados para páginas do livro e estado derivado do lobby.

### Próximos bloqueios obrigatórios

1. Validar manualmente o percurso `fundar → modo → personagem → assinatura → lobby` numa build real.
2. Corrigir/reativar o Playwright E2E para validar transições visuais no browser.
3. Consolidar `STARTING_GAME` antes de trabalhar no livro visual final.
4. Testar multiplayer em redes distintas e configurar TURN antes de distribuição pública.


## Concluído em v0.99.20 — remoção do legacy

- [x] `src/legacy/ReinosDoDragao.jsx` removido.
- [x] `src/main.jsx` carrega `src/app/App.jsx`.
- [x] composição visual separada da sessão em `useRealmSession.js`, sem JSX.
- [x] CSS ativo renomeado para `src/styles/app.css`.
- [x] fonte v52 e scripts de recuperação retirados da árvore de trabalho.
- [x] verificação de runtime atualizada para proibir o regresso da camada legacy.


## Concluído em v0.99.21 — fundação de performance 3D

- [x] loop RAF comum com pausa real em páginas ocultas;
- [x] lobby com cadência adaptada a movimento/idle sem reduzir resolução;
- [x] shadow maps do lobby desacoplados da frequência de render;
- [x] partilha de texturas procedurais idênticas dentro da cena;
- [x] instancing do rebordo repetido do tapete;
- [x] métricas opt-in de renderer/loop para profiling no hardware real.

Próxima decisão de performance deve ser guiada por `?perf=1` + DevTools. Só avançar para pixel ratio adaptativo, pré-render de texturas ou lazy construction se os números mostrarem necessidade.
