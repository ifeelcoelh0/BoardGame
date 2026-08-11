import { useState } from "react";
import "../../styles/player-rail.css";

/**
 * Progressive disclosure for public player information.
 * Hover/focus expands every banner for comparison; each PlayerBanner owns its
 * explicit click-through detail state independently.
 */
export default function PlayerRail({ children, embedded = false }) {
  const [overview, setOverview] = useState(false);
  return (
    <div
      className={`rd-player-rail${overview ? " is-overview" : ""}${embedded ? " rd-player-rail--embedded" : ""}`}
      onPointerEnter={() => setOverview(true)}
      onPointerLeave={() => setOverview(false)}
      onFocusCapture={() => setOverview(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOverview(false);
      }}
      aria-label="Casas do reino"
    >
      {children}
    </div>
  );
}
