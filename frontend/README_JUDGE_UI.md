# CRAI Judge-Ready Frontend

Light premium SaaS / precision-agriculture UI for CRAI — Adaptive Edge Agricultural Intelligence.

## Requirements
- Node.js 18+ (20+ recommended)
- CRAI FastAPI backend running on http://127.0.0.1:8000
- Existing dependencies from package.json

## Windows PowerShell setup

```powershell
cd C:\Users\91807\Downloads\CRAI_project_structure\CRAI

# Backup the old frontend
Rename-Item .\frontend .\frontend_backup_before_judge_ui

# Extract this ZIP here and rename its folder to frontend
# If the extracted folder is called crai-frontend:
Rename-Item .\crai-frontend .\frontend

cd .\frontend

npm install
npm run dev
```

Open:
http://localhost:5173

## Backend

In another PowerShell:

```powershell
cd C:\Users\91807\Downloads\CRAI_project_structure\CRAI\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## Optional API URL

Create `.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Production build

```powershell
npm run build
npm run preview
```

## Important integration behavior

The UI calls:
- GET /api/ai/status
- POST /api/analysis/image
- POST /api/field-sensors/readings

The primary risk and decision remain the deterministic CRAI outputs. Qwen3 is displayed as an explanatory advisory.

The UI includes a local demo fallback so the visual presentation can still be demonstrated if the backend is temporarily unavailable. For the SIH demo, keep the FastAPI backend and Ollama running so the real pipeline is shown.

## Recommended SIH demo
1. Open Overview.
2. Click Observe.
3. Upload the tomato leaf image.
4. Select A1.
5. Analyze with CRAI.
6. If adaptive evidence is requested, acquire fresh sensor evidence.
7. Open Field Intelligence.
8. Click "Why this score?"
9. Show evidence contribution.
10. Show the local Qwen3 advisory.
11. Open Sensors to demonstrate freshness.
12. Open History and Reports.
