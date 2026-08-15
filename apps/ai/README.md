# Nail Studio AI service

`apps/ai` is the internal FastAPI service described by Slice 6. It owns the
slow, optional AI work (retrieval, chat, and recipe generation) so the Express
API can remain responsive when Ollama or an embedding model is unavailable.

## Run locally

```powershell
cd apps/ai
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:AI_INTERNAL_TOKEN = "replace-with-a-long-random-token"
$env:AI_DATABASE_URL = "postgresql://..."
uvicorn app.main:app --reload --port 4100
```

Only `/health` is public. The other endpoints require
`X-AI-Internal-Token`; the Express API is the only intended caller.

When `AI_DATABASE_URL` or Ollama is unavailable, the service uses an empty
retrieval repository and deterministic recipe fallback. This keeps the main
application usable while the optional AI dependency is degraded.
