# CPFedST Medical Image Web App

Production-oriented web application for the trained **CPFedST – Continual Personalized Federated Side-Tuning with Knowledge-Aware Update Routing** model.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express
- Database: Firebase Cloud Firestore (prediction metadata only; raw images are not stored)
- Model runtime: Python + PyTorch
- Process manager: PM2
- Reverse proxy: Nginx
- Deployment target: Hostinger VPS

## Important model packaging note

The trained E4 v4 checkpoint is about **3 GB** in the training project, so it is intentionally **not included in this ZIP**. The application is wired to load the actual trained checkpoint at runtime.

The checkpoint recorded by the training run is:

`checkpoints/E4_v4_cpfedst_stage2.pt`

Your trained model checkpoint contains `global_model` and four `local_models`, matching the training project. The web app lets the user select Client 0–3 and performs inference with the corresponding final personalized client model.

The official pFedST repository is the upstream implementation used by the training code:
https://github.com/JiayiChen815/pFedST

Do not commit the 3 GB checkpoint to a normal Git repository. GitHub blocks files larger than 100 MiB unless a large-file mechanism such as Git LFS is used. See GitHub's documentation.

## Architecture

```text
Browser (React)
        |
        v
Nginx  ->  PM2 -> Node/Express
                    |
                    +----> Firebase Firestore (metadata)
                    |
                    +----> Persistent Python inference worker
                               |
                               +----> E4 v4 checkpoint
                               +----> official pFedST CLIP code
```

The Python worker stays alive so the large model is loaded once instead of once per request.

## What the web app does

1. Upload a medical skin-lesion image.
2. Select the federated client profile (Client 0–3).
3. Node/Express sends the image to the Python worker.
4. The trained E4 v4 local model produces eight-class predictions using the same class prompts used in training.
5. The UI displays the predicted lesion category, confidence, and top-5 probabilities.
6. Firebase stores only prediction metadata, never the uploaded image.
7. The research dashboard displays the recorded E4 v4 experiment metrics and GLOBAL/LOCAL/PROTECT routing distribution.

## Medical-use disclaimer

This is a research demonstrator based on a reduced experimental configuration. It is not a clinically validated diagnostic system and should not replace professional medical judgement.

## Local setup

### 1. Frontend

```bash
cd frontend
npm install
npm run build
```

### 2. Node backend

```bash
cd ../server
npm install
```

### 3. Python runtime

Create a Python environment and install:

```bash
cd ../ml
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4. Add the official pFedST implementation

Place the upstream pFedST Python package containing `pfedst_official/` under:

`ml/vendor/pfedst_official/`

or set `PFEDST_CODE_DIR` in `.env` to the directory that already contains `pfedst_official` in your training project.

### 5. Add the trained checkpoint

Copy the trained file:

`E4_v4_cpfedst_stage2.pt`

to:

`models/E4_v4_cpfedst_stage2.pt`

### 6. Configure environment variables

Copy `.env.example` to `server/.env` and edit the paths and Firebase values.

### 7. Start backend

```bash
cd server
npm start
```

For the local production preview, the backend serves `frontend/dist` on port 5000.

## Hostinger deployment

Recommended structure on the VPS:

`/var/www/cpfedst-webapp`

Keep the repository code in Git and upload the large checkpoint separately to:

`/var/www/cpfedst-webapp/models/E4_v4_cpfedst_stage2.pt`

Install Node, Python and required system packages on the VPS, then:

```bash
cd /var/www/cpfedst-webapp/frontend
npm install
npm run build

cd ../server
npm install
```

Create `server/.env` and start with PM2 using:

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Use `deploy/nginx-cpfedst.conf` as the Nginx reverse-proxy configuration and point your domain to the VPS.

## Health checks

- `GET /api/health`
- `GET /api/model-info`
- `GET /api/analytics`
- `POST /api/predict`

## Firebase

The server uses Firebase Admin SDK. It records:

- timestamp
- selected client profile
- predicted class
- confidence
- top-k probabilities
- application version

The raw image bytes are not written to Firestore.

## Repository layout

```text
CPFedST_Hostinger_WebApp/
├── config/
│   └── experiment-metadata.json
├── deploy/
│   ├── ecosystem.config.cjs
│   └── nginx-cpfedst.conf
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── ml/
│   ├── inference_worker.py
│   ├── model_adapter.py
│   ├── requirements.txt
│   └── README_MODEL_SETUP.md
├── models/
│   └── README.md
├── scripts/
│   ├── start-local.ps1
│   └── start-local.sh
├── server/
│   ├── src/
│   │   ├── firebase.js
│   │   ├── inferenceClient.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
└── README.md
```
