# Lobby 3D v80 — três famílias de molduras

## Alterações
- molduras reduzidas e mais finas, com maior área útil para o retrato;
- três linguagens coerentes: real (Maria e Protheus), gótica (Vlad, Muriel e Bones) e rústica (Romeo, Makuru e Artheria);
- brasão/gema integrado no topo de cada moldura;
- placas de nome embutidas e com acabamento metálico;
- seleção local indicada apenas por brilho discreto no friso interior;
- casas ocupadas/indisponíveis cobertas por tecido envelhecido com relevo e símbolo;
- hover mais contido, evitando o efeito de cartão a saltar da parede;
- iluminação da galeria mantida como iluminação ambiental, sem velas usadas como estado de seleção.

## Implementação
A alteração está concentrada em `src/ui/lobby/lobbySceneGallery.js` e preserva a API utilizada pelo controlador do lobby (`portraitTargets`, `washLights` e `frames`).
