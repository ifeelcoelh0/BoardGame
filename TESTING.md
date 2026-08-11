# v0.99.31 — testes Settings + Playtest Polish

## Automatizado
- Suite Node final: 467 testes.
- Settings: normalização, limites, storage inválido, persistência e perfis gráficos.
- Rematch: opt-in autoritativo, todos os ligados, jogador desligado, envio do cliente em endgame e rejeição fora do endgame.
- Scoring: vitória normal e por limite de rondas limpam `ready` sem mutar o estado anterior.
- Runtime architecture transpila Settings, rich text e rematch juntamente com as fronteiras existentes.

## Manual recomendado antes do primeiro playtest
1. Alterar Música/Efeitos/Vozes independentemente e recarregar a página; os valores devem persistir.
2. Alternar High/Medium/Low e confirmar via `?perf=1` que o perfil aplicado muda sem alterar regras/peças.
3. Testar Movimento reduzido, escala 85–120% e fullscreen manual/automático ao usar Pronto/Iniciar.
4. Confirmar badges de Conversa/Crónicas, label Grimório e Economy Strip em diferentes larguras.
5. Jogar um 7 e confirmar que som + banner do Dragão surgem sincronizados.
6. Testar Estrada Mais Longa/Maior Exército e cartas laterais com o sprite/arte maiores.
7. Terminar uma partida em dois browsers: um jogador pode optar por rematch sem mudar o outro; o lobby só reabre quando todos os ligados escolherem Jogar outra vez.

## Limitação deste ambiente
`verify:static` chega a `check-book-leaves.mjs`, mas não consegue importar `three` sem `node_modules`. Todos os verificadores posteriores foram executados manualmente. A build Vite também continua indisponível (`vite: not found`).

---

# v0.99.30 — testes Game UI Composition Pass

## Automatizado
- Suite completa Node: composição Action/Economy/Utility/Player, arquitetura, domínio e multiplayer.
- `stableBoardGeometryKey` prova que builds/revisões/reordenação não recriam a cena, mas uma mudança real do terreno sim.
- Board3D preserva o estado local da câmara através de recriações legítimas.
- Seleção inicial de personagem regressa ao salão ao confirmar; troca deliberada de Casa mantém o fluxo explícito.
- Fronteiras de produção proíbem `PixelAvatar`, `PixelPortrait`, `GameSocialPanel` e emojis de plataforma nas superfícies principais.
- UI Lab e novas superfícies passam no transpile JSX; runtime architecture passa no CheckJS semântico.

## Manual recomendado
1. Fazer zoom/rotação no tabuleiro, construir Estrada/Aldeia/Palácio e confirmar que a câmara não salta para a posição inicial.
2. Entrar por código, escolher/assinar uma personagem e confirmar regresso automático à vista default do salão.
3. Verificar Utility Rail recolhida/expandida com rato, teclado e touch; Mapa/Recursos não devem existir como botões.
4. Confirmar Roll compacto, Economy Strip legível e custos por hover/foco; durante placement o painel deve recolher para expor o mapa.
5. Passar o rato por um player banner: todos expandem; clicar num abre o detalhe rico.
6. Testar dados normais, 7/Dragão, Carta de Desenvolvimento, portos e Endgame para confirmar sprites/ícones atuais e ausência de emojis antigos.
7. Repetir em `?perf=1&gfx=high|medium|low` para garantir que a composição nova não alterou os perfis gráficos.

## Limitação deste ambiente
`verify:static` chega a `check-book-leaves.mjs`, mas não pode importar `three` porque `node_modules` não está instalado. A build Vite também não pode ser executada aqui (`vite: not found`).
