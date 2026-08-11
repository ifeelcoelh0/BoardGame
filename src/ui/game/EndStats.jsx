import { useState } from "react";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_SUMMARY_ICONS } from "../../assets/gameUiIcons.js";
import { CHARACTER_GLOW_COLORS as GLOW } from "../board/boardVisualConfig.js";
import { rankMetric } from "./endgame/gameEndgameModel.js";

const TABS = Object.freeze([["score","Placar"],["dice","Dados"],["harvest","Colheita"],["dragon","Dragão"],["trade","Comércio"]]);
function PlayerMark({ entry }) { return <i className="rd-endstats__mark" style={{ "--rd-player-color": GLOW[entry.characterId] || "#d0a14f" }} />; }
function Ranking({ model, values, label }) {
  const ranked = rankMetric(model, values); const maximum = Math.max(1, ...ranked.map((entry) => entry.value));
  return <section className="rd-endstats__metric"><h4>{label}</h4>{ranked.map((entry) => <div className="rd-endstats__metric-row" key={entry.playerIndex}><PlayerMark entry={entry}/><span>{entry.shortName}{entry.isLocal ? " · tu" : ""}</span><i><b style={{ width: `${entry.value / maximum * 100}%`, "--rd-player-color": GLOW[entry.characterId] || "#d0a14f" }} /></i><strong>{entry.value}</strong></div>)}</section>;
}
function Scoreboard({ model }) {
  return <div className="rd-endstats__scoreboard">{model.standings.map((entry, rank) => <article key={entry.playerIndex} className={rank === 0 ? "is-winner" : ""}><div className="rd-endstats__rank">{rank === 0 ? "♛" : `${rank + 1}º`}</div><PlayerMark entry={entry}/><div className="rd-endstats__player"><strong>{entry.shortName}{entry.isLocal ? " · tu" : ""}</strong><small>{entry.villages} aldeias · {entry.palaces} palácios · {entry.roads} estradas · {entry.troops} tropas · {entry.victoryCards} cartas PV</small></div><div className="rd-endstats__awards">{entry.hasLongestRoad && <span title="Estrada Mais Longa"><GameIcon name={GAME_SUMMARY_ICONS.road} size={20}/></span>}{entry.hasLargestArmy && <span title="Maior Exército"><GameIcon name={GAME_SUMMARY_ICONS.troops} size={20}/></span>}</div><strong className="rd-endstats__vp">{entry.victoryPoints} PV</strong></article>)}</div>;
}
function DiceStats({ model }) {
  const entries = Object.entries(model.dice.rolls).map(([n,c]) => [Number(n),c]); const maximum = Math.max(1,...entries.map(([,c])=>c));
  return <section className="rd-endstats__dice"><p>{model.dice.total} lançamentos · {model.dice.sevens} setes{model.warMode ? "" : ` · ${model.dice.disasters} desastres`}</p>{entries.map(([number,count]) => <div key={number} className={number===7?"is-seven":""}><strong>{number}</strong><i><b style={{width:`${count/maximum*100}%`}}/></i><span>{count}{model.dice.total ? ` · ${Math.round(count/model.dice.total*100)}%` : ""}</span></div>)}</section>;
}
export default function EndStats({ model }) {
  const [tab,setTab]=useState("score"); const dragonLabel=model.warMode?"Bênçãos":"Dragão"; const tabs=TABS.map(([id,label])=>id==="dragon"?[id,dragonLabel]:[id,label]);
  let content=<Scoreboard model={model}/>;
  if(tab==="dice") content=<DiceStats model={model}/>;
  if(tab==="harvest") content=<Ranking model={model} values={model.metrics.produced} label="Recursos colhidos com os dados"/>;
  if(tab==="dragon") content=model.warMode?<Ranking model={model} values={model.metrics.blessings} label="Bênçãos do Dragão recebidas"/>:<div className="rd-endstats__stack"><Ranking model={model} values={model.metrics.dragonBlocked} label="Recursos bloqueados pelo Dragão"/><Ranking model={model} values={model.metrics.robbedFrom} label="Cartas perdidas em roubos"/></div>;
  if(tab==="trade") content=<div className="rd-endstats__stack"><Ranking model={model} values={model.metrics.portTrades} label="Trocas em portos e banco"/><Ranking model={model} values={model.metrics.p2pTrades} label="Trocas entre jogadores"/></div>;
  return <section className="rd-endstats"><header><small>Crónicas finais</small><strong>Ronda {model.round}</strong></header><nav aria-label="Categorias das estatísticas finais">{tabs.map(([id,label])=><button type="button" key={id} className={tab===id?"is-active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav><div className="rd-endstats__content">{content}</div><p className="rd-endstats__note">As cartas secretas foram reveladas no final da partida.</p></section>;
}
