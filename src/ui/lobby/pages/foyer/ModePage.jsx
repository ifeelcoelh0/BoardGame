import { useState } from "react";
import GameIcon from "../../../assets/GameIcon.jsx";
import { BOOK_PAGE } from "../../bookPages.js";
import { LOBBY_MODES } from "../../lobbyModeCatalog.js";
import Leaf from "../Leaf.jsx";

export default function ModePage({ foyer }) {
  const busy = foyer.connSt === "wait";
  const [selectedModeId, setSelectedModeId] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedMode = LOBBY_MODES.find((mode) => mode.id === selectedModeId) ?? null;

  return (
    <>
      <Leaf page={BOOK_PAGE.MODE} side="left" chapter="FUNDAR REINO" title="Modo de jogo">
        <div className="rd-lobby-book-ui__modes">
          {LOBBY_MODES.map((mode) => {
            const selected = mode.id === selectedModeId;
            return (
              <button
                data-testid={`mode-${mode.id}`}
                key={mode.id}
                type="button"
                className={selected ? "is-selected" : ""}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => setSelectedModeId(mode.id)}
              >
                <span aria-hidden="true"><GameIcon name={mode.icon} size={34} alt="" /></span>
                <span><strong>{mode.name}</strong><em>{mode.description}</em></span>
                <b className="rd-lobby-book-ui__mode-check" aria-hidden="true">{selected ? "✓" : ""}</b>
              </button>
            );
          })}
        </div>
      </Leaf>

      <Leaf page={BOOK_PAGE.MODE} side="right" chapter="O REINO" title={selectedMode?.name ?? "Escolhe um modo"}>
        {selectedMode ? (
          <>
            <p className="rd-lobby-book-ui__mode-intro">{selectedMode.description}</p>
            <dl className="rd-lobby-book-ui__facts is-mode-detail">
              <div><dt>Jogadores</dt><dd>2–4</dd></div>
              <div><dt>Duração</dt><dd>{selectedMode.duration}</dd></div>
              <div><dt>Complexidade</dt><dd>{selectedMode.complexity}</dd></div>
              <div><dt>Dragão</dt><dd>{selectedMode.dragon}</dd></div>
              <div><dt>Guerra</dt><dd>{selectedMode.war}</dd></div>
              <div><dt>Exploração</dt><dd>{selectedMode.exploration}</dd></div>
            </dl>
            <section className="rd-lobby-book-ui__ideal">
              <small>IDEAL PARA</small>
              <p>{selectedMode.ideal}</p>
            </section>
          </>
        ) : (
          <div className="rd-lobby-book-ui__mode-empty">
            <GameIcon name="I_Map" size={46} alt="" />
            <p>Escolhe um modo na página esquerda para conhecer as suas regras e fundar o reino.</p>
          </div>
        )}

        <button className="rd-lobby-book-ui__advanced-toggle" type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
          <span aria-hidden="true">{advancedOpen ? "▾" : "▸"}</span> Opções avançadas
        </button>
        {advancedOpen && (
          <button className="rd-lobby-book-ui__setting" type="button" onClick={() => foyer.setTestSel(!foyer.testSel)}>
            Modo de teste: <b>{foyer.testSel ? "ligado" : "desligado"}</b>
            <span>99 recursos iniciais e partida a partir de 2 jogadores.</span>
          </button>
        )}

        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
        <div className="rd-lobby-book-ui__actions is-single-column">
          <button
            data-testid="create-realm-submit"
            className="is-primary"
            type="button"
            disabled={busy || !selectedMode}
            onClick={() => selectedMode && foyer.onCreate(selectedMode.id)}
          >
            <GameIcon name="RDD_FoundRealm" size={21} alt="" />
            {busy ? "A fundar…" : "Fundar Reino"}
          </button>
        </div>
      </Leaf>
    </>
  );
}
