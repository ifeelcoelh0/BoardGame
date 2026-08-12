import GameEconomyStrip from "./GameEconomyStrip.jsx";
import GameDevelopmentHand from "./GameDevelopmentHand.jsx";
import GameMatchStrip from "./GameMatchStrip.jsx";
import "../../../styles/game-bottom-dock.css";

export default function GameBottomDock({
  code,
  round,
  dice,
  diceAnimationKey,
  resources,
  resourceDefinitions,
  resourceKeys,
  costs,
  showCosts = false,
  cards = [],
  characterId,
  onOpenCard,
  onOpenCards,
  embedded = false,
}) {
  return (
    <div className={`rd-game-bottom-dock${embedded ? " rd-game-bottom-dock--embedded" : ""}`} aria-label="Mão do jogador">
      <div className="rd-game-bottom-dock__match"><GameMatchStrip code={code} round={round} dice={dice} diceAnimationKey={diceAnimationKey} /></div>
      <div className="rd-game-bottom-dock__hand">
        <div className="rd-game-bottom-dock__economy">
          <GameEconomyStrip
            resources={resources}
            resourceDefinitions={resourceDefinitions}
            resourceKeys={resourceKeys}
            costs={costs}
            docked
            showCardSummary={false}
            showCosts={showCosts}
          />
        </div>
        <div className="rd-game-bottom-dock__cards">
          <GameDevelopmentHand
            cards={cards}
            characterId={characterId}
            onOpenCard={onOpenCard}
            onOpenList={onOpenCards}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
