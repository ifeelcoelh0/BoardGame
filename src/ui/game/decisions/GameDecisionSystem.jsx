import { useEffect, useMemo } from "react";
import GameButton from "../../system/GameButton.jsx";
import GameIcon from "../../assets/GameIcon.jsx";
import CharacterSprite from "../../assets/CharacterSprite.jsx";
import { GAME_ACTION } from "../../../game/gameProtocol.js";
import { RESOURCE_DEFINITIONS, RESOURCE_KEYS } from "../../../game/resources.js";
import { RESOURCE_ICON_BY_KEY } from "../../../assets/gameUiIcons.js";
import { buildGameDecisionModel, GAME_DECISION_TYPE } from "../gameDecisionModel.js";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-decisions.css";

function ResourceIcon({ resource, size = 28 }) {
  return <GameIcon name={RESOURCE_ICON_BY_KEY[resource]} size={size} alt="" />;
}

function ResourceInventory({ resources, compact = false }) {
  return (
    <div className={`rd-decision-inventory${compact ? " is-compact" : ""}`} aria-label={t("decision.resourcesInHand")}>
      {RESOURCE_KEYS.map((resource) => (
        <div className="rd-decision-inventory__item" key={resource} title={RESOURCE_DEFINITIONS[resource].n}>
          <ResourceIcon resource={resource} size={compact ? 22 : 28} />
          <strong>{resources?.[resource] || 0}</strong>
        </div>
      ))}
    </div>
  );
}

function DecisionShell({ model, onClose, children, footer = null }) {
  const dismissible = model.dismissible === true;
  useEffect(() => {
    if (!dismissible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissible, onClose]);
  const handleBackdrop = (event) => {
    if (dismissible && event.target === event.currentTarget) onClose?.();
  };
  return (
    <div className={`rd-decision-overlay rd-decision-overlay--${model.tone || "standard"}`} onMouseDown={handleBackdrop}>
      <section className="rd-decision" role="dialog" aria-modal="true" aria-labelledby="rd-decision-title">
        <div className="rd-decision__ornament" aria-hidden="true"><i /><span>✦</span><i /></div>
        {dismissible && (
          <button className="rd-decision__close" type="button" onClick={onClose} aria-label={t("decision.close")}>×</button>
        )}
        <header className="rd-decision__header">
          <small>{model.eyebrow}</small>
          <h2 id="rd-decision-title">{model.title}</h2>
          {model.description && <p>{model.description}</p>}
        </header>
        <div className="rd-decision__body">{children}</div>
        {footer && <footer className="rd-decision__footer">{footer}</footer>}
      </section>
    </div>
  );
}

function ResourceChoice({ label, onPick, exclude = [], selected = null }) {
  return (
    <div className="rd-decision-section">
      {label && <div className="rd-decision-section__label">{label}</div>}
      <div className="rd-decision-resource-grid">
        {RESOURCE_KEYS.filter((resource) => !exclude.includes(resource)).map((resource) => (
          <button
            key={resource}
            type="button"
            className={`rd-decision-resource${selected === resource ? " is-selected" : ""}`}
            onClick={() => onPick(resource)}
          >
            <ResourceIcon resource={resource} />
            <span>{RESOURCE_DEFINITIONS[resource].n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResourceCounters({ values, inventory, onChange, label }) {
  return (
    <div className="rd-decision-section">
      <div className="rd-decision-section__label">{label}</div>
      <div className="rd-decision-counter-grid">
        {RESOURCE_KEYS.map((resource) => {
          const amount = values?.[resource] || 0;
          const max = inventory?.[resource];
          return (
            <div className="rd-decision-counter" key={resource}>
              <ResourceIcon resource={resource} />
              <span>{RESOURCE_DEFINITIONS[resource].n}</span>
              <strong>{amount}{Number.isFinite(max) ? <small> / {max}</small> : null}</strong>
              <div className="rd-decision-counter__controls">
                <button type="button" onClick={() => onChange(resource, Math.max(0, amount - 1))} disabled={amount <= 0}>−</button>
                <button type="button" onClick={() => onChange(resource, amount + 1)} disabled={Number.isFinite(max) && amount >= max}>+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerChoices({ players, onPick, selectedIndex = null, allowAll = false, onPickAll = null, disableDisconnected = false }) {
  return (
    <div className="rd-decision-player-grid">
      {allowAll && (
        <button type="button" className={`rd-decision-player rd-decision-player--all${selectedIndex === "all" ? " is-selected" : ""}`} onClick={onPickAll}>
          <span className="rd-decision-player__all" aria-hidden="true"><GameIcon name="RDD_AllPlayers" size={34} alt="" /></span>
          <strong>{t("decision.allPlayers")}</strong>
          <small>{t("decision.openRealm")}</small>
        </button>
      )}
      {players.map((player) => (
        <button
          type="button"
          key={player.playerId || player.index}
          className={`rd-decision-player${selectedIndex === player.index ? " is-selected" : ""}`}
          onClick={() => onPick(player)}
          disabled={disableDisconnected && player.connected === false}
          title={disableDisconnected && player.connected === false ? t("decision.disconnectedPlayer") : undefined}
        >
          <span className="rd-decision-player__portrait"><CharacterSprite character={player.characterId} size={64} /></span>
          <strong>{player.name}</strong>
          <small>{player.connected === false ? t("common.offline") : t("decision.resourceCount", { count: player.handSize })}</small>
        </button>
      ))}
    </div>
  );
}

function BundleSummary({ bundle, empty = "nada" }) {
  const entries = RESOURCE_KEYS.filter((resource) => (bundle?.[resource] || 0) > 0);
  if (!entries.length) return <span className="rd-decision-bundle is-empty">{empty}</span>;
  return (
    <span className="rd-decision-bundle">
      {entries.map((resource) => (
        <span key={resource}><ResourceIcon resource={resource} size={20} /><b>{bundle[resource]}</b></span>
      ))}
    </span>
  );
}

function DiscardDecision({ model, selection, onSelectionChange, onSubmit }) {
  const total = RESOURCE_KEYS.reduce((sum, resource) => sum + (selection?.[resource] || 0), 0);
  return (
    <>
      <ResourceInventory resources={model.inventory} />
      <ResourceCounters
        label={t("decision.chooseSacrifice")}
        values={selection}
        inventory={model.inventory}
        onChange={(resource, amount) => onSelectionChange({ ...selection, [resource]: amount })}
      />
      <div className={`rd-decision-progress${total === model.need ? " is-complete" : ""}`}>
        <span>{t("decision.selected")}</span><strong>{total} / {model.need}</strong>
      </div>
      <GameButton variant="primary" size="lg" disabled={total !== model.need} onClick={onSubmit}>{t("decision.sacrifice")}</GameButton>
    </>
  );
}

function TsunamiDecision({ model, onPick }) {
  return (
    <div className="rd-decision-option-list">
      {model.ports.map((port) => {
        const specific = port.portType !== "any";
        return (
          <button className="rd-decision-option" type="button" key={port.edge} onClick={() => onPick(port.edge)}>
            <span className="rd-decision-option__sigil"><GameIcon name="RDD_Port" size={34} alt="" /></span>
            <span><strong>{t("decision.port", { ratio: specific ? "2:1" : "3:1" })}</strong><small>{specific ? RESOURCE_DEFINITIONS[port.portType]?.n : t("decision.anyResource")}</small></span>
            {specific && <ResourceIcon resource={port.portType} />}
          </button>
        );
      })}
    </div>
  );
}

function SpyReport({ model, onClose }) {
  return (
    <>
      <ResourceInventory resources={model.resources} />
      <p className="rd-decision-note">{t("decision.privateReport")}</p>
      <GameButton variant="primary" size="md" onClick={onClose}>{t("decision.closeReport")}</GameButton>
    </>
  );
}

function BankDecision({ model, onTrade }) {
  return (
    <>
      <ResourceInventory resources={model.inventory} />
      <div className="rd-decision-exchanges">
        {model.exchanges.filter((exchange) => exchange.affordable).map((exchange) => (
          <div className="rd-decision-exchange" key={exchange.give}>
            <div className="rd-decision-exchange__give">
              <ResourceIcon resource={exchange.give} />
              <span>{t("decision.give", { count: exchange.ratio, resource: RESOURCE_DEFINITIONS[exchange.give].n })}</span>
            </div>
            <div className="rd-decision-exchange__arrow">→</div>
            <div className="rd-decision-exchange__receives">
              {exchange.receives.map((get) => (
                <button type="button" key={get} title={t("decision.receiveOne", { resource: RESOURCE_DEFINITIONS[get].n })} onClick={() => onTrade(exchange.give, get)}>
                  <ResourceIcon resource={get} /><span>+1</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!model.hasAffordableExchange && <p className="rd-decision-note">{t("decision.notEnoughBank")}</p>}
    </>
  );
}

function TradeProposalDecision({ model, offer, onOfferChange, onSubmit }) {
  const changeBundle = (side, resource, amount) => {
    const max = side === "give" ? model.inventory[resource] : 99;
    const safe = Math.max(0, Number.isFinite(max) ? Math.min(max, amount) : amount);
    onOfferChange({ ...offer, [side]: { ...offer[side], [resource]: safe } });
  };
  const hasBundle = Object.values(offer.give || {}).some(Boolean) || Object.values(offer.get || {}).some(Boolean);
  const selectedPlayer = offer.to;
  const validTarget = selectedPlayer === "all" || Number.isSafeInteger(selectedPlayer) && model.players.some((player) => player.index === selectedPlayer && player.connected !== false);
  return (
    <>
      <ResourceInventory resources={model.inventory} compact />
      <div className="rd-decision-trade-columns">
        <ResourceCounters label={t("decision.iGive")} values={offer.give} inventory={model.inventory} onChange={(resource, amount) => changeBundle("give", resource, amount)} />
        <ResourceCounters label={t("decision.iWant")} values={offer.get} onChange={(resource, amount) => changeBundle("get", resource, amount)} />
      </div>
      <div className="rd-decision-section">
        <div className="rd-decision-section__label">{t("decision.proposeTo")}</div>
        <PlayerChoices
          players={model.players}
          selectedIndex={offer.to}
          allowAll
          onPickAll={() => onOfferChange({ ...offer, to: "all" })}
          onPick={(player) => onOfferChange({ ...offer, to: player.index })}
          disableDisconnected
        />
      </div>
      <GameButton variant="primary" size="lg" disabled={!validTarget || !hasBundle} onClick={onSubmit}>{t("decision.sendProposal")}</GameButton>
    </>
  );
}

function TradeResponseDecision({ model, onAccept, onDecline }) {
  return (
    <>
      <div className="rd-decision-trade-summary">
        <div><small>{t("decision.receive")}</small><BundleSummary bundle={model.give} /></div>
        <span className="rd-decision-trade-summary__swap">⇄</span>
        <div><small>{t("decision.deliver")}</small><BundleSummary bundle={model.get} /></div>
      </div>
      <div className="rd-decision-section">
        <div className="rd-decision-section__label">{t("decision.yourHand")}</div>
        <ResourceInventory resources={model.inventory} compact />
      </div>
      {!model.canAccept && <p className="rd-decision-note is-warning">{t("decision.cannotAccept")}</p>}
      <div className="rd-decision-actions">
        <GameButton variant="primary" size="lg" disabled={!model.canAccept} onClick={onAccept}>{t("decision.accept")}</GameButton>
        <GameButton variant="danger" size="lg" onClick={onDecline}>{t("decision.decline")}</GameButton>
      </div>
    </>
  );
}

export default function GameDecisionSystem({
  game,
  graph,
  seat,
  localDecision,
  selection,
  tradeOffer,
  dispatchGameAction,
  onChangeLocalDecision,
  onCloseLocalDecision,
  onSelectionChange,
  onTradeOfferChange,
}) {
  const model = useMemo(() => buildGameDecisionModel(game, graph, seat, { decision: localDecision }), [game, graph, seat, localDecision]);
  useEffect(() => {
    if (!localDecision) return;
    if (!model || (model.source !== "card" && model.source !== "utility")) onCloseLocalDecision?.();
  }, [localDecision, model?.source, model?.type, onCloseLocalDecision]);
  if (!model) return null;

  const close = () => { if (model.dismissible) onCloseLocalDecision?.(); };
  const submitDiscard = () => {
    const total = RESOURCE_KEYS.reduce((sum, resource) => sum + (selection?.[resource] || 0), 0);
    if (total !== model.need) return;
    void dispatchGameAction(GAME_ACTION.RESOLVE_DISCARD, { resources: { ...(selection || {}) } }).then((ok) => {
      if (ok) onSelectionChange({});
    });
  };

  let body = null;
  if (model.type === GAME_DECISION_TYPE.DISCARD) {
    body = <DiscardDecision model={model} selection={selection || {}} onSelectionChange={onSelectionChange} onSubmit={submitDiscard} />;
  } else if (model.type === GAME_DECISION_TYPE.TSUNAMI) {
    body = <TsunamiDecision model={model} onPick={(edge) => void dispatchGameAction(GAME_ACTION.RESOLVE_TSUNAMI, { edge })} />;
  } else if (model.type === GAME_DECISION_TYPE.QUEUE_RESOURCE) {
    body = <><ResourceInventory resources={model.inventory} /><ResourceChoice label={t("decision.receiveRemaining", { count: model.remaining })} onPick={(resource) => void dispatchGameAction(GAME_ACTION.RESOLVE_QUEUE_RESOURCE, { resource })} /></>;
  } else if (model.type === GAME_DECISION_TYPE.STEAL) {
    body = <PlayerChoices players={model.players} onPick={(player) => { if (Date.now() - model.openedAt < 350) return; void dispatchGameAction(GAME_ACTION.STEAL_RESOURCE, { victimIndex: player.index }); }} />;
  } else if (model.type === GAME_DECISION_TYPE.SPY_TARGET) {
    body = <PlayerChoices players={model.players} onPick={(player) => {
      void dispatchGameAction(GAME_ACTION.PLAY_DEV_CARD, { cardId: model.cardId, targetPlayerId: player.playerId }).then((result) => {
        const report = result?.privateResult;
        if (report?.type === "SPY_REPORT") onChangeLocalDecision({ type: "spy-report", targetPlayerId: report.targetPlayerId, resources: report.resources });
        else if (result) onCloseLocalDecision();
      });
    }} />;
  } else if (model.type === GAME_DECISION_TYPE.SPY_REPORT) {
    body = <SpyReport model={model} onClose={onCloseLocalDecision} />;
  } else if (model.type === GAME_DECISION_TYPE.MONOPOLY) {
    body = <ResourceChoice label={t("decision.confiscate")} onPick={(resource) => {
      void dispatchGameAction(GAME_ACTION.PLAY_DEV_CARD, { cardId: model.cardId, resource }).then((result) => {
        if (result) onCloseLocalDecision();
      });
    }} />;
  } else if (model.type === GAME_DECISION_TYPE.DISCOVERY) {
    body = <ResourceChoice label={model.first ? t("decision.secondResource") : t("decision.firstResource")} selected={model.first} onPick={(resource) => {
      if (!model.first) onChangeLocalDecision({ type: "descoberta", cardId: model.cardId, first: resource });
      else {
        void dispatchGameAction(GAME_ACTION.PLAY_DEV_CARD, { cardId: model.cardId, firstResource: model.first, secondResource: resource }).then((result) => {
          if (result) onCloseLocalDecision();
        });
      }
    }} />;
  } else if (model.type === GAME_DECISION_TYPE.BANK) {
    body = <BankDecision model={model} onTrade={(give, get) => void dispatchGameAction(GAME_ACTION.BANK_TRADE, { give, get })} />;
  } else if (model.type === GAME_DECISION_TYPE.TRADE_PROPOSAL) {
    body = <TradeProposalDecision model={model} offer={tradeOffer} onOfferChange={onTradeOfferChange} onSubmit={() => {
      const toPlayerId = tradeOffer.to === "all" ? "all" : game.players?.[tradeOffer.to]?.playerId;
      if (!toPlayerId) return;
      void dispatchGameAction(GAME_ACTION.PROPOSE_TRADE, { toPlayerId, give: tradeOffer.give, get: tradeOffer.get }).then((result) => {
        if (result) onCloseLocalDecision();
      });
    }} />;
  } else if (model.type === GAME_DECISION_TYPE.TRADE_RESPONSE) {
    body = <TradeResponseDecision model={model} onAccept={() => void dispatchGameAction(GAME_ACTION.ACCEPT_TRADE, { tradeId: model.tradeId })} onDecline={() => void dispatchGameAction(GAME_ACTION.DECLINE_TRADE, { tradeId: model.tradeId })} />;
  }

  if (!body) return null;
  return <DecisionShell model={model} onClose={close}>{body}</DecisionShell>;
}
