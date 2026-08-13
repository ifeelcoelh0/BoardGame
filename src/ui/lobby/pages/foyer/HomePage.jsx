import { useMemo } from "react";
import GameIcon from "../../../assets/GameIcon.jsx";
import { BOOK_PAGE } from "../../bookPages.js";
import { savedRealmSummary } from "../../savedRealmsModel.js";
import Leaf, { Opening } from "../Leaf.jsx";
import { t } from "../../../../locales/i18n.js";

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
      <Leaf page={BOOK_PAGE.HOME} side="left" chapter={t("lobby.hall")} title={t("lobby.gameTitle")}>
        <Opening>{t("lobby.homeOpening")}</Opening>
        <dl className="rd-lobby-book-ui__facts">
          <div><dt>{t("lobby.players")}</dt><dd>2–4</dd></div>
          <div><dt>{t("lobby.houses")}</dt><dd>8</dd></div>
          <div><dt>{t("lobby.savedRealms")}</dt><dd>{savedCount}</dd></div>
        </dl>

        {latest ? (
          <section className="rd-lobby-book-ui__latest" aria-label={t("lobby.lastSession")}>
            <small>{t("lobby.lastSession")}</small>
            <strong>{t("lobby.realmCode", { code: latest.code })}</strong>
            <span>{latestSummary?.modeLabel} · {latestSummary?.updatedLabel}</span>
            <button type="button" disabled={!latestSummary?.recoverable} onClick={() => foyer.onResume(latest.code)}>
              {t("lobby.resumeLast")}
            </button>
          </section>
        ) : (
          <p className="rd-lobby-book-ui__folio-copy is-muted">
            {t("lobby.savesAuto")}
          </p>
        )}
      </Leaf>

      <Leaf page={BOOK_PAGE.HOME} side="right" chapter={t("lobby.start")} title={t("lobby.choosePath")}>
        <div className="rd-lobby-book-ui__pathways">
          <button data-testid="create-realm" className="is-primary" type="button" onClick={() => goTo(BOOK_PAGE.MODE)}>
            <GameIcon name="RDD_FoundRealm" size={34} alt="" />
            <span><strong>{t("lobby.foundRealm")}</strong><em>{t("lobby.foundRealmDesc")}</em></span>
          </button>
          <button data-testid="join-realm" type="button" onClick={() => { foyer.setErr(""); goTo(BOOK_PAGE.JOIN); }}>
            <GameIcon name="I_Key01" size={34} alt="" />
            <span><strong>{t("lobby.joinRealm")}</strong><em>{t("lobby.joinRealmDesc")}</em></span>
          </button>
          <button
            data-testid="open-saved-realms"
            type="button"
            disabled={savedCount === 0}
            onClick={() => { foyer.onRefreshSaved(); goTo(BOOK_PAGE.SAVED_REALMS); }}
          >
            <GameIcon name="I_Chest01" size={34} alt="" />
            <span>
              <strong>{t("lobby.resumeRealm")}</strong>
              <em>{savedCount ? t("lobby.savedCount", { count: savedCount }) : t("lobby.noSaved")}</em>
            </span>
          </button>
        </div>
        {foyer.err && <p className="rd-lobby-book-ui__error">{foyer.err}</p>}
      </Leaf>
    </>
  );
}
