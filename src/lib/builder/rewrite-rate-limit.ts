const history = new Map<string, number[]>();

export function rewriteLimited(key: string, limit: number, now = Date.now()) {
  if (history.size > 10000) for (const [id, times] of history) if (times.every(t => now - t >= 60000)) history.delete(id);
  const recent = (history.get(key) ?? []).filter(t => now - t < 60000);
  if (recent.length >= limit) return true;
  history.set(key, [...recent, now]);
  return false;
}
