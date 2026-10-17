// ============================================================
// CLEANOVA AI MODULE - Đánh giá & confusion matrix
// ============================================================
// Cung cấp:
//   - confusionMatrix(): bảng nhầm lẫn NxN + các chỉ số phái sinh
//   - formatConfusionMatrix(): in bảng ra console
//   - makeEarlyStopping(): callback dừng sớm theo val_loss
// ============================================================

const { LABELS, LABEL_DISPLAY } = require('./labels');

/**
 * Tính confusion matrix từ mảng nhãn thật & nhãn dự đoán.
 *
 * @param {string[]} yTrue
 * @param {string[]} yPred
 * @returns {{
 *   matrix: object,        // matrix[thật][đoán] = số lượng
 *   labels: string[],
 *   total: number,
 *   correct: number,
 *   accuracy: number,
 *   perClass: object,      // precision/recall/f1 từng lớp
 *   pairErrors: object     // lỗi giữa từng CẶP lớp (để kiểm mục tiêu <10%)
 * }}
 */
function confusionMatrix(yTrue, yPred) {
  const matrix = {};
  for (const a of LABELS) {
    matrix[a] = {};
    for (const b of LABELS) matrix[a][b] = 0;
  }

  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const t = yTrue[i];
    const p = yPred[i];
    if (matrix[t] && matrix[t][p] !== undefined) {
      matrix[t][p] += 1;
      if (t === p) correct += 1;
    }
  }

  const total = yTrue.length;

  // precision / recall / f1 từng lớp
  const perClass = {};
  for (const c of LABELS) {
    const tp = matrix[c][c];
    let fp = 0; let fn = 0;
    for (const o of LABELS) {
      if (o === c) continue;
      fp += matrix[o][c];   // lớp khác bị đoán thành c
      fn += matrix[c][o];   // c bị đoán thành lớp khác
    }
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
    perClass[c] = {
      tp, fp, fn,
      precision: round3(precision),
      recall: round3(recall),
      f1: round3(f1),
      support: tp + fn
    };
  }

  // Lỗi giữa từng CẶP lớp (không tính chiều đúng)
  // Ví dụ pairErrors['hoi-ban->rat-ban'] = số ảnh hoi-ban bị đoán rat-ban
  const pairErrors = {};
  for (const a of LABELS) {
    for (const b of LABELS) {
      if (a === b) continue;
      pairErrors[`${a}->${b}`] = matrix[a][b];
    }
  }

  return {
    matrix,
    labels: LABELS,
    total,
    correct,
    accuracy: round3(total ? correct / total : 0),
    perClass,
    pairErrors
  };
}

function round3(v) {
  return Math.round((v || 0) * 1000) / 1000;
}

/**
 * In confusion matrix ra console dạng bảng.
 * @param {object} cm - kết quả từ confusionMatrix()
 */
function formatConfusionMatrix(cm) {
  const lines = [];
  lines.push('  Confusion matrix (hàng = nhãn THẬT, cột = model ĐOÁN)');
  lines.push('');

  const w = 12;
  let head = '  ' + 'thật \\ đoán'.padEnd(w);
  for (const c of cm.labels) head += LABEL_DISPLAY[c].padStart(w);
  head += '   recall';
  lines.push(head);

  for (const a of cm.labels) {
    let row = '  ' + LABEL_DISPLAY[a].padEnd(w);
    for (const b of cm.labels) {
      const v = cm.matrix[a][b];
      const mark = (a === b) ? '✓' : ' ';
      row += `${String(v).padStart(w - 1)}${mark} `;
    }
    row += '  ' + (cm.perClass[a].recall * 100).toFixed(1) + '%';
    lines.push(row);
  }

  lines.push('');
  lines.push(`  Độ chính xác tổng: ${cm.correct}/${cm.total}  (${(cm.accuracy * 100).toFixed(1)}%)`);
  lines.push('');
  lines.push('  Theo từng lớp:');
  for (const c of cm.labels) {
    const p = cm.perClass[c];
    lines.push('   - ' + LABEL_DISPLAY[c].padEnd(10)
      + `precision ${(p.precision * 100).toFixed(1)}%`
      + `  recall ${(p.recall * 100).toFixed(1)}%`
      + `  f1 ${(p.f1 * 100).toFixed(1)}%`
      + `  (n=${p.support})`);
  }
  return lines.join('\n');
}

/**
 * Kiểm tra mục tiêu: nhầm lẫn giữa 2 lớp cụ thể phải < ngưỡng.
 *
 * Tỉ lệ nhầm = (số ảnh A bị đoán B + số ảnh B bị đoán A) / (tổng ảnh A + B)
 *
 * @param {object} cm
 * @param {string} a
 * @param {string} b
 * @returns {{rate:number, count:number, total:number, pass:boolean}}
 */
function pairConfusionRate(cm, a, b) {
  const ab = cm.matrix[a][b];
  const ba = cm.matrix[b][a];
  const total = cm.perClass[a].support + cm.perClass[b].support;
  const rate = total > 0 ? (ab + ba) / total : 0;
  return {
    rate: round3(rate),
    count: ab + ba,
    total,
    pass: rate < 0.10
  };
}

/**
 * Tạo bộ đếm early stopping theo val_loss.
 *
 * LƯU Ý: tfjs KHÔNG có callback tf.keras.callbacks.EarlyStopping.
 * Ta tự cài: theo dõi val_loss, nếu không cải thiện sau `patience` epoch thì
 * gọi model.stopTraining = true để dừng. Đồng thời lưu lại trọng số tốt nhất.
 *
 * @param {object} opts
 * @param {number} opts.patience - số epoch chờ (mặc định 7)
 * @param {number} opts.minDelta - mức cải thiện tối thiểu (mặc định 0.001)
 * @returns {{onEpochEnd:function, best:object, shouldStop:function}}
 */
function makeEarlyStopping(opts = {}) {
  const patience = opts.patience === undefined ? 7 : opts.patience;
  const minDelta = opts.minDelta === undefined ? 0.001 : opts.minDelta;

  const state = {
    bestValLoss: Infinity,
    bestEpoch: -1,
    bestWeights: null,
    wait: 0,
    stopped: false,
    history: []
  };

  return {
    state,
    /**
     * Gọi trong onEpochEnd. Trả về {improved, waitLeft}.
     */
    async onEpochEnd(epoch, logs, model) {
      const vl = logs.val_loss !== undefined ? logs.val_loss : logs.loss;
      state.history.push({ epoch, valLoss: vl, valAcc: logs.val_acc });

      const improved = (state.bestValLoss - vl) > minDelta;
      if (improved) {
        state.bestValLoss = vl;
        state.bestEpoch = epoch;
        state.wait = 0;
        // Lưu trọng số tốt nhất
        if (model) {
          if (state.bestWeights) state.bestWeights.forEach(t => t.dispose());
          state.bestWeights = model.getWeights().map(w => w.clone());
        }
      } else {
        state.wait += 1;
        if (state.wait >= patience) {
          state.stopped = true;
          if (model) model.stopTraining = true;
        }
      }
      return { improved, waitLeft: patience - state.wait };
    },
    /** Khôi phục trọng số tốt nhất vào model. */
    restoreBest(model) {
      if (state.bestWeights && model) {
        model.setWeights(state.bestWeights);
      }
    },
    dispose() {
      if (state.bestWeights) {
        state.bestWeights.forEach(t => t.dispose());
        state.bestWeights = null;
      }
    }
  };
}

module.exports = {
  confusionMatrix,
  formatConfusionMatrix,
  pairConfusionRate,
  makeEarlyStopping
};
