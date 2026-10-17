// Kiểm tra logic chia train/validation của train.js
// Mục tiêu: xác nhận KHÔNG rò rỉ dữ liệu (biến thể augmentation của cùng
// một ảnh gốc không được nằm ở cả train lẫn validation).
//
// Vì train.js chạy main() ngay khi require, ta không thể import trực tiếp.
// Nên ở đây chép lại 2 hàm cần kiểm và test độc lập — nhưng DÙNG CÙNG thuật
// toán, và so khớp với kỳ vọng.

const { LABELS } = require('../src/ml/labels');

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildGroupIds(items, augmentPerImage, totalSamples) {
  const groupIds = [];
  const nItems = items.length;
  for (let i = 0; i < nItems && groupIds.length < totalSamples; i += 1) {
    groupIds.push(i);
  }
  if (augmentPerImage > 0) {
    let itemIdx = 0;
    let countInGroup = 0;
    while (groupIds.length < totalSamples) {
      groupIds.push(itemIdx);
      countInGroup += 1;
      if (countInGroup >= augmentPerImage) {
        itemIdx += 1;
        countInGroup = 0;
      }
      if (itemIdx >= nItems) itemIdx = nItems - 1;
    }
  }
  return groupIds;
}

function groupStratifiedSplit(allLabels, groupIds, splitRatio, seed) {
  const rng = makeRng(seed);
  const groupsByClass = {};
  for (let i = 0; i < allLabels.length; i += 1) {
    const cls = allLabels[i];
    const gid = groupIds[i];
    if (!groupsByClass[cls]) groupsByClass[cls] = new Map();
    const m = groupsByClass[cls];
    if (!m.has(gid)) m.set(gid, []);
    m.get(gid).push(i);
  }
  const trainIdx = [];
  const valIdx = [];
  for (const cls of Object.keys(groupsByClass)) {
    const entries = Array.from(groupsByClass[cls].values());
    for (let i = entries.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const nValGroups = Math.max(1, Math.round(entries.length * splitRatio));
    entries.forEach((idxs, k) => {
      if (k < nValGroups) valIdx.push(...idxs);
      else trainIdx.push(...idxs);
    });
  }
  return { trainIdx, valIdx };
}

// ---- Dữ liệu giả: 3 lớp, mỗi lớp vài ảnh gốc, mỗi ảnh 3 biến thể ----
const AUG = 3;
const items = [];
const labels = [];
const clsPlan = [['sach', 5], ['hoi-ban', 6], ['rat-ban', 6]];
for (const [cls, n] of clsPlan) {
  for (let i = 0; i < n; i += 1) {
    items.push({ label: cls });
    labels.push(cls);
  }
}
const nItems = items.length;
const samplesPerItem = 1 + AUG;
const totalSamples = nItems * samplesPerItem;

// Mảng nhãn của mọi mẫu (gốc + biến thể) theo đúng thứ tự dataset.js tạo
const allLabels = [];
for (const it of items) allLabels.push(it.label);          // ảnh gốc
for (const it of items) {
  for (let k = 0; k < AUG; k += 1) allLabels.push(it.label); // biến thể
}

const groupIds = buildGroupIds(items, AUG, totalSamples);
const { trainIdx, valIdx } = groupStratifiedSplit(allLabels, groupIds, 0.2, 12345);

// ---- Kiểm tra ----
const checks = [];

checks.push(['số mẫu = items x (1+augment)',
  allLabels.length === totalSamples]);
checks.push(['groupIds dài bằng số mẫu',
  groupIds.length === totalSamples]);
checks.push(['train + val = tổng',
  trainIdx.length + valIdx.length === totalSamples]);

// 1. KHÔNG rò rỉ: không groupId nào xuất hiện ở cả 2 phía
const trainGroups = new Set(trainIdx.map(i => groupIds[i]));
const valGroups = new Set(valIdx.map(i => groupIds[i]));
let leak = 0;
for (const g of valGroups) if (trainGroups.has(g)) leak += 1;
checks.push(['KHÔNG rò rỉ (0 nhóm ở cả 2 phía)', leak === 0]);

// 2. Mỗi nhóm nằm TRỌN VẸN một phía
let splitGroups = 0;
const groupSide = new Map();
for (const i of trainIdx) {
  const g = groupIds[i];
  if (groupSide.has(g) && groupSide.get(g) !== 'train') splitGroups += 1;
  groupSide.set(g, 'train');
}
for (const i of valIdx) {
  const g = groupIds[i];
  if (groupSide.has(g) && groupSide.get(g) !== 'val') splitGroups += 1;
  groupSide.set(g, 'val');
}
checks.push(['mỗi nhóm trọn vẹn một phía', splitGroups === 0]);

// 3. Validation có ĐỦ 3 lớp (phân tầng)
const valCls = new Set(valIdx.map(i => allLabels[i]));
checks.push(['validation có đủ 3 lớp', valCls.size === 3]);

// 4. Tỉ lệ val xấp xỉ 20%
const ratio = valIdx.length / totalSamples;
checks.push([`tỉ lệ val ~20% (thực ${(ratio * 100).toFixed(1)}%)`,
  ratio > 0.15 && ratio < 0.25]);

// 5. Nhóm kích thước đúng (mỗi nhóm = 1 + AUG mẫu)
const groupSizes = {};
for (const i of [...trainIdx, ...valIdx]) {
  const g = groupIds[i];
  groupSizes[g] = (groupSizes[g] || 0) + 1;
}
const sizesOk = Object.values(groupSizes).every(s => s === samplesPerItem);
checks.push([`mỗi nhóm có đúng ${samplesPerItem} mẫu`, sizesOk]);

// ---- In ----
console.log('  Cau hinh test:');
console.log(`   - So anh goc   : ${nItems}`);
console.log(`   - Augment/ anh : ${AUG}`);
console.log(`   - Tong mau     : ${totalSamples}`);
console.log('');
console.log(`   - Train mau    : ${trainIdx.length}  (${trainGroups.size} nhom)`);
console.log(`   - Val mau      : ${valIdx.length}  (${valGroups.size} nhom)`);
console.log('');

const valByClass = {};
valIdx.forEach(i => { valByClass[allLabels[i]] = (valByClass[allLabels[i]] || 0) + 1; });
console.log('   Phan bo val theo lop: ' + LABELS.map(l => `${l}=${valByClass[l] || 0}`).join('  '));
console.log('');

console.log('='.repeat(64));
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? 'V' : 'X'} ${label}`);
  if (!ok) failed += 1;
}
console.log('='.repeat(64));
console.log(failed === 0
  ? `  TAT CA ${checks.length} KIEM TRA DEU DAT (khong ro ri du lieu)`
  : `  CO ${failed}/${checks.length} KHONG DAT`);
process.exitCode = failed === 0 ? 0 : 1;
