# DataPure — Render Deployment Guide

> **Stack:** React 18 + TypeScript + Vite (frontend) · FastAPI + Python 3.12 + Pandas + Pandera (backend) · SQLite (ephemeral on free tier)

---

## 1. Project Structure

```
INTERNSHIP PROJECT 1/
├── backend/              ← FastAPI backend (Render Web Service)
│   ├── app/
│   │   ├── main.py       ← Application entry-point & all routes
│   │   ├── config.py     ← Paths, constants, ephemeral-FS handling
│   │   ├── database.py   ← SQLite schema & connection helpers
│   │   ├── models.py     ← Pydantic request/response models
│   │   ├── sample_data.py← 5,000-row synthetic dataset generator
│   │   └── services/     ← profiler, cleaner, validator, visualizer…
│   └── requirements.txt
├── frontend/             ← React app (Render Static Site)
│   ├── src/
│   │   └── lib/api.ts    ← Uses VITE_API_URL env var in production
│   ├── vite.config.ts
│   └── package.json
├── render.yaml           ← Render Blueprint (auto-configure both services)
├── .env.example          ← Template for required env variables
└── .gitignore
```

---

## 2. Push Latest Changes to GitHub

Run these commands in VS Code Terminal (`Ctrl+\``):

```bash
git add .
git commit -m "chore: prepare project for Render deployment"
git push origin main
```

---

## 3. Deploy on Render

### Method A — Render Blueprint (Recommended, deploys both services at once)

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account and select the **`datapure`** repository
4. Render reads `render.yaml` and shows two services:
   - `datapure-backend` (Web Service)
   - `datapure-frontend` (Static Site)
5. Click **"Apply"** — both services will build and deploy

---

### Method B — Manual (deploy each service separately)

#### Step 1 — Deploy the Backend

| Field | Value |
|-------|-------|
| **Service Name** | `datapure-backend` |
| **Service Type** | Web Service |
| **Runtime** | Python 3 |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/api/health` |
| **Instance Type** | Free |

**Environment Variables to add:**

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.12` |
| `ALLOWED_ORIGINS` | *(leave blank for now — fill after frontend is deployed)* |

#### Step 2 — Deploy the Frontend

| Field | Value |
|-------|-------|
| **Service Name** | `datapure-frontend` |
| **Service Type** | Static Site |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Rewrite Rule** | Source: `/*` → Destination: `/index.html` (SPA routing) |

**Environment Variables to add:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | *(paste backend URL after Step 1 completes, e.g. `https://datapure-backend.onrender.com`)* |

---

## 4. Connect Frontend ↔ Backend

After both services finish deploying:

1. Copy the **backend** public URL from Render dashboard (e.g. `https://datapure-backend.onrender.com`)
2. Go to **datapure-frontend** → **Environment** tab → set:
   ```
   VITE_API_URL = https://datapure-backend.onrender.com
   ```
3. Click **"Save Changes"** — Render will automatically trigger a frontend rebuild.
4. Go to **datapure-backend** → **Environment** tab → set:
   ```
   ALLOWED_ORIGINS = https://datapure-frontend.onrender.com
   ```
5. Click **"Save Changes"** — backend restarts with correct CORS.

---

## 5. Required Environment Variables Summary

### Backend (`datapure-backend`)
| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of frontend URLs allowed by CORS |
| `PYTHON_VERSION` | Yes | Set to `3.12` |
| `PORT` | Auto | Injected by Render automatically — do not set manually |

### Frontend (`datapure-frontend`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Full URL of the deployed backend (no trailing slash) |

---

## 6. Free Tier Limitations

| Limitation | Impact |
|------------|--------|
| **Ephemeral filesystem** | Uploaded datasets and SQLite DB are lost on restart/redeploy. Sample dataset is regenerated automatically on each request. |
| **Cold starts** | Free services sleep after 15 minutes of inactivity. First request after sleep takes 20–60 seconds. |
| **750 hrs/month** | Shared between all free Web Services on your account. |
| **No persistent disk** | SQLite DB resets on each deploy. For persistent storage, upgrade to Starter or add a Render PostgreSQL database. |

---

## 7. Health Check

Backend health endpoint:
```
GET https://datapure-backend.onrender.com/api/health
# Expected response: {"status": "ok", "service": "DataPure API"}
```

---

## 8. Troubleshooting

### "Module not found" on backend startup
- Check that `backend/requirements.txt` lists all dependencies.
- Verify **Root Directory** is set to `backend` (not the repo root).

### CORS errors in browser console
- Confirm `ALLOWED_ORIGINS` on the backend includes the **exact** frontend URL (no trailing slash).
- Confirm `VITE_API_URL` on the frontend is the **exact** backend URL.

### React shows blank white page
- Confirm the **Rewrite Rule** `/* → /index.html` is set on the Static Site.
- Check browser console for a failed network request to `/api/...` — it means `VITE_API_URL` is not set.

### Dataset upload fails on Render
- File uploads work but are stored in `/tmp` (ephemeral). Data is lost on sleep/restart.
- This is expected on the free tier. Upgrade to Starter plan + Render Disk for persistence.

### Build fails: "tsc: command not found"
- Confirm **Build Command** is `npm install && npm run build` — `npm install` must run first.

---

## 9. Production Testing Checklist

After deployment, verify each item:

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Landing page loads at the frontend URL
- [ ] "Try Sample Dataset" loads 5,000 rows
- [ ] Overview Dashboard KPI cards animate
- [ ] All 16 charts render (5 Visual Analytics tabs)
- [ ] Data Profiling table shows column statistics
- [ ] Data Cleaning — Auto mode recommends operations
- [ ] Structural Validation rules run successfully
- [ ] Before vs After comparison page renders
- [ ] CSV export downloads successfully
- [ ] PDF report download works
- [ ] Dark mode toggle works
- [ ] Responsive layout on mobile
- [ ] File upload (CSV/Excel/JSON) works

---

## 10. Local Development (after deployment)

```bash
# Backend
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm run dev
# App runs at http://localhost:5173  (proxies /api → localhost:8000)
```
