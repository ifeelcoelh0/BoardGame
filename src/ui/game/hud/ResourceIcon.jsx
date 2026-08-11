import GameIcon from "../../assets/GameIcon.jsx";
import { RESOURCE_ICON_BY_KEY } from "../../../assets/gameUiIcons.js";

export default function ResourceIcon({ resource, size = 22, title, className = "" }) {
  const icon = RESOURCE_ICON_BY_KEY[resource];
  if (!icon) return null;
  return <GameIcon name={icon} size={size} title={title} className={className} />;
}
