# Deployment checklist

## Before Hostinger

- [ ] Run `npm run build` in `frontend/`.
- [ ] Install Python dependencies from `ml/requirements.txt`.
- [ ] Copy the exact working `pfedst_official` package to `ml/vendor/` or configure `PFEDST_CODE_DIR`.
- [ ] Copy `E4_v4_cpfedst_stage2.pt` to `models/`.
- [ ] Copy `server/.env.example` to `server/.env` and fill Firebase credentials.
- [ ] Verify `GET /api/health`.
- [ ] Verify one real prediction locally.

## On Hostinger

- [ ] Upload repository code.
- [ ] Upload model checkpoint separately.
- [ ] Install Node dependencies.
- [ ] Install Python dependencies.
- [ ] Set absolute paths in `.env`.
- [ ] Start PM2 using `deploy/ecosystem.config.cjs`.
- [ ] Configure Nginx using `deploy/nginx-cpfedst.conf`.
- [ ] Enable HTTPS for the domain.
- [ ] Test `/api/health` and `/api/predict`.
- [ ] Confirm Firestore logs appear without storing raw images.

## GitHub

Push application source, configuration, documentation, and frontend/backend code.
Keep `server/.env` and the trained model checkpoint out of the regular repository. The checkpoint is too large for normal GitHub tracking.
