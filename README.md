# Evolutionary Psychology Simulation Tutor

An interactive web application that pairs agent-based simulations of animal behavior with an AI tutoring chatbot. Students observe evolutionary dynamics (aggression, gaze-following, self-domestication, theory of mind) across multiple species, then answer transfer questions that ask them to apply what they learned to a new species — reinforcing conceptual understanding through active prediction rather than passive reading.

## Learning Theory

This tool is grounded in **transfer-appropriate processing** and **Socratic scaffolding**: the simulations create a concrete experiential anchor, and the tutor withholds explanations until the student has formed their own hypothesis, then probes incomplete reasoning rather than correcting it directly. The transfer task at the end of each session asks students to generalize a mechanism to an unfamiliar species, operationalizing the distinction between surface-level recall and genuine conceptual transfer.

## Team

- Cael Andrew McDermott
- Aurelia Maria Mendez-Ortega
- Andrew Torres

## AI Disclosure

This project uses large language models in two ways: (1) the in-app tutoring chatbot, which runs against either a local Ollama model or the Anthropic Claude API depending on configuration, and (2) Claude Code (Anthropic) was used as a development assistant during implementation. All system prompts, evaluation rubrics, and scenario scripts were written and reviewed by the team.

## Local Setup

### With uv (recommended)

Dependencies are managed by [uv](https://docs.astral.sh/uv/) via `pyproject.toml` at the repo root.

```bash
uv sync                              # install / update .venv
cd backend && uv run python app.py   # start Flask server on http://localhost:5000
```

### With pip

```bash
pip install -r requirements.txt
cd backend && python app.py
```

`backend/app.py` uses bare imports (`from routes.groups import ...`), so it must be invoked from inside `backend/` — running it from the repo root will fail with `ModuleNotFoundError`.

The frontend is served as static files by Flask itself, so opening <http://localhost:5000/> is the whole frontend story — no separate dev server, no build step.

### Model provider

`backend/config.py` reads `MODEL_PROVIDER` from env (`local` or `cloud`, default `local`):

- **local** — Ollama at `LOCAL_API_URL` (default `http://localhost:11434/api/chat`), model `LOCAL_MODEL` (default `qwen3.5:9b`).
- **cloud** — Anthropic Messages API using `ANTHROPIC_API_KEY` and `CLOUD_MODEL`.

Copy `.env.example` to `backend/.env` and fill in the values you need.
