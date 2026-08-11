export const DEVELOPMENT_CARD_PRESENTATION = Object.freeze({
  cavaleiro: Object.freeze({ title: "Cavaleiro", family: "troop", description: "Guia o Dragão de Fogo e rouba 1 carta a um rival. Conta para o Maior Exército." }),
  catapulta: Object.freeze({ title: "Catapulta", family: "troop", description: "O cerco começa! Move o Dragão e rouba 1 carta. Conta para o Maior Exército." }),
  arqueiro: Object.freeze({ title: "Arqueiro", family: "troop", description: "Uma seta certeira. Move o Dragão e rouba 1 carta. Conta para o Maior Exército." }),
  inteligencia: Object.freeze({ title: "Inteligência", family: "victory", description: "1 Ponto de Vitória secreto. Ninguém precisa de saber… ainda." }),
  conhecimento: Object.freeze({ title: "Conhecimento", family: "victory", description: "1 Ponto de Vitória secreto. Ninguém precisa de saber… ainda." }),
  fe: Object.freeze({ title: "Fé", family: "victory", description: "1 Ponto de Vitória secreto. Ninguém precisa de saber… ainda." }),
  sorte: Object.freeze({ title: "Sorte", family: "victory", description: "1 Ponto de Vitória secreto. Ninguém precisa de saber… ainda." }),
  astucia: Object.freeze({ title: "Astúcia", family: "victory", description: "1 Ponto de Vitória secreto. Ninguém precisa de saber… ainda." }),
  marcha: Object.freeze({ title: "Marcha Forçada", family: "war", description: "Os tambores rufam: ganha +1 ação militar neste turno." }),
  espiao: Object.freeze({ title: "Espião", family: "war", description: "Um sussurro na corte inimiga: espreita a mão de um rival à tua escolha." }),
  monopolio: Object.freeze({ title: "Monopólio", family: "rare", description: "Escolhe um recurso: todos os rivais entregam-te tudo o que têm dele." }),
  descoberta: Object.freeze({ title: "Trabalhadores", family: "utility", description: "Dois braços fortes ao teu serviço: recebe 2 recursos à tua escolha." }),
  estradas: Object.freeze({ title: "Construtor de Estradas", family: "utility", description: "Ergue 2 estradas grátis de imediato." }),
});

export function developmentCardPresentationKey(card) {
  if (!card || typeof card !== "object") return null;
  if (card.kind === "tropa") return card.sub || null;
  if (card.kind !== "vp") return card.kind || null;
  const sub = String(card.sub || "").toLocaleLowerCase("pt-PT");
  if (sub.includes("intelig")) return "inteligencia";
  if (sub.includes("conhecimento")) return "conhecimento";
  if (sub.includes("fé") || sub.includes("fe")) return "fe";
  if (sub.includes("sorte")) return "sorte";
  if (sub.includes("astúcia") || sub.includes("astucia")) return "astucia";
  return null;
}

export function developmentCardPresentation(card) {
  const key = developmentCardPresentationKey(card);
  return DEVELOPMENT_CARD_PRESENTATION[key] || Object.freeze({
    title: "Carta de Desenvolvimento",
    family: "unknown",
    description: "Uma carta antiga cujo efeito ainda não foi catalogado.",
  });
}
