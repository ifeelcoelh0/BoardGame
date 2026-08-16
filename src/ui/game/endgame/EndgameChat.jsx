import { useEffect, useRef, useState } from "react";
import { findPlayerIndexById } from "../../../game/playerIdentity.js";
import { characterById } from "../../../game/characterCatalog.js";
import { CHARACTER_GLOW_COLORS as GLOW } from "../../board/boardVisualConfig.js";
import GameIcon from "../../assets/GameIcon.jsx";
import { t } from "../../../locales/i18n.js";

function authorFor(game, message) {
  const index = message?.playerId ? findPlayerIndexById(game, message.playerId) : message?.i;
  const player = Number.isSafeInteger(index) ? game?.players?.[index] : null;
  const character = player?.ch ? characterById(player.ch) : message?.ch ? characterById(message.ch) : null;
  return {
    name: character?.n?.split(" ").pop() || message?.name?.split(" ").pop() || "?",
    color: character ? (GLOW[character.id] || "#e9d8ae") : "#e9d8ae",
  };
}

export default function EndgameChat({ game, chat = [], sendChat }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat.length]);

  const submit = (event) => {
    event?.preventDefault?.();
    const clean = text.trim();
    if (!clean || !sendChat || !sendChat(clean)) return;
    setText("");
  };

  return (
    <section className="rd-endgame-chat" aria-label={t("utility.chat")}>
      <header>
        <GameIcon name="RDD_ChatTankard" size={28} alt="" />
        <div><small>{t("end.afterMatch")}</small><strong>{t("utility.chat")}</strong></div>
      </header>
      <div className="rd-endgame-chat__messages" aria-live="polite">
        {chat.length === 0 && <p className="rd-endgame-chat__empty">{t("end.chatEmpty")}</p>}
        {chat.slice(-20).map((message) => {
          const author = authorFor(game, message);
          return <article key={message.id}><b style={{ "--rd-end-chat-author": author.color }}>{author.name}</b><span>{message.tx}</span></article>;
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit}>
        <input value={text} maxLength={200} placeholder={t("utility.messagePlaceholder")} aria-label={t("utility.messageAria")} onChange={(event) => setText(event.target.value)} />
        <button type="submit" disabled={!text.trim()} aria-label={t("utility.sendMessage")}>→</button>
      </form>
    </section>
  );
}
