# Arte das Cartas de Desenvolvimento

Fonte canónica para o estado da arte visual das cartas. Os nomes originais de geração (`pixellab-*`) não são usados em runtime; os ficheiros em `public/assets/cards/development/` têm nomes de domínio estáveis e são resolvidos por `src/assets/developmentCardArt.js`.

## Tropas por personagem

| Personagem | Cavaleiro | Arqueiro | Catapulta |
|---|---|---|---|
| Vlad | pronta | pronta | pronta |
| Maria | pronta | pronta | pronta |
| Protheus | pronta | pronta | pronta |
| Romeo | pronta | pronta | pronta |
| Makuru | pronta | pronta | pronta — mini tanque goblin artesanal |
| Artheria | pronta | pronta | pronta |
| Muriel | pronta | pronta | pronta |
| Bones | pronta | pronta | pronta |

As cartas de tropa não guardam a personagem no baralho. A UI resolve a ilustração a partir de `(card.sub, owner.characterId)`, mantendo regras, saves e protocolo independentes da arte.

## Cartas genéricas

- PV — Inteligência: pronta
- PV — Conhecimento: pronta
- PV — Fé: pronta
- PV — Sorte: pronta
- PV — Astúcia: pronta
- Monopólio: pronta
- Descoberta / Trabalhadores: pronta
- Construtor de Estradas: pronta
- Marcha Forçada: **arte em falta**
- Espião: **arte em falta**

`DEVELOPMENT_CARD_MISSING_ART` é a checklist executável das artes ainda pendentes. Os testes exigem que Marcha Forçada e Espião sejam atualmente as únicas lacunas declaradas.

## Eventos grandes disponíveis

As artes de eventos ficam separadas em `public/assets/events/`, atualmente a 148×148:

- Dragão / resultado 7
- Ganância
- Peste Negra
- Tsunami
- Tributo Real
- Maior Exército
- Estrada Mais Longa

Estas imagens já têm manifesto próprio (`src/assets/gameEventArt.js`), mas a integração no novo sistema de banners pertence à fase visual seguinte.
