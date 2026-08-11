# UI

A UI do jogo está organizada por responsabilidade, não por ecrã monolítico.

## Sistema visual

A linguagem visual canónica vive em:

- `theme/gameVisualLanguage.js` — papéis tipográficos, cores semânticas, materiais, níveis de ênfase, motion e z-index;
- `system/` — primitives React sem conhecimento das regras do jogo;
- `../styles/game-ui-system.css` — tokens CSS e implementação visual dos primitives;
- `lab/UILab.jsx` — style guide exclusivo de desenvolvimento (`?dev=ui`).

O lobby e a partida devem consumir esta linguagem comum. Um componente novo não deve criar uma paleta, tipografia ou família de botões própria se o sistema já representar essa necessidade. As Cartas de Desenvolvimento são a exceção deliberada de material: constituem um objeto medieval próprio, mas continuam a consumir os letterings, motion e contratos de interação canónicos.

## Componentes concretos

`game/`, `board/` e `lobby/` contêm componentes específicos dos respetivos contextos. `game/GameActionPanel.jsx` apresenta ações normais a partir de um modelo declarativo; `game/decisions/` apresenta escolhas modais a partir de `gameDecisionModel.js`, mantendo regras fora do React. `game/DevelopmentCard.jsx` e `game/DevelopmentCardListItem.jsx` são a primeira extração visual completa do antigo monólito. A extração do antigo monólito deve acontecer apenas quando a responsabilidade do componente estiver clara e puder depender das APIs de domínio/apresentação existentes, sem importar o `legacy`.

Ver `docs/GAME_UI_VISUAL_SYSTEM.md` para o contrato de direção visual.
