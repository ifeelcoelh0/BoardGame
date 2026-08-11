import { useEffect, useState } from "react";
import GameIcon from "../assets/GameIcon.jsx";
export function LobbyChat({ chat, players, sendChat }) {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [readCount, setReadCount] = useState(() => chat.length);
  const unread = isOpen ? 0 : Math.max(0, chat.length - readCount);

  useEffect(() => {
    if (isOpen) setReadCount(chat.length);
  }, [isOpen, chat.length]);

  const submit = (event) => {
    event.preventDefault();
    if (sendChat(value)) setValue("");
  };

  return (
    <section className={`rd-lobby-chat${isOpen ? " is-open" : " is-collapsed"}`} aria-label="Conversa da mesa">
      <button
        className="rd-lobby-chat__toggle"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Fechar conversa da mesa" : "Abrir conversa da mesa"}
        title="Conversa da mesa"
      >
        <GameIcon name="RDD_ChatTankard" size={32} alt="" />
        {unread > 0 && <span className="rd-lobby-chat__count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {isOpen && (
        <div className="rd-lobby-chat__panel">
          <header><small>VOZES À MESA</small><strong>Conversa</strong></header>
          <div className="rd-lobby-chat__messages">
            {chat.length === 0 && <p>A sala está silenciosa.</p>}
            {chat.slice(-5).map((message) => {
              const player = message.playerId
                ? players.find((candidate) => candidate.playerId === message.playerId)
                : players.find((candidate) => candidate.index === message.i);
              const author = player?.character?.n || message.name || "Reino";
              return <p key={message.id}><b>{author.split(" ").pop()}:</b> {message.tx}</p>;
            })}
          </div>
          <form onSubmit={submit}>
            <input value={value} maxLength={200} onChange={(event) => setValue(event.target.value)} placeholder="Escreve à mesa…" />
            <button type="submit" aria-label="Enviar mensagem">›</button>
          </form>
        </div>
      )}
    </section>
  );
}
