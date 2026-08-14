import GameIcon from "../../assets/GameIcon.jsx";
import ResourceCost from "./ResourceCost.jsx";
import ResourceIcon from "./ResourceIcon.jsx";
import { GAME_ACTION_ICONS } from "../../../assets/gameUiIcons.js";
import { BUILD_COSTS, PIECE_LIMITS, RESOURCE_KEYS } from "../../../game/resources.js";
import { MAX_WAGONS_PER_GAME, WAGON_COST } from "../../../game/explorationReducer.js";
import { isExplorationMode, isWarMode, usesDisasters } from "../../../game/gameModes.js";
import { GameUtilityPanelShell } from "./GameUtilityPanel.jsx";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-grimoire.css";

const BUILD_ROWS = Object.freeze([
  Object.freeze({ id: "estrada", labelKey: "build.road", icon: GAME_ACTION_ICONS.road, detailKey: "grimoire.roadDetail", detailVars: { max: PIECE_LIMITS.estrada } }),
  Object.freeze({ id: "aldeia", labelKey: "build.village", icon: GAME_ACTION_ICONS.village, detailKey: "grimoire.villageDetail", detailVars: { max: PIECE_LIMITS.aldeia } }),
  Object.freeze({ id: "palacio", labelKey: "build.palace", icon: GAME_ACTION_ICONS.palace, detailKey: "grimoire.palaceDetail", detailVars: { max: PIECE_LIMITS.palacio } }),
  Object.freeze({ id: "carta", labelKey: "build.card", icon: GAME_ACTION_ICONS.card, detailKey: "grimoire.cardDetail" }),
]);

export default function GameGrimoirePanel({ game, player, onOpenLibrary, onClose }) {
  const exploration = isExplorationMode(game.mode);
  const war = isWarMode(game.mode);
  const disasters = usesDisasters(game.mode);
  return (
    <GameUtilityPanelShell eyebrow={t("grimoire.freeReference")} title={t("grimoire.title")} onClose={onClose}>
      <p className="rd-ui-copy rd-grimoire__intro">{t("grimoire.intro")}</p>
      <div className="rd-grimoire__inventory">
        {RESOURCE_KEYS.map((resource) => <span key={resource}><ResourceIcon resource={resource} size={24}/><b>{player.res?.[resource] || 0}</b></span>)}
      </div>
      <div className="rd-grimoire__builds">
        {BUILD_ROWS.map((row) => <article key={row.id}><GameIcon name={row.icon} size={34}/><div><strong>{t(row.labelKey)}</strong><ResourceCost cost={BUILD_COSTS[row.id]}/><p>{t(row.detailKey, row.detailVars)}</p></div></article>)}
        {exploration && <article><GameIcon name={GAME_ACTION_ICONS.wagon} size={34}/><div><strong>{t("build.wagon")}</strong><ResourceCost cost={WAGON_COST}/><p>{t("grimoire.wagonDetail", { max: MAX_WAGONS_PER_GAME })}</p></div></article>}
      </div>
      <section className="rd-grimoire__rules"><h4>{t("grimoire.victoryPoints")}</h4><p>{t("grimoire.victoryRules")}</p></section>
      <section className="rd-grimoire__rules"><h4>{t("grimoire.bankTrades")}</h4><p>{t("grimoire.bankRules")}</p></section>
      {disasters && <section className="rd-grimoire__rules"><h4>{t("grimoire.disasters")}</h4><p>{t("grimoire.disasterRules")}</p></section>}
      {war && <section className="rd-grimoire__rules"><h4>{t("mode.guerra.name")}</h4><p>{t("grimoire.warRules")}</p></section>}
      {exploration && <section className="rd-grimoire__rules"><h4>{t("mode.exploracao.name")}</h4><p>{t("grimoire.explorationRules")}</p></section>}
      <button className="btn sm ghost rd-grimoire__library" type="button" onClick={onOpenLibrary}>{t("grimoire.openLibrary")}</button>
    </GameUtilityPanelShell>
  );
}
