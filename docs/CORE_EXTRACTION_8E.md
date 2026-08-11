# Parte 8E — Cartas de desenvolvimento

Esta fase moveu a compra, maturação e aplicação das cartas para `src/game/developmentCardReducer.js`.

## Fronteira de domínio

O reducer recebe o estado canónico, o índice autenticado do jogador e as escolhas completas da carta. Devolve:

- um novo estado sem alterar o original;
- um evento semântico para logs e animações;
- um resultado privado opcional, usado apenas pelo Espião.

A UI continua responsável por abrir seletores de recursos/alvos e por apresentar `cardEv`, falas e efeitos visuais.

## Regras abrangidas

- custo e compra para `devNew`;
- passagem de `devNew` para `devOld` no fim do turno;
- cartas de tropa nos modos clássico e Guerra;
- Trindade das Armas e Maior Exército;
- Construtor de Estradas;
- Marcha Forçada;
- Monopólio;
- Trabalhadores;
- Espião e respetivo relatório privado;
- rejeição de cartas de Ponto de Vitória como ação jogável.

## Próxima fronteira

Trocas entre jogadores e banco ainda têm mutadores no componente legacy. A próxima extração deve criar reducers para proposta, aceitação, recusa, cancelamento e atualização das estatísticas de comércio.
