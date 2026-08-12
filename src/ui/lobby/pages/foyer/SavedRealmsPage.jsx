import { useMemo, useState } from "react";
import GameIcon from "../../../assets/GameIcon.jsx";
import { BOOK_PAGE } from "../../bookPages.js";
import { savedRealmSummary } from "../../savedRealmsModel.js";
import Leaf, { Opening } from "../Leaf.jsx";

function SavedRealmDetails({ summary, onBack, onResume, onDelete }) {
  return (
    <div className="rd-lobby-book-ui__save-detail" data-testid={`saved-realm-details-${summary.code}`}>
      <button className="rd-lobby-book-ui__back-link" type="button" onClick={onBack}>← Todos os arquivos</button>
      <p className="rd-lobby-book-ui__save-state">{summary.statusLabel}</p>
      <dl className="rd-lobby-book-ui__facts">
        <div><dt>Modo</dt><dd>{summary.modeLabel}</dd></div>
        <div><dt>Jogadores</dt><dd>{summary.playerCount ?? "—"}</dd></div>
        <div><dt>Ronda</dt><dd>{summary.round ?? "—"}</dd></div>
        <div><dt>Último save</dt><dd>{summary.updatedLabel}</dd></div>
        <div><dt>Versão</dt><dd>{summary.appVersion ? `v${summary.appVersion}` : "—"}</dd></div>
      </dl>
      {!summary.valid && <p className="rd-lobby-book-ui__error">Este arquivo não pode ser retomado: {summary.reason || "erro desconhecido"}.</p>}
      <div className="rd-lobby-book-ui__actions is-single-column">
        <button className="is-primary" type="button" disabled={!summary.recoverable} onClick={onResume}>
          <GameIcon name="I_Chest01" size={21} alt="" /> Retomar Reino
        </button>
        <button className="is-leave" type="button" onClick={onDelete}>Apagar deste dispositivo</button>
      </div>
    </div>
  );
}

export default function SavedRealmsPage({ foyer, goTo }) {
  const entries = foyer.savedRealms ?? [];
  const summaries = useMemo(() => entries.map((entry) => ({ entry, summary: savedRealmSummary(entry) })), [entries]);
  const recoverable = summaries.filter(({ summary }) => summary.recoverable).length;
  const concluded = summaries.filter(({ summary }) => summary.concluded).length;
  const [selectedCode, setSelectedCode] = useState(null);
  const selected = summaries.find(({ summary }) => summary.code === selectedCode) ?? null;

  return (
    <>
      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="left" chapter="REINOS GUARDADOS" title="Arquivos">
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>Guardados</dt><dd>{entries.length}</dd></div>
          <div><dt>Recuperáveis</dt><dd>{recoverable}</dd></div>
          <div><dt>Concluídos</dt><dd>{concluded}</dd></div>
        </dl>
        <Opening>
          Estes reinos pertencem apenas a este dispositivo. Aqui podes retomar uma sessão ou consultar os seus detalhes.
        </Opening>
        <p className="rd-lobby-book-ui__folio-copy is-muted">
          Apagar um arquivo daqui não apaga os dados dos outros jogadores.
        </p>
      </Leaf>

      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="right" chapter={selected ? "DETALHES DO ARQUIVO" : "RECUPERAR"} title={selected ? `Reino ${selected.summary.code}` : "Escolhe um reino"}>
        {!entries.length ? (
          <div className="rd-lobby-book-ui__empty-state">
            <GameIcon name="I_Chest01" size={48} alt="" />
            <strong>Ainda não existem reinos guardados.</strong>
            <p>As partidas que fundares neste dispositivo aparecerão aqui automaticamente.</p>
            <div className="rd-lobby-book-ui__actions is-single-column">
              <button className="is-primary" type="button" onClick={() => goTo(BOOK_PAGE.MODE)}>
                <GameIcon name="RDD_FoundRealm" size={21} alt="" /> Fundar um Reino
              </button>
            </div>
          </div>
        ) : selected ? (
          <SavedRealmDetails
            summary={selected.summary}
            onBack={() => setSelectedCode(null)}
            onResume={() => foyer.onResume(selected.summary.code)}
            onDelete={() => {
              foyer.onDeleteSave(selected.summary.code);
              setSelectedCode(null);
            }}
          />
        ) : (
          <div className="rd-lobby-book-ui__saved">
            {summaries.map(({ entry, summary }) => (
              <article key={summary.code} data-testid={`saved-realm-${summary.code}`} className={!summary.valid ? "is-invalid" : ""}>
                <span>
                  <small>{summary.statusLabel}</small>
                  <strong>Reino {summary.code}</strong>
                  <em>{summary.modeLabel} · {summary.playerCount ?? "—"} jogadores</em>
                  <em>{summary.updatedLabel}</em>
                  {!summary.valid && <em className="is-error">Não foi possível validar ({summary.reason || "erro desconhecido"}).</em>}
                </span>
                <div>
                  <button className="is-resume" type="button" disabled={!summary.recoverable} onClick={() => foyer.onResume(entry.code)}>Retomar</button>
                  <button type="button" onClick={() => setSelectedCode(summary.code)}>Detalhes</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Leaf>
    </>
  );
}
