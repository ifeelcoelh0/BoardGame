import GameIcon from "../../../assets/GameIcon.jsx";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isCurrentRoomCode, normalizeRoomCode } from "../../../../game/roomCode.js";
import { BOOK_PAGE } from "../../bookPages.js";
import Leaf, { Opening } from "../Leaf.jsx";
import { t } from "../../../../locales/i18n.js";

function sanitizeRoomCodeInput(value) {
  return [...normalizeRoomCode(value)]
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .slice(0, ROOM_CODE_LENGTH)
    .join("");
}

function joinStatus({ busy, validCode, error, connSt }) {
  if (error) return { tone: "error", label: error };
  if (busy || connSt === "wait") return { tone: "working", label: t("lobby.connecting") };
  if (connSt === "err") return { tone: "error", label: t("lobby.connectionProblem") };
  if (validCode) return { tone: "ready", label: t("lobby.codeReady") };
  return { tone: "idle", label: t("lobby.codePrompt") };
}

export default function JoinPage({ foyer }) {
  const busy = foyer.connSt === "wait";
  const normalizedCode = normalizeRoomCode(foyer.codeIn);
  const validCode = isCurrentRoomCode(normalizedCode);
  const status = joinStatus({ busy, validCode, error: foyer.err, connSt: foyer.connSt });

  return (
    <>
      <Leaf page={BOOK_PAGE.JOIN} side="left" chapter={t("lobby.joinChapter")} title={t("lobby.realmCodeTitle")}>
        <div data-tutorial-anchor="join-panel">
          <Opening>{t("lobby.joinOpening")}</Opening>
          <label className="rd-lobby-book-ui__field-label" htmlFor="rd-room-code">{t("lobby.realmCodeTitle")}</label>
          <input
            id="rd-room-code"
            data-testid="room-code-input"
            className="rd-lobby-book-ui__code-input"
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            value={foyer.codeIn}
            onChange={(event) => {
              foyer.setErr("");
              foyer.setCodeIn(sanitizeRoomCodeInput(event.target.value));
            }}
            placeholder="ABCDEF"
            aria-label={t("lobby.realmCodeTitle")}
          />
          <div className={`rd-lobby-book-ui__status is-${status.tone}`} role="status" aria-live="polite">
            <span aria-hidden="true">{status.tone === "error" ? "!" : status.tone === "working" ? "…" : validCode ? "✓" : "i"}</span>
            <p>{status.label}</p>
          </div>
          <div className="rd-lobby-book-ui__actions is-single-column">
            <button data-testid="join-submit" className="is-primary" type="button" disabled={busy || !validCode} onClick={foyer.onJoin}>
              <GameIcon name="I_Key01" size={21} alt="" />
              {busy ? t("lobby.entering") : t("lobby.enterRealm")}
            </button>
          </div>
        </div>
      </Leaf>
      <Leaf page={BOOK_PAGE.JOIN} side="right" chapter={t("lobby.afterJoin")} title={t("lobby.afterJoinTitle")}>
        <ol className="rd-lobby-book-ui__rules-list is-emphasized">
          <li><strong>{t("lobby.reserveSeat")}</strong><span>{t("lobby.reserveSeatDesc")}</span></li>
          <li><strong>{t("lobby.chooseHouse")}</strong><span>{t("lobby.chooseHouseDesc")}</span></li>
          <li><strong>{t("lobby.readyConfirm")}</strong><span>{t("lobby.readyConfirmDesc")}</span></li>
          <li><strong>{t("lobby.hostStarts")}</strong><span>{t("lobby.hostStartsDesc")}</span></li>
        </ol>
        <section className="rd-lobby-book-ui__notice">
          <GameIcon name="I_Key02" size={28} alt="" />
          <p>{t("lobby.reconnectNotice")}</p>
        </section>
      </Leaf>
    </>
  );
}
