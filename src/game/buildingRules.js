import { isExplorationMode, isWarMode } from "./gameModes.js";

function hexOf(game, key) {
  return game?.board?.hexes?.find((hex) => hex.k === key) || null;
}

function isHiddenHex(game, key) {
  return Boolean(hexOf(game, key)?.hid);
}

function vertexIsOpen(game, graph, vertexKey) {
  return !isExplorationMode(game?.mode)
    || graph.verts[vertexKey].hexes.some((hexKey) => !isHiddenHex(game, hexKey));
}

function edgeIsOpen(game, graph, edgeKey) {
  return !isExplorationMode(game?.mode)
    || graph.edges[edgeKey].hexes.some((hexKey) => !isHiddenHex(game, hexKey));
}

function isWasteHex(game, key) {
  const hex = hexOf(game, key);
  return Boolean(hex) && hex.hid !== true && hex.terr === "deserto";
}

function isWasteEdge(game, graph, edgeKey) {
  const hexes = graph.edges[edgeKey].hexes;
  return hexes.length === 2 && hexes.every((hexKey) => isWasteHex(game, hexKey));
}

export function validRoads(game, graph, playerIndex, onlyAtVertex = null) {
  return Object.keys(graph.edges).filter((edgeKey) => {
    if (game.roads[edgeKey] != null) return false;
    if (!edgeIsOpen(game, graph, edgeKey)) return false;
    if ((isExplorationMode(game?.mode) || isWarMode(game?.mode)) && isWasteEdge(game, graph, edgeKey)) return false;

    const { a, b } = graph.edges[edgeKey];
    if (onlyAtVertex) return a === onlyAtVertex || b === onlyAtVertex;

    const connectsToPlayer = (vertexKey) => {
      const building = game.builds[vertexKey];
      if (building?.p === playerIndex) return true;
      if (building && building.p !== playerIndex) return false;
      return graph.verts[vertexKey].edges.some((otherEdge) => (
        otherEdge !== edgeKey && game.roads[otherEdge] === playerIndex
      ));
    };

    return connectsToPlayer(a) || connectsToPlayer(b);
  });
}

export function validVillages(game, graph, playerIndex, setup) {
  return Object.keys(graph.verts).filter((vertexKey) => {
    if (game.builds[vertexKey]) return false;

    const hasNearbyBuilding = graph.verts[vertexKey].edges.some((edgeKey) => {
      const edge = graph.edges[edgeKey];
      const neighbour = edge.a === vertexKey ? edge.b : edge.a;
      return Boolean(game.builds[neighbour]);
    });
    if (hasNearbyBuilding) return false;
    if (!vertexIsOpen(game, graph, vertexKey)) return false;

    if (setup) {
      if (!isWarMode(game?.mode) || !game.board.prov) return true;

      const provinceByHex = game.board.prov;
      const claims = {};
      for (const [claimedVertex, building] of Object.entries(game.builds)) {
        for (const hexKey of graph.verts[claimedVertex].hexes) {
          if (provinceByHex[hexKey] != null) claims[provinceByHex[hexKey]] = building.p;
        }
      }

      let playerProvince = null;
      for (const province in claims) {
        if (claims[province] === playerIndex) playerProvince = province;
      }

      const touchingProvinces = graph.verts[vertexKey].hexes
        .map((hexKey) => provinceByHex[hexKey])
        .filter((province) => province != null);
      if (!touchingProvinces.length) return false;

      return touchingProvinces.some((province) => (
        playerProvince != null
          ? String(province) === String(playerProvince)
          : claims[String(province)] == null
      ));
    }

    return graph.verts[vertexKey].edges.some((edgeKey) => game.roads[edgeKey] === playerIndex);
  });
}

export function validPalaces(game, playerIndex) {
  return Object.keys(game.builds).filter((vertexKey) => (
    game.builds[vertexKey].p === playerIndex && game.builds[vertexKey].t === 1
  ));
}

export function pieceCount(game, playerIndex, pieceType) {
  if (pieceType === "estrada") {
    return Object.values(game.roads).filter((owner) => owner === playerIndex).length;
  }
  const buildingType = pieceType === "aldeia" ? 1 : 2;
  return Object.values(game.builds).filter((building) => (
    building.p === playerIndex && building.t === buildingType
  )).length;
}

export function activePorts(game, graph, playerIndex) {
  const disabledPorts = game.players[playerIndex]?.portOff || [];
  return (game.board.ports || []).filter((port) => {
    if (port.hid) return false;
    const edge = graph.edges[port.e];
    if (!edge) return false;
    const ownsEndpoint = [edge.a, edge.b].some((vertexKey) => (
      game.builds[vertexKey]?.p === playerIndex
    ));
    const disabled = disabledPorts.some((entry) => entry.e === port.e);
    return ownsEndpoint && !disabled;
  });
}

export function bankRatio(game, graph, playerIndex, resource) {
  const ports = activePorts(game, graph, playerIndex);
  if (ports.some((port) => port.type === resource)) return 2;
  if (ports.some((port) => port.type === "any")) return 3;
  return 4;
}
