export type Save = {
  version: 1;
  stage: number;
  best: Record<string, number>;
  perfect: string[];
  favorites: string[];
  ratings: Record<string, number>;
  session?: { code: string; moves: number[] };
  maxChain: number;
  settings: {
    sound: boolean;
    motion: boolean;
    contrast: boolean;
    volume: number;
    haptics: boolean;
    reducedSound: boolean;
  };
};
export const defaultSave = (): Save => ({
  version: 1,
  stage: 1,
  best: {},
  perfect: [],
  favorites: [],
  ratings: {},
  maxChain: 0,
  settings: {
    sound: false,
    motion: typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches,
    contrast: false,
    volume: 0.3,
    haptics: false,
    reducedSound: false,
  },
});
export function migrate(raw: unknown): Save {
  const fallback = defaultSave();
  if (!raw || typeof raw !== 'object') return fallback;
  const s = raw as Partial<Save>;
  if (s.version !== 1) return fallback;
  if (Number.isSafeInteger(s.stage) && s.stage! > 0 && s.stage! <= 999999999) fallback.stage = s.stage!;
  if (Number.isFinite(s.maxChain) && s.maxChain! >= 0) fallback.maxChain = s.maxChain!;
  if (s.best && typeof s.best === 'object')
    for (const [k, v] of Object.entries(s.best))
      if (/^PC1-[CID]-[ENHXZ]-[A-Za-z0-9-]{1,40}$/.test(k) && Number.isInteger(v) && v >= 1)
        fallback.best[k] = v;
  for (const k of ['perfect', 'favorites'] as const)
    if (Array.isArray(s[k]))
      fallback[k] = [
        ...new Set(
          s[k].filter((c) => typeof c === 'string' && /^PC1-[CID]-[ENHXZ]-[A-Za-z0-9-]{1,40}$/.test(c)),
        ),
      ];
  if (s.ratings && typeof s.ratings === 'object')
    for (const [k, v] of Object.entries(s.ratings))
      if (/^PC1-[CID]-[ENHXZ]-[A-Za-z0-9-]{1,40}$/.test(k) && Number.isInteger(v) && v >= 1 && v <= 5)
        fallback.ratings[k] = v;
  if (
    s.session &&
    typeof s.session.code === 'string' &&
    /^PC1-[CID]-[ENHXZ]-[A-Za-z0-9-]{1,40}$/.test(s.session.code) &&
    Array.isArray(s.session.moves) &&
    s.session.moves.length <= 28 &&
    s.session.moves.every((id) => Number.isInteger(id) && id >= 0 && id < 28)
  )
    fallback.session = { code: s.session.code, moves: s.session.moves };
  for (const k of ['sound', 'motion', 'contrast', 'haptics', 'reducedSound'] as const)
    if (typeof s.settings?.[k] === 'boolean') fallback.settings[k] = s.settings[k];
  if (typeof s.settings?.volume === 'number' && Number.isFinite(s.settings.volume))
    fallback.settings.volume = Math.min(1, Math.max(0, s.settings.volume));
  return fallback;
}
export function loadSave(): Save {
  try {
    return migrate(JSON.parse(localStorage.getItem('pulse-chain-save-v1') ?? 'null'));
  } catch {
    return defaultSave();
  }
}
export function persist(save: Save): boolean {
  try {
    localStorage.setItem('pulse-chain-save-v1', JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
