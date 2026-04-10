# psych-team-395
woooooooooo

## Running with uv

Dependencies are managed by [uv](https://docs.astral.sh/uv/) via `pyproject.toml` at the repo root.

```bash
uv sync                              # install / update .venv
cd backend && uv run python app.py   # start Flask server on http://localhost:5000
```

`backend/app.py` uses bare imports (`from routes.groups import ...`), so it must be invoked from inside `backend/` — running it from the repo root will fail with `ModuleNotFoundError`.

The frontend is served as static files by Flask itself, so opening <http://localhost:5000/> is the whole frontend story — no separate dev server, no build step.

### Model provider

`backend/config.py` reads `MODEL_PROVIDER` from env (`local` or `cloud`, default `local`):

- **local** → Ollama at `LOCAL_API_URL` (default `http://localhost:11434/api/chat`), model `LOCAL_MODEL` (default `gemma3:4b`).
- **cloud** → Anthropic Messages API using `ANTHROPIC_API_KEY` and `CLOUD_MODEL`.

Put these in a `.env` file inside `backend/` — it's loaded automatically via `python-dotenv`.
