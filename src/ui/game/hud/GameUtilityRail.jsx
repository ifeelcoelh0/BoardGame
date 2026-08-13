import { useEffect, useRef, useState } from "react";
import { EMOTES } from "../../../presentation/emoteCatalog.js";
import { findPlayerIndexById } from "../../../game/playerIdentity.js";
import { characterById as charOf } from "../../../game/characterCatalog.js";
import { CHARACTER_GLOW_COLORS as GLOW } from "../../board/boardVisualConfig.js";
import GameIcon from "../../assets/GameIcon.jsx";
import { GAME_UTILITY_ICONS } from "../../../assets/gameUiIcons.js";
import { HUD_UTILITY } from "./hudCatalog.js";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-utility-rail.css";

function chatAuthor(game, message) {
  const playerIndex = message?.playerId ? findPlayerIndexById(game, message.playerId) : message?.i;
  const player = Number.isSafeInteger(playerIndex) ? game?.players?.[playerIndex] : null;
  const character = player?.ch ? charOf(player.ch) : message?.ch ? charOf(message.ch) : null;
  return {
    name: character?.n?.split(" ").pop() || message?.name?.split(" ").pop() || "?",
    color: character ? (GLOW[character.id] || "#e9d8ae") : "#e9d8ae",
  };
}

const UTILITY_BUTTONS = Object.freeze([
  Object.freeze({ id: HUD_UTILITY.HISTORY, labelKey: "utility.history", icon: GAME_UTILITY_ICONS.history }),
  Object.freeze({ id: HUD_UTILITY.GRIMOIRE, labelKey: "utility.grimoire", icon: GAME_UTILITY_ICONS.grimoire }),
  Object.freeze({ id: HUD_UTILITY.OPTIONS, labelKey: "utility.options", icon: GAME_UTILITY_ICONS.options }),
]);

export default function GameUtilityRail({
  game,
  chat = [],
  sendChat,
  sendEmote,
  disabled = false,
  activeUtility = null,
  onOpenUtility,
  logCount = 0,
  embedded = false,
}) {
  const [expanded, setExpanded] = useState(embedded);
  const [socialMode, setSocialMode] = useState(null);
  const [text, setText] = useState("");
  const [emoteCooldown, setEmoteCooldown] = useState(false);
  const readIdsRef = useRef(new Set());
  const endRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const collapseTimerRef = useRef(null);

  useEffect(() => () => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  useEffect(() => {
    if (socialMode !== "chat") return;
    chat.forEach((message) => readIdsRef.current.add(message.id));
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat, socialMode]);

  const unread = socialMode === "chat" ? 0 : chat.filter((message) => !readIdsRef.current.has(message.id)).length;
  const openRail = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
    setExpanded(true);
  };
  const scheduleCollapse = () => {
    if (embedded || socialMode || activeUtility) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => { collapseTimerRef.current = null; setExpanded(false); }, 320);
  };

  const submitChat = () => {
    const clean = text.trim();
    if (!clean || !sendChat || !sendChat(clean)) return;
    setText("");
  };
  const fireEmote = (emoteId) => {
    if (emoteCooldown || disabled || !sendEmote || !sendEmote(emoteId)) return;
    setSocialMode(null);
    setEmoteCooldown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => { cooldownTimerRef.current = null; setEmoteCooldown(false); }, 2000);
  };
  const fireEmoteRef = useRef(fireEmote);
  fireEmoteRef.current = fireEmote;

  useEffect(() => {
    if (embedded) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "e" || event.key === "E") {
        openRail();
        setSocialMode((current) => current === "emotes" ? null : "emotes");
        return;
      }
      const index = Number.parseInt(event.key, 10) - 1;
      if (index >= 0 && index < EMOTES.length) fireEmoteRef.current(EMOTES[index].k);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded]);

  const toggleSocial = (mode) => {
    openRail();
    setSocialMode((current) => current === mode ? null : mode);
  };
  const openUtility = (id) => {
    openRail();
    setSocialMode(null);
    onOpenUtility?.(id);
  };

  return (
    <aside
      className={`rd-utility-rail${expanded || socialMode || activeUtility ? " is-expanded" : ""}${embedded ? " rd-utility-rail--embedded" : ""}`}
      onPointerEnter={openRail}
      onPointerLeave={scheduleCollapse}
      onFocusCapture={openRail}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleCollapse(); }}
      aria-label={t("utility.tools")}
    >
      {socialMode === "emotes" && (
        <section className="rd-utility-rail__popover rd-utility-rail__reactions" aria-label={t("utility.reactions")}>
          <header><small>{t("utility.realmGestures")}</small><strong>{t("utility.reactions")}</strong></header>
          <div className="rd-utility-rail__emote-grid">
            {EMOTES.map((emote, index) => (
              <button key={emote.k} type="button" disabled={disabled || emoteCooldown} title={`${emote.n} (${index + 1})`} onClick={() => fireEmote(emote.k)}>
                <GameIcon name={emote.icon} size={34} alt="" /><small>{index + 1}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {socialMode === "chat" && (
        <section className="rd-utility-rail__popover rd-utility-rail__chat" aria-label={t("utility.chat")}>
          <header><small>{t("utility.tableVoices")}</small><strong>{t("utility.realmConversation")}</strong></header>
          <div className="rd-utility-rail__chat-log" aria-live="polite">
            {chat.length === 0 && <p className="rd-utility-rail__empty">{t("utility.noMessages")}</p>}
            {chat.map((message) => {
              const author = chatAuthor(game, message);
              return <article key={message.id} className="rd-utility-rail__message"><b style={{ "--rd-social-author": author.color }}>{author.name}</b><span>{message.tx}</span></article>;
            })}
            <div ref={endRef} />
          </div>
          <div className="rd-utility-rail__composer">
            <input value={text} maxLength={200} disabled={disabled} placeholder={t("utility.messagePlaceholder")} aria-label={t("utility.messageAria")} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitChat(); if (event.key === "Escape") setSocialMode(null); }} />
            <button type="button" disabled={disabled || !text.trim()} onClick={submitChat} aria-label={t("utility.sendMessage")}>→</button>
          </div>
        </section>
      )}
      <nav className="rd-utility-rail__dock">
        <button type="button" className={socialMode === "emotes" ? "is-active is-primary" : "is-primary"} onClick={() => toggleSocial("emotes")} aria-label={t("utility.reactions")}><GameIcon name="RDD_Reactions" size={30} alt="" /><span>{t("utility.reactions")}</span></button>
        <button type="button" className={socialMode === "chat" ? "is-active is-primary" : "is-primary"} onClick={() => toggleSocial("chat")} aria-label={t("utility.conversation")}><GameIcon name="RDD_ChatTankard" size={30} alt="" /><span>{t("utility.conversation")}</span>{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</button>
        {UTILITY_BUTTONS.map((item) => (
          <button key={item.id} type="button" className={`${activeUtility === item.id ? "is-active " : ""}is-secondary`} onClick={() => openUtility(item.id)} aria-label={t(item.labelKey)}>
            <GameIcon name={item.icon} size={28} alt="" /><span>{t(item.labelKey)}</span>{item.id === HUD_UTILITY.HISTORY && logCount ? <i>{logCount}</i> : null}
          </button>
        ))}
      </nav>
    </aside>
  );
}
