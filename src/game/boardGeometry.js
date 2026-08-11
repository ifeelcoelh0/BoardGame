export const HEX_SIZE = 46;
const HALF_HEX_WIDTH = Math.sqrt(3) * HEX_SIZE / 2;

export const HEX_CORNER_OFFSETS = Object.freeze([
  Object.freeze([HALF_HEX_WIDTH, -HEX_SIZE / 2]),
  Object.freeze([HALF_HEX_WIDTH, HEX_SIZE / 2]),
  Object.freeze([0, HEX_SIZE]),
  Object.freeze([-HALF_HEX_WIDTH, HEX_SIZE / 2]),
  Object.freeze([-HALF_HEX_WIDTH, -HEX_SIZE / 2]),
  Object.freeze([0, -HEX_SIZE]),
]);

export function hexCenter(q, r) {
  return {
    x: Math.sqrt(3) * HEX_SIZE * (q + r / 2),
    y: 1.5 * HEX_SIZE * r,
  };
}

function cornerPoint(centerX, centerY, cornerIndex) {
  return {
    x: centerX + HEX_CORNER_OFFSETS[cornerIndex][0],
    y: centerY + HEX_CORNER_OFFSETS[cornerIndex][1],
  };
}

function vertexKey(x, y) {
  return `${Math.round(x / 2)}_${Math.round(y / 2)}`;
}

function edgeKey(first, second) {
  return [first, second].sort().join("|");
}

export function ringCoords(radius) {
  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new RangeError("O raio do anel hexagonal tem de ser um inteiro não negativo.");
  }
  if (radius === 0) return [[0, 0]];
  const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  let q = -radius;
  let r = radius;
  const result = [];
  for (let direction = 0; direction < 6; direction += 1) {
    for (let step = 0; step < radius; step += 1) {
      result.push([q, r]);
      q += directions[direction][0];
      r += directions[direction][1];
    }
  }
  return result;
}

export function makeBoardGraph(hexes) {
  if (!Array.isArray(hexes)) throw new TypeError("O tabuleiro deve fornecer uma lista de hexágonos.");
  const verts = {};
  const edges = {};
  const hexMap = {};

  hexes.forEach((hex) => {
    if (!hex || typeof hex.k !== "string") throw new TypeError("Hexágono inválido.");
    const coordinates = hex.k.split(",").map(Number);
    if (coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(value))) {
      throw new TypeError(`Coordenada hexagonal inválida: ${hex.k}`);
    }
    const center = hexCenter(coordinates[0], coordinates[1]);
    const corners = [];
    for (let cornerIndex = 0; cornerIndex < 6; cornerIndex += 1) {
      const point = cornerPoint(center.x, center.y, cornerIndex);
      const key = vertexKey(point.x, point.y);
      corners.push(key);
      if (!verts[key]) verts[key] = { x: point.x, y: point.y, hexes: [], edges: [] };
      verts[key].hexes.push(hex.k);
    }
    hexMap[hex.k] = { ...hex, center, corners };
    for (let cornerIndex = 0; cornerIndex < 6; cornerIndex += 1) {
      const first = corners[cornerIndex];
      const second = corners[(cornerIndex + 1) % 6];
      const key = edgeKey(first, second);
      if (!edges[key]) edges[key] = { a: first, b: second, hexes: [] };
      edges[key].hexes.push(hex.k);
    }
  });

  Object.entries(edges).forEach(([key, edge]) => {
    verts[edge.a].edges.push(key);
    verts[edge.b].edges.push(key);
  });
  Object.values(verts).forEach((vertex) => {
    vertex.edges = [...new Set(vertex.edges)];
  });
  return { verts, edges, hexMap };
}
