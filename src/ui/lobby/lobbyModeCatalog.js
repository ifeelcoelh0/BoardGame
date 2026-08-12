/*
   Catálogo editorial dos modos mostrado no salão.

   O mesmo modo aparecia em dois sítios diferentes: FoyerPages tinha descrições,
   duração e complexidade, enquanto lobbyViewModel mantinha outro mapa com nome,
   ícone e duração. Isso criava duas fontes de verdade para a mesma informação.
   O Book v2 passa a consumir este catálogo único, e o view-model limita-se a
   selecionar a entrada correspondente ao jogo.
*/

export const LOBBY_MODES = Object.freeze([
  Object.freeze({
    id: "dragao",
    name: "Modo Dragão",
    icon: "RDD_ModeDragon",
    description: "A experiência completa, com o dragão a interferir na mesa.",
    duration: "60–90 min",
    complexity: "Média",
    dragon: "Sim",
    war: "Não",
    exploration: "Não",
    ideal: "A experiência principal de Reinos do Dragão.",
  }),
  Object.freeze({
    id: "classico",
    name: "Modo Clássico",
    icon: "RDD_Palace",
    description: "Construção e comércio, sem eventos de dragão.",
    duration: "45–75 min",
    complexity: "Média",
    dragon: "Não",
    war: "Não",
    exploration: "Não",
    ideal: "Quem quer uma partida focada em expansão e comércio.",
  }),
  Object.freeze({
    id: "rapido",
    name: "Cerco Relâmpago",
    icon: "S_Thunder03",
    description: "Partida curta, pontuação reduzida.",
    duration: "20–35 min",
    complexity: "Baixa",
    dragon: "Não",
    war: "Não",
    exploration: "Não",
    ideal: "Mesas que querem uma partida rápida e directa.",
  }),
  Object.freeze({
    id: "guerra",
    name: "Guerra dos Reinos",
    icon: "W_Sword006",
    description: "Combate directo, tropas e poderes de casa.",
    duration: "75–120 min",
    complexity: "Alta",
    dragon: "Não",
    war: "Sim",
    exploration: "Não",
    ideal: "Jogadores que procuram confronto directo e controlo territorial.",
  }),
  Object.freeze({
    id: "exploracao",
    name: "Terras do Além",
    icon: "I_Map",
    description: "Mapa maior, carruagens e regiões por descobrir.",
    duration: "60–100 min",
    complexity: "Alta",
    dragon: "Não",
    war: "Não",
    exploration: "Sim",
    ideal: "Quem gosta de descobrir o mapa e expandir para território desconhecido.",
  }),
]);

const LOBBY_MODE_BY_ID = Object.freeze(Object.fromEntries(
  LOBBY_MODES.map((mode) => [mode.id, mode]),
));

export function getLobbyModeMeta(modeId) {
  return LOBBY_MODE_BY_ID[modeId] ?? LOBBY_MODE_BY_ID.dragao;
}
