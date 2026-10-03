import { useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, Database, GitBranch, ShieldCheck, UploadCloud } from 'lucide-react';

const fallbackClasses = [
  'melanoma',
  'melanocytic nevus',
  'basal cell carcinoma',
  'actinic keratosis',
  'benign keratosis',
  'dermatofibroma',
  'vascular lesion',
  'squamous cell carcinoma'
];

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [clientId, setClientId] = useState('0');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/health').then((r) => r.json()),
      fetch('/api/analytics').then((r) => r.json())
    ])
      .then(([health, stats]) => {
        setStatus(health);
        setAnalytics(stats);
      })
      .catch(() => setError('Backend is not reachable. Start the Express server first.'));
  }, []);

  const currentRoute = useMemo(() => {
    if (!analytics) return null;
    const total = analytics.routing.total || 1;
    return [
      ['GLOBAL', analytics.routing.global, analytics.routing.globalPct],
      ['LOCAL', analytics.routing.local, analytics.routing.localPct],
      ['PROTECT', analytics.routing.protect, analytics.routing.protectPct]
    ].map(([name, count, percent]) => ({ name, count, percent, width: (count / total) * 100 }));
  }, [analytics]);

  function chooseFile(nextFile) {
    setError('');
    setResult(null);
    if (!nextFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setError('Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError('Maximum upload size is 8 MB.');
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function predict() {
    if (!file) {
      setError('Upload a skin-lesion image first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('clientId', clientId);
      const response = await fetch('/api/predict', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Prediction failed');
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><BrainCircuit size={21} /></div>
          <div>
            <div className="brand-title">CPFedST Medical AI</div>
            <div className="brand-subtitle">Continual Personalized Federated Side-Tuning</div>
          </div>
        </div>
        <div className={`status-pill ${status?.ok && status?.modelConfigured ? 'online' : 'pending'}`}>
          <Activity size={15} />
          {status?.ok && status?.modelConfigured ? 'API online' : 'Model setup pending'}
        </div>
      </header>

      <main className="content">
        <section className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Research demonstrator</span>
            <h1>Knowledge-aware medical image classification.</h1>
            <p>
              Upload a skin-lesion image and run inference through the final E4 v4 personalized client model.
              The UI also exposes the measured federated routing and retention statistics from the trained experiment.
            </p>
            <div className="hero-tags">
              <span>CLIP ViT-B/16</span>
              <span>4 Clients</span>
              <span>8 Classes</span>
              <span>React + Express</span>
            </div>
          </div>
          <div className="architecture-card">
            <div className="card-title">Inference path</div>
            <div className="flow-row"><div>Image</div><span>→</span><div>Frozen CLIP</div><span>→</span><div>Client {clientId}</div><span>→</span><div>Prediction</div></div>
            <div className="architecture-note">The training-time GLOBAL / LOCAL / PROTECT routing is shown as measured research telemetry, while inference uses the selected final personalized client state.</div>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="panel upload-panel">
            <div className="panel-heading">
              <div><span className="panel-kicker">01</span><h2>Upload image</h2></div>
              <UploadCloud size={21} />
            </div>
            <label className="dropzone">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} />
              {preview ? <img src={preview} alt="Selected lesion" /> : <div className="drop-content"><UploadCloud size={32} /><strong>Choose a medical image</strong><span>JPG, PNG or WEBP · max 8 MB</span></div>}
            </label>
            <div className="controls">
              <label>
                <span>Federated client profile</span>
                <select value={clientId} onChange={(e) => { setClientId(e.target.value); setResult(null); }}>
                  {[0, 1, 2, 3].map((id) => <option key={id} value={id}>Client {id}</option>)}
                </select>
              </label>
              <button className="primary-button" onClick={predict} disabled={loading || !file}>
                {loading ? 'Running inference…' : 'Predict lesion class'}
              </button>
            </div>
            {error && <div className="error-box">{error}</div>}
          </div>

          <div className="panel result-panel">
            <div className="panel-heading">
              <div><span className="panel-kicker">02</span><h2>Prediction</h2></div>
              <ShieldCheck size={21} />
            </div>
            {!result ? (
              <div className="empty-state"><BrainCircuit size={38} /><strong>Prediction will appear here</strong><span>Upload an image and select the client profile that represents the local institution.</span></div>
            ) : result.demo ? (
              <div className="empty-state"><Database size={38} /><strong>Demo mode active</strong><span>{result.message}</span></div>
            ) : (
              <div className="result-content">
                <div className="prediction-main">
                  <span>Predicted class</span>
                  <h3>{result.prediction}</h3>
                  <div className="confidence">{pct(result.confidence)} confidence · Client {result.clientId}</div>
                </div>
                <div className="probability-list">
                  {result.top5.map((item) => (
                    <div className="prob-row" key={item.classId}>
                      <div className="prob-label"><span>{item.className}</span><strong>{pct(item.probability)}</strong></div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${item.probability * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="result-note">Research use only. This output is not a clinical diagnosis.</div>
              </div>
            )}
          </div>
        </section>

        <section className="stats-grid">
          <div className="panel metric-card"><span>Stage-2 BACC</span><strong>{analytics ? analytics.retention.stage2Bacc ?? '0.3504' : '—'}</strong><small>Final E4 v4</small></div>
          <div className="panel metric-card"><span>Stage-2 Macro-F1</span><strong>{analytics ? analytics.roundwiseMacroF1?.[2] ?? '0.1987' : '—'}</strong><small>Final round</small></div>
          <div className="panel metric-card"><span>BACC forgetting</span><strong>{analytics ? analytics.retention.baccForgetting.toFixed(4) : '—'}</strong><small>Stage 1 retention measure</small></div>
          <div className="panel metric-card"><span>Trainable side params</span><strong>2.14M</strong><small>CLIP backbone frozen</small></div>
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">03</span><h2>E4 v4 routing telemetry</h2></div><GitBranch size={21} /></div>
            <p className="section-description">Recorded training-time update routing from the final E4 v4 experiment.</p>
            <div className="route-stack">
              {(currentRoute || []).map((route) => (
                <div key={route.name} className="route-item">
                  <div className="prob-label"><span>{route.name}</span><strong>{route.percent.toFixed(1)}%</strong></div>
                  <div className="bar-track"><div className={`bar-fill route-${route.name.toLowerCase()}`} style={{ width: `${route.width}%` }} /></div>
                  <small>{route.count} routed updates</small>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">04</span><h2>Round-wise BACC</h2></div><Activity size={21} /></div>
            <p className="section-description">Final E4 v4 Stage-2 BACC across three federated rounds.</p>
            <div className="round-chart">
              {(analytics?.roundwiseBacc || []).map((value, index) => (
                <div className="round-column" key={index}>
                  <div className="round-value">{value.toFixed(4)}</div>
                  <div className="round-bar-shell"><div className="round-bar" style={{ height: `${Math.max(10, value * 100)}%` }} /></div>
                  <span>R{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="disclaimer">
          <div><ShieldCheck size={17} /><strong>Privacy and deployment note</strong></div>
          <p>Uploaded images are processed for inference and are not stored in Firebase. Only prediction metadata is logged. Because the model is a research demonstrator trained in a reduced verification setting, the application should be presented as a research prototype rather than a clinical diagnostic service.</p>
        </section>
      </main>

      <footer className="footer">CPFedST · MICCAI 2025 pFedST extension · Research demonstrator</footer>
    </div>
  );
}
