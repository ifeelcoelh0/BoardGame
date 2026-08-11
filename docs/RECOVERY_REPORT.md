# Relatório de recuperação da v52

> **Nota histórica:** este relatório descreve o estado imediatamente após a recuperação da v52. O ficheiro original, `src/legacy/` e `src/styles/legacy.css` foram removidos da árvore de trabalho em v0.99.20; permanecem recuperáveis pelo histórico Git.

## Origem

- Ficheiro preservado: `legacy/reinos-do-dragao-v52-original.html`
- SHA-256: `b77f70fe66ee5148045513c84ac77fe5edf3a231b644492bcd5cc719ac4b6164`

## Resultado mecânico

- 736 chamadas `React.createElement(...)` encontradas no HTML original.
- 0 chamadas `React.createElement(...)` restantes na fonte JSX.
- 748 anotações `/* @__PURE__ */` removidas.
- CSS embutido extraído para `src/styles/legacy.css`.
- 162 funções nomeadas preservadas: nenhuma em falta.
- As únicas constantes de topo removidas foram `CSS` e `__rootEl`, substituídas respetivamente pela importação da folha de estilos e por `src/main.jsx`.
- PeerJS e Three.js deixaram de depender de `window.Peer` e `window.THREE`.
- A fonte JSX passa pela transformação sintática do TypeScript sem erros.
- Uma nova transformação de JSX para JavaScript recria 734 elementos React; a diferença corresponde ao elemento `<style>` removido e ao arranque separado.

## O que ainda não foi feito

- Não houve refactor de regras ou estado.
- Não houve redesign da GUI.
- Os dados, áudios e componentes continuam juntos em `src/legacy/ReinosDoDragao.jsx`.
- Não foram atualizadas dependências.
- É necessária validação manual em navegador, incluindo multiplayer em dois clientes.

## Nota sobre o teste neste ambiente

A instalação das dependências não pôde ser concluída neste ambiente porque o registo npm interno disponível aqui não contém os pacotes Vite. Isto não é um erro detetado no projeto; a verificação realizada foi sintática e estrutural. Num computador com acesso ao registo npm normal, executar `npm install`, `npm run dev` e a checklist de equivalência.
