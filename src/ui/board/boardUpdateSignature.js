export function stableSpotKey(spots) {
  return [...(spots || [])].sort().join("|");
}

function boardHexGeometrySignature(hex) {
  return [hex?.k, hex?.terr, hex?.num ?? "", hex?.hid ? 1 : 0, hex?.lair ? 1 : 0].join(":");
}

function boardPortGeometrySignature(port) {
  return [port?.e, port?.type, port?.hid ? 1 : 0].join(":");
}

/**
 * Identidade estritamente geométrica da cena 3D.
 *
 * Construções, recursos, turnos e revisões não pertencem aqui: são atualizações
 * incrementais da cena. Só uma alteração que muda o próprio tabuleiro (por
 * exemplo revelar um hexágono) deve recriar o controller. Isso mantém a câmara
 * local do jogador intacta entre ações autoritativas.
 */
export function stableBoardGeometryKey(board) {
  if (!board || !Array.isArray(board.hexes)) return "board:none";
  const hexes = board.hexes.map(boardHexGeometrySignature).sort();
  const ports = (board.ports || []).map(boardPortGeometrySignature).sort();
  return `${hexes.join("|")}#${ports.join("|")}`;
}
