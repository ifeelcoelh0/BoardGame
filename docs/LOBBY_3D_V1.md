# Lobby 3D v1

Primeira implementação funcional do salão de preparação de Reinos do Dragão.

## Incluído

- Cena Three.js real dentro do lobby.
- Sala escura com pedra, madeira, lareira, velas e luz oscilante.
- Mesa redonda com quatro lugares.
- Cadeiras vazias e humanos low-poly para lugares ocupados.
- Duas silhuetas masculinas e duas femininas.
- Jogador local colocado visualmente no lugar inferior.
- Cartão da casa selecionada com personagem pixel art.
- Detalhes do modo e lista de jogadores.
- Chat da mesa.
- Estado `ready` sincronizado entre clientes.
- Início bloqueado até existirem pelo menos dois jogadores e todos estarem prontos.
- Troca de casa integrada.
- Compatibilidade com o controlo de perks do modo Guerra.

## Ainda provisório

- Os humanos são construídos com primitivas low-poly; futuramente receberão os
  avatares persistentes do hub.
- A transição 2D → lobby e lobby → tabuleiro ainda não foi criada.
- Materiais, modelos da sala e animações podem ser refinados depois da validação
  in-game.
