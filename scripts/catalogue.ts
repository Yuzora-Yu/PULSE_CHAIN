import { writeFileSync } from 'node:fs';
import { generate } from '../src/generator/generate';
import { campaignRequest, hash } from '../src/generator/seed';
const entries = [];
for (let stage = 1; stage <= 300; stage++) {
  const p = generate(campaignRequest(stage));
  entries.push({ stage, attempt: p.attempt, par: p.solution.par, hash: hash(JSON.stringify(p.board)) });
  if (stage % 50 === 0) console.log(`Campaign ${stage}/300 verified`);
}
writeFileSync(
  'docs/campaign-v1-manifest.json',
  JSON.stringify(
    { ruleVersion: 1, generatorVersion: 1, review: 'solver-certified; human playtest pending', entries },
    null,
    2,
  ),
);
