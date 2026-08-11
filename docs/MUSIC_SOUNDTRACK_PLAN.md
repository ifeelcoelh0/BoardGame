# Soundtrack — direção técnica

A `main-theme.m4a` é a identidade musical do salão/lobby e continuará a ser essa faixa.

Quando existirem as primeiras faixas de partida, a música deixa de ser um único `SND.music[0]` e passa para um catálogo semântico. O runtime deverá escolher faixas por contexto, não por nomes de ficheiro espalhados na UI.

Contextos previstos:

- `lobby` — `main-theme`;
- `game/default` — rotação geral da partida;
- `mode` — clássico, dragão, guerra, exploração, etc.;
- `timeOfDay` — dia/noite;
- `weather` — limpo, chuva, tempestade, neve, etc.;
- eventos especiais podem pedir uma transição, mas não devem interromper música por cada ação pequena.

Cada faixa poderá declarar tags, peso de seleção e regras simples de repetição. A prioridade futura será aproximadamente `evento especial > modo + clima/hora > playlist geral`.

A reprodução continuará por `HTMLAudioElement`/MediaElement streaming; música longa não deve passar por `decodeAudioData`. Crossfade e anti-repeat entram quando houver pelo menos duas faixas reais para testar.

A v0.99.28 não altera a reprodução musical atual para não criar silêncio ou uma playlist artificial antes de os novos temas existirem.
