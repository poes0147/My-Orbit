import { strengthsTaxonomy } from './taxonomy';
import type { StrengthExperience, StrengthExtraction } from './schema';

const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
const compact = (text: string) => normalize(text).replace(/[\s\p{P}]/gu, '');
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function similarity(a: string, b: string) {
  const grams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3)));
  const left = grams(compact(a)), right = grams(compact(b));
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / (new Set([...left, ...right]).size || 1);
}

export function rankStrengths(experiences: StrengthExperience[], extractions: StrengthExtraction[]) {
  const ordered = [...experiences].sort((a, b) => compare(a.id, b.id));
  const canonical = new Map<string, string>();
  for (const experience of ordered) {
    const match = ordered.find(other => compare(other.id, experience.id) < 0 && (
      compact(other.action) === compact(experience.action) ||
      (similarity(other.action, experience.action) > 0.6 && similarity(other.title, experience.title) > 0.6)
    ));
    canonical.set(experience.id, match ? canonical.get(match.id)! : experience.id);
  }
  const candidates = strengthsTaxonomy.map(meta => {
    const evidence: { quote: string; experienceTitle: string; experienceId: string; field: string }[] = [];
    for (const item of [...extractions].sort((a, b) => compare(`${a.experienceId}:${a.field}:${a.quote}`, `${b.experienceId}:${b.field}:${b.quote}`))) {
      if (item.strengthId !== meta.id || item.actor !== 'self' || item.modality !== 'performed') continue;
      const source = experiences.find(exp => exp.id === item.experienceId);
      if (!source) continue;
      const quote = normalize(item.quote), original = normalize(source[item.field]);
      if (quote.length < 5 || !original.includes(quote)) continue;
      // Contextual extraction is primary. These checks reject obvious invalid spans even if the model mislabeled them.
      const context = (source[item.field].split(/[.!?。\n]/).map(normalize).filter(sentence => sentence.includes(quote.replace(/[.!?。]+$/, ''))).join(' ') || quote)
        .replace(/포기하지\s*않고/g, '계속');
      if (/하지\s*(않|못)|안\s*했|못\s*했|하고\s*싶|할\s*(예정|계획)|(?:선배|동료|팀원|상사)(?:가|는)\s/.test(context)) continue;
      if (new Set(quote.split(/\s+/)).size <= 1 || /^[\s\p{L}]+$/u.test(quote) && !/(했|하였|했다|함|한 |하여|하며|만들|바꿨|확인|정리|분류|비교|기록|배웠|진행|수정|조정)/.test(quote)) continue;
      const experienceId = canonical.get(source.id)!;
      const existing = evidence.filter(ev => ev.experienceId === experienceId);
      if (existing.length >= 2 || existing.some(ev => compact(ev.quote).includes(compact(quote)) || compact(quote).includes(compact(ev.quote)) || similarity(ev.quote, quote) > 0.8)) continue;
      evidence.push({ quote, experienceTitle: source.title, experienceId, field: item.field });
    }
    return { strengthId: meta.id, name: meta.name, clusterName: meta.clusterName,
      reason: `제출한 경험에서 ‘${meta.definition}’에 해당하는 행동을 찾았어요.`,
      distinctExperienceCount: new Set(evidence.map(ev => ev.experienceId)).size, evidences: evidence };
  }).filter(candidate => candidate.evidences.length).sort((a, b) =>
    b.distinctExperienceCount - a.distinctExperienceCount || b.evidences.length - a.evidences.length || compare(a.strengthId, b.strengthId));
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    const redundant = candidate.evidences.every(ev => selected.some(prior => prior.evidences.some(other =>
      other.experienceId === ev.experienceId && (compact(other.quote).includes(compact(ev.quote)) || compact(ev.quote).includes(compact(other.quote)) || similarity(other.quote, ev.quote) > 0.8))));
    if (!redundant) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return selected;
}
