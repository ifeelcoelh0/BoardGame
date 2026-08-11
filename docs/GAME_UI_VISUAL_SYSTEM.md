# Sistema visual in-game — contrato v1

Este documento fixa a linguagem visual partilhada pelo lobby e pela interface da partida. Não define a arte final de cartas, log, banners ou HUD; define as regras às quais esses componentes terão de obedecer.

## 1. Princípio

A interface deve parecer construída dentro do mesmo mundo físico do lobby, sem transformar cada controlo num objeto decorativo pesado.

A linguagem divide-se em três famílias:

- **Pergaminho + tinta** — narrativa, regras, cartas, histórico, decisões e conteúdo que merece leitura.
- **Madeira escura + bronze** — estrutura persistente: HUD, barras, botões e molduras que vivem sobre o tabuleiro.
- **Cor da casa** — identifica jogador, propriedade, turno e autoria. Não substitui a paleta global da interface.

## 2. Tipografia

| Papel | Família | Uso |
|---|---|---|
| Display | IM Fell English SC | títulos de painéis, capítulos, nomes de sistemas |
| Label | Cinzel | botões, labels compactas, pequenos cabeçalhos, estados |
| Body | Crimson Pro | log, descrições, regras e texto denso |
| Hand | Fondamento / Cormorant Garamond | notas manuscritas e pequenos trechos diegéticos |
| Signature | Mrs Saint Delafield | assinatura/lock e confirmações pessoais |
| Blackletter | UnifrakturCook | momentos cerimoniais raros |
| Technical | VT323 | códigos de reino e diagnóstico apenas |

VT323 deixa de ser uma fonte estrutural da interface da partida. Texto longo nunca usa lettering decorativo.

## 3. Materiais

Os componentes concretos escolhem um material do sistema antes de criarem uma moldura nova:

- `parchment`: conteúdo de consulta ou narrativa;
- `parchment-raised`: pergaminho que precisa de flutuar/ganhar foco;
- `oak`: estrutura persistente do HUD;
- `bronze`: acento estrutural/ação, usado em áreas pequenas;
- `inset`: contadores, recursos e dados compactos dentro de outra superfície;
- `veil`: camada escura transitória sobre o tabuleiro.

Pergaminho não deve ser usado como fundo universal. Um HUD inteiro em pergaminho aumenta ruído e perde contraste com cartas, livros e eventos.

## 4. Hierarquia de atenção

1. **Ambient** — informação persistente; quase sem movimento.
2. **Interactive** — uma decisão ou controlo ativo pede atenção.
3. **Important** — o estado da partida mudou; pode interromper brevemente.
4. **Ceremonial** — vitória, grande prémio ou momento raro; pode usar selo, lettering especial e animação mais rica.

Esta escala deve ser usada por log, banners e HUD para que elementos diferentes não disputem sempre o mesmo nível de atenção.

## 5. Movimento

- press: 90 ms;
- fast: 160 ms;
- standard: 240 ms;
- reveal: 420 ms;
- ceremonial: 640 ms.

A animação deve comunicar causa, estado ou importância. `prefers-reduced-motion` reduz timings estruturais para valores praticamente instantâneos.

## 6. Primitives

Os primitives vivem em `src/ui/system/`:

- `GameSurface` — materiais e nível de ênfase;
- `GameButton` — ações principal/secundária/quiet/danger;
- `GameIconButton` — controlos compactos do HUD;
- `GameHeading` — hierarquia de títulos.

São infraestrutura visual. Não devem conhecer regras de jogo, personagens ou estados multiplayer.

## 7. Fonte de verdade

- `src/ui/theme/gameVisualLanguage.js` — contrato JS partilhado com canvas/ferramentas;
- `src/styles/game-ui-system.css` — tokens CSS e primitives;
- `src/ui/lab/UILab.jsx` — style guide DEV que demonstra o contrato;
- `src/ui/lobby/lobbyQuillInk.js` — consome os mesmos papéis tipográficos e cores de tinta.

## 8. Próximas aplicações

A implementação de componentes concretos deve seguir esta ordem:

1. cartas de desenvolvimento;
2. log de acontecimentos;
3. banners de acontecimentos importantes;
4. shell do HUD e controlos utilitários;
5. modais/consultas restantes.

Os banners de jogador existentes ficam fora deste primeiro redesenho porque já cumprem suficientemente bem a função e podem ser revistos depois sem bloquear o sistema.
