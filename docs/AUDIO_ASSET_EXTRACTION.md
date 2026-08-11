# Extração dos assets de áudio

Os Data URLs do objeto `SND` foram extraídos de `src/legacy/ReinosDoDragao.jsx` para `public/assets/audio/`.

## Resultado

- 67 ficheiros Ogg extraídos.
- As chaves e os arrays de `SND` foram preservados.
- O carregamento continua a usar `fetch()` e `AudioContext.decodeAudioData()`.
- Os caminhos usam `import.meta.env.BASE_URL`, pelo que respeitam a configuração `base` do Vite.
- `public/assets/audio/manifest.json` regista tamanho e SHA-256 de cada asset.

## Verificação

```bash
npm run verify
```

Além da validação JSX já existente, o comando confirma que:

- já não há Data URLs de áudio no código;
- todos os ficheiros do manifesto existem;
- os checksums continuam corretos;
- cada asset está referenciado no objeto `SND`.
