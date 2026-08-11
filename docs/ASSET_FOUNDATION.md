# Fundação de assets — v52 source

Esta etapa organiza os assets recebidos sem alterar a interface normal do jogo.

## Abrir a galeria

Com o servidor Vite já a correr:

- jogo normal: `http://localhost:5173/`
- galeria: `http://localhost:5173/?dev=assets`

Também pode ser iniciada diretamente com:

```bash
npm run dev:assets
```

## Conteúdo integrado

- 496 ícones PNG transparentes, todos com 34 × 34 px;
- 8 personagens;
- 8 direções por personagem;
- manifesto JSON em `public/assets/assets-manifest.json`;
- manifestos JavaScript em `src/assets/`;
- componentes reutilizáveis `GameIcon` e `CharacterSprite`.

## Componentes

```jsx
<GameIcon name="I_BronzeCoin" size={24} />
<CharacterSprite character="makuru" direction="south" size={96} />
```

## Limite desta etapa

Nenhum asset foi aplicado ao jogo principal. Os banners, molduras, fundos, recortes,
sombras e escalas finais devem ser definidos depois de existir uma direção visual
aprovada. Esta separação evita adaptar a interface a arte provisória ou misturar
vários estilos sem uma regra comum.
