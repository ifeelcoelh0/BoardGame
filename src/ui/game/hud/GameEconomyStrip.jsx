import GameIcon from "../../assets/GameIcon.jsx";
import ResourceCost from "./ResourceCost.jsx";
import ResourceIcon from "./ResourceIcon.jsx";
import { GAME_ACTION_ICONS, GAME_UTILITY_ICONS } from "../../../assets/gameUiIcons.js";
import "../../../styles/game-economy-strip.css";

const COST_ROWS = Object.freeze([
  Object.freeze({ id: "estrada", label: "Estrada", icon: GAME_ACTION_ICONS.road }),
  Object.freeze({ id: "aldeia", label: "Aldeia", icon: GAME_ACTION_ICONS.village }),
  Object.freeze({ id: "palacio", label: "Palácio", icon: GAME_ACTION_ICONS.palace }),
  Object.freeze({ id: "carta", label: "Carta", icon: GAME_ACTION_ICONS.card }),
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
    <section className={`rd-economy${costsOpen ? " is-open" : ""}${compact ? " is-compact" : ""}${embedded ? " rd-economy--embedded" : ""}${docked ? " rd-economy--docked" : ""}`} aria-label="Economia do reino">
      {showCosts && (
        <div className="rd-economy__costs" aria-label="Custos de construção">
          {COST_ROWS.map((row) => (
            <article key={row.id}>
              <GameIcon name={row.icon} size={28} alt="" />
              <span><strong>{row.label}</strong><ResourceCost cost={costs[row.id]} /></span>
            </article>
          ))}
        </div>
      )}
      <div className="rd-economy__resources" aria-label="Recursos e cartas na mão">
        {resourceKeys.map((resource) => (
          <span key={resource} title={resourceDefinitions[resource]?.n}>
            <ResourceIcon resource={resource} size={30} title={resourceDefinitions[resource]?.n} />
            <b>{resources?.[resource] || 0}</b>
          </span>
        ))}
        {showCardSummary && <i aria-hidden="true" />}
        {showCardSummary && (
          <button type="button" onClick={onOpenCards} title="Abrir as tuas cartas">
            <GameIcon name={GAME_UTILITY_ICONS.cards} size={30} alt="" />
            <b>{cardCount}</b>
            <small>Cartas</small>
          </button>
        )}
      </div>
    </section>
  );
}
