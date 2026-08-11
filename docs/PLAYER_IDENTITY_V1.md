# Identidade estável de jogador — Parte 2

Esta alteração separa a identidade do jogador da personagem escolhida e do índice atual no array `players`.

## Campos no estado canónico

Cada jogador contém agora:

- `playerId`: identidade estável dentro da partida;
- `seatId`: identidade estável do lugar;
- `sessionTokenHash`: SHA-256 do token secreto, nunca o token em claro.

As regras antigas continuam temporariamente a usar índices. O componente recalcula o índice local através de `playerId` e confirma também o `seatId`.

## Token local

O token de 256 bits é criado com Web Crypto e guardado apenas no navegador do respetivo jogador, em `localStorage`. O estado partilhado e o save do jogo guardam somente o hash SHA-256.

## Entrada no lobby

O convidado já não adiciona diretamente um jogador ao snapshot. Envia `claim-seat`; o host valida a fase, lotação, personagem e hash, cria `playerId`/`seatId`, associa a ligação ao jogador e confirma o pedido.

## Reconexão

Ao voltar a entrar no mesmo código, o navegador envia `session-auth` com `playerId` e o token. O host calcula o hash e só associa a ligação ao jogador quando corresponde ao hash guardado. Uma sessão já ligada noutro navegador é rejeitada.

O antigo ecrã “Quem és tu?” foi removido. Uma partida iniciada só pode ser retomada com o token original.

## Proteção transitória de snapshots

A autoridade completa por ações será implementada na parte seguinte. Até lá, snapshots de clientes ainda existem para as regras antigas, mas o host agora:

- rejeita snapshots de ligações não autenticadas;
- rejeita alterações ao número ou ordem de jogadores;
- preserva `playerId`, `seatId` e `sessionTokenHash` do estado canónico;
- volta a enviar o estado oficial quando rejeita um snapshot;
- atribui chat e emotes ao jogador associado à ligação, ignorando o índice anunciado pelo cliente;
- guarda `playerId` nas mensagens de chat para a autoria não mudar quando índices do lobby se deslocam;
- ignora callbacks de tentativas de ligação antigas depois de sair ou iniciar outra tentativa.

## Compatibilidade de saves antigos

Ao retomar um save anterior, são criados IDs para os jogadores existentes e um novo token para o anfitrião. Num save ainda em lobby, lugares antigos sem token são libertados automaticamente para não ficarem bloqueados. Numa partida já iniciada, os antigos convidados não possuem tokens válidos e, por segurança, não podem reclamar manualmente esses lugares.
