import { t } from "../../locales/i18n.js";
export default function ConnectionLostOverlay({ isHost, onReconnect }) {
  return (
    <div className="disov" style={{ zIndex: 200 }} role="alertdialog" aria-modal="true" aria-labelledby="connection-lost-title">
      <div className="disbox">
        <div aria-hidden="true" style={{ fontSize: 54 }}>🔌</div>
        <h2 id="connection-lost-title" className="f-t" style={{ color: "#e0b23a", margin: "10px 0" }}>
          {t("connection.lost")}
        </h2>
        <p style={{ fontSize: 14, marginBottom: 14 }}>
          {isHost
            ? t("connection.hostLost")
            : t("connection.guestLost")}
        </p>
        <button className="btn gold" type="button" onClick={onReconnect}>{t("connection.reconnect")}</button>
      </div>
    </div>
  );
}
