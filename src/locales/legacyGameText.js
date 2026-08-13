import { getLocale } from "./i18n.js";

const EXACT_EN = new Map([
  ["A terra respondeu ao chamamento dos dados.", "The land answered the call of the dice."],
  ["A terra ficou em silêncio; ninguém colheu recursos.", "The land fell silent; nobody harvested resources."],
  ["O Dragão Desperta!", "The Dragon Awakens!"],
  ["Trindade das Armas!", "Weapon Trinity!"],
  ["Monopólio!", "Monopoly!"],
  ["Libertação!", "Liberation!"],
  ["O Gigante Caiu!", "The Giant Has Fallen!"],
  ["O Pântano Estremece", "The Swamp Trembles"],
  ["A Horda Acordou!", "The Horde Awakens!"],
  ["O Coração Caiu!", "The Heart Has Fallen!"],
  ["O Gelo Estala…", "The Ice Cracks…"],
  ["O Despertar!", "The Awakening!"],
  ["A Bênção do Dragão!", "The Dragon's Blessing!"],
  ["Um palácio ergue-se!", "A Palace Rises!"],
]);

const DYNAMIC_EN = Object.freeze([
  [/^Saiu o (\d+)!$/u, (match) => `Rolled ${match[1]}!`],
  [/^“GRAOOOR! Tragam-me os vossos sacrifícios!” O Dragão será guiado por (.+)\.$/u,
    (match) => `“GRAOOOR! Bring me your sacrifices!” The Dragon will be guided by ${match[1]}.`],
  [/^“Todo o (.+) do reino\.\.\. é MEU!” \((\d+) cartas confiscadas\)$/u,
    (match) => `“All the ${match[1]} in the realm... is MINE!” (${match[2]} cards confiscated)`],
]);

const FIXED_EN = new Map([
  ["É a vez de", "It is the turn of"],
  ["fundou uma aldeia", "founded a village"],
  ["ergueu uma estrada", "built a road"],
  ["ergueu um PALÁCIO", "built a PALACE"],
  ["comprou uma carta de desenvolvimento", "bought a development card"],
  ["aceitou a troca de", "accepted the trade from"],
  ["roubou 1 carta a", "stole 1 card from"],
  ["O Dragão pousou em", "The Dragon landed on"],
  ["Os reinos estão fundados. Que comece a era do Dragão!", "The realms are founded. Let the age of the Dragon begin!"],
  ["marcha para o campo de batalha", "marches to the battlefield"],
  ["marcha! O Dragão vai ser guiado", "marches! The Dragon will be guided"],
  ["invocou o Construtor de Estradas", "called upon the Road Builder"],
  ["ganha +1 ação militar neste turno", "gains +1 military action this turn"],
  ["enviou um espião à corte de", "sent a spy to the court of"],
  ["Os trabalhadores de", "The workers of"],
  ["TRINDADE DAS ARMAS", "WEAPON TRINITY"],
  ["Os seus domínios estão para sempre a salvo do Dragão", "Their domains are forever safe from the Dragon"],
  ["Os domínios de", "The domains of"],
  ["ficam para sempre a salvo do Dragão", "are forever safe from the Dragon"],
  ["O Dragão abre o tesouro do vulcão", "The Dragon opens the volcano's treasure"],
  ["cada casa escolhe 1 recurso à sua vontade", "each House chooses 1 resource"],
  ["que o despertou, escolhe 2", "who awakened it, chooses 2"],
  ["O Dragão de Gelo", "The Ice Dragon"],
  ["O Troll Gigante", "The Giant Troll"],
  ["Coração do Reino", "Heart of the Realm"],
  ["pontos", "points"],
  ["turnos", "turns"],
  ["turno", "turn"],
  ["recursos", "resources"],
  ["recurso", "resource"],
  ["aldeia", "village"],
  ["aldeias", "villages"],
  ["palácio", "palace"],
  ["estrada", "road"],
  ["estradas", "roads"],
  ["Cavaleiro", "Knight"],
  ["Catapulta", "Catapult"],
  ["Arqueiro", "Archer"],
  ["Floresta Sombria", "Shadow Forest"],
  ["Poços de Argila", "Clay Pits"],
  ["Prados Selvagens", "Wild Meadows"],
  ["Grutas Douradas", "Golden Caves"],
  ["Montanhas de Obsidiana", "Obsidian Mountains"],
  ["Terras Ardidas", "Burned Lands"],
  ["Geleira Eterna", "Eternal Glacier"],
  ["Madeira", "Wood"],
  ["Tijolo", "Brick"],
  ["Cavalos", "Horses"],
  ["Ouro", "Gold"],
  ["Obsidiana", "Obsidian"],
]);

function translateDynamic(text) {
  for (const [pattern, translate] of DYNAMIC_EN) {
    const match = text.match(pattern);
    if (match) return translate(match);
  }
  return null;
}

export function localizeLegacyGameText(value, locale = getLocale()) {
  const text = String(value ?? "");
  if (locale === "pt-PT" || !text) return text;
  const exact = EXACT_EN.get(text);
  if (exact) return exact;
  const dynamic = translateDynamic(text);
  if (dynamic) return dynamic;
  let result = text;
  for (const [from, to] of FIXED_EN) result = result.split(from).join(to);
  return result;
}
