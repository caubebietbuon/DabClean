'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('../src/v3/clipProvider').load().then(() => console.log('CLIP local cache ready; this is NOT a cleanliness accuracy test.'))
  .catch(err => { console.error('Cannot prepare V3 model:', err.message); process.exitCode = 1; });
