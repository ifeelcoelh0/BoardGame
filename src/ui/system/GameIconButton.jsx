export default function GameIconButton({ icon, label, active = false, badge = null, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rd-ui-icon-button${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      aria-pressed={props["aria-pressed"] ?? (active ? true : undefined)}
      title={props.title ?? label}
      {...props}
    >
      <span className="rd-ui-icon-button__icon" aria-hidden="true">{icon}</span>
      <span className="rd-ui-icon-button__label">{label}</span>
      {badge != null && <b className="rd-ui-icon-button__badge">{badge}</b>}
    </button>
  );
}
