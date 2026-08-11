import { GAME_ACTION } from "../game/gameProtocol.js";
import { RESOURCE_DEFINITIONS as RES } from "../game/resources.js";
import { DISASTER_DEFINITIONS as DISASTERS } from "../game/disasterReducer.js";
import { WAR_UNIT_ICONS as UICON } from "../game/warReducer.js";
import { isWarMode as GUERRA } from "../game/gameModes.js";
import { makeBoardGraph as makeGraph } from "../game/boardGeometry.js";
import { characterById } from "../game/characterCatalog.js";
import {
  appendGameLog,
  setGameAward,
  setGameCardReveal,
  setGameDisaster,
  setGameStory,
} from "../game/presentationState.js";
import { terrainLabel, WAR_UNIT_LABELS } from "./gameLabels.js";

const FLAV = Object.freeze({
  madeira: (amount) => "abateu " + amount + (amount > 1 ? " troncos" : " tronco") + " na Floresta Sombria 🪵",
  tijolo: (amount) => "moldou " + amount + (amount > 1 ? " tijolos" : " tijolo") + " nos Poços de Argila 🧱",
  cavalos: (amount) => "criou " + (amount > 1 ? amount + " cavalos novos" : "mais um cavalo") + " nos seus estábulos 🐎",
  ouro: (amount) => "extraiu " + amount + (amount > 1 ? " pepitas" : " pepita") + " de ouro das grutas 🪙",
  obsidiana: (amount) => "arrancou " + amount + (amount > 1 ? " lascas" : " lasca") + " de obsidiana às montanhas ⚫",
});

const WAR_FLAVOUR = Object.freeze([
  "O corvo já circula.",
  "A terra bebeu sangue hoje.",
  "Os bardos vão cantar isto.",
  "Nem os deuses piscaram.",
  "A guerra não conhece piedade.",
]);

export function createGamePresenter({ random = Math.random, now = Date.now } = {}) {
  const eventIdOptions = { random, now };
  const pick = (values) => values[Math.floor(random() * values.length)];
  const pname = (game, playerIndex) => characterById(game.players[playerIndex].ch)?.n || game.players[playerIndex].ch;
  const addLog = (game, message, playerIndex = null, meta = null) => appendGameLog(game, message, playerIndex, {
    ...eventIdOptions,
    ...(meta || {}),
  });
  const logEvent = (game, message, playerIndex = null, emphasis = "important", audio = null) => addLog(game, message, playerIndex, { kind: "event", emphasis, ...(audio ? { audio } : {}) });
  const logWar = (game, message, playerIndex = null, audio = null) => addLog(game, message, playerIndex, { kind: "war", ...(audio ? { audio } : {}) });
  const logTrade = (game, message, playerIndex = null, audio = null) => addLog(game, message, playerIndex, { kind: "trade", ...(audio ? { audio } : {}) });
  const logExploration = (game, message, playerIndex = null, audio = null) => addLog(game, message, playerIndex, { kind: "exploration", ...(audio ? { audio } : {}) });
  const speak = (game, playerIndex) => {
    const quotes = characterById(game.players[playerIndex].ch)?.q || [];
    if (quotes.length) addLog(game, "“" + pick(quotes) + "”", playerIndex);
  };
  const sfxCue = (sfx) => ({ sfx });
  const voiceCue = (game, playerIndex, event, sfx = null) => {
    const character = game.players?.[playerIndex]?.ch;
    if (!character) return sfx ? { sfx } : null;
    return { ...(sfx ? { sfx } : {}), voice: { character, event } };
  };
  const troopCue = (subtype) => ({ troop: subtype });
  const unitSfx = (subtype) => subtype === "arqueiro" ? "bowP" : subtype === "catapulta" ? "catP" : "swordP";
  const fireEv = (game, kind, playerIndex, title, text, lines, extra = null) => setGameStory(game, {
    kind,
    pi: playerIndex,
    title,
    text,
    lines: lines || null,
    ...(extra || {}),
  }, eventIdOptions);
  const revealDev = (game, playerIndex, card) => {
    if (card) setGameCardReveal(game, { pi: playerIndex, card }, eventIdOptions);
  };
  const fireAwardEv = (game, kind, playerIndex, previousPlayerIndex, value) => setGameAward(game, {
    kind,
    pi: playerIndex,
    prev: previousPlayerIndex == null ? null : previousPlayerIndex,
    value,
  }, eventIdOptions);
  const tname = (type) => WAR_UNIT_LABELS[type].replace(/^\S+ /, "");
  const WFLAV = WAR_FLAVOUR;
  const TROOPS = WAR_UNIT_LABELS;

  function presentExplorationEvent(g, gr, event) {
      if (!event)
          return;
      if (event.type === "WAGON_BUILT") {
          logExploration(g, "🛞 " + pname(g, event.actorIndex) + " atrelou " + (event.lastAvailable ? "a sua última carruagem" : "uma carruagem") + ".", event.actorIndex, sfxCue("build"));
          return;
      }
      if (event.type === "WAGON_MOVED" && event.reveal) {
          const terrain = terrainLabel(event.reveal.terrain);
          const resource = event.reveal.resource;
          if (resource)
              logExploration(g, "🗺️ " + pname(g, event.actorIndex) + " descobriu " + terrain + " e trouxe 1 " + RES[resource].n + " " + RES[resource].i + ".", event.actorIndex, sfxCue("coin"));
          else
              logExploration(g, "🗺️ " + pname(g, event.actorIndex) + " descobriu " + terrain + ". Não há aqui nada que preste.", event.actorIndex);
          event.reveal.ports.forEach(() => logExploration(g, "⚓ " + pname(g, event.actorIndex) + " encontrou um porto na costa distante!", event.actorIndex));
          return;
      }
      if (event.type === "COLONISTS_LOADED") {
          logExploration(g, "👪 " + pname(g, event.actorIndex) + " carregou colonos e partiu para o desconhecido.", event.actorIndex);
          return;
      }
      if (event.type === "REMOTE_VILLAGE_FOUNDED") {
          logExploration(g, "🏠 " + pname(g, event.actorIndex) + " desmantelou a carruagem e ergueu com ela uma aldeia em terras distantes!", event.actorIndex, sfxCue("build"));
          speak(g, event.actorIndex);
      }
  }

  function warKillLog(g, me, aT, dT, vi) {
      logWar(g, UICON[aT] + " " + TROOPS[aT].replace(/^\S+ /, "") + " de " + pname(g, me) + " abateu " + UICON[dT] + " de " + pname(g, vi) + "!", me, sfxCue(unitSfx(aT)));
  }

  function siegeThreatText(g, gr, hk) {
      const u = g.units[hk];
      if (!u || u.t !== "catapulta")
          return null;
      const alvos = gr.hexMap[hk].corners.filter((v) => {
          const b = g.builds[v];
          return b && b.p !== u.p && (g.occ || {})[v] == null;
      }).map((v) => (g.builds[v].t === 2 ? "o pal\xE1cio" : "a aldeia") + " de " + pname(g, g.builds[v].p));
      if (!alvos.length)
          return null;
      return "\u{1FAA8} CERCO ARMADO: a catapulta de " + pname(g, u.p) + " est\xE1 \xE0s portas d" + (alvos.length > 1 ? "e: " + alvos.join(", ") : alvos[0].slice(1)) + "! Cai no in\xEDcio do pr\xF3ximo turno dela \u2014 s\xF3 um cavaleiro a pode travar.";
  }

  function warEv(g, me, title, text, siege) {
      fireEv(g, "char", me, title, text + (siege ? " " + siege : "") + " \u201C" + pick(WFLAV) + "\u201D");
  }

  function presentScoringEvents(g, events) {
      (events || []).forEach((event) => {
          if (event.type === "LONGEST_ROAD_CHANGED" && event.playerIndex != null) {
              logEvent(g, "🛤️ " + pname(g, event.playerIndex) + " reclama a Estrada Mais Longa (+2 PV)!", event.playerIndex);
              fireAwardEv(g, "road", event.playerIndex, event.previousPlayerIndex, event.length);
              return;
          }
          if (event.type === "LARGEST_ARMY_CHANGED" && event.playerIndex != null) {
              logEvent(g, "🎖️ " + pname(g, event.playerIndex) + " comanda o Maior Exército (+2 PV)!", event.playerIndex);
              fireAwardEv(g, "army", event.playerIndex, event.previousPlayerIndex, event.size);
              return;
          }
          if (event.type === "GAME_WON") {
              const prefix = event.reason === "ROUND_LIMIT" ? "👑 Fim das rondas! " : "👑 ";
              const verb = event.reason === "ROUND_LIMIT" ? " venceu com " : " conquistou o reino com ";
              logEvent(g, prefix + pname(g, event.playerIndex) + verb + event.score + " pontos!", event.playerIndex, "important", voiceCue(g, event.playerIndex, "victory", "fanfare"));
              if (event.reason === "ROUND_LIMIT" && (event.tiedPlayerIndices || []).length > 1)
                  logEvent(g, "⚖️ Empate em pontos: prevaleceu a ordem estável dos lugares do reino.", event.playerIndex);
          }
      });
  }

  function disasterDetails(g, event) {
      const det = [];
      event.effects.forEach((effect) => {
          if (effect.type === "RESOURCE_LOST") {
              const icon = RES[effect.resource].i;
              if (effect.reason === "GREED")
                  det.push(pname(g, effect.playerIndex) + " perdeu 1" + icon + " para o saque.");
              else if (effect.reason === "TSUNAMI")
                  det.push(pname(g, effect.playerIndex) + " não tinha portos — as ondas levaram-lhe 1" + icon + " da costa.");
              else
                  det.push(pname(g, effect.playerIndex) + " pagou 1" + icon + " de tributo.");
          }
          else if (effect.type === "EMPTY_RESOURCES") {
              if (effect.reason === "GREED")
                  det.push(pname(g, effect.playerIndex) + " tinha os cofres vazios — nada a saquear.");
              else if (effect.reason === "TRIBUTE")
                  det.push(pname(g, effect.playerIndex) + " tinha os cofres vazios — nada a tributar.");
          }
          else if (effect.type === "RESOURCE_GRANTED") {
              const icon = RES[effect.resource].i;
              if (effect.source === "GREED_LOOT")
                  det.push(pname(g, effect.playerIndex) + " ficou com 1" + icon + " do saque.");
              else
                  det.push("O saque não chegou a " + pname(g, effect.playerIndex) + " — o banco compensou com 1" + icon + ".");
          }
          else if (effect.type === "QUARANTINED")
              det.push("O exército de " + pname(g, effect.playerIndex) + " está de quarentena — sem jogar tropas por 2 turnos.");
          else if (effect.type === "PORT_DISABLED")
              det.push(pname(g, effect.playerIndex) + " perdeu um porto (3 turnos).");
          else if (effect.type === "PORT_CHOICE_REQUIRED")
              det.push(pname(g, effect.playerIndex) + " vai escolher que porto sacrificar.");
          else if (effect.type === "COAST_UNTOUCHED")
              det.push(pname(g, effect.playerIndex) + " não tinha portos nem provisões — as ondas passaram ao largo.");
      });
      if (event.disasterType === "tsunami" && !event.effects.some((effect) => ["RESOURCE_LOST", "PORT_DISABLED", "PORT_CHOICE_REQUIRED"].includes(effect.type)))
          det.push("As ondas rebentaram em costas desertas.");
      if (event.disasterType === "tributo")
          det.push("Os protegidos vão receber 2 recursos à escolha.");
      return det;
  }

  function presentDevelopmentCardPlay(g, event) {
      const me = event.actorIndex;
      const card = event.card;
      const details = event.details || {};
      if (card.kind === "tropa") {
          if (GUERRA(g.mode))
              addLog(g, TROOPS[card.sub] + " de " + pname(g, me) + " marcha para o campo de batalha!", me, { audio: troopCue(card.sub) });
          else
              addLog(g, TROOPS[card.sub] + " de " + pname(g, me) + " marcha! O Dragão vai ser guiado.", me, { audio: troopCue(card.sub) });
          if (details.trinityCompleted) {
              addLog(g, "⚜️ " + pname(g, me) + " reuniu a TRINDADE DAS ARMAS! Os seus domínios estão para sempre a salvo do Dragão.", me);
              speak(g, me);
              fireEv(g, "char", me, "Trindade das Armas!", "“" + pick(characterById(g.players[me].ch).q) + "” Os domínios de " + pname(g, me) + " ficam para sempre a salvo do Dragão!");
          }
          presentScoringEvents(g, details.scoringEvents || []);
          return;
      }
      if (card.kind === "estradas") {
          addLog(g, "🛤️ " + pname(g, me) + " invocou o Construtor de Estradas (2 grátis).", me, { audio: sfxCue("card") });
          return;
      }
      if (card.kind === "marcha") {
          addLog(g, "⚡ Marcha Forçada! " + pname(g, me) + " ganha +1 ação militar neste turno.", me, { audio: sfxCue("march") });
          return;
      }
      if (card.kind === "espiao") {
          addLog(g, "🕵️ " + pname(g, me) + " enviou um espião à corte de " + pname(g, details.targetIndex) + "…", me, { audio: sfxCue("card") });
          return;
      }
      if (card.kind === "monopolio") {
          const res = details.resource;
          addLog(g, "👑 MONOPÓLIO! " + pname(g, me) + " confiscou todo o " + RES[res].n + " (" + details.total + ").", me, { audio: sfxCue("card") });
          fireEv(g, "char", me, "Monopólio!", "“Todo o " + RES[res].n + " do reino... é MEU!” (" + details.total + " cartas confiscadas)");
          return;
      }
      if (card.kind === "descoberta") {
          addLog(g, "⚒️ Os trabalhadores de " + pname(g, me) + " trouxeram " + RES[details.firstResource].i + RES[details.secondResource].i + ".", me, { audio: sfxCue("build") });
      }
  }

  function presentTradeEvent(g, event) {
      if (event.type === "BANK_TRADE_COMPLETED") {
          logTrade(g, "⚖️ " + pname(g, event.actorIndex) + " trocou " + event.ratio + RES[event.give].i + " por 1" + RES[event.get].i + " no banco.", event.actorIndex, sfxCue("deal"));
          return;
      }
      if (event.type === "PLAYER_TRADE_PROPOSED") {
          logTrade(g, "🤝 " + pname(g, event.actorIndex) + " propôs uma troca a " + (event.targetIndex === "all" ? "todos os reinos" : pname(g, event.targetIndex)) + ".", event.actorIndex, sfxCue("tradeOffer"));
          return;
      }
      if (event.type === "PLAYER_TRADE_ACCEPTED") {
          logTrade(g, "🤝 " + pname(g, event.actorIndex) + " aceitou a troca de " + pname(g, event.proposerIndex) + ".", event.actorIndex, voiceCue(g, event.actorIndex, "trade_done", "deal"));
          return;
      }
      if (event.type === "PLAYER_TRADE_DECLINED") {
          logTrade(g, "✋ " + pname(g, event.actorIndex) + " recusou a troca.", event.actorIndex, sfxCue("bad"));
          if (event.closed && event.broadcast)
              logTrade(g, "✋ Ninguém aceitou a proposta.");
          return;
      }
      if (event.type === "PLAYER_TRADE_CANCELLED") {
          logTrade(g, "✋ " + pname(g, event.actorIndex) + " cancelou a proposta de troca.", event.actorIndex);
          return;
      }
      if (event.type === "PLAYER_TRADE_CANCELLED_DISCONNECT") {
          logTrade(g, "🔌 A proposta de " + pname(g, event.actorIndex) + " foi cancelada porque o proponente perdeu a ligação.", event.actorIndex);
          return;
      }
      if (event.type === "PLAYER_TRADE_DECLINED_DISCONNECT") {
          logTrade(g, "🔌 " + pname(g, event.actorIndex) + " saiu da proposta de troca ao perder a ligação.", event.actorIndex);
          if (event.closed && event.broadcast)
              logTrade(g, "✋ A proposta terminou porque já não existem destinatários disponíveis.");
      }
  }

  function presentOccupationReleases(g, releases) {
      (releases || []).forEach((release) => {
          const what = release.buildingType === 2 ? "O palácio" : "A aldeia";
          logWar(g, "🕊️ " + what + " de " + pname(g, release.ownerIndex) + " foi " + (release.buildingType === 2 ? "LIBERTADO" : "LIBERTADA") + "! O cerco quebrou.", release.ownerIndex, sfxCue("bell"));
          fireEv(g, "char", release.ownerIndex, "🕊️ Libertação!", what + " de " + pname(g, release.ownerIndex) + " voltou às mãos do povo — o cerco quebrou e a produção regressa à dona.");
      });
  }

  function presentWarResurrections(g, resurrections) {
      (resurrections || []).forEach((rise) => {
          if (rise.resurrected)
              logWar(g, "💀 A tropa de " + pname(g, rise.playerIndex) + " reergueu-se em OSSO junto ao bastião!", rise.playerIndex);
          else
              logWar(g, "💀 Os ossos de " + pname(g, rise.playerIndex) + " não encontraram lugar junto ao bastião…", rise.playerIndex);
      });
  }

  function presentWarActionEvent(g, gr, event) {
      if (!event)
          return;
      const me = event.actorIndex;
      if (event.type === "TROOP_RECRUITED") {
          logWar(g, UICON[event.subtype] + " " + pname(g, me) + " recrutou " + tname(event.subtype) + "! Escolhe onde destacar.", me);
          return;
      }
      if (event.type === "UNIT_DEPLOYED") {
          if (event.defeatedRaider)
              logWar(g, "🗡️ " + pname(g, me) + " destacou tropa sobre um saqueador e esmagou-o!", me);
          logWar(g, UICON[event.subtype] + " " + pname(g, me) + " destacou " + tname(event.subtype) + " junto ao seu bastião.", me, sfxCue(unitSfx(event.subtype)));
          const siege = siegeThreatText(g, gr, event.hex);
          if (siege)
              warEv(g, me, "🪨 Cerco Armado!", siege, null);
          presentOccupationReleases(g, event.occupationReleases);
          return;
      }
      if (event.type === "UNIT_MOVED") {
          logWar(g, UICON[event.unitType] + " " + pname(g, me) + " moveu " + tname(event.unitType) + (event.freeMove ? " (grátis)" : "") + ".", me, sfxCue(unitSfx(event.unitType)));
          const siege = siegeThreatText(g, gr, event.toHex);
          if (siege)
              warEv(g, me, "🪨 Cerco Armado!", siege, null);
          if (event.bonusGranted)
              logWar(g, "🐆 Mestre das Rotas: a tropa de " + pname(g, me) + " pode avançar já +1 hexágono.", me);
          presentOccupationReleases(g, event.occupationReleases);
          return;
      }
      if (event.type === "UNIT_COMBAT_RESOLVED") {
          presentWarResurrections(g, event.resurrections);
          if (event.resolution === "ARCHER_DUEL") {
              logWar(g, "🏹 Duelo de flechas! Os arqueiros de " + pname(g, me) + " e " + pname(g, event.defenderIndex) + " caem ambos.", me);
              warEv(g, me, "🏹 Duelo de Flechas!", "Os arqueiros de " + pname(g, me) + " e " + pname(g, event.defenderIndex) + " dispararam ao mesmo tempo. Nenhum falhou.", null);
          }
          else if (event.resolution === "ARCHER_KILL") {
              warKillLog(g, me, "arqueiro", event.defenderType, event.defenderIndex);
              warEv(g, me, "🏹 Morte Silenciosa!", "O arqueiro de " + pname(g, me) + " abateu " + tname(event.defenderType) + " de " + pname(g, event.defenderIndex) + " — sem sequer sair do lugar.", null);
          }
          else if (event.resolution === "MAKURU_DEFENSE") {
              logWar(g, "🌿 A terra protege " + pname(g, event.defenderIndex) + "! O ataque de " + pname(g, me) + " quebrou-se contra o Filho da Terra.", event.defenderIndex);
              warEv(g, me, "🌿 A Terra Protege!", "No seu terreno, " + pname(g, event.defenderIndex) + " vence o empate: a tropa de " + pname(g, me) + " tombou.", null);
          }
          else if (event.resolution === "MUTUAL_DESTRUCTION") {
              logWar(g, "⚔️ Choque frontal! As tropas de " + pname(g, me) + " e " + pname(g, event.defenderIndex) + " chocaram em campo aberto.", me);
              warEv(g, me, "💥 Choque Frontal!", tname(event.unitType) + " contra " + tname(event.defenderType) + ": " + pname(g, me) + " e " + pname(g, event.defenderIndex) + " mediram forças no embate.", null);
          }
          else if (event.resolution === "ATTACKER_VICTORY") {
              warKillLog(g, me, event.unitType, event.defenderType, event.defenderIndex);
              warEv(g, me, "⚔️ Conflito Militar!", tname(event.unitType) + " de " + pname(g, me) + " esmagou " + tname(event.defenderType) + " de " + pname(g, event.defenderIndex) + " em campo aberto.", siegeThreatText(g, gr, event.toHex));
          }
          presentOccupationReleases(g, event.occupationReleases);
          return;
      }
      if (event.type === "TROLL_GIANT_ATTACKED") {
          logWar(g, UICON[event.unitType] + " " + pname(g, me) + " feriu o Troll Gigante (-" + event.damage + "). Vida: " + event.remainingHp + "/" + event.maxHp, me);
          if (event.defeated) {
              const champions = event.champions || [];
              logWar(g, "🏆 O TROLL GIGANTE CAIU!" + (champions.length ? " " + champions.map((i) => pname(g, i)).join(" e ") + " ganha(m) +1 Glória de Guerra." : ""));
              fireEv(g, "troll", me, "🏆 O Gigante Caiu!", "A horda perde o seu senhor e deixa de crescer. Todos os que causaram dano reclamam 1 recurso" + (champions.length ? "; " + champions.map((i) => pname(g, i)).join(" e ") + " recebe(m) +1 Glória de Guerra permanente." : "."));
          }
          return;
      }
      if (event.type === "TROLL_RAIDER_DEFEATED") {
          logWar(g, "🗡️ " + pname(g, me) + " abateu um saqueador troll e reclama 1 recurso!", me);
          return;
      }
      if (event.type === "UNIT_BRIBED") {
          logWar(g, "💋 Suborno! " + pname(g, me) + " pagou 2 ouro e a tropa de " + pname(g, event.ownerIndex) + " recuou um hexágono.", me);
          warEv(g, me, "💋 Suborno!", "O ouro de " + pname(g, me) + " falou mais alto: a tropa de " + pname(g, event.ownerIndex) + " abandonou a posição e recuou.", null);
          presentOccupationReleases(g, event.occupationReleases);
      }
  }

  function presentWarAutomationEvents(g, events) {
      (events || []).forEach((event) => {
          if (event.type === "BUILDING_OCCUPIED") {
              if (event.gloryAwarded)
                  logWar(g, "🏅 Glória de Guerra: +1 ponto PERMANENTE para " + pname(g, event.occupierIndex) + " pelo cerco bem-sucedido!", event.occupierIndex);
              logWar(g, "🔥 " + pname(g, event.occupierIndex) + " OCUPOU " + (event.buildingType === 2 ? "o palácio" : "a aldeia") + " de " + pname(g, event.ownerIndex) + "! A produção é sua enquanto o cerco durar.", event.occupierIndex);
              warEv(g, event.occupierIndex, "🔥 Ocupação!", pname(g, event.occupierIndex) + " tomou " + (event.buildingType === 2 ? "o palácio" : "a aldeia") + " de " + pname(g, event.ownerIndex) + ": a produção e +1 ponto são do ocupante enquanto o cerco durar. Matar a catapulta liberta-o de imediato.", null);
              speak(g, event.occupierIndex);
              return;
          }
          if (event.type === "OCCUPATION_CONTRABAND") {
              logWar(g, "🤝 O povo de " + pname(g, event.playerIndex) + " contrabandeou " + event.resources.length + " recurso" + (event.resources.length > 1 ? "s" : "") + " sob ocupação.", event.playerIndex);
              return;
          }
          if (event.type === "OCCUPATION_RELEASED") {
              presentOccupationReleases(g, [event]);
              return;
          }
          if (event.type === "TROLL_OMEN_RUSH") {
              logWar(g, "👹 Presságio: o pântano borbulha — a horda aproxima-se (" + event.rush + "/" + event.cap + ").");
              return;
          }
          if (event.type === "TROLL_OMEN_RAIDER") {
              logWar(g, "👹 Presságio: mais um saqueador emerge do lodo!");
              return;
          }
          if (event.type === "TROLL_WARNING") {
              logWar(g, "🌊 O chão treme: alguma coisa enorme respira no pântano...");
              fireEv(g, "troll", event.actorIndex, "👣 O Pântano Estremece", "Alguma coisa muito grande mexe-se no lodo. A horda vem aí — quem não tiver tropas prontas vai arrepender-se.");
              return;
          }
          if (event.type === "TROLL_AWAKENED") {
              logWar(g, "🧌 O TROLL GIGANTE acordou no pântano — e não veio sozinho!");
              fireEv(g, "troll", event.actorIndex, "🧌 A Horda Acordou!", "O Troll Gigante ergue-se do lodo e marcha para o Coração do Reino. Saqueadores espalham-se pelos bastiões. Prepara as tropas — quem ficar só a construir vai pagar caro.");
              return;
          }
          if (event.type === "GIANT_CAMPER_CRUSHED") {
              logWar(g, "💀 A tropa de " + pname(g, event.actorIndex) + " hesitou diante do gigante e foi esmagada.", event.actorIndex);
              return;
          }
          if (event.type === "GIANT_STOMPED_UNIT" && event.playerIndex != null) {
              logWar(g, "🧌 O gigante pisou a tropa de " + pname(g, event.playerIndex) + "!", event.playerIndex);
              return;
          }
          if (event.type === "GIANT_REACHED_HEART") {
              logWar(g, "🧌 O TROLL GIGANTE tomou o Coração do Reino! A Guarda calou-se.");
              fireEv(g, "troll", event.actorIndex, "🧌 O Coração Caiu!", "O gigante esmaga o centro do reino. Ninguém recebe a Guarda do Coração e a horda repõe-se a cada ronda. Só matando-o isto acaba.");
              return;
          }
          if (event.type === "RAIDER_ARRIVED") {
              const what = event.buildingType === 2 ? "o palácio" : "a aldeia";
              if (event.resource)
                  logWar(g, "👹 Um saqueador pilhou " + RES[event.resource].i + " e cercou " + what + " de " + pname(g, event.ownerIndex) + "!", event.ownerIndex);
              else
                  logWar(g, "👹 Um saqueador cercou " + what + " de " + pname(g, event.ownerIndex) + " — não havia nada para roubar.", event.ownerIndex);
              return;
          }
          if (event.type === "GIANT_ROUND_SWEEP") {
              logWar(g, "🧌 O gigante varreu o campo: a tropa de " + pname(g, event.playerIndex) + " foi esmagada!", event.playerIndex);
              return;
          }
          if (event.type === "HORDE_REFILLED")
              logWar(g, "👹 A horda repõe-se: " + event.added + " saqueador(es) emergem do lodo!");
      });
  }

  function presentTurnAdvance(g, event) {
      const warEvents = (event.events || []).filter((item) => ![
          "DEVELOPMENT_CARDS_MATURED",
          "INCOMING_PLAYER_EFFECTS_TICKED",
          "WAGONS_RESET",
          "ICE_DRAGON_AWAKENED",
          "WAR_ROUND_LIMIT_REACHED",
          "HEART_GUARD_BLESSING_QUEUED",
          "TURN_STARTED"
      ].includes(item.type));
      presentWarAutomationEvents(g, warEvents);
      if (event.iceDragonAwakened) {
          logEvent(g, "❄️ Algo antigo se agita na Geleira Eterna... o Dragão de Gelo abriu os olhos.");
          fireEv(g, "gelo", event.playerIndex, "❄️ O Gelo Estala…", "O Dragão de Gelo acordou na geleira. Quando o próximo 7 for lançado, as Casas revelarão as suas artes antigas.");
      }
      if (event.guardBlessingQueued)
          addLog(g, "🏰 A Guarda do Coração: a tropa de " + pname(g, event.playerIndex) + " domina o centro e reclama 1 recurso.", event.playerIndex);
  }

  function presentAppliedGameAction(g, applied) {
      const events = applied?.events || [];
      const actionType = applied?.actionType;
      const actorIndex = applied?.actorIndex;
      const gr = makeGraph(g.board.hexes);
      const first = (type) => events.find((event) => event?.type === type);

      if (actionType === GAME_ACTION.ROLL_DICE) {
          const rolled = first("DICE_ROLLED");
          if (rolled) {
              const [d1, d2] = rolled.dice;
              addLog(g, "🎲 " + pname(g, actorIndex) + " lançou " + rolled.total + " (" + d1 + "+" + d2 + ")", actorIndex, { audio: sfxCue("dice") });
              presentWarAutomationEvents(g, events);
              if (rolled.seven) {
                  if (rolled.seven.type === "ICE_DRAGON_BLESSING") {
                      if (rolled.seven.perksActivated) {
                          logEvent(g, "❄️ O DESPERTAR: o Dragão de Gelo ruge e as oito Casas revelam as suas artes antigas!", null, "ceremonial");
                          fireEv(g, "gelo", actorIndex, "❄️ O Despertar!", "O Dragão de Gelo ergue-se da geleira. As Casas revelam as suas artes antigas — os perks de Casa estão ativos! Consulta o teu no painel de regras.");
                      }
                      logEvent(g, "🐉 O Dragão partilha o seu tesouro! Todos escolhem 1 recurso; " + pname(g, actorIndex) + " escolhe 2.", actorIndex, "ceremonial", sfxCue("dragon"));
                      fireEv(g, "dragao", actorIndex, "🐉 A Bênção do Dragão!", "O Dragão abre o tesouro do vulcão: cada casa escolhe 1 recurso à sua vontade — e " + pname(g, actorIndex) + ", que o despertou, escolhe 2.");
                  }
                  else {
                      logEvent(g, "🐉 O Dragão de Fogo desperta! " + pname(g, actorIndex) + " vai guiá-lo.", actorIndex, "ceremonial", sfxCue("dragon"));
                      fireEv(g, "dragao", actorIndex, "O Dragão Desperta!", "“GRAOOOR! Tragam-me os vossos sacrifícios!” O Dragão será guiado por " + pname(g, actorIndex) + ".");
                  }
              }
              else {
                  const lines = [];
                  const gains = [];
                  (rolled.production?.gains || []).forEach((gain, playerIndex) => {
                      const parts = Object.entries(gain).filter(([, amount]) => amount > 0);
                      if (!parts.length)
                          return;
                      addLog(g, pname(g, playerIndex) + " colheu " + parts.map(([resource, amount]) => amount + RES[resource].i).join(" "), playerIndex);
                      lines.push(pname(g, playerIndex) + " " + parts.map(([resource, amount]) => FLAV[resource](amount)).join(" e ") + ".");
                      gains.push({
                          playerIndex,
                          playerName: pname(g, playerIndex),
                          resources: parts.map(([resource, amount]) => ({ resource, amount }))
                      });
                  });
                  fireEv(g, "dados", actorIndex, "Saiu o " + rolled.total + "!", gains.length ? "A terra respondeu ao chamamento dos dados." : "A terra ficou em silêncio; ninguém colheu recursos.", null, { n: rolled.total, dice: rolled.dice.slice(), gains });
              }
          }
          const disaster = first("DISASTER_RESOLVED");
          if (disaster) {
              if (disaster.outcome === "NO_PROTECTED")
                  logEvent(g, "🌫️ O presságio do " + disaster.sacredNumber + " ecoou... mas ninguém reclamou o número sagrado.");
              else if (disaster.outcome === "NO_TARGETS")
                  logEvent(g, "🕊️ Todos os reinos estavam protegidos do presságio do " + disaster.sacredNumber + ".");
              else {
                  const type = disaster.disasterType;
                  setGameDisaster(g, { type, num: disaster.sacredNumber, id: disaster.disasterId, det: disasterDetails(g, disaster) }, eventIdOptions);
                  const disasterSfx = type === "tsunami" ? "tsunami"
                      : type === "ganancia" ? "disasterGreed"
                      : type === "peste" ? "disasterPlague"
                      : type === "tributo" ? "disasterTribute"
                      : "disaster";
                  logEvent(g, DISASTERS[type].i + " DESASTRE: " + DISASTERS[type].n + " (saiu " + disaster.sacredNumber + ")!", null, "ceremonial", sfxCue(disasterSfx));
              }
          }
          return;
      }

      if (actionType === GAME_ACTION.RESOLVE_DISCARD) {
          const event = first("DISCARD_RESOLVED");
          if (event)
              logEvent(g, "🔥 " + pname(g, actorIndex) + " sacrificou " + event.amount + " cartas ao Dragão.", actorIndex, "important", sfxCue("bad"));
      }
      else if (actionType === GAME_ACTION.RESOLVE_TSUNAMI) {
          logEvent(g, "🌊 " + pname(g, actorIndex) + " viu um porto ser engolido pelas ondas.", actorIndex);
      }
      else if (actionType === GAME_ACTION.RESOLVE_QUEUE_RESOURCE) {
          const event = first("QUEUE_RESOURCE_RESOLVED");
          if (event?.completed) {
              const label = event.decisionType === "tributo" ? "recebeu o seu tributo" : "recebeu a bênção do Dragão";
              addLog(g, (event.decisionType === "tributo" ? "👑 " : "🐉 ") + pname(g, actorIndex) + " " + label + ".", actorIndex);
          }
      }
      else if ([GAME_ACTION.ACCEPT_TRADE, GAME_ACTION.DECLINE_TRADE, GAME_ACTION.BANK_TRADE, GAME_ACTION.PROPOSE_TRADE, GAME_ACTION.CANCEL_TRADE].includes(actionType)) {
          events.forEach((event) => presentTradeEvent(g, event));
      }
      else if (actionType === GAME_ACTION.BUILD_VILLAGE) {
          const event = first("SETUP_SETTLEMENT_BUILT") || first("VILLAGE_BUILT");
          if (event?.type === "SETUP_SETTLEMENT_BUILT") {
              const prefix = event.rapidMode ? "🏰 " : "🏠 ";
              const actionText = event.rapidMode ? " ergueu o " : " fundou a ";
              const pieceText = event.rapidMode ? (event.secondPlacement ? "segundo palácio" : "primeiro palácio") : (event.secondPlacement ? "segunda aldeia" : "primeira aldeia");
              addLog(g, prefix + pname(g, actorIndex) + actionText + pieceText + (event.secondPlacement ? " e colheu os frutos da terra." : "."), actorIndex, { audio: voiceCue(g, actorIndex, event.rapidMode ? "found_palace" : "found_village", "build") });
          }
          else if (event) {
              addLog(g, "🏠 " + pname(g, actorIndex) + " fundou uma aldeia!", actorIndex, { audio: voiceCue(g, actorIndex, "found_village", "build") });
          }
      }
      else if (actionType === GAME_ACTION.BUILD_ROAD) {
          const event = first("ROAD_BUILT") || first("SETUP_ROAD_BUILT");
          if (event?.type === "ROAD_BUILT")
              addLog(g, "🛤️ " + pname(g, actorIndex) + " ergueu uma estrada.", actorIndex, { audio: sfxCue("build") });
          else if (event?.setupCompleted)
              addLog(g, "⚔️ Os reinos estão fundados. Que comece a era do Dragão! " + pname(g, g.order[0]) + " começa.", null, { audio: sfxCue("march") });
      }
      else if (actionType === GAME_ACTION.BUILD_PALACE) {
          addLog(g, "🏰 " + pname(g, actorIndex) + " ergueu um PALÁCIO!", actorIndex, { audio: voiceCue(g, actorIndex, "found_palace", "build") });
          fireEv(g, "char", actorIndex, "Um palácio ergue-se!", "“" + pick(characterById(g.players[actorIndex].ch).q) + "”");
      }
      else if (actionType === GAME_ACTION.PLACE_DRAGON) {
          const event = first("DRAGON_PLACED");
          if (event) {
              const terrain = g.board.hexes.find((hex) => hex.k === event.hex)?.terr;
              addLog(g, "🐉 O Dragão pousou em " + terrainLabel(terrain, "terreno desconhecido") + ".", actorIndex, { audio: sfxCue("flap") });
              event.excluded.forEach(({ playerIndex, reason }) => {
                  const why = reason === "IMMUNE" ? "imune (Trindade)" : "sem cartas na mão";
                  addLog(g, "🔎 " + pname(g, playerIndex) + " está adjacente mas não pode ser saqueado: " + why + ".", playerIndex);
              });
          }
      }
      else if (actionType === GAME_ACTION.STEAL_RESOURCE) {
          const event = first("RESOURCE_STOLEN");
          if (event) {
              addLog(g, "🗡️ " + pname(g, actorIndex) + " roubou 1 carta a " + pname(g, event.victimIndex) + ".", actorIndex, { audio: voiceCue(g, event.victimIndex, "robbed", "swoop") });
          }
      }
      else if (actionType === GAME_ACTION.BUY_DEV_CARD) {
          addLog(g, "📜 " + pname(g, actorIndex) + " comprou uma carta de desenvolvimento.", actorIndex, { audio: sfxCue("card") });
      }
      else if ([GAME_ACTION.RECRUIT_TROOP, GAME_ACTION.DEPLOY_UNIT, GAME_ACTION.UNIT_ACTION, GAME_ACTION.BRIBE_UNIT].includes(actionType)) {
          const event = events.find((item) => ["TROOP_RECRUITED", "UNIT_DEPLOYED", "UNIT_MOVED", "UNIT_COMBAT_RESOLVED", "TROLL_GIANT_ATTACKED", "TROLL_RAIDER_DEFEATED", "UNIT_BRIBED"].includes(item?.type));
          presentWarActionEvent(g, gr, event);
      }
      else if ([GAME_ACTION.BUILD_WAGON, GAME_ACTION.MOVE_WAGON, GAME_ACTION.LOAD_COLONISTS, GAME_ACTION.FOUND_REMOTE_VILLAGE].includes(actionType)) {
          const event = events.find((item) => ["WAGON_BUILT", "WAGON_MOVED", "COLONISTS_LOADED", "REMOTE_VILLAGE_FOUNDED"].includes(item?.type));
          presentExplorationEvent(g, gr, event);
      }
      else if (actionType === GAME_ACTION.PLAY_DEV_CARD) {
          const event = first("DEVELOPMENT_CARD_PLAYED");
          if (event) {
              revealDev(g, actorIndex, event.card);
              presentDevelopmentCardPlay(g, event);
          }
      }
      else if (actionType === GAME_ACTION.END_TURN) {
          const event = first("TURN_ADVANCED");
          if (event) {
              presentTurnAdvance(g, event);
              if (!event.roundLimitReached)
                  addLog(g, "⏳ É a vez de " + pname(g, event.playerIndex) + ".", event.playerIndex);
          }
      }

      presentScoringEvents(g, events.filter((event) => ["LONGEST_ROAD_CHANGED", "LARGEST_ARMY_CHANGED", "GAME_WON"].includes(event?.type)));
  }

  return Object.freeze({
    addLog,
    presentAppliedGameAction,
    presentScoringEvents,
    presentTradeEvent,
    presentTurnAdvance,
  });
}
