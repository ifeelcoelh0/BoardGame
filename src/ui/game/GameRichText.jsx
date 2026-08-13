import GameIcon from "../assets/GameIcon.jsx";
import { GAME_ACTION_ICONS, RESOURCE_ICON_BY_KEY } from "../../assets/gameUiIcons.js";
import { cleanGameUiText } from "./gameTextPresentation.js";

const TERM_ICON = Object.freeze({
  madeira: RESOURCE_ICON_BY_KEY.madeira,
  tijolo: RESOURCE_ICON_BY_KEY.tijolo,
  argila: RESOURCE_ICON_BY_KEY.tijolo,
  cavalo: RESOURCE_ICON_BY_KEY.cavalos,
  cavalos: RESOURCE_ICON_BY_KEY.cavalos,
  ouro: RESOURCE_ICON_BY_KEY.ouro,
  obsidiana: RESOURCE_ICON_BY_KEY.obsidiana,
  estrada: GAME_ACTION_ICONS.road,
  estradas: GAME_ACTION_ICONS.road,
  aldeia: GAME_ACTION_ICONS.village,
  aldeias: GAME_ACTION_ICONS.village,
  palácio: GAME_ACTION_ICONS.palace,
  palácios: GAME_ACTION_ICONS.palace,
  carta: GAME_ACTION_ICONS.card,
  cartas: GAME_ACTION_ICONS.card,
  wood: RESOURCE_ICON_BY_KEY.madeira,
  clay: RESOURCE_ICON_BY_KEY.tijolo,
  horse: RESOURCE_ICON_BY_KEY.cavalos,
  horses: RESOURCE_ICON_BY_KEY.cavalos,
  gold: RESOURCE_ICON_BY_KEY.ouro,
  obsidian: RESOURCE_ICON_BY_KEY.obsidiana,
  road: GAME_ACTION_ICONS.road,
  roads: GAME_ACTION_ICONS.road,
  village: GAME_ACTION_ICONS.village,
  villages: GAME_ACTION_ICONS.village,
  palace: GAME_ACTION_ICONS.palace,
  palaces: GAME_ACTION_ICONS.palace,
  card: GAME_ACTION_ICONS.card,
  cards: GAME_ACTION_ICONS.card,
});

const TERM_RE = /(madeira|tijolo|argila|cavalos?|ouro|obsidiana|estradas?|aldeias?|palácios?|cartas?|wood|clay|horses?|gold|obsidian|roads?|villages?|palaces?|cards?)/giu;

export default function GameRichText({ children, iconSize = 16 }) {
  const text = cleanGameUiText(children);
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(TERM_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const word = match[0];
    const icon = TERM_ICON[word.toLowerCase()];
    parts.push(
      <span className="rd-rich-term" key={`${index}-${word}`}>
        {icon && <GameIcon name={icon} size={iconSize} alt="" />}
        <span>{word}</span>
      </span>,
    );
    cursor = index + word.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
