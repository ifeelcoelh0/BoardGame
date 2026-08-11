import { emoteById } from "../../../presentation/emoteCatalog.js";
import GameIcon from "../../assets/GameIcon.jsx";
import "../../../styles/game-emote-bubble.css";

export default function GameEmoteBubble({ emoteId }) {
  const emote = emoteById(emoteId);
  return (
    <div className="rd-social-bubble" aria-label={emote?.n || "Reação"}>
      {emote?.icon ? <GameIcon name={emote.icon} size={31} alt="" /> : <span>·</span>}
    </div>
  );
}
