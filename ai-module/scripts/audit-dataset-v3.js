'use strict';
const fs = require('fs');
const path = require('path');
const { fingerprint, distance } = require('../src/v3/benchmark');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/audit-dataset-v3.js <dataset-directory> [private-output.json]');
  const root = path.resolve(process.argv[2]), records = [], counts = {}, unreadable = [];
  for (const label of ['sach', 'hoi-ban', 'rat-ban']) {
    const folder = path.join(root, label);
    const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort() : [];
    counts[label] = files.length;
    for (const file of files) {
      try { records.push({ label, file, ...await fingerprint(path.join(folder, file)) }); }
      catch { unreadable.push({ label, file }); }
    }
  }
  const exact = [], near = [];
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    if (a.sha256 === b.sha256) exact.push({ a: `${a.label}/${a.file}`, b: `${b.label}/${b.file}`, crossLabel: a.label !== b.label });
    else if (distance(a.dhash, b.dhash) <= 6) near.push({ a: `${a.label}/${a.file}`, b: `${b.label}/${b.file}`, crossLabel: a.label !== b.label });
  }
  const report = { counts, readable: records.length, unreadable, exactDuplicatePairs: exact,
    nearDuplicateCandidates: near, note: 'dHash <= 6 flags candidates for HUMAN review; not proof of the same room. No room provenance or six-criterion labels inferred.' };
  const output = path.resolve(process.argv[3] || path.join(__dirname, '../.cache/dataset-audit.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ counts, readable: records.length, unreadable: unreadable.length,
    exactDuplicatePairs: exact.length, exactCrossLabelPairs: exact.filter(p => p.crossLabel).length,
    nearDuplicateCandidates: near.length, output }));
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
