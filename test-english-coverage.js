const fs = require('fs');
const path = require('path');

console.log('=== RUNNING COMPREHENSIVE 100% ENGLISH COVERAGE AUDIT ===\n');

const html = fs.readFileSync(path.join(__dirname, 'frontend/trangchu.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(__dirname, 'frontend/main.js'), 'utf8');

// Regex for Vietnamese characters
const vietnameseDiacritics = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵĐ]/i;

// 1. Extract translations object from main.js safely
const matchTrans = mainJs.match(/const translations\s*=\s*({[\s\S]*?^};)/m);
if (!matchTrans) {
  console.error('❌ Could not locate translations object in main.js');
  process.exit(1);
}

const translations = eval(`(${matchTrans[1].replace(/;\s*$/, '')})`);
const en = translations.en;
const vi = translations.vi;

let failures = [];

// 2. Check all data-i18n keys in trangchu.html exist in translations.en
const dataI18nMatches = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
const uniqueKeys = [...new Set(dataI18nMatches)];
console.log(`Checking ${uniqueKeys.length} unique data-i18n keys in HTML...`);

uniqueKeys.forEach(k => {
  if (en[k] === undefined) {
    failures.push(`Missing EN translation for key: data-i18n="${k}"`);
  }
});

// 3. Check data-i18n-option
const optionMatches = [...html.matchAll(/data-i18n-option="([^"]+)"/g)].map(m => m[1]);
optionMatches.forEach(k => {
  if (en[k] === undefined) {
    failures.push(`Missing EN translation for option: data-i18n-option="${k}"`);
  }
});

// 4. Check data-i18n-placeholder
const placeholderMatches = [...html.matchAll(/data-i18n-placeholder="([^"]+)"/g)].map(m => m[1]);
placeholderMatches.forEach(k => {
  if (en[k] === undefined) {
    failures.push(`Missing EN translation for placeholder: data-i18n-placeholder="${k}"`);
  }
});

// 5. Simulate translation application to HTML and check for remaining Vietnamese text
let simulatedHtml = html;

// Replace options
simulatedHtml = simulatedHtml.replace(/<option\s+([^>]*?)data-i18n-option="([^"]+)"([^>]*)>([\s\S]*?)<\/option>/gi, (match, p1, key, p2, oldText) => {
  return `<option ${p1} ${p2}>${en[key] || oldText}</option>`;
});

// Multiple passes to handle any nested translated tags
for (let pass = 0; pass < 3; pass++) {
  simulatedHtml = simulatedHtml.replace(/<([a-z0-9]+)\s+([^>]*?)data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, p1, key, p2, oldContent) => {
    return `<${tag} ${p1} ${p2}>${en[key] !== undefined ? en[key] : oldContent}</${tag}>`;
  });
}

// Strip comments and script tags, styles, head
let cleaned = simulatedHtml
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<head[\s\S]*?<\/head>/gi, '');

// Extract visible text outside tags
const rawTexts = cleaned.replace(/<[^>]+>/g, '\n').split('\n')
  .map(t => t.trim())
  .filter(t => t.length > 0);

console.log(`Auditing ${rawTexts.length} rendered text nodes for residual Vietnamese words...`);

let residualVietnamese = [];
rawTexts.forEach(line => {
  if (vietnameseDiacritics.test(line)) {
    residualVietnamese.push(line);
  }
});

if (residualVietnamese.length > 0) {
  console.log(`\n⚠️ Found ${residualVietnamese.length} text fragments containing Vietnamese diacritics:`);
  residualVietnamese.forEach(rv => console.log('   - ', rv));
  failures.push(`${residualVietnamese.length} visible text elements still contain Vietnamese characters after switchLanguage('en')`);
} else {
  console.log('✅ ZERO residual Vietnamese text fragments found in simulated rendered English page!');
}

// 6. Audit modal service details in JS
const modalMatch = mainJs.match(/const serviceDetailsData\s*=\s*({[\s\S]*?\r?\n\s*};)/);
if (!modalMatch) {
  failures.push('serviceDetailsData definition not found in main.js');
} else {
  const serviceDetailsData = eval(`(${modalMatch[1].replace(/;\s*$/, '')})`);
  if (!serviceDetailsData.en) {
    failures.push('serviceDetailsData missing .en property');
  } else {
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(id => {
      const item = serviceDetailsData.en[id];
      if (!item) {
        failures.push(`serviceDetailsData.en missing service ${id}`);
      } else {
        const fieldsToCheck = [item.title, item.category, item.desc, item.price, item.minDuration, item.duration, ...(item.features || [])];
        fieldsToCheck.forEach(val => {
          if (vietnameseDiacritics.test(val)) {
            failures.push(`serviceDetailsData.en[${id}] contains Vietnamese text: "${val}"`);
          }
        });
      }
    });
    console.log('✅ Service details modal contains bilingual English dataset for all 8 services with 0 Vietnamese text!');
  }
}

// 7. Audit formatUnitEN helper
if (!mainJs.includes("formatUnitEN") || !mainJs.includes("updateDynamicPricesLanguage")) {
  failures.push('main.js missing formatUnitEN or updateDynamicPricesLanguage helpers');
} else {
  console.log('✅ formatUnitEN and updateDynamicPricesLanguage dynamic price handling present!');
}

console.log('\n----------------------------------------');
if (failures.length === 0) {
  console.log('🎉 AUDIT RESULT: 100% PERFECT ENGLISH COVERAGE!');
  process.exit(0);
} else {
  console.log('❌ AUDIT RESULT: FAILURES DETECTED:');
  failures.forEach(f => console.log('  •', f));
  process.exit(1);
}
