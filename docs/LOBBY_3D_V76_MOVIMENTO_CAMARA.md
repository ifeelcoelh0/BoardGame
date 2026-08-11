# Lobby 3D V76 — Movimento de câmara

- O lobby abre focado na parede esquerda para confirmação/seleção da casa.
- Confirmar ou trocar a casa devolve a câmara à composição principal da mesa.
- O botão de troca percorre o mesmo trajeto em sentido inverso.
- Ao iniciar a partida, a câmara aproxima-se do centro da mesa por uma curva suave antes da passagem para o tabuleiro.
- As trajetórias usam curvas Bézier quadráticas e respeitam `prefers-reduced-motion`.
