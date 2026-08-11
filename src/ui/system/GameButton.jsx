export default function GameButton({
  variant = "secondary",
  size = "md",
  icon = null,
  eyebrow = null,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`rd-ui-button rd-ui-button--${variant} rd-ui-button--${size}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {icon && <span className="rd-ui-button__icon" aria-hidden="true">{icon}</span>}
      <span className="rd-ui-button__copy">
        {eyebrow && <small>{eyebrow}</small>}
        <strong>{children}</strong>
      </span>
    </button>
  );
}
