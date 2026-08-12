import { useMemo } from "react";
import GameIcon from "../../../assets/GameIcon.jsx";
import { BOOK_PAGE } from "../../bookPages.js";
import { savedRealmSummary } from "../../savedRealmsModel.js";
import Leaf, { Opening } from "../Leaf.jsx";

export default function HomePage({ foyer, goTo }) {
  const entries = foyer.savedRealms ?? [];
  const savedCount = entries.length;
  const latest = useMemo(
    () => [...entries].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0] ?? null,
    [entries],
  );
  const latestSummary = latest ? savedRealmSummary(latest) : null;

  return (
    <>
      <Leaf page={BOOK_PAGE.HOME} side="left" chapter="O SALÃO" title="Reinos do Dragão">
        <Opening>Oito casas. Um trono. E um dragão que não escolhe lados.</Opening>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Jogadores</dt><dd>2–4</dd></div>
          <div><dt>Casas</dt><dd>8</dd></div>
          <div><dt>Reinos guardados</dt><dd>{savedCount}</dd></div>
        </dl>

        {latest ? (
          <section className="rd-lobby-book-ui__latest" aria-label="Última sessão">
            <small>ÚLTIMA SESSÃO</small>
            <strong>Reino {latest.code}</strong>
            <span>{latestSummary?.modeLabel} · {latestSummary?.updatedLabel}</span>
            <button type="button" disabled={!latestSummary?.recoverable} onClick={() => foyer.onResume(latest.code)}>
              Retomar última sessão
            </button>
          </section>
        ) : (
          <p className="rd-lobby-book-ui__folio-copy is-muted">
            As partidas que fundares neste dispositivo aparecerão aqui automaticamente.
          </p>
        )}
      </Leaf>

      <Leaf page={BOOK_PAGE.HOME} side="right" chapter="COMEÇAR" title="Escolhe o caminho">
        <div className="rd-lobby-book-ui__pathways">
          <button data-testid="create-realm" className="is-primary" type="button" onClick={() => goTo(BOOK_PAGE.MODE)}>
            <GameIcon name="RDD_FoundRealm" size={34} alt="" />
            <span><strong>Fundar um Reino</strong><em>Cria uma nova mesa e partilha o código.</em></span>
          </button>
          <button data-testid="join-realm" type="button" onClick={() => { foyer.setErr(""); goTo(BOOK_PAGE.JOIN); }}>
            <GameIcon name="I_Key01" size={34} alt="" />
            <span><strong>Entrar num Reino</strong><em>Usa o código recebido do anfitrião.</em></span>
          </button>
          <button
            data-testid="open-saved-realms"
            type="button"
            disabled={savedCount === 0}
            onClick={() => { foyer.onRefreshSaved(); goTo(BOOK_PAGE.SAVED_REALMS); }}
          >
            <GameIcon name="I_Chest01" size={34} alt="" />
            <span>
              <strong>Retomar um Reino</strong>
              <em>{savedCount ? `${savedCount} ${savedCount === 1 ? "reino guardado" : "reinos guardados"} neste dispositivo.` : "Nenhuma partida guardada neste dispositivo."}</em>
            </span>
          </button>
        </div>
        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
      </Leaf>
    </>
  );
}
