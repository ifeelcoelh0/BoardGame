import { RPG_ICONS } from "./iconManifest.js";
import { customGameIcon } from "./customGameIcons.js";

const RPG_ICON_BY_ID = new Map(RPG_ICONS.map((icon) => [icon.id, icon]));

export function gameIconEntry(name) {
  if (typeof name !== "string" || !name) return null;
  return customGameIcon(name) ?? RPG_ICON_BY_ID.get(name) ?? null;
}
