require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { InferenceClient } = require('./inferenceClient');
const { savePrediction, firebaseStatus } = require('./firebase');

const app = express();
const port = Number(process.env.PORT || 5000);
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 8);
const metadataPath = path.resolve(process.env.EXPERIMENT_METADATA || path.join(__dirname, '..', '..', 'config', 'experiment-metadata.json'));
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    cb(null, allowed.has(file.mimetype));
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const inference = new InferenceClient();

app.get('/api/health', (_req, res) => {
  const modelConfigured = Boolean(process.env.MODEL_CHECKPOINT) || fs.existsSync(path.resolve(path.join(__dirname, '..', '..', 'models', 'E4_v4_cpfedst_stage2.pt')));
  res.json({
    ok: true,
    service: 'cpfedst-webapp',
    modelConfigured,
    firebase: firebaseStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/model-info', (_req, res) => {
  res.json({
    projectName: metadata.projectName,
    basePaper: metadata.basePaper,
    model: metadata.model,
    training: metadata.training,
    finalE4v4: metadata.finalE4v4,
  });
});

app.get('/api/analytics', (_req, res) => {
  res.json({
    routing: metadata.finalE4v4.routing,
    roundwiseBacc: metadata.finalE4v4.roundwiseBacc,
    roundwiseMacroF1: metadata.finalE4v4.roundwiseMacroF1,
    retention: {
      stage1BaccBefore: metadata.finalE4v4.stage1BaccBefore,
      stage1BaccAfter: metadata.finalE4v4.stage1BaccAfter,
      baccForgetting: metadata.finalE4v4.baccForgetting,
      stage1MacroF1Before: metadata.finalE4v4.stage1MacroF1Before,
      stage1MacroF1After: metadata.finalE4v4.stage1MacroF1After,
      macroF1Forgetting: metadata.finalE4v4.macroF1Forgetting,
    },
  });
});

app.post('/api/predict', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Upload a JPG, PNG, or WEBP image.' });
    }

    const clientId = Number(req.body.clientId ?? 0);
    if (![0, 1, 2, 3].includes(clientId)) {
      return res.status(400).json({ ok: false, error: 'clientId must be 0, 1, 2, or 3.' });
    }

    const result = await inference.predict(req.file.buffer, clientId);
    const record = {
      createdAt: new Date().toISOString(),
      clientId,
      prediction: result.prediction,
      confidence: result.confidence,
      top5: result.top5,
      appVersion: process.env.APP_VERSION || '1.0.0',
    };

    const firebase = await savePrediction(record);
    res.json({ ok: true, result, firebase });
  } catch (error) {
    const status = /timed out/i.test(error.message) ? 504 : 500;
    res.status(status).json({ ok: false, error: error.message });
  }
});
const frontendDist = path.resolve(
  process.env.FRONTEND_DIST ||
  path.join(__dirname, '..', '..', 'frontend', 'dist')
);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();

    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}


app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: error.message });
  }
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`CPFedST server running on port ${port}`);
});
