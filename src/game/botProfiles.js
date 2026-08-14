import { GAME_ACTION } from "./gameProtocol.js";

export const BOT_PROFILE_VERSION = 1;

export const BOT_PROFILE = Object.freeze({
  BALANCED: "balanced",
  EXPANDER: "expander",
  DEVELOPER: "developer",
  ECONOMIST: "economist",
});

export const DIVERSE_BOT_PROFILES = Object.freeze([
  BOT_PROFILE.BALANCED,
  BOT_PROFILE.EXPANDER,
  BOT_PROFILE.DEVELOPER,
  BOT_PROFILE.ECONOMIST,
]);

const BASE_ACTION_SCORE = Object.freeze({
  [GAME_ACTION.RESOLVE_DISCARD]: 100_000,
  [GAME_ACTION.RESOLVE_TSUNAMI]: 100_000,
  [GAME_ACTION.RESOLVE_QUEUE_RESOURCE]: 100_000,
  [GAME_ACTION.ROLL_DICE]: 95_000,
  [GAME_ACTION.PLACE_DRAGON]: 93_000,
  [GAME_ACTION.STEAL_RESOURCE]: 93_000,
  [GAME_ACTION.DEPLOY_UNIT]: 90_000,
  [GAME_ACTION.FOUND_REMOTE_VILLAGE]: 88_000,
  [GAME_ACTION.BUILD_PALACE]: 86_000,
  [GAME_ACTION.BUILD_VILLAGE]: 82_000,
  [GAME_ACTION.PLAY_DEV_CARD]: 69_000,
  [GAME_ACTION.RECRUIT_TROOP]: 67_000,
  [GAME_ACTION.UNIT_ACTION]: 64_000,
  [GAME_ACTION.LOAD_COLONISTS]: 63_000,
  [GAME_ACTION.BUILD_WAGON]: 61_000,
  [GAME_ACTION.BUILD_ROAD]: 57_000,
  [GAME_ACTION.BUY_DEV_CARD]: 54_000,
  [GAME_ACTION.BRIBE_UNIT]: 49_000,
  [GAME_ACTION.PROPOSE_TRADE]: 46_000,
  [GAME_ACTION.MOVE_WAGON]: 5_000,
  [GAME_ACTION.BANK_TRADE]: 4_000,
  [GAME_ACTION.ACCEPT_TRADE]: 3_000,
  [GAME_ACTION.DECLINE_TRADE]: 2_500,
  [GAME_ACTION.CANCEL_TRADE]: 2_000,
  [GAME_ACTION.REMATCH_READY]: 1_000,
  [GAME_ACTION.END_TURN]: 100,
});

const PROFILE_CONFIG = Object.freeze({
  [BOT_PROFILE.BALANCED]: Object.freeze({
    id: BOT_PROFILE.BALANCED,
    label: "Equilibrado",
    description: "Mantém a hierarquia histórica do bot e procura a melhor oportunidade geral.",
    actionScores: Object.freeze({}),
    cardKindBias: Object.freeze({}),
    tradeAttemptsPerTurn: 1,
    tradeConsiderationRate: 0.12,
    tradeUtilityThreshold: 2_000,
  }),
  [BOT_PROFILE.EXPANDER]: Object.freeze({
    id: BOT_PROFILE.EXPANDER,
    label: "Expansor",
    description: "Privilegia novas aldeias, estradas e acesso a melhores zonas de produção.",
    actionScores: Object.freeze({
      [GAME_ACTION.BUILD_VILLAGE]: 89_000,
      [GAME_ACTION.BUILD_ROAD]: 84_000,
      [GAME_ACTION.BUILD_PALACE]: 80_000,
      [GAME_ACTION.BUY_DEV_CARD]: 48_000,
      [GAME_ACTION.PROPOSE_TRADE]: 51_000,
      [GAME_ACTION.BANK_TRADE]: 8_000,
    }),
    cardKindBias: Object.freeze({}),
    tradeAttemptsPerTurn: 1,
    tradeConsiderationRate: 0.10,
    tradeUtilityThreshold: 2_200,
  }),
  [BOT_PROFILE.DEVELOPER]: Object.freeze({
    id: BOT_PROFILE.DEVELOPER,
    label: "Desenvolvimento",
    description: "Investe cedo em cartas e converte o baralho em pontos, tropas e ações especiais.",
    actionScores: Object.freeze({
      [GAME_ACTION.PLAY_DEV_CARD]: 91_000,
      [GAME_ACTION.BUY_DEV_CARD]: 87_000,
      [GAME_ACTION.BUILD_PALACE]: 78_000,
      [GAME_ACTION.BUILD_VILLAGE]: 74_000,
      [GAME_ACTION.BUILD_ROAD]: 56_000,
      [GAME_ACTION.PROPOSE_TRADE]: 55_000,
      [GAME_ACTION.BANK_TRADE]: 9_000,
    }),
    cardKindBias: Object.freeze({
      tropa: 3_000,
      descoberta: 1_500,
      monopolio: 1_200,
      estradas: 800,
    }),
    tradeAttemptsPerTurn: 1,
    tradeConsiderationRate: 0.16,
    tradeUtilityThreshold: 1_800,
  }),
  [BOT_PROFILE.ECONOMIST]: Object.freeze({
    id: BOT_PROFILE.ECONOMIST,
    label: "Economista",
    description: "Prioriza eficiência de recursos, palácios e trocas para desbloquear objetivos.",
    actionScores: Object.freeze({
      [GAME_ACTION.BUILD_PALACE]: 90_000,
      [GAME_ACTION.BUILD_VILLAGE]: 84_000,
      [GAME_ACTION.PROPOSE_TRADE]: 76_000,
      [GAME_ACTION.BANK_TRADE]: 68_000,
      [GAME_ACTION.BUY_DEV_CARD]: 60_000,
      [GAME_ACTION.BUILD_ROAD]: 55_000,
    }),
    cardKindBias: Object.freeze({}),
    tradeAttemptsPerTurn: 1,
    tradeConsiderationRate: 0.22,
    tradeUtilityThreshold: 900,
  }),
});

export function botProfile(profileId = BOT_PROFILE.BALANCED) {
  return PROFILE_CONFIG[profileId] || PROFILE_CONFIG[BOT_PROFILE.BALANCED];
}

export function normalizeBotProfileId(profileId) {
  return botProfile(profileId).id;
}

export function botActionBaseScore(profileId, actionType) {
  const profile = botProfile(profileId);
  return profile.actionScores[actionType] ?? BASE_ACTION_SCORE[actionType] ?? 0;
}

export function botCardKindBias(profileId, cardKind) {
  return Number(botProfile(profileId).cardKindBias?.[cardKind]) || 0;
}

export function botTradeAttemptsPerTurn(profileId) {
  return Math.max(0, Number(botProfile(profileId).tradeAttemptsPerTurn) || 0);
}

export function botTradeUtilityThreshold(profileId) {
  return Number(botProfile(profileId).tradeUtilityThreshold) || 0;
}

export function botTradeConsiderationRate(profileId) {
  const value = Number(botProfile(profileId).tradeConsiderationRate);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function botProfilesForGame(gameIndex, playerCount, strategySet = BOT_PROFILE.BALANCED) {
  if (!Number.isSafeInteger(playerCount) || playerCount < 1) return [];
  if (strategySet !== "diverse") {
    const profileId = normalizeBotProfileId(strategySet);
    return Array.from({ length: playerCount }, () => profileId);
  }

  // Keep one stable profile assignment during each roster-rotation block. The
  // roster rotates through player slots, so every character in that table sees
  // every profile once. Shift the profile-to-slot mapping between combinations
  // to avoid permanently tying one profile to one player slot.
  const block = Math.floor(Math.max(0, Number(gameIndex) || 0) / playerCount);
  const shift = block % DIVERSE_BOT_PROFILES.length;
  return Array.from({ length: playerCount }, (_, playerIndex) => (
    DIVERSE_BOT_PROFILES[(playerIndex + shift) % DIVERSE_BOT_PROFILES.length]
  ));
}
