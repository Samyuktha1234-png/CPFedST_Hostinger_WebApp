const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

class InferenceClient {
  constructor() {
    this.python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    this.workerPath = path.resolve(process.env.ML_WORKER_PATH || path.join(__dirname, '..', '..', 'ml', 'inference_worker.py'));
    this.pending = new Map();
    this.spawnWorker();
  }

  spawnWorker() {
    this.worker = spawn(this.python, [this.workerPath], {
      cwd: path.dirname(this.workerPath),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = readline.createInterface({ input: this.worker.stdout });
    rl.on('line', (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(message.error || 'Model inference failed'));
    });

    this.worker.stderr.on('data', (chunk) => {
      if (process.env.DEBUG_MODEL_WORKER === 'true') {
        process.stderr.write(`[model-worker] ${chunk}`);
      }
    });

    this.worker.on('exit', (code, signal) => {
      for (const [, pending] of this.pending) {
        pending.reject(new Error(`Inference worker exited (code=${code}, signal=${signal})`));
      }
      this.pending.clear();
      setTimeout(() => this.spawnWorker(), 1500);
    });
  }

  predict(imageBuffer, clientId) {
    if (!this.worker || this.worker.killed) {
      return Promise.reject(new Error('Inference worker is not available yet.'));
    }

    const id = crypto.randomUUID();
    const payload = {
      id,
      clientId,
      imageBase64: imageBuffer.toString('base64'),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Model inference timed out.'));
      }, Number(process.env.INFERENCE_TIMEOUT_MS || 180000));

      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (err) => { clearTimeout(timeout); reject(err); },
      });

      this.worker.stdin.write(JSON.stringify(payload) + '\n');
    });
  }
}

module.exports = { InferenceClient };
