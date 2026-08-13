import { t } from "../../locales/i18n.js";
import { getLobbyModeMeta } from "./lobbyModeCatalog.js";

export function createEmptyLobbyViewModel(characters = []) {
  const characterStates = Object.fromEntries(
    characters.map((character) => [character.id, { status: "free", ownerColor: null }]),
  );
  return {
    mode: { get name() { return t("lobby.hallOfRealms"); }, icon: null, get duration() { return t("lobby.chooseYourPath"); } },
    players: [],
    localPlayer: null,
    isHost: false,
    hasConfirmedCharacter: false,
    slots: Array.from({ length: 4 }, () => null),
    seatCharacters: [null, null, null, null],
    perk: null,
    availableCharacterIds: characters.map((character) => character.id),
    characterStates,
    seatStates: Array.from({ length: 4 }, () => ({ occupied: false, ready: false, connected: true })),
  };
}

export function createLobbyViewModel({ game, seat, characters = [], perks = {} }) {
  if (!game || !Array.isArray(game.players) || !Number.isInteger(seat)) {
    return createEmptyLobbyViewModel(characters);
  }

  const mode = getLobbyModeMeta(game.mode);
  const players = game.players.map((player, index) => {
    const character = characters.find((item) => item.id === player.ch);
    return {
      ...player,
      index,
      ready: player.ready === true,
      character,
      characterLabel: character?.n ?? "Casa por escolher",
      color: character?.pc ?? "#d6ac55",
    };
  });
  const localPlayer = players[seat] ?? null;
  const isHost = seat === 0;
  const hasConfirmedCharacter = localPlayer?.characterConfirmed === true && Boolean(localPlayer?.character);
  const slots = [];
  if (players[seat]) slots.push(players[seat]);
  players.forEach((player) => {
    if (player.index !== seat) slots.push(player);
  });
  while (slots.length < 4) slots.push(null);
  slots.splice(4);

  const seatCharacters = slots.map((player) => player?.character?.id ?? null);
  const perk = game.mode === "guerra" && hasConfirmedCharacter ? perks[localPlayer.ch] : null;
  const availableCharacterIds = characters
    .filter((character) => character.id === localPlayer?.character?.id || !players.some((player) => player.character?.id === character.id))
    .map((character) => character.id);

  const characterStates = {};
  characters.forEach((character) => {
    const owner = players.find((player) => player.character?.id === character.id);
    if (!owner) characterStates[character.id] = { status: "free", ownerColor: null };
    else if (owner.index === seat) characterStates[character.id] = { status: "local", ownerColor: owner.color };
    else characterStates[character.id] = { status: "taken", ownerColor: owner.color };
  });

  const seatStates = slots.map((player) => ({
    occupied: Boolean(player),
    ready: player?.ready === true,
    connected: player ? player.connected !== false : true,
  }));

  return {
    mode,
    players,
    localPlayer,
    isHost,
    hasConfirmedCharacter,
    slots,
    seatCharacters,
    perk,
    availableCharacterIds,
    characterStates,
    seatStates,
  };
}
