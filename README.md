# Reinos do Dragão

Jogo de tabuleiro multijogador para browser, inspirado em jogos de recolha de recursos e construção, com tabuleiro 3D, partidas de 3 a 4 jogadores e ligação peer-to-peer entre browsers, sem servidor de jogo dedicado.

**[▶ Jogar a demo](https://board-game-navy.vercel.app/)**


---

## Funcionalidades

- **Cinco modos de jogo:** Dragão (modo base, com desastres), Clássico, Rápido, Guerra e Exploração.
- **Multijogador em tempo real** via WebRTC (PeerJS): um jogador cria a sala e partilha o código, os outros entram pelo browser.
- **Bots** com perfis e estratégias próprias para preencher lugares vazios.
- **Tabuleiro e lobby em 3D** com Three.js, perfis gráficos High/Medium/Low.
- **Guardar e retomar partidas**, com recuperação de sessão após refresh ou perda de ligação.
- **Áudio, música e definições persistentes**, incluindo movimento reduzido e escala da interface.

## Arquitetura

O jogo usa um modelo **host-authoritative**: o browser de quem cria a sala é a única fonte de verdade sobre o estado da partida.

```
Cliente ──ação──▶ Host (valida + aplica reducer) ──vista filtrada──▶ todos os clientes
```

- **Regras puras em reducers** (`src/game/`): dados, construção, comércio, cartas de desenvolvimento, guerra, exploração, pontuação e ciclo de turnos. Cada ação é validada contra a lista de ações legais antes de ser aplicada.
- **Vistas de estado por jogador:** cada cliente recebe apenas a informação que pode ver (por exemplo, não vê as cartas dos outros).
- **Robustez de rede:** identidade de jogador persistente, deduplicação de ações, retries, journal de ações com verificação por replay e gestão de reconexões.
- **Saves versionados**, com schema validado e migrações.

## Segurança

- **Credenciais TURN temporárias:** o browser pede-as a uma Vercel Function (`api/turn-credentials.js`), que fala com o Cloudflare Realtime TURN. O segredo mestre nunca chega ao cliente nem ao repositório. Detalhes em [`TURN_SETUP.md`](TURN_SETUP.md).
- **Cabeçalhos de segurança** na Vercel: Content Security Policy restritiva, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` (ver [`vercel.json`](vercel.json)).
- **Validação no host:** os clientes não conseguem alterar o estado diretamente; ações inválidas ou repetidas são rejeitadas.

## Stack

| Área | Tecnologias |
|---|---|
| Frontend | React 18, Vite |
| 3D | Three.js |
| Multijogador | WebRTC, PeerJS, STUN/TURN (Cloudflare) |
| Backend | Vercel Functions |
| Testes | Node test runner, Cypress (E2E) |

## Correr localmente

Requer Node.js 18 ou superior.

```bash
git clone https://github.com/ifeelcoelh0/BoardGame.git
cd BoardGame
npm install
cp .env.example .env   # opcional: em local funciona só com STUN
npm run dev
```

Abre o endereço indicado pelo Vite em duas ou mais janelas do browser para testar uma partida multijogador.

## Testes

```bash
npm test          # testes unitários e de integração (Node)
npm run verify    # verificações estáticas de arquitetura + testes
npm run test:e2e  # testes end-to-end com Cypress
```

O projeto tem mais de 90 ficheiros de teste, que cobrem regras, protocolo multijogador, recuperação de sessões, saves e bots. Ver [`TESTING.md`](TESTING.md).

## Documentação

- [`CHANGELOG.md`](CHANGELOG.md): histórico de versões
- [`TURN_SETUP.md`](TURN_SETUP.md): configuração do TURN dinâmico
- [`docs/`](docs/): notas técnicas de arquitetura, multijogador e interface

## Autor

**Pedro Coelho** · [GitHub](https://github.com/ifeelcoelh0) · [LinkedIn](https://www.linkedin.com/in/pedro-coelho-6515923a4/)
