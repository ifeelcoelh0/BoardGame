import { useEffect, useState } from "react";
import CharacterSprite from "../assets/CharacterSprite.jsx";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_SUMMARY_ICONS as SUMMARY_ICONS, RESOURCE_ICON_BY_KEY as RESOURCE_ICONS } from "../../assets/gameUiIcons.js";

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

const RESOURCE_LABELS = {
  madeira: "Madeira",
  tijolo: "Argila",
  cavalos: "Cavalos",
  ouro: "Ouro",
  obsidiana: "Obsidiana",
};

const STATUS_ICONS = {
  immune: "S_Holy09",
  plague: "P_Red04",
  tsunami: "S_Magic03",
};

function BannerIcon({ name, size = 20, title, className = "" }) {
  return <GameIcon name={name} size={size} title={title} className={className} />;
}

function BannerStat({ icon, label, value, highlighted = false, compactLabel = null }) {
  return (
    <span
      className={`rdb-player-banner__stat${highlighted ? " is-highlighted" : ""}`}
      title={label}
      aria-label={`${label}: ${value}`}
    >
      <BannerIcon name={icon} size={17} />
      <small>{compactLabel || label}</small>
      <b>{value}</b>
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
          <strong>{Object.values(player.res || {}).reduce((sum, amount) => sum + (amount || 0), 0)} recursos</strong>
          <span>A composição da mão deste rival é secreta.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rdb-player-banner__resource-grid">
      {resourceEntries.map((resource) => (
        <span key={resource} title={RESOURCE_LABELS[resource]}>
          <BannerIcon name={RESOURCE_ICONS[resource]} size={26} />
          <small>{RESOURCE_LABELS[resource]}</small>
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
  const visibleVictoryPoints = publicVictoryPoints;
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
      title={isExpanded ? "Fechar detalhes desta casa" : "Abrir detalhes desta casa"}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span className="rdb-player-banner__grain" aria-hidden="true" />
      <span className={`rdb-player-banner__rank${rank === 0 ? " is-first" : ""}`}>
        {rank + 1}.º
      </span>

      <span className="rdb-player-banner__portrait" aria-hidden="true">
        <CharacterSprite character={character.id} size={100} />
      </span>

      <span className="rdb-player-banner__identity">
        <small>{character.t}</small>
        <span className="rdb-player-banner__name-line">
          <strong>{character.n.split(" ").pop()}</strong>
          {isLocal && <i>(tu)</i>}
          {isBot && <em className="rdb-player-banner__presence is-bot">bot</em>}
          {player.connected === false && (
            <em className="rdb-player-banner__presence is-offline">
              {reconnectSeconds != null ? `BOT EM ${reconnectSeconds}s` : "OFFLINE"}
            </em>
          )}
          {hasStatuses && (
            <span className="rdb-player-banner__status-icons" aria-label="Estados atuais">
              {player.immune && (
                <span title="Trindade das Armas — imune">
                  <BannerIcon name={STATUS_ICONS.immune} size={18} />
                </span>
              )}
              {player.sick > 0 && (
                <span title={`Peste — ${player.sick} turno(s)`}>
                  <BannerIcon name={STATUS_ICONS.plague} size={18} />
                  <b>{player.sick}</b>
                </span>
              )}
              {tsunamiTurns > 0 && (
                <span title={`Tsunami — porto(s) regressam em ${tsunamiTurns} turno(s)`}>
                  <BannerIcon name={STATUS_ICONS.tsunami} size={18} />
                  <b>{tsunamiTurns}</b>
                </span>
              )}
            </span>
          )}
        </span>
      </span>

      <span className="rdb-player-banner__victory" title="Pontos de vitória">
        <small>P.V.</small>
        <strong>{visibleVictoryPoints}</strong>
        {isLocal && secretVictoryPoints > 0 && <i>+{secretVictoryPoints} secreto</i>}
      </span>

      <span className="rdb-player-banner__stats">
        <BannerStat icon={SUMMARY_ICONS.resources} label="Recursos na mão" compactLabel="Recursos" value={resourceCount} />
        <BannerStat icon={SUMMARY_ICONS.cards} label="Cartas de desenvolvimento" compactLabel="Cartas" value={developmentCards} />
        <BannerStat icon={SUMMARY_ICONS.road} label="Estradas construídas" compactLabel="Estradas" value={roadCount} highlighted={hasLongestRoad} />
        <BannerStat icon={SUMMARY_ICONS.troops} label="Força do exército" compactLabel="Exército" value={troopCount} highlighted={hasLargestArmy} />
      </span>

      <span className="rdb-player-banner__affordance" aria-hidden="true">
        <b>{isExpanded ? "FECHAR" : "DETALHES"}</b><i>›</i>
      </span>

      {isActive && (
        <span className="rdb-player-banner__turn">
          <i />
          {player.connected === false
            ? ` A AGUARDAR${reconnectSeconds != null ? ` · BOT EM ${reconnectSeconds}s` : ""}`
            : " A JOGAR"}
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
            aria-label="Fechar detalhes"
          >
            ×
          </button>

          <header className="rdb-player-banner__details-header">
            <span className="rdb-player-banner__detail-portrait">
              <RotatingCharacter characterId={character.id} active={isExpanded} />
            </span>
            <div>
              <small>{character.t}</small>
              <h3>{character.n}{isLocal ? " (tu)" : ""}</h3>
              {quote && <blockquote>“{quote}”</blockquote>}
            </div>
          </header>

          <div className="rdb-player-banner__detail-section">
            <h4>ESTADO DA CASA</h4>
            <div className="rdb-player-banner__status-list">
              {!hasStatuses && <span className="rdb-player-banner__no-status">Sem efeitos ativos.</span>}
              {player.immune && (
                <StatusBadge
                  type="immune"
                  label="Imune"
                  title="Trindade das Armas — imune ao Dragão e aos desastres"
                />
              )}
              {player.sick > 0 && (
                <StatusBadge
                  type="plague"
                  value={player.sick}
                  label="Peste"
                  title={`Doente durante mais ${player.sick} turno(s)`}
                />
              )}
              {tsunamiTurns > 0 && (
                <StatusBadge
                  type="tsunami"
                  value={tsunamiTurns}
                  label="Tsunami"
                  title={`Porto(s) regressam em ${tsunamiTurns} turno(s)`}
                />
              )}
            </div>
          </div>

          <div className="rdb-player-banner__detail-section">
            <h4>RECURSOS</h4>
            <DetailedResources player={player} isLocal={isLocal} />
          </div>

          {perk && (
            <div className={`rdb-player-banner__perk${perkLive ? " is-live" : ""}`}>
              <small>{perkLive ? "PODER DA CASA ATIVO" : "PODER DA CASA"}</small>
              <strong>{perk.n}</strong>
              <p>{perk.d}</p>
              {!perkLive && warMode && <i>Ainda não despertou nesta partida.</i>}
              {!warMode && <i>Este poder pertence ao modo Guerra dos Reinos.</i>}
            </div>
          )}

          <div className="rdb-player-banner__detail-stats">
            <span><BannerIcon name={SUMMARY_ICONS.cards} size={22} /><small>Cartas</small><b>{developmentCards}</b></span>
            <span className={hasLongestRoad ? "is-award" : ""}><BannerIcon name={SUMMARY_ICONS.road} size={22} /><small>Estrada</small><b>{longestRoad}</b></span>
            <span className={hasLargestArmy ? "is-award" : ""}><BannerIcon name={SUMMARY_ICONS.troops} size={22} /><small>Tropas</small><b>{troopCount}</b></span>
            <span><BannerIcon name="I_Telescope" size={22} /><small>Pontos visíveis</small><b>{publicVictoryPoints}</b></span>
          </div>

          {(hasLongestRoad || hasLargestArmy) && (
            <div className="rdb-player-banner__awards">
              {hasLongestRoad && <span>Estrada Mais Longa</span>}
              {hasLargestArmy && <span>Maior Exército</span>}
            </div>
          )}

          {warMode && player.troops && (
            <div className="rdb-player-banner__army-breakdown">
              <span><small>Cavaleiros</small><b>{player.troops.cavaleiro || 0}</b></span>
              <span><small>Catapultas</small><b>{player.troops.catapulta || 0}</b></span>
              <span><small>Arqueiros</small><b>{player.troops.arqueiro || 0}</b></span>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
