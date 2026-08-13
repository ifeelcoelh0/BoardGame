import { t } from "../../locales/i18n.js";
import "../../styles/app-shell.css";

export function SceneLoading({ label }) {
  return <div role="status" aria-live="polite" style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#0b0805", color: "#d6ac55", fontFamily: "serif" }}>{label}</div>;
}

export default function AppShell({ children, className = "", ...props }) {
  return <>
    <a className="rd-skip-link" href="#rd-primary-content">{t("a11y.skipToGame")}</a>
    <div id="rd-primary-content" tabIndex={-1} aria-label={t("a11y.primaryContent")} className={`rd${className ? ` ${className}` : ""}`} {...props}>{children}</div>
  </>;
}
