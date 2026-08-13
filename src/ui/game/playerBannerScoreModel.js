function safeScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function playerBannerScore({ publicVictoryPoints = 0, secretVictoryPoints = 0, isLocal = false } = {}) {
  const publicScore = safeScore(publicVictoryPoints);
  const secretScore = isLocal ? safeScore(secretVictoryPoints) : 0;
  const total = publicScore + secretScore;
  return Object.freeze({
    publicScore,
    secretScore,
    total,
    hasPrivateTotal: isLocal && secretScore > 0,
  });
}
