import { CHARACTERS } from "../../assets/characterManifest.js";
import { assetUrl } from "../../assets/assetUrl.js";

const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function getCharacterAsset(id) {
  return CHARACTER_BY_ID.get(id) ?? null;
}

export default function CharacterSprite({
  character,
  direction = "south",
  size = 96,
  title,
  alt,
  className = "",
  style,
}) {
  const entry = typeof character === "object" ? character : getCharacterAsset(character);

  if (!entry) {
    return null;
  }

  const safeDirection = entry.directions.includes(direction)
    ? direction
    : entry.defaultDirection;

  return (
    <img
      src={assetUrl(`${entry.basePath}/${safeDirection}.png`)}
      width={size}
      height={size}
      alt={alt ?? `${entry.name}, direção ${safeDirection}`}
      title={title ?? entry.name}
      className={className}
      draggable={false}
      loading="lazy"
      style={{
        display: "block",
        objectFit: "contain",
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}
