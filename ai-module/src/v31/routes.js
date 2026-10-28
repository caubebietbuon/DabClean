'use strict';
const path = require('path');
const { createRouter } = require('../v3/routes');
const { runAnalysis } = require('../v3/engine');
const { POLICY } = require('./scoring');
function createV31Router() {
  return createRouter({ version: '3.1', providerEnv: 'AI_V31_PROVIDER', enabledEnv: 'AI_V31_ENABLED', defaultProvider: 'ollama',
    capabilities: { scoringPolicy: POLICY }, run: (files, options) => runAnalysis(files, {
      ...options, workerPath: path.join(__dirname, 'worker.js') }) });
}
module.exports = { createV31Router };
