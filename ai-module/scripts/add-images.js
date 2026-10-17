// ============================================================
// CLEANOVA AI MODULE - add-images.js
// Thêm ảnh mới vào dataset/ (hoi-ban, rat-ban) một cách AN TOÀN.
//
// Chạy:
//   node scripts/add-images.js --src "d:\folder anh\rat-ban"  --label rat-ban
//   node scripts/add-images.js --src "d:\folder anh\hoi-ban" --label hoi-ban
//   node scripts/add-images.js --from-json sources.json
//
// QUY TẮC AN TOÀN (quan trọng):
//   1. GIỮ NGUYÊN ảnh cũ — không bao giờ ghi đè.
//   2. Đặt tên mới có tiền tố nguồn + timestamp -> không trùng.
//   3. Chỉ nhận ảnh THẬT: kiểm tra MAGIC BYTES, không tin đuôi file.
//   4. PNG/WebP/GIF/BMP/TIFF -> chuyển sang JPEG (sharp).
//   5. Bỏ ảnh hỏng hoặc < 12KB (quá nhỏ để chứa nội dung phòng thật).
//   6. DEDUPE bằng SHA-256, kiểm tra LIÊN LỚP — không để cùng một ảnh
//      xuất hiện ở 2 nhãn khác nhau (sẽ làm model học sai).
//   7. Báo cáo đầy đủ: thêm bao nhiêu, bỏ bao nhiêu và VÌ SAO.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { sniffFormat, FORMAT_LABEL } = require('../src/ml/imageUtils');

const MIN_BYTES = 12 * 1024;       // 12KB
const DATASET_DIR = path.join(__dirname, '..', 'dataset');
const VALID_LABELS = ['sach', 'hoi-ban', 'rat-ban'];

// ------------------------------------------------------------
// Đọc tham số
// ------------------------------------------------------------
function parseArgs(argv) {
  const args = { src: null, label: null, fromJson: null, dryRun: false, quality: 92 };
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--src': args.src = v; i += 1; break;
      case '--label': args.label = v; i += 1; break;
      case '--from-json': args.fromJson = v; i += 1; break;
      case '--quality': args.quality = parseInt(v, 10); i += 1; break;
      case '--dry-run': args.dryRun = true; break;
      default: break;
    }
  }
  return args;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

// ------------------------------------------------------------
// Quét hash của TOÀN BỘ dataset hiện có (mọi lớp) để dedupe liên lớp
// ------------------------------------------------------------
function scanExistingHashes() {
  const hashes = new Map(); // hash -> { label, file }
  const perLabel = {};

  for (const label of VALID_LABELS) {
    const dir = path.join(DATASET_DIR, label);
    const files = listFiles(dir);
    perLabel[label] = files.length;
    for (const f of files) {
      try {
        const h = sha256(fs.readFileSync(f));
        if (!hashes.has(h)) hashes.set(h, { label, file: f });
      } catch { /* bỏ qua file đọc lỗi */ }
    }
  }
  return { hashes, perLabel };
}

// ------------------------------------------------------------
// Chuẩn hoá 1 file nguồn -> Buffer JPEG (hoặc null nếu không hợp lệ)
// ------------------------------------------------------------
async function normalizeToJpeg(sharp, file, quality) {
  const raw = fs.readFileSync(file);

  if (raw.length < MIN_BYTES) {
    return { ok: false, reason: `quá nhỏ (${(raw.length / 1024).toFixed(1)}KB < 12KB)` };
  }

  const format = sniffFormat(raw);
  if (format === 'unknown') {
    return { ok: false, reason: 'không nhận diện được định dạng (không phải ảnh)' };
  }

  // JPEG sẵn -> giữ nguyên byte gốc (không re-encode, tránh mất chất lượng)
  if (format === 'jpeg') {
    // vẫn kiểm tra sharp đọc được (phát hiện ảnh JPEG hỏng/cụt)
    try {
      await sharp(raw).metadata();
    } catch (e) {
      return { ok: false, reason: `JPEG hỏng: ${e.message.slice(0, 40)}` };
    }
    return { ok: true, buffer: raw, converted: false, format };
  }

  // Định dạng khác -> chuyển sang JPEG
  try {
    const buffer = await sharp(raw, { failOn: 'none' })
      .rotate()                     // tôn trọng EXIF orientation
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { ok: true, buffer, converted: true, format };
  } catch (e) {
    return { ok: false, reason: `không chuyển được sang JPEG: ${e.message.slice(0, 40)}` };
  }
}

// ------------------------------------------------------------
// Xử lý 1 thư mục nguồn cho 1 nhãn
// ------------------------------------------------------------
async function addFromDir(sharp, srcDir, label, opts, state) {
  const destDir = path.join(DATASET_DIR, label);
  fs.mkdirSync(destDir, { recursive: true });

  const files = listFiles(srcDir);
  const stamp = Date.now().toString(36);
  const srcTag = path.basename(srcDir).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12) || 'src';

  const report = {
    label,
    srcDir,
    label_new: 0,          // ảnh mới thêm (không trùng)
    dup_in_source: 0,      // trùng trong chính lô nguồn
    dup_existing: 0,       // đã có trong dataset (bất kỳ lớp nào)
    skipped: 0,            // không hợp lệ
    converted: 0,          // đã chuyển từ PNG/WebP/... sang JPEG
    skipReasons: {},
    sampleAdded: []
  };

  const batchHashes = new Set(); // hash trong lô nguồn này

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const short = path.relative(srcDir, file);

    let norm;
    try {
      norm = await normalizeToJpeg(sharp, file, opts.quality);
    } catch (e) {
      norm = { ok: false, reason: `đọc lỗi: ${e.message.slice(0, 40)}` };
    }

    if (!norm.ok) {
      report.skipped += 1;
      report.skipReasons[norm.reason] = (report.skipReasons[norm.reason] || 0) + 1;
      continue;
    }

    const h = sha256(norm.buffer);

    // Trùng trong lô nguồn?
    if (batchHashes.has(h)) {
      report.dup_in_source += 1;
      continue;
    }
    batchHashes.add(h);

    // Trùng với dataset hiện có (BẤT KỲ lớp nào — kể cả khác nhãn)?
    const existing = state.hashes.get(h);
    if (existing) {
      report.dup_existing += 1;
      continue;
    }

    // Đặt tên mới, đảm bảo chưa tồn tại
    let name = `${srcTag}_${stamp}_${String(i).padStart(4, '0')}.jpg`;
    let full = path.join(destDir, name);
    let n = 0;
    while (fs.existsSync(full)) {
      n += 1;
      name = `${srcTag}_${stamp}_${String(i).padStart(4, '0')}_${n}.jpg`;
      full = path.join(destDir, name);
    }

    if (!opts.dryRun) {
      fs.writeFileSync(full, norm.buffer);
    }

    // Ghi nhận để các lô sau không thêm trùng lại
    state.hashes.set(h, { label, file: full });
    report.label_new += 1;
    if (norm.converted) report.converted += 1;
    if (report.sampleAdded.length < 3) {
      report.sampleAdded.push(`${short} -> ${name}${norm.converted ? ` (từ ${FORMAT_LABEL[norm.format]})` : ''}`);
    }

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`\r   ${label}: ${i + 1}/${files.length}...   `);
    }
  }

  process.stdout.write('\r'.padEnd(60) + '\r');
  return report;
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);
  const sharp = require('sharp');

  // Gom danh sách nguồn cần xử lý
  let jobs = [];
  if (args.src && args.label) {
    jobs.push({ srcDir: args.src, label: args.label });
  }
  if (args.fromJson) {
    const cfg = JSON.parse(fs.readFileSync(args.fromJson, 'utf8'));
    jobs = jobs.concat(cfg);
  }

  if (jobs.length === 0) {
    console.error('❌ Thiếu tham số. Dùng --src <thư mục> --label <nhãn>, hoặc --from-json <file>.');
    console.error('   Nhãn hợp lệ: sach | hoi-ban | rat-ban');
    process.exit(1);
  }

  for (const j of jobs) {
    if (!VALID_LABELS.includes(j.label)) {
      console.error(`❌ Nhãn không hợp lệ: "${j.label}". Chỉ nhận: ${VALID_LABELS.join(', ')}`);
      process.exit(1);
    }
    if (!fs.existsSync(j.srcDir)) {
      console.error(`❌ Thư mục nguồn không tồn tại: ${j.srcDir}`);
      process.exit(1);
    }
  }

  console.log('='.repeat(64));
  console.log('  THÊM ẢNH VÀO DATASET');
  console.log('='.repeat(64));
  console.log(`  Dataset đích : ${DATASET_DIR}`);
  if (args.dryRun) console.log('  CHẾ ĐỘ       : --dry-run (KHÔNG ghi file thật)');
  console.log('');

  // Quét trạng thái hiện tại (để dedupe liên lớp)
  console.log('  Đang quét hash của dataset hiện có...');
  const state = scanExistingHashes();
  console.log(`  Số ảnh mỗi lớp TRƯỚC khi thêm:`);
  for (const l of VALID_LABELS) {
    console.log(`   - ${l.padEnd(9)} : ${state.perLabel[l]} ảnh`);
  }
  console.log(`  Tổng hash duy nhất: ${state.hashes.size}`);
  console.log('');

  // Xử lý từng job
  const reports = [];
  for (const j of jobs) {
    console.log(`  ▶ Thêm từ: ${j.srcDir}  →  dataset/${j.label}`);
    reports.push(await addFromDir(sharp, j.srcDir, j.label, args, state));
    console.log('');
  }

  // Báo cáo
  console.log('='.repeat(64));
  console.log('  KẾT QUẢ');
  console.log('='.repeat(64));
  for (const r of reports) {
    console.log(`  Nhãn: ${r.label}`);
    console.log(`   ✅ Thêm mới        : ${r.label_new}`);
    if (r.converted) console.log(`      (đã chuyển sang JPEG: ${r.converted})`);
    console.log(`   ↩️  Trùng trong lô   : ${r.dup_in_source}`);
    console.log(`   ↩️  Đã có trong ds  : ${r.dup_existing}`);
    console.log(`   ⏭️  Bỏ qua (không hợp lệ): ${r.skipped}`);
    for (const [reason, n] of Object.entries(r.skipReasons)) {
      console.log(`        - ${reason}: ${n}`);
    }
    if (r.sampleAdded.length) {
      console.log('   Ví dụ:');
      r.sampleAdded.forEach(s => console.log(`     ${s}`));
    }
    console.log('');
  }

  // Trạng thái sau
  console.log('  Số ảnh mỗi lớp SAU khi thêm:');
  let total = 0;
  for (const l of VALID_LABELS) {
    const n = listFiles(path.join(DATASET_DIR, l)).length;
    total += n;
    const delta = n - state.perLabel[l];
    console.log(`   - ${l.padEnd(9)} : ${n} ảnh  (${delta >= 0 ? '+' : ''}${delta})`);
  }
  console.log(`   TỔNG        : ${total} ảnh`);
  console.log('='.repeat(64));

  if (args.dryRun) {
    console.log('  ⚠️  Đây là --dry-run: KHÔNG có file nào được ghi thật.');
  }
}

main().catch(err => {
  console.error('\n❌ LỖI:', err.message);
  console.error(err.stack);
  process.exit(1);
});
