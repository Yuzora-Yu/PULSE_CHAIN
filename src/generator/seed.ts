import type { Request } from '../core/model';
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Frozen GEN-V1: FNV-1a UTF-16 seed hash + Mulberry32. */
export function random(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const difficultyLetters = { easy: 'E', normal: 'N', hard: 'H', expert: 'X', extreme: 'Z' } as const;
export function puzzleCode(r: Request) {
  return `PC1-${r.mode[0].toUpperCase()}-${difficultyLetters[r.difficulty]}-${r.key}`;
}
export function parseCode(code: string): Request {
  const match = /^PC1-([CID])-([ENHXZ])-([A-Za-z0-9-]{1,40})$/.exec(code.trim().toUpperCase());
  if (!match) throw new Error('Puzzle Code を確認してください（PC1-…）');
  const mode = ({ C: 'campaign', I: 'infinite', D: 'daily' } as const)[match[1] as 'C' | 'I' | 'D'];
  const difficulty = ({ E: 'easy', N: 'normal', H: 'hard', X: 'expert', Z: 'extreme' } as const)[
    match[2] as 'E' | 'N' | 'H' | 'X' | 'Z'
  ];
  if (mode === 'campaign' && !/^[1-9]\d{0,8}$/.test(match[3])) throw new Error('Stage 番号が無効です');
  if (
    mode === 'daily' &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(match[3]) ||
      Number.isNaN(Date.parse(match[3])) ||
      new Date(match[3]).toISOString().slice(0, 10) !== match[3])
  )
    throw new Error('日付が無効です');
  return { mode, difficulty, key: match[3] };
}
export const campaignRequest = (stage: number): Request => ({
  mode: 'campaign',
  key: String(stage),
  difficulty:
    stage <= 20 || stage % 10 === 0
      ? 'easy'
      : stage < 80 || stage % 10 < 3
        ? 'normal'
        : stage < 450
          ? 'hard'
          : stage < 900
            ? 'expert'
            : 'extreme',
});
