import { assetUrl } from "../../assets/assetUrl.js";
import { gameIconEntry } from "../../assets/gameIconCatalog.js";

export function getGameIcon(name) {
  return gameIconEntry(name);
}

export default function GameIcon({
  name,
  icon,
  size = 34,
  title,
  alt = "",
  className = "",
  style,
  onClick,
}) {
  const entry = icon && typeof icon === "object" ? icon : getGameIcon(name ?? icon);

  if (!entry) {
    return null;
  }

  return (
    <img
      src={assetUrl(entry.path)}
      width={size}
      height={size}
      alt={alt}
      title={title ?? entry.id}
      className={className}
      onClick={onClick}
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
