import { useMemo, useState } from "react";
import GameIcon from "../../../assets/GameIcon.jsx";
import { BOOK_PAGE } from "../../bookPages.js";
import { savedRealmSummary } from "../../savedRealmsModel.js";
import Leaf, { Opening } from "../Leaf.jsx";
import { t } from "../../../../locales/i18n.js";

function SavedRealmDetails({ summary, onBack, onResume, onDelete }) {
  return (
    <div className="rd-lobby-book-ui__save-detail" data-testid={`saved-realm-details-${summary.code}`}>
      <button className="rd-lobby-book-ui__back-link" type="button" onClick={onBack}>{t("lobby.allArchives")}</button>
      <p className="rd-lobby-book-ui__save-state">{summary.statusLabel}</p>
      <dl className="rd-lobby-book-ui__facts">
        <div><dt>{t("lobby.mode")}</dt><dd>{summary.modeLabel}</dd></div>
        <div><dt>{t("lobby.players")}</dt><dd>{summary.playerCount ?? "—"}</dd></div>
        <div><dt>{t("lobby.round")}</dt><dd>{summary.round ?? "—"}</dd></div>
        <div><dt>{t("lobby.lastSave")}</dt><dd>{summary.updatedLabel}</dd></div>
        <div><dt>{t("lobby.version")}</dt><dd>{summary.appVersion ? `v${summary.appVersion}` : "—"}</dd></div>
      </dl>
      {!summary.valid && <p className="rd-lobby-book-ui__error">{t("lobby.invalidArchive", { reason: summary.reason || t("lobby.unknownError") })}</p>}
      <div className="rd-lobby-book-ui__actions is-single-column">
        <button className="is-primary" type="button" disabled={!summary.recoverable} onClick={onResume}>
          <GameIcon name="I_Chest01" size={21} alt="" /> {t("lobby.resume")}
        </button>
        <button className="is-leave" type="button" onClick={onDelete}>{t("lobby.deleteDevice")}</button>
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
      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="left" chapter={t("lobby.savedChapter")} title={t("lobby.archives")}>
        <div data-tutorial-anchor="archives-panel">
          <dl className="rd-lobby-book-ui__facts">
            <div><dt>{t("lobby.saved")}</dt><dd>{entries.length}</dd></div>
            <div><dt>{t("lobby.recoverable")}</dt><dd>{recoverable}</dd></div>
            <div><dt>{t("lobby.completed")}</dt><dd>{concluded}</dd></div>
          </dl>
          <Opening>
            {t("lobby.archiveOpening")}
          </Opening>
          <p className="rd-lobby-book-ui__folio-copy is-muted">
            {t("lobby.deleteLocalNote")}
          </p>
        </div>
      </Leaf>

      <Leaf page={BOOK_PAGE.SAVED_REALMS} side="right" chapter={selected ? t("lobby.archiveDetails") : t("lobby.recover")} title={selected ? t("lobby.realmCode", { code: selected.summary.code }) : t("lobby.chooseRealm")}>
        {!entries.length ? (
          <div className="rd-lobby-book-ui__empty-state">
            <GameIcon name="I_Chest01" size={48} alt="" />
            <strong>{t("lobby.noArchives")}</strong>
            <p>{t("lobby.savesAuto")}</p>
            <div className="rd-lobby-book-ui__actions is-single-column">
              <button className="is-primary" type="button" onClick={() => goTo(BOOK_PAGE.MODE)}>
                <GameIcon name="RDD_FoundRealm" size={21} alt="" /> {t("lobby.foundRealm")}
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
                  <strong>{t("lobby.realmCode", { code: summary.code })}</strong>
                  <em>{summary.modeLabel} · {summary.playerCount == null ? "—" : t("lobby.playerCount", { count: summary.playerCount })}</em>
                  <em>{summary.updatedLabel}</em>
                  {!summary.valid && <em className="is-error">{t("lobby.validationFailed", { reason: summary.reason || t("lobby.unknownError") })}</em>}
                </span>
                <div>
                  <button className="is-resume" type="button" disabled={!summary.recoverable} onClick={() => foyer.onResume(entry.code)}>{t("lobby.resume")}</button>
                  <button type="button" onClick={() => setSelectedCode(summary.code)}>{t("lobby.details")}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Leaf>
    </>
  );
}
