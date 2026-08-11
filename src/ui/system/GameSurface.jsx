export default function GameSurface({
  as: Element = "section",
  material = "oak",
  emphasis = "ambient",
  className = "",
  children,
  ...props
}) {
  return (
    <Element
      className={`rd-ui-surface rd-ui-surface--${material} rd-ui-emphasis--${emphasis}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </Element>
  );
}
