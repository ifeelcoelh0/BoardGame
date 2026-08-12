/**
 * Iconografia própria de Reinos do Dragão.
 *
 * Estes assets não fazem parte da galeria RPG de 496 ícones. São peças finais
 * desenhadas especificamente para ações e conceitos do jogo, mantidas num
 * catálogo pequeno para a UI não depender de nomes de ficheiros.
 */
export const CUSTOM_GAME_ICONS = Object.freeze({
  RDD_Dice: Object.freeze({ id: "RDD_Dice", path: "assets/icons/reinos/rd-dice.png", width: 36, height: 36 }),
  RDD_Options: Object.freeze({ id: "RDD_Options", path: "assets/icons/reinos/rd-options.png", width: 36, height: 36 }),
  RDD_Fullscreen: Object.freeze({ id: "RDD_Fullscreen", path: "assets/icons/reinos/rd-fullscreen.png", width: 36, height: 36 }),
  RDD_Road: Object.freeze({ id: "RDD_Road", path: "assets/icons/reinos/rd-road.png", width: 36, height: 36 }),
  RDD_Village: Object.freeze({ id: "RDD_Village", path: "assets/icons/reinos/rd-village.png", width: 36, height: 36 }),
  RDD_Palace: Object.freeze({ id: "RDD_Palace", path: "assets/icons/reinos/rd-palace.png", width: 36, height: 36 }),
  RDD_DevelopmentCard: Object.freeze({ id: "RDD_DevelopmentCard", path: "assets/icons/reinos/rd-development-card.png", width: 36, height: 36 }),
  RDD_Bank: Object.freeze({ id: "RDD_Bank", path: "assets/icons/reinos/rd-bank.png", width: 36, height: 36 }),
  RDD_Trade: Object.freeze({ id: "RDD_Trade", path: "assets/icons/reinos/rd-trade.png", width: 36, height: 36 }),
  RDD_Port: Object.freeze({ id: "RDD_Port", path: "assets/icons/reinos/rd-port.png", width: 36, height: 36 }),
  RDD_AllPlayers: Object.freeze({ id: "RDD_AllPlayers", path: "assets/icons/reinos/rd-all-players.png", width: 36, height: 36 }),
  RDD_Reactions: Object.freeze({ id: "RDD_Reactions", path: "assets/icons/reinos/rd-reactions.png", width: 36, height: 36 }),
  RDD_EmoteHappy: Object.freeze({ id: "RDD_EmoteHappy", path: "assets/icons/reinos/rd-emote-happy.png", width: 36, height: 36 }),
  RDD_EmoteLaugh: Object.freeze({ id: "RDD_EmoteLaugh", path: "assets/icons/reinos/rd-emote-laugh.png", width: 36, height: 36 }),
  RDD_EmoteTease: Object.freeze({ id: "RDD_EmoteTease", path: "assets/icons/reinos/rd-emote-tease.png", width: 36, height: 36 }),
  RDD_EmoteAngry: Object.freeze({ id: "RDD_EmoteAngry", path: "assets/icons/reinos/rd-emote-angry.png", width: 36, height: 36 }),
  RDD_EmoteShocked: Object.freeze({ id: "RDD_EmoteShocked", path: "assets/icons/reinos/rd-emote-shocked.png", width: 36, height: 36 }),
  RDD_EmoteCry: Object.freeze({ id: "RDD_EmoteCry", path: "assets/icons/reinos/rd-emote-cry.png", width: 36, height: 36 }),
  RDD_EmotePlead: Object.freeze({ id: "RDD_EmotePlead", path: "assets/icons/reinos/rd-emote-plead.png", width: 36, height: 36 }),
  RDD_EmoteChallenge: Object.freeze({ id: "RDD_EmoteChallenge", path: "assets/icons/reinos/rd-emote-challenge.png", width: 36, height: 36 }),
  RDD_ChatTankard: Object.freeze({ id: "RDD_ChatTankard", path: "assets/icons/reinos/rd-chat-tankard.png", width: 36, height: 36 }),
  RDD_ModeDragon: Object.freeze({ id: "RDD_ModeDragon", path: "assets/icons/reinos/rd-mode-dragon.png", width: 36, height: 36 }),
  RDD_FoundRealm: Object.freeze({ id: "RDD_FoundRealm", path: "assets/icons/reinos/rd-found-realm.png", width: 36, height: 36 }),
  RDD_ResourceWood: Object.freeze({ id: "RDD_ResourceWood", path: "assets/icons/reinos/rd-resource-wood.png", width: 36, height: 36 }),
  RDD_ResourceHorses: Object.freeze({ id: "RDD_ResourceHorses", path: "assets/icons/reinos/rd-resource-horses.png", width: 36, height: 36 }),
  RDD_ResourceObsidian: Object.freeze({ id: "RDD_ResourceObsidian", path: "assets/icons/reinos/rd-resource-obsidian.png", width: 36, height: 36 }),
});

export function customGameIcon(name) {
  return typeof name === "string" ? CUSTOM_GAME_ICONS[name] ?? null : null;
}
