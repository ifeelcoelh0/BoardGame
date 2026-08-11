import ResourceIcon from "./ResourceIcon.jsx";

export default function ResourceCost({ cost = {}, compact = false }) {
  const entries = Object.entries(cost).filter(([, amount]) => Number(amount) > 0);
  if (!entries.length) return null;
  return (
    <span className={`rd-resource-cost${compact ? " rd-resource-cost--compact" : ""}`}>
      {entries.map(([resource, amount]) => (
        <span key={resource} className="rd-resource-cost__item">
          <ResourceIcon resource={resource} size={compact ? 14 : 17} />
          <b>{amount}</b>
        </span>
      ))}
    </span>
  );
}
