import { useEffect, useState } from "react";
import CharacterSprite from "../assets/CharacterSprite.jsx";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_SUMMARY_ICONS as SUMMARY_ICONS, RESOURCE_ICON_BY_KEY as RESOURCE_ICONS } from "../../assets/gameUiIcons.js";
import { t } from "../../locales/i18n.js";
import { playerBannerScore } from "./playerBannerScoreModel.js";
import "../../styles/player-banner.css";

const ROTATION_DIRECTIONS = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
];

const resourceLabel = (resource) => t(`resources.${resource}`);

const STATUS_ICONS = {
  immune: "S_Holy09",
  plague: "P_Red04",
  tsunami: "S_Magic03",
};

function BannerIcon({ name, size = 20, title, className = "" }) {
  return <GameIcon name={name} size={size} title={title} className={className} />;
}

function BannerStat({ icon, label, value, highlighted = false, awardLabel = null }) {
  const title = highlighted && awardLabel ? `${awardLabel} · ${label}: ${value}` : label;
  return (
    <span
      className={`rdb-player-banner__stat${highlighted ? " is-highlighted" : ""}`}
      title={title}
      aria-label={highlighted && awardLabel ? `${awardLabel}. ${label}: ${value}` : `${label}: ${value}`}
    >
      <BannerIcon name={icon} size={24} />
      <b>{value}</b>
      {highlighted && <span className="rdb-player-banner__award-mark" aria-hidden="true"><BannerIcon name="Ac_Medal01" size={16} /></span>}
    </span>
  );
}

function RotatingCharacter({ characterId, active }) {
  const [directionIndex, setDirectionIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setDirectionIndex(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDirectionIndex((current) => (current + 1) % ROTATION_DIRECTIONS.length);
    }, 520);

    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <CharacterSprite
      character={characterId}
      direction={ROTATION_DIRECTIONS[directionIndex]}
      size={136}
      className="rdb-player-banner__detail-character"
    />
  );
}

function StatusBadge({ type, value, title, label }) {
  return (
    <span className={`rdb-player-banner__status rdb-player-banner__status--${type}`} title={title}>
      <BannerIcon name={STATUS_ICONS[type]} size={18} />
      {value != null && <b>{value}</b>}
      <span>{label}</span>
    </span>
  );
}

function DetailedResources({ player, isLocal }) {
  const resourceEntries = Object.keys(RESOURCE_ICONS);

  if (!isLocal) {
    return (
      <div className="rdb-player-banner__hidden-hand">
        <BannerIcon name={SUMMARY_ICONS.resources} size={28} />
        <div>
          <strong>{t("hud.resourceTotal", { count: Object.values(player.res || {}).reduce((sum, amount) => sum + (amount || 0), 0) })}</strong>
          <span>{t("hud.secretHand")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rdb-player-banner__resource-grid">
      {resourceEntries.map((resource) => (
        <span key={resource} title={resourceLabel(resource)}>
          <BannerIcon name={RESOURCE_ICONS[resource]} size={26} />
          <small>{resourceLabel(resource)}</small>
          <b>{player.res?.[resource] || 0}</b>
        </span>
      ))}
    </div>
  );
}

export default function PlayerBanner({
  player,
  character,
  rank,
  publicVictoryPoints,
  secretVictoryPoints = 0,
  resourceCount,
  developmentCards,
  roadCount,
  longestRoad,
  troopCount,
  hasLongestRoad = false,
  hasLargestArmy = false,
  isLocal = false,
  isActive = false,
  reconnectSeconds = null,
  isExpanded = false,
  onToggle,
  perk,
  perkLive = false,
  warMode = false,
  quote,
  style,
  children,
}) {
  const tsunamiTurns = player.portOff?.length
    ? Math.max(...player.portOff.map((port) => port.left))
    : 0;
  const hasStatuses = player.immune || player.sick > 0 || tsunamiTurns > 0;
  const score = playerBannerScore({ publicVictoryPoints, secretVictoryPoints, isLocal });
  const visibleVictoryPoints = score.publicScore;
  const isBot = player.controller === "bot";

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle?.();
    }
  };

  return (
    <article
      className={`rdb-player-banner${isActive ? " is-active" : ""}${isExpanded ? " is-expanded" : ""}${player.connected === false ? " is-disconnected" : ""}${isBot ? " is-bot-controlled" : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      title={isExpanded ? t("common.close") : t("common.details")}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span className="rdb-player-banner__grain" aria-hidden="true" />
      <span className={`rdb-player-banner__rank${rank === 0 ? " is-first" : ""}`}>
        #{rank + 1}
      </span>

      <span className="rdb-player-banner__portrait" aria-hidden="true">
        <CharacterSprite character={character.id} size={100} />
      </span>

      <span className="rdb-player-banner__identity">
        <small>{character.t}</small>
        <span className="rdb-player-banner__name-line">
          <strong>{character.n.split(" ").pop()}</strong>
          {isLocal && <i>({t("common.you")})</i>}
          {isBot && <em className="rdb-player-banner__presence is-bot">{t("common.bot")}</em>}
          {player.connected === false && (
            <em className="rdb-player-banner__presence is-offline">
              {reconnectSeconds != null ? t("hud.botIn", { seconds: reconnectSeconds }) : t("common.offline")}
            </em>
          )}
          {hasStatuses && (
            <span className="rdb-player-banner__status-icons" aria-label={t("hud.currentStates")}>
              {player.immune && (
                <span title={t("hud.weaponTrinityImmune")}>
                  <BannerIcon name={STATUS_ICONS.immune} size={18} />
                </span>
              )}
              {player.sick > 0 && (
                <span title={t("hud.plagueTurns", { turns: player.sick })}>
                  <BannerIcon name={STATUS_ICONS.plague} size={18} />
                  <b>{player.sick}</b>
                </span>
              )}
              {tsunamiTurns > 0 && (
                <span title={t("hud.tsunamiTurns", { turns: tsunamiTurns })}>
                  <BannerIcon name={STATUS_ICONS.tsunami} size={18} />
                  <b>{tsunamiTurns}</b>
                </span>
              )}
            </span>
          )}
        </span>
      </span>

      <span
        className="rdb-player-banner__victory"
        title={isLocal && secretVictoryPoints > 0
          ? `${t("hud.publicVictoryPoints")}: ${visibleVictoryPoints} · ${t("hud.yourTotalVictoryPoints")}: ${visibleVictoryPoints + secretVictoryPoints}`
          : `${t("hud.victoryPoints")}: ${visibleVictoryPoints}`}
      >
        <small>{t("hud.vpAbbrev")}</small>
        <strong aria-label={score.hasPrivateTotal ? `${t("hud.publicVictoryPoints")}: ${score.publicScore}. ${t("hud.yourTotalVictoryPoints")}: ${score.total}` : `${t("hud.victoryPoints")}: ${score.publicScore}`}>
          {score.publicScore}
          {score.hasPrivateTotal && <span className="rdb-player-banner__secret-total"> ({score.total})</span>}
        </strong>
      </span>

      <span className="rdb-player-banner__stats">
        <BannerStat icon={SUMMARY_ICONS.resources} label={t("hud.resourcesInHand")} value={resourceCount} />
        <BannerStat icon={SUMMARY_ICONS.cards} label={t("hud.developmentCards")} value={developmentCards} />
        <BannerStat icon={SUMMARY_ICONS.road} label={t("hud.roadsBuilt")} value={roadCount} highlighted={hasLongestRoad} awardLabel={t("hud.longestRoad")} />
        <BannerStat icon={SUMMARY_ICONS.troops} label={t("hud.armyStrength")} value={troopCount} highlighted={hasLargestArmy} awardLabel={t("hud.largestArmy")} />
      </span>

      <span className="rdb-player-banner__affordance" aria-hidden="true">
        <b>{isExpanded ? t("common.close").toUpperCase() : t("common.details").toUpperCase()}</b><i>›</i>
      </span>

      {isActive && (
        <span className="rdb-player-banner__turn">
          <i />
          {player.connected === false
            ? ` ${t("hud.waiting")}${reconnectSeconds != null ? ` · ${t("hud.botIn", { seconds: reconnectSeconds })}` : ""}`
            : ` ${t("hud.playing")}`}
        </span>
      )}
      {children}

      {isExpanded && (
        <section className={`rdb-player-banner__details${rank >= 2 ? " is-lower" : ""}`} onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="rdb-player-banner__close"
            onClick={(event) => {
              event.stopPropagation();
              onToggle?.();
            }}
            aria-label={t("common.close")}
          >
            ×
          </button>

          <header className="rdb-player-banner__details-header">
            <span className="rdb-player-banner__detail-portrait">
              <RotatingCharacter characterId={character.id} active={isExpanded} />
            </span>
            <div>
              <small>{character.t}</small>
              <h3>{character.n}{isLocal ? ` (${t("common.you")})` : ""}</h3>
              {quote && <blockquote>“{quote}”</blockquote>}
            </div>
          </header>

          <div className="rdb-player-banner__detail-section">
            <h4>{t("hud.houseState")}</h4>
            <div className="rdb-player-banner__status-list">
              {!hasStatuses && <span className="rdb-player-banner__no-status">{t("hud.noActiveEffects")}</span>}
              {player.immune && (
                <StatusBadge
                  type="immune"
                  label={t("hud.immune")}
                  title={t("hud.weaponTrinityImmune")}
                />
              )}
              {player.sick > 0 && (
                <StatusBadge
                  type="plague"
                  value={player.sick}
                  label={t("hud.plague")}
                  title={t("hud.plagueTurns", { turns: player.sick })}
                />
              )}
              {tsunamiTurns > 0 && (
                <StatusBadge
                  type="tsunami"
                  value={tsunamiTurns}
                  label={t("hud.tsunami")}
                  title={t("hud.tsunamiTurns", { turns: tsunamiTurns })}
                />
              )}
            </div>
          </div>

          <div className="rdb-player-banner__detail-section">
            <h4>{t("hud.resources").toUpperCase()}</h4>
            <DetailedResources player={player} isLocal={isLocal} />
          </div>

          {perk && (
            <div className={`rdb-player-banner__perk${perkLive ? " is-live" : ""}`}>
              <small>{perkLive ? t("hud.housePowerActive") : t("hud.housePower")}</small>
              <strong>{perk.n}</strong>
              <p>{perk.d}</p>
              {!perkLive && warMode && <i>{t("hud.powerNotAwake")}</i>}
              {!warMode && <i>{t("hud.powerWarOnly")}</i>}
            </div>
          )}

          <div className="rdb-player-banner__detail-stats">
            <span><BannerIcon name={SUMMARY_ICONS.cards} size={22} /><small>{t("hud.cards")}</small><b>{developmentCards}</b></span>
            <span className={hasLongestRoad ? "is-award" : ""}><BannerIcon name={SUMMARY_ICONS.road} size={22} /><small>{t("hud.roads")}</small><b>{longestRoad}</b></span>
            <span className={hasLargestArmy ? "is-award" : ""}><BannerIcon name={SUMMARY_ICONS.troops} size={22} /><small>{t("hud.army")}</small><b>{troopCount}</b></span>
            <span><BannerIcon name="I_Telescope" size={22} /><small>{t("hud.publicVictoryPoints")}</small><b>{publicVictoryPoints}</b></span>
          </div>

          {(hasLongestRoad || hasLargestArmy) && (
            <div className="rdb-player-banner__awards">
              {hasLongestRoad && <span>{t("hud.longestRoad")}</span>}
              {hasLargestArmy && <span>{t("hud.largestArmy")}</span>}
            </div>
          )}

          {warMode && player.troops && (
            <div className="rdb-player-banner__army-breakdown">
              <span><small>{t("hud.knights")}</small><b>{player.troops.cavaleiro || 0}</b></span>
              <span><small>{t("hud.catapults")}</small><b>{player.troops.catapulta || 0}</b></span>
              <span><small>{t("hud.archers")}</small><b>{player.troops.arqueiro || 0}</b></span>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
