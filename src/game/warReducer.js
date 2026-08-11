import { TERRAIN_RESOURCE_BY_TYPE } from "./constructionReducer.js";
import { canPay, payCost } from "./resources.js";

export const WAR_UNIT_TYPES = Object.freeze(["cavaleiro", "catapulta", "arqueiro"]);
export const WAR_UNIT_BEATS = Object.freeze({
  cavaleiro: "catapulta",
  catapulta: "arqueiro",
  arqueiro: "cavaleiro",
});
export const WAR_UNIT_ICONS = Object.freeze({
  cavaleiro: "⚔️",
  catapulta: "🪨",
  arqueiro: "🏹",
});
export const WAR_UNIT_COSTS = Object.freeze({
  cavaleiro: Object.freeze({ cavalos: 2, ouro: 1 }),
  arqueiro: Object.freeze({ madeira: 1, cavalos: 1, ouro: 1 }),
  catapulta: Object.freeze({ madeira: 1, tijolo: 1, obsidiana: 1 }),
});
export const TROLL_PLAYER_INDEX = -9;

const HEX_DIRECTIONS = Object.freeze([
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]);

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function assertActor(game, actorIndex) {
  if (!Number.isSafeInteger(actorIndex) || actorIndex < 0 || actorIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para a ação militar.");
  }
}

function assertWarMode(game) {
  if (game.mode !== "guerra") throw new Error("A ação militar só está disponível no modo Guerra.");
}

function assertUnitType(subtype) {
  if (!WAR_UNIT_TYPES.includes(subtype)) throw new TypeError("Tipo de tropa inválido.");
}

function hexOf(game, key) {
  return game.board?.hexes?.find((hex) => hex.k === key) || null;
}

function isHiddenHex(game, key) {
  return hexOf(game, key)?.hid === true;
}

function terrainOf(game, key) {
  return hexOf(game, key)?.terr || null;
}

function isBurnedTerrain(game, key) {
  if (isHiddenHex(game, key)) return false;
  const terrain = terrainOf(game, key);
  return Boolean(terrain) && !TERRAIN_RESOURCE_BY_TYPE[terrain];
}

export function hexDistance(first, second) {
  const [q1, r1] = String(first).split(",").map(Number);
  const [q2, r2] = String(second).split(",").map(Number);
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function neighboringHexes(game, key) {
  const [q, r] = String(key).split(",").map(Number);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return [];
  return HEX_DIRECTIONS
    .map(([dq, dr]) => `${q + dq},${r + dr}`)
    .filter((candidate) => Boolean(hexOf(game, candidate)));
}

export function isTrollUnit(unit) {
  return Boolean(unit) && unit.p === TROLL_PLAYER_INDEX;
}

export function giantHex(game) {
  return game.troll?.giant && !game.troll?.defeated ? game.troll.giant.at : null;
}

export function hasWarPerk(game, playerIndex, characterId) {
  return game.mode === "guerra"
    && game.perksOn !== false
    && game.gelo?.active === true
    && game.players?.[playerIndex]?.ch === characterId;
}

export function militaryActionsLeft(game) {
  return 2 - (game.turn?.milN || 0);
}

export function troopCost(game, playerIndex, subtype) {
  assertActor(game, playerIndex);
  assertUnitType(subtype);
  const cost = { ...WAR_UNIT_COSTS[subtype] };
  if (hasWarPerk(game, playerIndex, "vlad") && subtype === "cavaleiro") {
    cost.cavalos -= 1;
  }
  if (hasWarPerk(game, playerIndex, "bones")) {
    cost.obsidiana = (cost.obsidiana || 0) + 1;
  }
  return cost;
}

export function validDeployHexes(game, graph, playerIndex, subtype) {
  assertActor(game, playerIndex);
  assertUnitType(subtype);
  const capitalVertex = game.players[playerIndex]?.capV;
  if (capitalVertex == null || !graph?.verts?.[capitalVertex]) return [];

  if (game.troll) {
    for (const unit of Object.values(game.units || {})) {
      if (isTrollUnit(unit) && unit.blk === capitalVertex && unit.fresh) return [];
    }
  }

  return graph.verts[capitalVertex].hexes.filter((key) => (
    key !== game.board?.dragon
    && !isHiddenHex(game, key)
    && key !== giantHex(game)
    && (!game.units?.[key] || isTrollUnit(game.units[key]))
  ));
}

export function unitTargets(game, graph, fromHex, playerIndex) {
  assertActor(game, playerIndex);
  const unit = game.units?.[fromHex];
  const targets = new Set();
  if (!unit || unit.p !== playerIndex || isTrollUnit(unit)) return targets;

  neighboringHexes(game, fromHex).forEach((key) => {
    if (key === game.board?.dragon || isHiddenHex(game, key)) return;
    const target = game.units?.[key];
    if (!target) targets.add(key);
    else if (target.p !== playerIndex && (WAR_UNIT_BEATS[unit.t] === target.t || target.t === unit.t)) targets.add(key);
  });

  if (game.troll?.awake) {
    neighboringHexes(game, fromHex).forEach((key) => {
      if (isTrollUnit(game.units?.[key])) targets.add(key);
    });
    const giant = giantHex(game);
    if (giant) {
      if (hexDistance(fromHex, giant) === 1) {
        targets.clear();
        targets.add(giant);
        return targets;
      }
      targets.delete(giant);
      [...targets].forEach((key) => {
        if (hexDistance(key, giant) === 1 && game.units?.[key] && !isTrollUnit(game.units[key])) targets.delete(key);
      });
    }
  }

  if (unit.t === "arqueiro" && hasWarPerk(game, playerIndex, "artheria")) {
    const anchored = graph?.hexMap?.[fromHex]?.corners?.some((vertex) => {
      const building = game.builds?.[vertex];
      return building && building.p === playerIndex && game.occ?.[vertex] == null;
    });
    if (anchored) {
      const adjacent = new Set(neighboringHexes(game, fromHex));
      neighboringHexes(game, fromHex).forEach((middle) => {
        if (isHiddenHex(game, middle)) return;
        neighboringHexes(game, middle).forEach((key) => {
          if (key === fromHex || adjacent.has(key) || key === game.board?.dragon || isHiddenHex(game, key)) return;
          const target = game.units?.[key];
          if (target && target.p !== playerIndex && (WAR_UNIT_BEATS[unit.t] === target.t || target.t === unit.t)) {
            targets.add(key);
          }
        });
      });
    }
  }

  return targets;
}

function siegeCount(game, graph, vertex, playerIndex) {
  return (graph?.verts?.[vertex]?.hexes || []).filter((key) => {
    const unit = game.units?.[key];
    return unit && unit.p === playerIndex && unit.t === "catapulta";
  }).length;
}

export function releaseInvalidOccupations(game, graph) {
  const released = [];
  if (!game.occ) return released;
  for (const [vertex, occupyingPlayer] of Object.entries(game.occ)) {
    const building = game.builds?.[vertex];
    if (!building) {
      delete game.occ[vertex];
      continue;
    }
    const required = (building.t === 2 ? 2 : 1) + (hasWarPerk(game, building.p, "maria") ? 1 : 0);
    if (siegeCount(game, graph, vertex, occupyingPlayer) < required) {
      delete game.occ[vertex];
      released.push({
        vertex,
        ownerIndex: building.p,
        formerOccupierIndex: occupyingPlayer,
        buildingType: building.t,
      });
    }
  }
  return released;
}

function pushDestination(game, fromHex, targetHex) {
  const [q1, r1] = String(fromHex).split(",").map(Number);
  const [q2, r2] = String(targetHex).split(",").map(Number);
  const destination = `${q2 + (q2 - q1)},${r2 + (r2 - r1)}`;
  const hex = hexOf(game, destination);
  if (!hex || hex.hid || game.units?.[destination] || destination === game.board?.dragon || destination === giantHex(game)) return null;
  return destination;
}

export function bribeTargets(game, playerIndex) {
  assertActor(game, playerIndex);
  const targets = new Set();
  for (const [key, unit] of Object.entries(game.units || {})) {
    if (unit.p !== playerIndex || isTrollUnit(unit)) continue;
    neighboringHexes(game, key).forEach((neighbor) => {
      const target = game.units?.[neighbor];
      if (target && target.p !== playerIndex && !isTrollUnit(target) && pushDestination(game, key, neighbor)) targets.add(neighbor);
    });
  }
  return targets;
}

function dieOrRise(game, graph, key, resurrections) {
  const unit = game.units?.[key];
  if (!unit) return null;
  delete game.units[key];
  const result = { playerIndex: unit.p, unitType: unit.t, fromHex: key, resurrected: false, toHex: null };
  if (unit.sk) {
    delete unit.sk;
    unit.bone = 1;
    const spots = validDeployHexes(game, graph, unit.p, unit.t);
    if (spots.length) {
      game.units[spots[0]] = unit;
      result.resurrected = true;
      result.toHex = spots[0];
    }
    resurrections.push(result);
  }
  return result;
}

function resolveGiantDefeat(game) {
  const troll = game.troll;
  troll.defeated = true;
  troll.giant = null;
  const contributors = Object.keys(troll.dmg || {}).map(Number).filter((index) => troll.dmg[index] > 0);
  game.queue = Array.isArray(game.queue) ? game.queue : [];
  contributors.forEach((index) => game.queue.push({ t: "bencao", p: index, left: 1 }));
  let best = -1;
  contributors.forEach((index) => { if (troll.dmg[index] > best) best = troll.dmg[index]; });
  const champions = contributors.filter((index) => troll.dmg[index] === best);
  game.glory = game.glory || {};
  champions.forEach((index) => { game.glory[index] = (game.glory[index] || 0) + 1; });
  return { contributors, champions };
}

function reduceTrollAttack(next, graph, actorIndex, fromHex, toHex) {
  const troll = next.troll;
  const unit = next.units?.[fromHex];
  if (!troll?.awake || !unit || unit.p !== actorIndex || isTrollUnit(unit) || hexDistance(fromHex, toHex) !== 1) return null;

  if (troll.giant && !troll.defeated && toHex === troll.giant.at) {
    const damage = unit.t === "catapulta" ? 2 : 1;
    troll.giant.hp -= damage;
    troll.dmg = troll.dmg || {};
    troll.dmg[actorIndex] = (troll.dmg[actorIndex] || 0) + damage;
    unit.atk = 1;
    next.turn.milN = (next.turn.milN || 0) + 1;
    next.turn.acted = next.turn.acted || {};
    next.turn.acted[fromHex] = true;
    const remainingHp = Math.max(0, troll.giant.hp);
    const maxHp = troll.giant.maxHp;
    const defeat = troll.giant.hp <= 0 ? resolveGiantDefeat(next) : null;
    return {
      game: next,
      event: {
        type: "TROLL_GIANT_ATTACKED",
        actorIndex,
        fromHex,
        unitType: unit.t,
        damage,
        remainingHp,
        maxHp,
        defeated: Boolean(defeat),
        contributors: defeat?.contributors || [],
        champions: defeat?.champions || [],
      },
    };
  }

  const target = next.units?.[toHex];
  if (isTrollUnit(target)) {
    delete next.units[toHex];
    let restingHex = fromHex;
    if (unit.t !== "arqueiro") {
      delete next.units[fromHex];
      next.units[toHex] = unit;
      restingHex = toHex;
    }
    next.turn.milN = (next.turn.milN || 0) + 1;
    next.turn.acted = next.turn.acted || {};
    next.turn.acted[restingHex] = true;
    next.queue = Array.isArray(next.queue) ? next.queue : [];
    next.queue.push({ t: "bencao", p: actorIndex, left: 1 });
    return {
      game: next,
      event: {
        type: "TROLL_RAIDER_DEFEATED",
        actorIndex,
        fromHex,
        toHex,
        restingHex,
        unitType: unit.t,
      },
    };
  }
  return null;
}

export function reduceTroopRecruitment(game, actorIndex, subtype) {
  assertWarMode(game);
  assertActor(game, actorIndex);
  assertUnitType(subtype);
  if (militaryActionsLeft(game) <= 0) throw new Error("O jogador já gastou as ações militares deste turno.");
  if (game.turn?.deploy) throw new Error("Já existe uma tropa por destacar.");
  const cost = troopCost(game, actorIndex, subtype);
  if (!canPay(game.players[actorIndex], cost)) throw new Error("O jogador não consegue pagar a tropa.");

  const next = cloneGame(game);
  payCost(next.players[actorIndex], cost);
  next.players[actorIndex].troops = next.players[actorIndex].troops || {};
  next.players[actorIndex].troops[subtype] = (next.players[actorIndex].troops[subtype] || 0) + 1;
  next.turn.deploy = subtype;

  return {
    game: next,
    event: { type: "TROOP_RECRUITED", actorIndex, subtype, cost },
  };
}

export function reduceUnitDeployment(game, graph, actorIndex, hex) {
  assertWarMode(game);
  assertActor(game, actorIndex);
  const subtype = game.turn?.deploy;
  assertUnitType(subtype);
  if (militaryActionsLeft(game) <= 0) throw new Error("O jogador já gastou as ações militares deste turno.");
  if (!validDeployHexes(game, graph, actorIndex, subtype).includes(hex)) throw new Error("Hexágono inválido para destacar a tropa.");

  const next = cloneGame(game);
  const defeatedRaider = isTrollUnit(next.units?.[hex]);
  if (defeatedRaider) {
    delete next.units[hex];
    next.queue = Array.isArray(next.queue) ? next.queue : [];
    next.queue.push({ t: "bencao", p: actorIndex, left: 1 });
  }
  next.units = next.units || {};
  next.units[hex] = { p: actorIndex, t: subtype };
  if (hasWarPerk(next, actorIndex, "bones")) next.units[hex].sk = 1;
  next.turn.bonus = null;
  next.turn.deploy = null;
  next.turn.milN = (next.turn.milN || 0) + 1;
  next.turn.acted = next.turn.acted || {};
  next.turn.acted[hex] = true;
  const occupationReleases = releaseInvalidOccupations(next, graph);

  return {
    game: next,
    event: {
      type: "UNIT_DEPLOYED",
      actorIndex,
      subtype,
      hex,
      defeatedRaider,
      skeletonGuard: Boolean(next.units[hex].sk),
      occupationReleases,
    },
  };
}

export function reduceUnitAction(game, graph, actorIndex, fromHex, toHex) {
  assertWarMode(game);
  assertActor(game, actorIndex);
  const unit = game.units?.[fromHex];
  if (!unit || unit.p !== actorIndex || isTrollUnit(unit)) throw new Error("Tropa inválida.");
  const bonusMove = game.turn?.bonus === fromHex && !game.units?.[toHex];
  if (game.turn?.acted?.[fromHex]) throw new Error("A tropa já agiu neste turno.");
  if (!bonusMove && militaryActionsLeft(game) <= 0) throw new Error("O jogador já gastou as ações militares deste turno.");
  if (!unitTargets(game, graph, fromHex, actorIndex).has(toHex)) throw new Error("Destino militar inválido.");

  const next = cloneGame(game);
  const trollResult = reduceTrollAttack(next, graph, actorIndex, fromHex, toHex);
  if (trollResult) return trollResult;

  const movingUnit = next.units[fromHex];
  const target = next.units[toHex];
  const targetSnapshot = target ? { ...target } : null;
  const resurrections = [];
  let freeMove = false;
  let grantBonus = false;
  let resolution;

  if (!target) {
    freeMove = bonusMove || (
      hasWarPerk(next, actorIndex, "makuru")
      && terrainOf(next, fromHex) === terrainOf(next, toHex)
      && !isBurnedTerrain(next, toHex)
    );
    grantBonus = !bonusMove && hasWarPerk(next, actorIndex, "protheus") && isBurnedTerrain(next, toHex);
    next.turn.bonus = null;
    delete next.units[fromHex];
    next.units[toHex] = movingUnit;
    if (grantBonus) next.turn.bonus = toHex;
    resolution = "MOVE";
  } else if (movingUnit.t === "arqueiro") {
    next.turn.bonus = null;
    if (target.t === "arqueiro") {
      dieOrRise(next, graph, toHex, resurrections);
      dieOrRise(next, graph, fromHex, resurrections);
      resolution = "ARCHER_DUEL";
    } else {
      dieOrRise(next, graph, toHex, resurrections);
      resolution = "ARCHER_KILL";
    }
  } else if (target.t === movingUnit.t) {
    next.turn.bonus = null;
    const defenderProtected = hasWarPerk(next, target.p, "makuru")
      && ["floresta", "montanhas"].includes(terrainOf(next, toHex));
    if (defenderProtected) {
      dieOrRise(next, graph, fromHex, resurrections);
      resolution = "MAKURU_DEFENSE";
    } else {
      dieOrRise(next, graph, toHex, resurrections);
      dieOrRise(next, graph, fromHex, resurrections);
      resolution = "MUTUAL_DESTRUCTION";
    }
  } else {
    next.turn.bonus = null;
    dieOrRise(next, graph, toHex, resurrections);
    delete next.units[fromHex];
    next.units[toHex] = movingUnit;
    resolution = "ATTACKER_VICTORY";
  }

  if (!freeMove) next.turn.milN = (next.turn.milN || 0) + 1;
  next.turn.acted = next.turn.acted || {};
  if (!freeMove && !grantBonus) {
    if (next.units[toHex]?.p === actorIndex) next.turn.acted[toHex] = true;
    if (next.units[fromHex]?.p === actorIndex) next.turn.acted[fromHex] = true;
  }
  if (bonusMove && next.units[toHex]?.p === actorIndex) next.turn.acted[toHex] = true;
  const occupationReleases = releaseInvalidOccupations(next, graph);

  return {
    game: next,
    event: {
      type: resolution === "MOVE" ? "UNIT_MOVED" : "UNIT_COMBAT_RESOLVED",
      resolution,
      actorIndex,
      fromHex,
      toHex,
      unitType: movingUnit.t,
      defenderIndex: targetSnapshot?.p ?? null,
      defenderType: targetSnapshot?.t ?? null,
      freeMove,
      bonusMove,
      bonusGranted: grantBonus,
      resurrections,
      occupationReleases,
    },
  };
}

export function reduceUnitBribe(game, graph, actorIndex, targetHex) {
  assertWarMode(game);
  assertActor(game, actorIndex);
  if (!hasWarPerk(game, actorIndex, "romeo")) throw new Error("O jogador não possui a capacidade de Suborno.");
  if (game.turn?.bribed) throw new Error("O Suborno já foi utilizado neste turno.");
  if ((game.players[actorIndex]?.res?.ouro || 0) < 2) throw new Error("O jogador não possui ouro suficiente.");
  if (!bribeTargets(game, actorIndex).has(targetHex)) throw new Error("Tropa inválida para suborno.");

  const next = cloneGame(game);
  const target = next.units[targetHex];
  const supportingHex = neighboringHexes(next, targetHex).find((neighbor) => (
    next.units?.[neighbor]?.p === actorIndex && pushDestination(next, neighbor, targetHex)
  ));
  if (!supportingHex) throw new Error("Nenhuma tropa aliada consegue executar o suborno.");
  const destination = pushDestination(next, supportingHex, targetHex);
  if (!destination) throw new Error("A tropa subornada não tem para onde recuar.");
  next.players[actorIndex].res.ouro -= 2;
  delete next.units[targetHex];
  next.units[destination] = target;
  next.turn.bribed = true;
  const occupationReleases = releaseInvalidOccupations(next, graph);

  return {
    game: next,
    event: {
      type: "UNIT_BRIBED",
      actorIndex,
      ownerIndex: target.p,
      unitType: target.t,
      fromHex: targetHex,
      toHex: destination,
      supportingHex,
      occupationReleases,
    },
  };
}
