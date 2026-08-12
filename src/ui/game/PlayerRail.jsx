import "../../styles/player-rail.css";

/**
 * Coluna fixa de estado dos jogadores. Cada casa fica sempre legível e os
 * detalhes continuam disponíveis por clique no respetivo banner.
 */
export default function PlayerRail({ children, embedded = false }) {
  return (
    <div
      className={`rd-player-rail${embedded ? " rd-player-rail--embedded" : ""}`}
      aria-label="Casas do reino"
    >
      {children}
    </div>
  );
}
