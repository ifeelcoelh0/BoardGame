# v0.99.31 — revisão

- Settings têm store/persistência próprios; não voltam ao reducer transitório do `GameScreen`.
- Perfis gráficos continuam canónicos em `graphicsQualityProfiles.js`; a UI apenas escolhe o perfil.
- Volumes Música/Efeitos/Vozes são canais reais do mixer, não multiplicadores espalhados pelos componentes.
- Fullscreen é pedido apenas a partir de gesto do utilizador e falha de forma segura.
- `REMATCH_READY` é ação autoritativa, protocol version 7; nenhum cliente pode reabrir o lobby localmente.
- O fim da partida limpa `ready` antes da votação para não herdar prontidão do lobby anterior.
- Rich text semântico reutiliza os ícones canónicos sem introduzir decisões visuais no domínio `game/`.
- O Dragão deixa de ter atraso visual artificial em relação ao cue de áudio.

---

# v0.99.30 — revisão

- Nenhuma regra, save ou protocolo foi alterado; a ronda é de composição/presentação e lifecycle local da câmara.
- Progressive disclosure é modelado por componentes/estados explícitos, não por offsets e `:hover` dispersos no `GameScreen`.
- O Board3D só pode recriar a cena quando muda geometria real ou perfil gráfico; a câmara é estado local persistente.
- A ida automática da parede para o salão distingue seleção inicial de uma troca deliberada de Casa.
- Mapa e Recursos deixaram de ser utilitários; não existem aliases de compatibilidade para o dock antigo.
- Retratos antigos e Social antigo são proibidos por teste arquitetural; as superfícies primárias também rejeitam emojis de plataforma.
- Fullscreen e preferências persistentes ficam deliberadamente para a próxima patch de Definições, onde terão uma única fonte de verdade.
