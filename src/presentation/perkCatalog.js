export const CHARACTER_PERKS = Object.freeze({
  vlad: Object.freeze({ i: "🧛", n: "Sangue Antigo", d: "Os teus Cavaleiros custam -1 cavalo." }),
  bones: Object.freeze({ i: "💀", n: "Legião de Ossos", d: "As tuas tropas custam +1 obsidiana, mas reerguem-se da primeira morte." }),
  artheria: Object.freeze({ i: "🏹", n: "Olho de Águia", d: "Arqueiros num hexágono junto a uma construção tua livre disparam a 2 hexágonos." }),
  maria: Object.freeze({ i: "🛡️", n: "Muralhas do Povo", d: "Os cercos às tuas construções exigem +1 catapulta." }),
  makuru: Object.freeze({ i: "🌿", n: "Filho da Terra", d: "Vences empates a defender em floresta/montanha e moves-te de graça entre terrenos férteis iguais." }),
  muriel: Object.freeze({ i: "🔮", n: "Voz do Dragão", d: "Recebes +1 recurso em cada Bênção do Dragão." }),
  romeo: Object.freeze({ i: "💋", n: "Suborno", d: "1× por turno: paga 2 ouro e empurra uma tropa inimiga adjacente às tuas (ação grátis)." }),
  protheus: Object.freeze({ i: "🐆", n: "Mestre das Rotas", d: "Ao entrares em terreno ardido, avanças de imediato +1 hexágono." }),
});

export function characterPerk(characterId) {
  return CHARACTER_PERKS[characterId] || null;
}
