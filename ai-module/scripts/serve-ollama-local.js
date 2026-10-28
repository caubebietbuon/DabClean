'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const exe = path.join(__dirname, '../.cache/ollama/ollama.exe');
if (!fs.existsSync(exe)) {
  console.error('Missing portable Ollama runtime. Follow docs/AI_V31_REPORT.md; no automatic cloud fallback.');
  process.exitCode = 1;
} else {
  const env = { ...process.env, OLLAMA_HOST: '127.0.0.1:11434',
    OLLAMA_MODELS: path.join(__dirname, '../.cache/ollama-models'), OLLAMA_NO_CLOUD: '1',
    OLLAMA_NUM_PARALLEL: '1', OLLAMA_MAX_QUEUE: '2', OLLAMA_MAX_LOADED_MODELS: '1' };
  // CPU is the tested fallback for the local GTX 1050 Ti driver/toolchain mismatch.
  // These values affect only this child process, never the system driver or user environment.
  if (!process.argv.includes('--gpu')) Object.assign(env, { CUDA_VISIBLE_DEVICES: '-1', GGML_VK_VISIBLE_DEVICES: '-1', OLLAMA_VULKAN: 'false' });
  const child = spawn(exe, ['serve'], { env, stdio: 'inherit', windowsHide: true });
  child.once('error', err => { console.error(err.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code || 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill());
}
