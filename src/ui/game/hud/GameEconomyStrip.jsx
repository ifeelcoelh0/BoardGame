import GameIcon from "../../assets/GameIcon.jsx";
import ResourceCost from "./ResourceCost.jsx";
import ResourceIcon from "./ResourceIcon.jsx";
import { GAME_ACTION_ICONS, GAME_UTILITY_ICONS } from "../../../assets/gameUiIcons.js";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-economy-strip.css";

const COST_ROWS = Object.freeze([
  Object.freeze({ id: "estrada", labelKey: "build.road", icon: GAME_ACTION_ICONS.road }),
  Object.freeze({ id: "aldeia", labelKey: "build.village", icon: GAME_ACTION_ICONS.village }),
  Object.freeze({ id: "palacio", labelKey: "build.palace", icon: GAME_ACTION_ICONS.palace }),
  Object.freeze({ id: "carta", labelKey: "build.card", icon: GAME_ACTION_ICONS.card }),
]);

export default function GameEconomyStrip({
  resources,
  resourceDefinitions,
  resourceKeys,
  costs,
  cardCount,
  onOpenCards,
  costsOpen = false,
  compact = false,
  embedded = false,
  docked = false,
  showCardSummary = true,
  showCosts = true,
}) {
  return (
    <section className={`rd-economy${costsOpen ? " is-open" : ""}${compact ? " is-compact" : ""}${embedded ? " rd-economy--embedded" : ""}${docked ? " rd-economy--docked" : ""}`} aria-label={t("economy.realm")}>
      {showCosts && (
        <div className="rd-economy__costs" aria-label={t("economy.buildCosts")}>
          {COST_ROWS.map((row) => (
            <article key={row.id}>
              <div className="rd-economy__build-kind">
                <GameIcon name={row.icon} size={38} alt="" />
                <strong>{t(row.labelKey)}</strong>
              </div>
              <div className="rd-economy__build-price">
                <ResourceCost cost={costs[row.id]} />
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="rd-economy__resources" aria-label={t("economy.hand")}>
        {resourceKeys.map((resource) => (
          <span key={resource} title={resourceDefinitions[resource]?.n} data-rd-resource-target={resource}>
            <ResourceIcon resource={resource} size={30} title={resourceDefinitions[resource]?.n} />
            <b>{resources?.[resource] || 0}</b>
          </span>
        ))}
        {showCardSummary && <i aria-hidden="true" />}
        {showCardSummary && (
          <button type="button" onClick={onOpenCards} title={t("economy.openCards")}>
            <GameIcon name={GAME_UTILITY_ICONS.cards} size={30} alt="" />
            <b>{cardCount}</b>
            <small>{t("hud.cards")}</small>
          </button>
        )}
      </div>
    </section>
  );
}
