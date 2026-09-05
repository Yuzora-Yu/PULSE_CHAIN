export const utcDay = () => new Date().toISOString().slice(0, 10);
export function recentDays(count = 14, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}
export function dailyProgress(best: Record<string, number>, now = new Date()) {
  const days = Object.keys(best)
    .filter((k) => k.startsWith('PC1-D-N-'))
    .map((k) => k.slice(8))
    .sort();
  const set = new Set(days);
  let streak = 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!set.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { days, set, streak };
}
