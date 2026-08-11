# Lobby 3D v75 — integração dos bonecos 3D

## Objetivo
Trazer para a versão mais recente do lobby os bonecos 3D que estavam presos à versão antiga `v64-bonecos`, sem perder as melhorias posteriores da sala, iluminação, materiais e parede de seleção.

## Integração
- adicionado `src/ui/lobby/lobbyCharacters.js` da versão dos bonecos;
- substituído o sistema temporário de humanos low-poly do lobby pelo sistema de personagens sentados;
- cada lugar passa a receber o personagem correspondente à casa escolhida;
- cadeiras e personagens continuam a ser atualizados dinamicamente quando entram, saem ou trocam de casa;
- mantidas as animações subtis dos personagens;
- mantidas todas as alterações posteriores: lareira à direita, materiais, troféus, candelabros, retratos pixel art e molduras da parede esquerda.
