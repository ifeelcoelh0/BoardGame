import GameIcon from "../../assets/GameIcon.jsx";
import ResourceCost from "./ResourceCost.jsx";
import ResourceIcon from "./ResourceIcon.jsx";
import { GAME_ACTION_ICONS } from "../../../assets/gameUiIcons.js";
import { BUILD_COSTS, PIECE_LIMITS, RESOURCE_KEYS } from "../../../game/resources.js";
import { MAX_WAGONS_PER_GAME, WAGON_COST } from "../../../game/explorationReducer.js";
import { isClassicMode, isExplorationMode, isWarMode } from "../../../game/gameModes.js";
import { GameUtilityPanelShell } from "./GameUtilityPanel.jsx";
import "../../../styles/game-grimoire.css";

const BUILD_ROWS = Object.freeze([
  Object.freeze({ id: "estrada", label: "Estrada", icon: GAME_ACTION_ICONS.road, detail: `0 pontos · liga o reino · máx. ${PIECE_LIMITS.estrada}` }),
  Object.freeze({ id: "aldeia", label: "Aldeia", icon: GAME_ACTION_ICONS.village, detail: `1 ponto · 1 recurso por produção · máx. ${PIECE_LIMITS.aldeia}` }),
  Object.freeze({ id: "palacio", label: "Palácio", icon: GAME_ACTION_ICONS.palace, detail: `2 pontos · 2 recursos por produção · máx. ${PIECE_LIMITS.palacio}` }),
  Object.freeze({ id: "carta", label: "Carta de Desenvolvimento", icon: GAME_ACTION_ICONS.card, detail: "Tropas, atributos, Monopólio, Trabalhadores ou Estradas" }),
]);

export default function GameGrimoirePanel({ game, player, onOpenLibrary, onClose }) {
  const exploration = isExplorationMode(game.mode);
  const war = isWarMode(game.mode);
  const classic = isClassicMode(game.mode);
  return (
    <GameUtilityPanelShell eyebrow="Consulta livre" title="Grimório do Reino" onClose={onClose}>
      <p className="rd-ui-copy rd-grimoire__intro">Custos, pontuação e leis da partida atual.</p>
      <div className="rd-grimoire__inventory">
        {RESOURCE_KEYS.map((resource) => <span key={resource}><ResourceIcon resource={resource} size={24}/><b>{player.res?.[resource] || 0}</b></span>)}
      </div>
      <div className="rd-grimoire__builds">
        {BUILD_ROWS.map((row) => <article key={row.id}><GameIcon name={row.icon} size={34}/><div><strong>{row.label}</strong><ResourceCost cost={BUILD_COSTS[row.id]}/><p>{row.detail}</p></div></article>)}
        {exploration && <article><GameIcon name={GAME_ACTION_ICONS.wagon} size={34}/><div><strong>Carruagem</strong><ResourceCost cost={WAGON_COST}/><p>Vazia move 2 hexágonos; com colonos move 1. Uma de cada vez, {MAX_WAGONS_PER_GAME} na partida.</p></div></article>}
      </div>
      <section className="rd-grimoire__rules"><h4>Pontos de Vitória</h4><p>Aldeia 1 · Palácio 2 · Estrada Mais Longa +2 · Maior Exército +2 · Carta de atributo +1 secreta.</p></section>
      <section className="rd-grimoire__rules"><h4>Trocas com o banco</h4><p>4:1 sempre · 3:1 num porto genérico · 2:1 num porto do recurso correspondente.</p></section>
      {!classic && <section className="rd-grimoire__rules"><h4>Desastres</h4><p>As saídas de 2 e 12 podem desencadear os presságios ativos do modo. O banner do acontecimento explica o efeito quando ocorre.</p></section>}
      {war && <section className="rd-grimoire__rules"><h4>Guerra dos Reinos</h4><p>As cartas de tropa destacam unidades no tabuleiro. Cada turno dispõe das ações militares permitidas pelo modo; ocupações, Troll e Guarda do Coração seguem as regras específicas da Guerra.</p></section>}
      {exploration && <section className="rd-grimoire__rules"><h4>Terras do Além</h4><p>As carruagens atravessam as Terras Ardidas, revelam território e podem transportar colonos para fundar aldeias distantes.</p></section>}
      <button className="btn sm ghost rd-grimoire__library" type="button" onClick={onOpenLibrary}>Ver todas as cartas do baralho</button>
    </GameUtilityPanelShell>
  );
}
