export default function CharacterSubtitle({ characterName = "", subtitle = null }) {
  if (!subtitle?.text) return null;
  return (
    <span
      className="rdb-character-subtitle"
      role="status"
      aria-live="polite"
      aria-label={`${characterName}: ${subtitle.text}`}
      data-subtitle-id={subtitle.id || undefined}
    >
      <span aria-hidden="true">“{subtitle.text}”</span>
    </span>
  );
}
