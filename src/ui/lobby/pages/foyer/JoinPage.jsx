import GameIcon from "../../../assets/GameIcon.jsx";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isCurrentRoomCode, normalizeRoomCode } from "../../../../game/roomCode.js";
import { BOOK_PAGE } from "../../bookPages.js";
import Leaf, { Opening } from "../Leaf.jsx";

function sanitizeRoomCodeInput(value) {
  return [...normalizeRoomCode(value)]
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .slice(0, ROOM_CODE_LENGTH)
    .join("");
}

function joinStatus({ busy, validCode, error, connSt }) {
  if (error) return { tone: "error", label: error };
  if (busy || connSt === "wait") return { tone: "working", label: "A estabelecer ligação…" };
  if (connSt === "err") return { tone: "error", label: "A ligação encontrou um problema." };
  if (validCode) return { tone: "ready", label: "Código completo. Pronto para entrar." };
  return { tone: "idle", label: "Introduz as seis letras do código." };
}

export default function JoinPage({ foyer }) {
  const busy = foyer.connSt === "wait";
  const normalizedCode = normalizeRoomCode(foyer.codeIn);
  const validCode = isCurrentRoomCode(normalizedCode);
  const status = joinStatus({ busy, validCode, error: foyer.err, connSt: foyer.connSt });

  return (
    <>
      <Leaf page={BOOK_PAGE.JOIN} side="left" chapter="ENTRAR NUM REINO" title="Código do reino">
        <Opening>Introduz o código de seis letras recebido de quem fundou o reino.</Opening>
        <label className="rd-lobby-book-ui__field-label" htmlFor="rd-room-code">Código do reino</label>
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
          aria-label="Código do reino"
        />
        <div className={`rd-lobby-book-ui__status is-${status.tone}`} role="status" aria-live="polite">
          <span aria-hidden="true">{status.tone === "error" ? "!" : status.tone === "working" ? "…" : validCode ? "✓" : "i"}</span>
          <p>{status.label}</p>
        </div>
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button data-testid="join-submit" className="is-primary" type="button" disabled={busy || !validCode} onClick={foyer.onJoin}>
            <GameIcon name="I_Key01" size={21} alt="" />
            {busy ? "A entrar…" : "Entrar no Reino"}
          </button>
        </div>
      </Leaf>
      <Leaf page={BOOK_PAGE.JOIN} side="right" chapter="O QUE ACONTECE DEPOIS" title="Ao entrar">
        <ol className="rd-lobby-book-ui__rules-list is-emphasized">
          <li><strong>Reservamos o teu lugar.</strong><span>A mesa passa a contar contigo.</span></li>
          <li><strong>Escolhes a tua casa.</strong><span>A parede das casas abre assim que entrares.</span></li>
          <li><strong>Confirmas quando estiveres pronto.</strong><span>O livro mostra o estado da mesa.</span></li>
          <li><strong>O anfitrião inicia a partida.</strong><span>Quando os lugares necessários estiverem prontos.</span></li>
        </ol>
        <section className="rd-lobby-book-ui__notice">
          <GameIcon name="I_Key02" size={28} alt="" />
          <p>Se perderes a ligação, tentaremos recuperar automaticamente o teu lugar durante a janela de reconexão.</p>
        </section>
      </Leaf>
    </>
  );
}
