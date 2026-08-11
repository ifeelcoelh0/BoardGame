export default function GameHeading({
  eyebrow,
  title,
  description,
  level = 2,
  align = "left",
  className = "",
}) {
  const Heading = `h${Math.min(6, Math.max(1, level))}`;
  return (
    <header className={`rd-ui-heading rd-ui-heading--${align}${className ? ` ${className}` : ""}`}>
      {eyebrow && <small>{eyebrow}</small>}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
    </header>
  );
}
