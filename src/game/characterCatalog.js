const CHARACTER_DATA = [
    {
        id: "vlad",
        pc: "#5b6bff",
        n: "Vlad Dr\xE1cula",
        t: "O Senhor das Trevas",
        c: "#2b2b52",
        ac: "#b9b9d4",
        em: "\u{1F987}",
        q: ["A noite pertence-me.", "O sangue chama por mais terras.", "Curvem-se perante as trevas."]
    },
    {
        id: "maria",
        pc: "#ffd60a",
        n: "Princesa Maria",
        t: "A Luz do Reino",
        c: "#e0b23a",
        ac: "#6b4d05",
        em: "\u{1F451}",
        q: ["Pelo reino e pela luz!", "Uma princesa nunca recua.", "O ouro fica-me t\xE3o bem."]
    },
    {
        id: "protheus",
        pc: "#ff3b30",
        n: "Rei Protheus",
        t: "O Velho Glut\xE3o",
        c: "#a8232b",
        ac: "#f0c9c9",
        em: "\u{1F356}",
        q: ["Mais vinho! E mais terras!", "No meu tempo \xE9 que era...", "A coroa pesa, mas o trono \xE9 confort\xE1vel."]
    },
    {
        id: "romeo",
        pc: "#ff8a00",
        n: "Menino Romeo",
        t: "O Prod\xEDgio",
        c: "#a35c1a",
        ac: "#153a1c",
        em: "\u{1F33F}",
        q: ["Os grandes v\xE3o cair!", "Quem precisa de ouro quando se tem c\xE9rebro?", "Um dia serei rei... v\xE3o ver."]
    },
    {
        id: "makuru",
        pc: "#7cff2b",
        n: "Goblin Makuru",
        t: "O Matreiro",
        c: "#5a9e3a",
        ac: "#1e3a12",
        em: "\u{1F977}",
        q: ["Que ningu\xE9m conte os meus recursos\u2026", "Trocas justas? Isso \xE9 para os tolos.", "Eu n\xE3o roubei. Encontrei primeiro."]
    },
    {
        id: "artheria",
        pc: "#00e5a0",
        n: "Elfa Artheria",
        t: "A Guardi\xE3 dos Bosques",
        c: "#2f7d4a",
        ac: "#e8d98a",
        em: "\u{1F3F9}",
        q: ["A floresta lembra-se de tudo.", "Vejo o teu plano antes de o pensares.", "Paci\xEAncia: as \xE1rvores tamb\xE9m esperam."]
    },
    {
        id: "muriel",
        pc: "#e63dff",
        n: "Feiticeira Muriel",
        t: "A Voz do Arcano",
        c: "#7b3fc4",
        ac: "#ffd76b",
        em: "\u{1F52E}",
        q: ["Os dados obedecem-me\u2026 quase sempre.", "Li o teu destino. N\xE3o vais gostar.", "Magia n\xE3o \xE9 batota. \xC9 estudo."]
    },
    {
        id: "bones",
        pc: "#e8f4ff",
        n: "Esqueleto Bones",
        t: "O Que Voltou",
        c: "#d8e2f0",
        ac: "#2a3040",
        em: "\u{1F480}",
        q: ["J\xE1 morri uma vez. N\xE3o assusta.", "Tenho todo o tempo do mundo.", "Ossos velhos, planos novos."]
    }
];

export const CHARACTERS = Object.freeze(CHARACTER_DATA.map((character) => Object.freeze({
  ...character,
  q: Object.freeze([...(character.q || [])]),
})));

const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function characterById(id) {
  return CHARACTER_BY_ID.get(id) || null;
}

export function characterName(id) {
  return characterById(id)?.n || String(id || "");
}

export function characterQuote(id, index = 0) {
  const quotes = characterById(id)?.q || [];
  if (!quotes.length) return "";
  const normalized = Math.abs(Number(index) || 0) % quotes.length;
  return quotes[normalized];
}
