/*
 * Linguagem visual canónica de Reinos do Dragão.
 *
 * Este módulo é deliberadamente independente de React, DOM e CSS. O canvas do
 * lobby, a UI React e ferramentas de render podem partilhar os mesmos nomes e
 * papéis tipográficos sem criar dependências entre camadas.
 */
export const GAME_VISUAL_LANGUAGE_VERSION = 2;

export const GAME_UI_FONTS = Object.freeze({
  /* Títulos cerimoniais, capítulos, nomes de sistemas e anúncios importantes. */
  display: "'IM Fell English SC', 'Palatino Linotype', Georgia, serif",
  /* Texto corrido, descrições, logs e informação densa. */
  body: "'Fondamento', Georgia, serif",
  /* Labels compactas, botões, pequenos cabeçalhos e estados. */
  label: "'Cinzel', Georgia, serif",
  /* Texto que deve parecer escrito à mão no mundo físico. */
  hand: "'Fondamento', Georgia, serif",
  /* Assinaturas e confirmações pessoais. */
  signature: "'Mrs Saint Delafield', 'Fondamento', cursive",
  /* Blackletter é reservada a momentos raros e títulos de forte peso. */
  blackletter: "'UnifrakturCook', 'IM Fell English SC', Georgia, serif",
  /* VT323 não é tipografia estrutural: fica reservada a códigos/diagnóstico. */
  technical: "'VT323', ui-monospace, monospace",
});


export const GAME_UI_COLORS = Object.freeze({
  ink: "#2e1f14",
  inkSoft: "#5c4629",
  inkFaded: "#7d684a",
  rubric: "#8e2c1b",
  rubricSoft: "#a3462c",
  paperLight: "#f4e6c5",
  paper: "#e7d2a7",
  paperShadow: "#bea173",
  paperEdge: "#8c6739",
  night: "#080504",
  oakDeep: "#120b07",
  oak: "#24170d",
  oakRaised: "#382417",
  bronzeDark: "#66431f",
  bronze: "#a27331",
  bronzeBright: "#d0a14f",
  gold: "#e0b23a",
  goldBright: "#f5d87a",
  ivory: "#f4e5c0",
  muted: "#b8a37d",
  danger: "#8e342c",
  success: "#58985a",
  info: "#4f7e8e",
});

export const GAME_UI_MATERIALS = Object.freeze({
  parchment: "parchment",
  parchmentRaised: "parchment-raised",
  oak: "oak",
  bronze: "bronze",
  inset: "inset",
  veil: "veil",
});

export const GAME_UI_EMPHASIS = Object.freeze({
  ambient: "ambient",
  interactive: "interactive",
  important: "important",
  ceremonial: "ceremonial",
});

export const GAME_UI_MOTION_MS = Object.freeze({
  press: 90,
  fast: 160,
  standard: 240,
  reveal: 420,
  ceremonial: 640,
});

export const GAME_UI_Z = Object.freeze({
  board: 0,
  hud: 30,
  floating: 45,
  modal: 60,
  toast: 80,
  event: 95,
  fatal: 110,
});

export const GAME_UI_RULES = Object.freeze([
  "Pergaminho serve conteúdo narrativo e consulta; não é o fundo de todos os controlos.",
  "Cartas de Desenvolvimento são objetos visuais próprios; usam o sistema global apenas para tipografia, movimento e interação.",
  "Madeira escura e bronze formam a estrutura persistente do HUD.",
  "A cor da personagem identifica propriedade/turno; não substitui a paleta global da interface.",
  "Eventos importantes podem interromper visualmente; informação persistente deve permanecer discreta.",
  "Cinzel identifica controlos e labels; Fondamento transporta texto orgânico e informação longa quando a escala permite leitura confortável.",
  "Mrs Saint Delafield e UnifrakturCook são acentos raros; Fondamento é o manuscrito funcional do jogo.",
  "Animação comunica causa, estado ou importância; nunca existe apenas para manter o ecrã em movimento.",
]);
