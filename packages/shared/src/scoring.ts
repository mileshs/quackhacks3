export type ScoreBand = "PERFECT" | "CLEAN" | "CRASH";

export function clampMatchPercent(matchPercent: number) {
  return Math.max(0, Math.min(100, matchPercent));
}

export function scoreFromMatch(matchPercent: number) {
  const match = clampMatchPercent(matchPercent);
  const t = Math.max(0, Math.min(1, (match - 70) / 30));
  const k = 2;

  return Math.round(100 * ((Math.exp(k * t) - 1) / (Math.exp(k) - 1)));
}

export function scoreBandFromMatch(matchPercent: number): ScoreBand {
  const match = clampMatchPercent(matchPercent);

  if (match >= 90) {
    return "PERFECT";
  }

  if (match >= 70) {
    return "CLEAN";
  }

  return "CRASH";
}
