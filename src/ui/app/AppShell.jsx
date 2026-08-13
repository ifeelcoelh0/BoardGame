export function SceneLoading({ label }) {
  return <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#0b0805", color: "#d6ac55", fontFamily: "serif" }}>{label}</div>;
}

export default function AppShell({ children, className = "", ...props }) {
  return <div className={`rd${className ? ` ${className}` : ""}`} {...props}>{children}</div>;
}
