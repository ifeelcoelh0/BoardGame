# Vistas de estado por jogador — v1

O host mantém o estado canónico completo em memória e no save local. Nenhuma ligação recebe esse objeto diretamente.

## Tipos de vista

- **Pública:** usada antes da autenticação. Não contém mãos, hashes de sessão, ordem do baralho ou conteúdo real de elementos sob nevoeiro.
- **Privada:** usada depois da autenticação. Acrescenta apenas os recursos e cartas do jogador associado à ligação.
- **Final:** quando `phase === "ended"`, revela cartas, recursos, baralho e mapa para as estatísticas finais. Os hashes de sessão continuam removidos.

## Campos públicos derivados

Cada jogador expõe:

- `resourceCount`: quantidade total de recursos, sem indicar os tipos;
- `developmentCardCount`: quantidade total de cartas de desenvolvimento;
- arrays de cartas `hidden` com o comprimento público necessário à interface.

O baralho é substituído por cartas `hidden`, preservando apenas `deck.length`/`deckCount`.

## Nevoeiro

Um hexágono com `hid: true` conserva apenas a chave e a topologia. O terreno é substituído por `deserto` e o número por `null` até ser revelado. Portos ocultos usam temporariamente o tipo genérico `any`.

## Transporte

Todas as mensagens que contenham `g` passam por `payloadForConnection`. O `playerId` é obtido exclusivamente de `net.current.auth`, nunca do payload enviado pelo cliente.

## Resultados privados

Efeitos que revelam informação temporariamente, como Espião, usam `privateResult` na resposta da ação. Esse resultado é enviado apenas à ligação que submeteu a ação e não entra no snapshot partilhado.

## Limite do modelo

O jogador que executa o host controla o processo que contém o estado canónico e pode inspecioná-lo. Impedir também o host de ver segredos exigiria um servidor independente ou um protocolo criptográfico distribuído.
