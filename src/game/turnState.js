export const INITIAL_PLAY_TURN = Object.freeze({
  pos: 0,
  rolled: false,
  dice: null,
  devPlayed: false,
  mustDragon: false,
  steal: null,
  milN: 0,
  acted: Object.freeze({}),
  deploy: null,
  troopPlayed: false,
});

export function createPlayTurnState({ position = 0, previousDice = null } = {}) {
  return {
    ...INITIAL_PLAY_TURN,
    pos: position,
    dice: previousDice,
    acted: {},
  };
}
