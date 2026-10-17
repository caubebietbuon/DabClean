// Kiểm tra module metrics: confusion matrix, pair rate, early stopping
const {
  confusionMatrix,
  formatConfusionMatrix,
  pairConfusionRate,
  makeEarlyStopping
} = require('../src/ml/metrics');

// ---- Test 1: confusion matrix với dữ liệu biết trước ----
const yTrue = [
  'sach', 'sach', 'sach', 'sach',
  'hoi-ban', 'hoi-ban', 'hoi-ban', 'hoi-ban', 'hoi-ban', 'hoi-ban',
  'rat-ban', 'rat-ban', 'rat-ban', 'rat-ban', 'rat-ban', 'rat-ban'
];
const yPred = [
  'sach', 'sach', 'sach', 'sach',              // 4/4 đúng
  'hoi-ban', 'hoi-ban', 'hoi-ban', 'hoi-ban', 'hoi-ban', 'rat-ban', // 5 đúng, 1 nhầm
  'rat-ban', 'rat-ban', 'rat-ban', 'rat-ban', 'hoi-ban', 'hoi-ban' // 4 đúng, 2 nhầm
];

const cm = confusionMatrix(yTrue, yPred);

console.log(formatConfusionMatrix(cm));
console.log('');

// ---- Test 2: kiểm tra số liệu có khớp với dữ liệu đầu vào không ----
const checks = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push([label, ok, actual, expected]);
}

check('tổng số', cm.total, 16);
check('số đúng', cm.correct, 13);
check('sach: 4 đúng', cm.matrix.sach.sach, 4);
check('hoi-ban: 5 đúng', cm.matrix['hoi-ban']['hoi-ban'], 5);
check('rat-ban: 4 đúng', cm.matrix['rat-ban']['rat-ban'], 4);
check('hoi-ban->rat-ban = 1', cm.matrix['hoi-ban']['rat-ban'], 1);
check('rat-ban->hoi-ban = 2', cm.matrix['rat-ban']['hoi-ban'], 2);

// ---- Test 3: pair confusion rate ----
// hoi-ban↔rat-ban: 1 + 2 = 3 nhầm / (6 + 6) = 12 ảnh -> 25%
const pr = pairConfusionRate(cm, 'hoi-ban', 'rat-ban');
check('pair count', pr.count, 3);
check('pair total', pr.total, 12);
check('pair rate 25%', pr.rate, 0.25);
check('pair khong dat (<10%)', pr.pass, false);

// sach↔hoi-ban: 0 nhầm -> 0%
const pr2 = pairConfusionRate(cm, 'sach', 'hoi-ban');
check('sach-hoi count', pr2.count, 0);
check('sach-hoi dat', pr2.pass, true);

// ---- Test 4: early stopping ----
(async () => {
  const es = makeEarlyStopping({ patience: 3, minDelta: 0.001 });
  const fakeModel = { getWeights: () => [], setWeights: () => {}, stopTraining: false };

  // val_loss giảm dần rồi đi ngang
  const losses = [0.90, 0.60, 0.40, 0.30, 0.31, 0.32, 0.33, 0.34];
  for (let i = 0; i < losses.length; i += 1) {
    await es.onEpochEnd(i, { val_loss: losses[i], val_acc: 0.8 }, fakeModel);
    if (es.state.stopped) break;
  }
  check('early stop đã dừng', es.state.stopped, true);
  check('epoch tốt nhất = 3', es.state.bestEpoch, 3);
  check('bestValLoss = 0.30', es.state.bestValLoss, 0.30);
  es.dispose();

  // ---- In kết quả ----
  console.log('');
  console.log('='.repeat(60));
  let failed = 0;
  for (const [label, ok, actual, expected] of checks) {
    if (!ok) {
      failed += 1;
      console.log(`  X ${label}`);
      console.log(`      thuc te : ${JSON.stringify(actual)}`);
      console.log(`      mong doi: ${JSON.stringify(expected)}`);
    } else {
      console.log(`  V ${label}`);
    }
  }
  console.log('='.repeat(60));
  console.log(failed === 0
    ? `  TAT CA ${checks.length} KIEM TRA DEU DAT`
    : `  CO ${failed}/${checks.length} KIEM TRA KHONG DAT`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
