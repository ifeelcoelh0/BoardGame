export function deriveGameOverlayVisibility(presentation, seat, dismissedIds, now = Date.now()) {
  const dismissed = dismissedIds instanceof Set ? dismissedIds : new Set();
  const cardEvent = presentation?.cardReveal || null;
  const disasterEvent = presentation?.disaster || null;
  const awardEvent = presentation?.award || null;
  const storyEvent = presentation?.story || null;
  const cardVisible = !!(cardEvent && cardEvent.pi !== seat && !dismissed.has(cardEvent.id));
  const disasterVisible = !!(disasterEvent && !cardVisible && !dismissed.has(disasterEvent.id));
  const awardVisible = !!(awardEvent && !cardVisible && !disasterVisible && !dismissed.has(awardEvent.id));
  const storyAvailable = storyEvent && !cardVisible && !disasterVisible && !awardVisible && !dismissed.has(storyEvent.id);
  const dragonStoryVisible = !!(storyAvailable && storyEvent.kind === "dragao" && now - storyEvent.id < 30_000);
  const storyVisible = !!(storyAvailable && storyEvent.kind !== "dragao" && now - storyEvent.id < 30_000 && (storyEvent.kind !== "gelo" || now - storyEvent.id > 1450));
  return { cardEvent, disasterEvent, awardEvent, storyEvent, cardVisible, disasterVisible, awardVisible, dragonStoryVisible, storyVisible };
}
