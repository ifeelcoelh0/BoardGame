# v0.99.37 — Core Modes Hardening

Esta passagem congela **Clássico**, **Cerco Relâmpago** e **Modo Dragão** como a base estável do projeto antes de aprofundar Guerra dos Reinos e Terras do Além.

## O que fica coberto automaticamente

- criação do reino pelo Book v2;
- escolha de personagem através do contrato semântico da galeria;
- adição de bots no lobby e prontidão;
- início real dos três modos-base no Cypress;
- 3 e 4 jogadores no núcleo de jogo;
- setup completo;
- primeiro lançamento e fim de turno;
- save/resume em lobby e durante a partida;
- preservação de ordem, turno, construções e estradas após resume;
- vistas privadas novamente censuradas depois de carregar o save;
- Cerco Relâmpago inicia com palácios, Clássico/Dragão com aldeias;
- criação da sessão local e código de reino no browser;
- fluxos multi-humano continuam cobertos no núcleo/integracão e na matriz manual, porque o Cypress controla um browser de cada vez;
- arranque com humano + dois bots nos três modos.

## Testes locais

Validação curta desta camada:

```bash
npm run test:core
```

Browser real com Cypress (dois terminais):

Terminal 1:

```bash
npm run e2e:serve
```

Terminal 2:

```bash
npm run test:e2e
```

Para investigar visualmente com o runner interativo:

```bash
npm run test:e2e:open
```

A validação normal do projeto continua a ser:

```bash
npm run checksums:update
npm run check
```

## Matriz manual antes do merge

Não é necessário terminar seis partidas completas. O objetivo é validar as fronteiras que um teste automático não consegue avaliar tão bem.

| Cenário | Clássico | Relâmpago | Dragão |
|---|---|---|---|
| 1 humano + 2 bots entra no tabuleiro | ☐ | ☐ | ☐ |
| 2 humanos + bot entram por código | ☐ | ☐ | ☐ |
| HUD / ações / custos legíveis | ☐ | ☐ | ☐ |
| refresh de um convidado recupera lugar | ☐ | ☐ | ☐ |
| convidado ausente pode ser assumido por bot | ☐ | ☐ | ☐ |
| humano regressa e recupera controlo | ☐ | ☐ | ☐ |
| save aparece nos Arquivos e retoma | ☐ | ☐ | ☐ |
| fim de turno não bloqueia a partida | ☐ | ☐ | ☐ |

### Verificações específicas

**Clássico**
- setup coloca aldeias, não palácios;
- não aparecem decisões/eventos exclusivos do Dragão.

**Cerco Relâmpago**
- setup coloca palácios;
- pontuação/ritmo reduzidos mantêm o mesmo lobby, multiplayer e HUD.

**Modo Dragão**
- 7 e movimento do Dragão continuam a obrigar a decisão correta;
- resultados 2 e 12 / Trindade continuam a ser medidos pelo benchmark, sem alterar as regras para favorecer o bot.

## Regra arquitetural desta versão

O hardening não cria um segundo caminho de jogo para testes. Cypress usa o mesmo lobby e o mesmo `GameScreen`; os testes de núcleo usam `gameActionReducer`, save schema e state views reais. Os únicos acrescentos de produção são atributos semânticos estáveis no `AppShell` do jogo para o browser poder confirmar modo e fase sem depender de coordenadas WebGL ou de CSS decorativo.
