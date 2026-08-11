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
});

const TERM_RE = /(madeira|tijolo|argila|cavalos?|ouro|obsidiana|estradas?|aldeias?|palácios?|cartas?)/giu;

export default function GameRichText({ children, iconSize = 16 }) {
  const text = cleanGameUiText(children);
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(TERM_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const word = match[0];
    const icon = TERM_ICON[word.toLocaleLowerCase("pt-PT")];
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
