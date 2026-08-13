import { t } from "../../locales/i18n.js";

const MODE_DATA = Object.freeze([
  Object.freeze({ id: "dragao", icon: "RDD_ModeDragon", duration: "60–90 min", dragon: true, war: false, exploration: false }),
  Object.freeze({ id: "classico", icon: "RDD_Palace", duration: "45–75 min", dragon: false, war: false, exploration: false }),
  Object.freeze({ id: "rapido", icon: "S_Thunder03", duration: "20–35 min", dragon: false, war: false, exploration: false }),
  Object.freeze({ id: "guerra", icon: "W_Sword006", duration: "75–120 min", dragon: false, war: true, exploration: false }),
  Object.freeze({ id: "exploracao", icon: "I_Map", duration: "60–100 min", dragon: false, war: false, exploration: true }),
]);

function localizeMode(mode) {
  return Object.freeze({
    ...mode,
    name: t(`mode.${mode.id}.name`),
    description: t(`mode.${mode.id}.description`),
    complexity: t(`mode.${mode.id}.complexity`),
    dragon: mode.dragon ? t("common.yes") : t("common.no"),
    war: mode.war ? t("common.yes") : t("common.no"),
    exploration: mode.exploration ? t("common.yes") : t("common.no"),
    ideal: t(`mode.${mode.id}.ideal`),
  });
}

export const LOBBY_MODES = Object.freeze(MODE_DATA.map(localizeMode));
const LOBBY_MODE_BY_ID = Object.freeze(Object.fromEntries(LOBBY_MODES.map((mode) => [mode.id, mode])));

export function getLobbyModeMeta(modeId) {
  return LOBBY_MODE_BY_ID[modeId] ?? LOBBY_MODE_BY_ID.dragao;
}
