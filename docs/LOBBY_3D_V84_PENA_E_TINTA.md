# Lobby v84 — pena e tinta

Trabalho sobre a parede de seleção e o pergaminho de confirmação. O problema não
era de composição: era de **registo**. Tudo estava desenhado com `ctx.fillText`,
que produz tipografia perfeita — espaçamento constante, linha de base exata,
tinta idêntica em todos os glifos. Nenhuma dessas três coisas acontece quando
alguém escreve com uma pena, e é por isso que uma folha com textura de papel
continuava a ler como página web.

## Módulos novos

Os três são puros: recebem um contexto 2D e pintam. Não importam THREE nem tocam
em `document`, o que permite renderizá-los fora do browser para inspeção visual
durante o desenvolvimento.

| Módulo | Responsabilidade |
| --- | --- |
| `lobbyQuillInk.js` | Motor de lettering e acidentes de tinta |
| `lobbyPosterArt.js` | Pintura dos cartazes de captura e do carimbo de reclamado |
| `lobbyScrollArt.js` | Pintura da carta de seleção e da faixa de assinatura |

### `lobbyQuillInk.js`

- `handText` desenha **letra a letra**: jitter na linha de base, rotação por
  letra, variação de corpo (±5%), ciclo de tinteiro (a tinta esvai-se ao longo
  das letras e volta carregada depois do mergulho), sangramento nas fibras.
- `printText` faz o oposto: alinhamento regular, porque é uma máquina, mas
  entintagem irregular do bloco de madeira, com letras lavadas e fantasmas de
  segundo contacto.
- `handParagraph` quebra linhas com margem direita irregular. Um escrivão não
  justifica: cada linha acaba onde a palavra seguinte já não cabe à vista.
- Restantes: `dropCap`, `quillRule`, `ruleWithLozenge`, `roughFrame`, `inkBlot`,
  `flourish`, `foxing`, `crease`, `drypointGuides`, `mixHex`.

Todas as sementes derivam do texto (`hashSeed`), por isso o cartaz do Vlad
escreve-se sempre da mesma maneira entre sessões, mas diferente do da Maria.

## Cartazes

A ideia que os faz ler como objeto: **o cartaz é impresso mas preenchido à mão**.
O bloco imprime o que é comum a todos — `Wanted`, `by order of the crown`,
`dead or alive`, `reward`, `known throughout the realm`, o cerco com falhas de
impressão e os losangos dos cantos — e deixa pautas em branco. O escrivão da
guarda escreve depois o nome, o epíteto e a recompensa, tortos, em tinta mais
escura, a transbordar a pauta.

Acrescentado ainda: bordo cortado à faca com mordidas ocasionais (a versão
anterior ondulava tanto que lia como nuvem), buracos de prego com rasgo em L,
vincos de dobra, marca de copo, manchas de humidade, sujidade no bordo de baixo
e canto rasgado variável por cartaz.

Na cena: sombra de contacto na pedra, cantos de baixo a levantar muito mais (só
está pregado em cima), e restos de cartazes antigos com pregos soltos entre as
folhas.

O **pano com a caveira** que tapava um cartaz tomado foi substituído por um
carimbo `claimed` riscado a vermelho. Um cartaz cujo alvo já foi reclamado é
riscado, não coberto: continua a dizer *quem* está tomado em vez de esconder a
resposta debaixo do tecido.

### Coordenadas partilhadas

`POSTER_WINDOW` e `POSTER_NAILS` são exportados e consumidos pela galeria. A
moldura impressa do retrato e os buracos rasgados estão pintados na textura; se
os números divergissem, o retrato flutuava dentro do seu próprio cerco e cada
prego assentava ao lado do seu buraco.

## Carta de seleção

- Bloco de texto inteiro rodado meio grau. Mais lê-se como erro, menos não se lê.
- Hierarquia de manuscrito: rubrica vermelha nos títulos, tinta de galha no
  corpo, inicial grande a abrir a crónica (assente na linha de base da segunda
  linha, como as iniciais dos manuscritos).
- Títulos de secção em versaletes impressos. Blackletter ao corpo de 26px
  fechava demasiado e transformava "Chronicle" numa mancha.
- Retrato em moldura traçada à mão, com legenda escrita depois, mais pequena e
  mais torta que o resto.
- Datação na mão do escrivão, no lugar onde um documento real põe o lugar e a
  data.
- Pautas marcadas a seco sob a crónica.

## Assinar em vez de selar

O selo de cera era um cilindro com um toro e uma esfera por cima do papel. Por
muito bem iluminado que estivesse, lia-se como objeto pousado à frente do
documento — não como cera prensada nele. Foi removido.

O rodapé passou a ter uma **linha de assinatura**. Confirmar é assinar:

1. Clique na linha → a assinatura escreve-se da esquerda para a direita em
   cursiva, com poça de tinta na ponta da pena (1,05 s).
2. Remate num floreado.
3. Pausa de 0,16 s — é a pausa que faz o gesto ler como dois atos.
4. A cera cai e assenta com impacto (0,42 s).
5. Só então `onCharacterSelect` corre.

Confirmar no instante do clique fazia a animação acontecer depois de a decisão
já estar tomada, o que é o mesmo que não a ter. Durante a assinatura, cancelar,
`Escape` e cliques fora ficam inertes: a folha já está assinada.

A faixa vive num plano próprio com canvas de 760×280, redesenhado apenas durante
a animação. A cera é pintada nesse mesmo canvas, o que a mantém rente ao papel.
Redesenhar os 768×1024 do pergaminho a cada frame para escrever um nome seria
pagar a textura toda por 5% dela.

## Fontes

Acrescentadas ao `@import` de `src/styles/legacy.css`:

- **UnifrakturCook** — blackletter dos títulos impressos
- **Fondamento** — mão corrente do escrivão
- **Mrs Saint Delafield** — cursiva da assinatura

`IM Fell English SC` (já presente) passou a servir só o que é tipo móvel. Cada
painter repinta em `document.fonts.ready`: sem isso o primeiro cartaz sai em
Georgia e todo o efeito desaparece.

## Verificação

`npm run verify` limpo (292 testes) e `npm run build` sem erros. `SHA256SUMS.txt`
regenerado.

Não verificado em browser: a cena 3D não pôde ser renderizada neste ambiente. As
texturas foram todas inspecionadas visualmente fora do browser; as alterações de
geometria e iluminação (sombra de contacto, curvatura do papel, restos na parede)
ficam por confirmar no ecrã.
