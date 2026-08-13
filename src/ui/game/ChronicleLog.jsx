import { useMemo, useState } from "react";
import { characterById } from "../../game/characterCatalog.js";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_ACTION_ICONS, GAME_UTILITY_ICONS } from "../../assets/gameUiIcons.js";
import { cleanGameUiText } from "./gameTextPresentation.js";
import GameRichText from "./GameRichText.jsx";
import ResourceIcon from "./hud/ResourceIcon.jsx";
import { RESOURCE_DEFINITIONS } from "../../game/resources.js";
import { t } from "../../locales/i18n.js";
import "../../styles/chronicle-log.css";

const FILTERS = Object.freeze([
  ["all", "chronicle.all"],
  ["event", "chronicle.majorEvents"],
  ["war", "chronicle.war"],
  ["trade", "chronicle.trades"],
  ["exploration", "chronicle.exploration"],
]);

const CHRONICLE_ICON_BY_KIND = Object.freeze({
  event: GAME_UTILITY_ICONS.history,
  war: GAME_ACTION_ICONS.cavaleiro,
  trade: GAME_ACTION_ICONS.trade,
  exploration: "I_Map",
  realm: GAME_UTILITY_ICONS.history,
});

function chroniclePresentation(entry) {
  const text = String(entry?.msg || "").trim().replace(/^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|[⚜⚖✋])\s*/u, "");
  return {
    icon: entry?.icon || CHRONICLE_ICON_BY_KIND[entry?.kind || "realm"] || GAME_UTILITY_ICONS.history,
    text: cleanGameUiText(text),
  };
}


function resourceFlowLabel(resources = []) {
  const gain = resources.some((entry) => entry.amount > 0);
  const loss = resources.some((entry) => entry.amount < 0);
  if (gain && loss) return t("chronicle.trade");
  if (gain) return t("chronicle.received");
  if (loss) return t("chronicle.paid");
  return "";
}

function ChronicleResourceFlow({ resources = [] }) {
  if (!resources.length) return null;
  return (
    <div className="rd-chronicle__resource-flow" aria-label={t("chronicle.resourceMovement")}>
      <small>{resourceFlowLabel(resources)}</small>
      <div>
        {resources.map((entry, index) => {
          const positive = entry.amount > 0;
          const label = RESOURCE_DEFINITIONS[entry.resource]?.n || entry.resource;
          return (
            <span key={`${entry.resource}-${index}`} className={positive ? "is-gain" : "is-loss"} title={`${positive ? "+" : ""}${entry.amount} ${t(label)}`}>
              <b>{positive ? "+" : "−"}{Math.abs(entry.amount)}</b>
              <ResourceIcon resource={entry.resource} size={22} />
              <em>{t(label)}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function entryPlayer(game, entry) {
  if (!Number.isSafeInteger(entry?.pi)) return null;
  const player = game?.players?.[entry.pi];
  const character = characterById(player?.ch);
  if (!character) return null;
  return { name: character.n, color: character.c };
}

export default function ChronicleLog({ game, entries = [], onClose = null, embedded = false }) {
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => entries.reduce((result, entry) => {
    const kind = entry?.kind || "realm";
    result[kind] = (result[kind] || 0) + 1;
    return result;
  }, {}), [entries]);
  const availableFilters = FILTERS.filter(([key]) => key === "all" || counts[key] > 0);
  const visibleEntries = filter === "all" ? entries : entries.filter((entry) => entry?.kind === filter);

  const chronicle = (
    <section className={`rd-chronicle${embedded ? " rd-chronicle--embedded" : ""}`} onClick={(event) => event.stopPropagation()}>
      <header className="rd-chronicle__header">
        <div>
          <span className="rd-chronicle__kicker">{t("chronicle.archive")}</span>
          <h3>{t("chronicle.title")}</h3>
        </div>
        <div className="rd-chronicle__header-actions">
          <span className="rd-chronicle__count">{t("chronicle.records", { count: entries.length })}</span>
          {onClose && <button type="button" className="rd-chronicle__close" onClick={onClose} aria-label={t("chronicle.close")}>×</button>}
        </div>
      </header>

      {availableFilters.length > 1 && (
        <nav className="rd-chronicle__filters" aria-label={t("chronicle.filter")}>
          {availableFilters.map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? "is-active" : ""} onClick={() => setFilter(key)}>
              {t(label)}
            </button>
          ))}
        </nav>
      )}

      <div className="rd-chronicle__scroll">
        {visibleEntries.length === 0 && <p className="rd-chronicle__empty">{t("chronicle.empty")}</p>}
        {visibleEntries.map((entry, index) => {
          const player = entryPlayer(game, entry);
          const message = chroniclePresentation(entry);
          return (
            <article
              key={entry.id ?? `${index}-${entry.msg}`}
              className={`rd-chronicle__entry rd-chronicle__entry--${entry.emphasis || "ambient"}`}
              style={player ? { "--chronicle-player": player.color } : undefined}
            >
              <div className="rd-chronicle__sigil" aria-hidden="true"><GameIcon name={message.icon} size={22} alt="" /></div>
              <div className="rd-chronicle__body">
                <div className="rd-chronicle__meta">
                  <span>{player?.name || (entry.kind === "event" ? t("chronicle.annals") : t("chronicle.chronicler"))}</span>
                  <i aria-hidden="true" />
                </div>
                <p><GameRichText>{message.text}</GameRichText></p>
                <ChronicleResourceFlow resources={entry.resources || []} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  if (embedded) return chronicle;
  return (
    <div className="rd-chronicle-overlay" role="dialog" aria-modal="true" aria-label={t("chronicle.title")} onClick={onClose || undefined}>
      {chronicle}
    </div>
  );
}
