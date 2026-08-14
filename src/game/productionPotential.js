export const DICE_SUM_PIPS = Object.freeze({
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
});

export function diceSumPips(total) {
  return DICE_SUM_PIPS[total] || 0;
}

function visibleProductiveHex(hex) {
  return Boolean(hex)
    && hex.hid !== true
    && hex.terr !== "oculto"
    && hex.terr !== "deserto"
    && diceSumPips(hex.num) > 0;
}

export function vertexProductionProfile(game, graph, vertex) {
  const adjacent = graph?.verts?.[vertex]?.hexes || [];
  const terrains = new Set();
  const numbers = new Set();
  let pips = 0;
  let productiveHexes = 0;

  for (const hexKey of adjacent) {
    const hex = graph?.hexMap?.[hexKey];
    if (!visibleProductiveHex(hex)) continue;
    const weight = diceSumPips(hex.num);
    pips += weight;
    productiveHexes += 1;
    if (hex.terr) terrains.add(hex.terr);
    if (Number.isFinite(hex.num)) numbers.add(hex.num);
  }

  const terrainDiversity = terrains.size;
  return {
    vertex,
    pips,
    expectedProductionPerRoll: pips / 36,
    productiveHexes,
    terrainDiversity,
    terrains: [...terrains].sort(),
    numbers: [...numbers].sort((a, b) => a - b),
    // Keep the bot's existing preference formula centralized so diagnostics
    // and policy cannot silently disagree about setup quality.
    score: pips * 190 + terrainDiversity * 28,
  };
}

export function vertexProductionScore(game, graph, vertex) {
  return vertexProductionProfile(game, graph, vertex).score;
}
