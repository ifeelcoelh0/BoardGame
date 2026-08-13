# Cypress E2E — v0.99.37

A camada E2E ativa usa Cypress 15.19.0. O objetivo é validar os fluxos de browser que mais protegem a base estável do jogo sem duplicar as regras do domínio.

## Primeira instalação após a migração

A migração remove Playwright e troca a dependência de desenvolvimento para Cypress. Depois de aplicar o patch:

```bat
del playwright.config.js
rmdir /s /q tests\e2e
del scripts\run-real-peerjs-e2e.mjs
npm install
```

`npm install` atualiza `package-lock.json`, remove `@playwright/test` e instala Cypress.

## Correr localmente no Windows

Terminal 1:

```bat
npm run e2e:serve
```

Terminal 2:

```bat
npm run test:e2e
```

O Cypress verifica o `baseUrl` antes de iniciar. Se o Vite não estiver disponível em `http://127.0.0.1:4173`, falha com uma mensagem explícita em vez de ficar à espera silenciosamente.

Para ver os testes a correr e inspecionar cada passo:

```bat
npm run test:e2e:open
```

## O que os E2E cobrem

- salão e abertura do Book;
- fundação de um reino;
- seleção de modo;
- escolha/assinatura de personagem através do contrato semântico da galeria;
- criação de código e sessão do jogador;
- adição de dois bots;
- prontidão e início da partida;
- entrada real no `GameScreen` em Clássico, Cerco Relâmpago e Dragão;
- presença dos três player banners e do dock inferior.

## Limite intencional

Cypress controla um browser de cada vez. Fluxos que exigem dois ou mais browsers humanos simultaneamente — entrada por código entre dois utilizadores, expulsão/reentrada e reconexão concorrente — continuam protegidos pelos testes de integração/controladores e pela matriz manual de hardening. Não foi introduzido um segundo runtime de multiplayer só para contornar esta limitação da ferramenta.
