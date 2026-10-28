'use strict';

// Split complete rooms/source groups globally, even when one room has different class labels.
function groupSplit(labels, groupIds, ratio = 0.2, seed = 20261017) {
  if (labels.length !== groupIds.length || !(ratio > 0 && ratio < 1)) throw new Error('Invalid split inputs');
  const groups = new Map();
  groupIds.forEach((id, i) => {
    if (id === null || id === undefined || id === '') throw new Error('Missing room/source group');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(i);
  });
  if (groups.size < 2) throw new Error('Need at least two independent rooms/source groups');
  const entries = [...groups.entries()].sort(([a], [b]) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  let state = seed >>> 0;
  for (let i = entries.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 4294967296 * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  const count = Math.min(entries.length - 1, Math.max(1, Math.round(entries.length * ratio)));
  const valIdx = entries.slice(0, count).flatMap(([, indices]) => indices);
  const trainIdx = entries.slice(count).flatMap(([, indices]) => indices);
  // Small datasets may lack a class on either side. Never silently publish a misleading validation.
  for (const label of new Set(labels)) {
    if (!trainIdx.some(i => labels[i] === label) || !valIdx.some(i => labels[i] === label)) {
      throw new Error(`Class ${label} absent from train/validation after room grouping; add independent rooms or choose a documented seed.`);
    }
  }
  return { trainIdx, valIdx };
}
module.exports = { groupSplit };
