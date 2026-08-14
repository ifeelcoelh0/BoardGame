import { useState } from "react";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_SUMMARY_ICONS } from "../../assets/gameUiIcons.js";
import { CHARACTER_GLOW_COLORS as GLOW } from "../board/boardVisualConfig.js";
import { rankMetric } from "./endgame/gameEndgameModel.js";
import { t } from "../../locales/i18n.js";

const TABS = Object.freeze([["score","end.tab.score"],["dice","end.tab.dice"],["harvest","end.tab.harvest"],["dragon","end.tab.dragon"],["trade","end.tab.trade"]]);
function PlayerMark({ entry }) { return <i className="rd-endstats__mark" style={{ "--rd-player-color": GLOW[entry.characterId] || "#d0a14f" }} />; }
function Ranking({ model, values, label }) {
  const ranked = rankMetric(model, values); const maximum = Math.max(1, ...ranked.map((entry) => entry.value));
  return <section className="rd-endstats__metric"><h4>{label}</h4>{ranked.map((entry) => <div className="rd-endstats__metric-row" key={entry.playerIndex}><PlayerMark entry={entry}/><span>{entry.shortName}{entry.isLocal ? ` · ${t("end.you")}` : ""}</span><i><b style={{ width: `${entry.value / maximum * 100}%`, "--rd-player-color": GLOW[entry.characterId] || "#d0a14f" }} /></i><strong>{entry.value}</strong></div>)}</section>;
}
const SCORE_SOURCE_KEYS = Object.freeze([
  ["villages", "end.source.villages"],
  ["palaces", "end.source.palaces"],
  ["longestRoad", "end.source.longestRoad"],
  ["largestArmy", "end.source.largestArmy"],
  ["occupations", "end.source.occupations"],
  ["glory", "end.source.glory"],
  ["secretVictoryPoints", "end.source.vpCards"],
]);

function ScoreSourceLine({ entry }) {
  const items = SCORE_SOURCE_KEYS
    .map(([source, key]) => [t(key), Number(entry.scoreSources?.[source]) || 0])
    .filter(([, points]) => points > 0)
    .map(([label, points]) => t("end.scoreSource", { label, points }));
  return <small>{items.length ? items.join(" · ") : t("end.noScoreSources")}</small>;
}

function Scoreboard({ model }) {
  return <div className="rd-endstats__scoreboard">{model.standings.map((entry, rank) => <article key={entry.playerIndex} className={rank === 0 ? "is-winner" : ""}><div className="rd-endstats__rank">{rank === 0 ? "♛" : `#${rank + 1}`}</div><PlayerMark entry={entry}/><div className="rd-endstats__player"><strong>{entry.shortName}{entry.isLocal ? ` · ${t("end.you")}` : ""}</strong><ScoreSourceLine entry={entry}/></div><div className="rd-endstats__awards">{entry.hasLongestRoad && <span title={t("end.longestRoad")}><GameIcon name={GAME_SUMMARY_ICONS.road} size={20}/></span>}{entry.hasLargestArmy && <span title={t("end.largestArmy")}><GameIcon name={GAME_SUMMARY_ICONS.troops} size={20}/></span>}</div><strong className="rd-endstats__vp">{entry.victoryPoints} {t("hud.vpAbbrev")}</strong></article>)}</div>;
}
function DiceStats({ model }) {
  const entries = Object.entries(model.dice.rolls).map(([n,c]) => [Number(n),c]); const maximum = Math.max(1,...entries.map(([,c])=>c));
  return <section className="rd-endstats__dice"><p>{t("end.rollSummary", { rolls: model.dice.total, sevens: model.dice.sevens })}{model.disasterMode ? ` · ${t("end.disasters", { count: model.dice.disasters })}` : ""}</p>{entries.map(([number,count]) => <div key={number} className={number===7?"is-seven":""}><strong>{number}</strong><i><b style={{width:`${count/maximum*100}%`}}/></i><span>{count}{model.dice.total ? ` · ${Math.round(count/model.dice.total*100)}%` : ""}</span></div>)}</section>;
}
export default function EndStats({ model }) {
  const [tab,setTab]=useState("score"); const dragonLabel=model.warMode?t("end.tab.blessings"):t("end.tab.dragon"); const tabs=TABS.map(([id,key])=>id==="dragon"?[id,dragonLabel]:[id,t(key)]);
  let content=<Scoreboard model={model}/>;
  if(tab==="dice") content=<DiceStats model={model}/>;
  if(tab==="harvest") content=<Ranking model={model} values={model.metrics.produced} label={t("end.harvestMetric")}/>;
  if(tab==="dragon") content=model.warMode?<Ranking model={model} values={model.metrics.blessings} label={t("end.blessingsMetric")}/>:<div className="rd-endstats__stack"><Ranking model={model} values={model.metrics.dragonBlocked} label={t("end.blockedMetric")}/><Ranking model={model} values={model.metrics.robbedFrom} label={t("end.robbedMetric")}/></div>;
  if(tab==="trade") content=<div className="rd-endstats__stack"><Ranking model={model} values={model.metrics.portTrades} label={t("end.portTradeMetric")}/><Ranking model={model} values={model.metrics.p2pTrades} label={t("end.playerTradeMetric")}/></div>;
  return <section className="rd-endstats"><header><small>{t("end.finalChronicles")}</small><strong>{t("end.round", { round: model.round })}</strong></header><nav aria-label={t("end.statsCategories")}>{tabs.map(([id,label])=><button type="button" key={id} className={tab===id?"is-active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav><div className="rd-endstats__content">{content}</div><p className="rd-endstats__note">{t("end.secretReveal")}</p></section>;
}
