# Plano de migração e refactor

## Fase 0 — concluída neste pacote

- Congelar a v52 original.
- Criar projeto React/Vite.
- Converter `React.createElement` para JSX.
- Separar o CSS.
- Fixar as versões atuais das dependências do jogo.
- Não introduzir alterações visuais ou de regras.

## Fase 1 — equivalência funcional

Testar lado a lado o HTML original e o projeto-fonte:

- criação e entrada numa partida por código;
- seleção de personagem;
- colocação inicial;
- dados, produção, construção e trocas;
- cartas e desastres;
- pausa, áudio, chat e reações;
- gravação/retoma, caso aplicável;
- Dragão, Clássico, Cerco Relâmpago, Guerra dos Reinos e Terras do Além;
- dois separadores e, idealmente, dois dispositivos.

Cada diferença deve ser registada antes de qualquer redesign.

## Fase 2 — fronteiras técnicas

Extrair por esta ordem, uma zona de cada vez:

1. dados estáticos (`RES`, `CHARS`, `COSTS`, cartas, perks e tropas);
2. utilitários puros;
3. geração e regras do tabuleiro;
4. estado e ações da partida;
5. sincronização PeerJS;
6. renderer Three.js;
7. áudio;
8. componentes de GUI.

Depois de cada extração, repetir a lista de equivalência.

## Fase 3 — sistema de interface

Criar os componentes-base sem reduzir a identidade dos banners:

- `GameIcon`;
- `Button`;
- `Panel`;
- `Modal`;
- `Toast`;
- `Tooltip`;
- `PlayerBanner`;
- `ResourceTray`;
- `TurnStatus`;
- `ActionPanel`;
- `CardHand`;
- `SocialPanel`.

Os banners dos jogadores devem manter retrato, casa, nome, pontos e estado. O trabalho será de hierarquia e consistência, não de os transformar em linhas genéricas.

## Fase 4 — redesign

Aplicar o novo sistema primeiro a uma única situação de referência: quatro jogadores, Modo Dragão, turno normal depois dos dados. Só depois propagar para menus, lobby, trocas, cartas e restantes modos.
