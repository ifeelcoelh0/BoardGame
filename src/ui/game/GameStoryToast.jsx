import CharacterSprite from "../assets/CharacterSprite.jsx";
import GameIcon from "../assets/GameIcon.jsx";
import ResourceIcon from "./hud/ResourceIcon.jsx";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { cleanGameUiText } from "./gameTextPresentation.js";
import GameRichText from "./GameRichText.jsx";
import "../../styles/game-story-toast.css";

export default function GameStoryToast({ event, game, onDismiss }) {
  if (!event) return null;
  const player = Number.isSafeInteger(event.pi) ? game?.players?.[event.pi] : null;
  const characterId = player?.ch || null;
  const isDice = event.kind === "dados";
  return (
    <div className={`rd-story-toast${isDice ? " rd-story-toast--dice" : ""}`} role="status" onClick={onDismiss}>
      <div className="rd-story-toast__identity">
        {characterId ? <CharacterSprite character={characterId} size={68} /> : <GameIcon name={GAME_ACTION_ICONS.rollDice} size={42} alt="" />}
      </div>
      <div className="rd-story-toast__copy">
        <small>{isDice ? "Resultado dos dados" : "Acontecimento"}</small>
        <h3>{cleanGameUiText(event.title)}</h3>
        {event.text && <p><GameRichText>{event.text}</GameRichText></p>}
        {Array.isArray(event.gains) && event.gains.length > 0 && (
          <div className="rd-story-toast__gains">
            {event.gains.map((gain) => (
              <div key={gain.playerIndex}>
                <strong>{gain.playerName}</strong>
                <span>
                  {gain.resources.map(({ resource, amount }) => (
                    <i key={resource} title={`${amount} ${resource}`}>
                      <ResourceIcon resource={resource} size={22} />
                      <b>+{amount}</b>
                    </i>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
        {!isDice && Array.isArray(event.lines) && event.lines.length > 0 && (
          <div className="rd-story-toast__lines">{event.lines.map((line, index) => <span key={`${index}-${line}`}><GameRichText>{line}</GameRichText></span>)}</div>
        )}
      </div>
    </div>
  );
}
