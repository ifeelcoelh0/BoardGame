# Reinos do Dragão — TURN dinâmico (v0.99.32)

Esta versão obtém credenciais TURN temporárias através de uma Vercel Function.
O segredo mestre nunca é enviado para o browser.

## Arquitetura

Browser -> GET /api/turn-credentials -> Vercel Function -> Cloudflare Realtime TURN

A função devolve apenas `iceServers` temporários. O PeerJS usa esses servidores
para WebRTC; P2P direto continua a ser preferido, e TURN funciona como fallback.

## Variáveis Vercel

Configurar em **Project > Settings > Environment Variables** para Preview e Production:

- `CLOUDFLARE_TURN_KEY_ID` = ID da TURN key
- `CLOUDFLARE_TURN_API_TOKEN` = token secreto associado à TURN key
- `TURN_CREDENTIAL_TTL_SECONDS` = `86400`
- `VITE_TURN_CREDENTIALS_ENDPOINT` = `/api/turn-credentials`
- `VITE_REQUIRE_TURN` = `true`

Opcional, apenas num Preview para provar que o relay funciona:

- `VITE_FORCE_TURN_RELAY` = `true`

Depois do teste, remover/desativar `VITE_FORCE_TURN_RELAY`; em produção normal o
jogo deve preferir ligação P2P direta e usar TURN apenas quando necessário.

## Teste rápido

1. Fazer deploy do branch na Vercel.
2. Abrir `https://SEU-PREVIEW.vercel.app/api/turn-credentials`.
3. Deve aparecer JSON com `iceServers`, incluindo pelo menos um URL `turn:` ou `turns:`.
4. Criar um reino num dispositivo/rede e entrar noutro dispositivo noutra rede.
5. Para um teste forte, ativar `VITE_FORCE_TURN_RELAY=true`, redeploy e repetir.
6. Depois remover `VITE_FORCE_TURN_RELAY` e fazer novo deploy.

## Segurança

Nunca criar `VITE_CLOUDFLARE_TURN_API_TOKEN` nem colocar o token no GitHub.
Variáveis com prefixo `VITE_` são compiladas para o frontend e não são secrets.
O token Cloudflare deve existir apenas como `CLOUDFLARE_TURN_API_TOKEN` na Vercel.

O endpoint público pode gerar credenciais temporárias para jogadores legítimos.
Se o jogo ganhar utilização pública relevante, acrescentar rate limiting/abuse
protection ao endpoint e acompanhar o consumo do serviço TURN.
