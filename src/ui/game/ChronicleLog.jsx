import { useMemo, useState } from "react";
import { characterById } from "../../game/characterCatalog.js";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_ACTION_ICONS, GAME_UTILITY_ICONS } from "../../assets/gameUiIcons.js";
import { cleanGameUiText } from "./gameTextPresentation.js";
import GameRichText from "./GameRichText.jsx";
import "../../styles/chronicle-log.css";

const FILTERS = Object.freeze([
  ["all", "Todas"],
  ["event", "Grandes eventos"],
  ["war", "Guerra"],
  ["trade", "Trocas"],
  ["exploration", "Exploração"],
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
          <span className="rd-chronicle__kicker">Arquivo da partida</span>
          <h3>Crónicas do Reino</h3>
        </div>
        <div className="rd-chronicle__header-actions">
          <span className="rd-chronicle__count">{entries.length} registos</span>
          {onClose && <button type="button" className="rd-chronicle__close" onClick={onClose} aria-label="Fechar crónicas">×</button>}
        </div>
      </header>

      {availableFilters.length > 1 && (
        <nav className="rd-chronicle__filters" aria-label="Filtrar crónicas">
          {availableFilters.map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? "is-active" : ""} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className="rd-chronicle__scroll">
        {visibleEntries.length === 0 && <p className="rd-chronicle__empty">Ainda não há acontecimentos registados.</p>}
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
                  <span>{player?.name || (entry.kind === "event" ? "Anais do Reino" : "Cronista")}</span>
                  <i aria-hidden="true" />
                </div>
                <p><GameRichText>{message.text}</GameRichText></p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  if (embedded) return chronicle;
  return (
    <div className="rd-chronicle-overlay" role="dialog" aria-modal="true" aria-label="Crónicas do Reino" onClick={onClose || undefined}>
      {chronicle}
    </div>
  );
}
