# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

Dependencies are managed by **uv** via `pyproject.toml` at the repo root. The legacy `backend/requirements.txt` mirrors the same deps.

```bash
uv sync                              # install / update .venv
cd backend && uv run python app.py   # start Flask server (default :5000)
```

`backend/app.py` uses bare imports (`from routes.groups import ...`, `import config`), so it **must** be invoked from inside `backend/` — running it from the repo root will fail with `ModuleNotFoundError`.

The frontend is served as static files by Flask itself (`static_folder="../frontend"`), so opening `http://localhost:5000/` is the whole frontend story — no separate dev server, no build step.

There are no tests, no linter config, and no build pipeline.

## Model provider switching

`backend/config.py` reads `MODEL_PROVIDER` from env (`local` or `cloud`, default `local`):
- **local** → POSTs to Ollama at `LOCAL_API_URL` (default `http://localhost:11434/api/chat`) using `LOCAL_MODEL` (default `gemma3:4b`).
- **cloud** → POSTs to the Anthropic Messages API using `ANTHROPIC_API_KEY` and `CLOUD_MODEL`.

Both code paths live in `backend/routes/chat.py` (`call_local_api` / `call_cloud_api`); the chat route picks one based on `config.MODEL_PROVIDER`.

`.env` is loaded via `python-dotenv` from `backend/` working dir.

## The "group:topic:species" composite key

This is the central organizing concept of the whole app. Every piece of state — control values, info text, system prompts, simulation populations, chat history — is keyed by the colon-joined tuple `groupId:topicId:speciesId` (e.g. `chimps_bonobos:aggression:bonobos`, `dogs_wolves:gaze_following:dogs`).

When adding a new simulation, you must touch all of these in lockstep:

| Layer | File | What to add |
|---|---|---|
| Backend taxonomy | `backend/config.py` → `SPECIES_GROUPS` | A new top-level group, or new topic/species inside an existing group. This is what `/api/groups` returns and drives the entire UI. |
| Backend tutor prompt | `backend/config.py` → `SYSTEM_PROMPTS` | One entry per `group:topic:species` key. Falls back to a generic prompt if missing. |
| Frontend controls | `frontend/js/state.js` → `controlConfigs` | Slider definitions (`key`, `label`, `min`, `max`, `step`, `default`) per composite key. |
| Frontend info panel | `frontend/js/state.js` → `infoTexts` | HTML string shown in the left info panel per composite key. |
| Frontend renderer | `frontend/js/simulation.js` → `renderers` | Map composite key → render function `(dt, key) => void`. |
| Frontend reset logic | `frontend/js/simulation.js` → `resetPop` | If your sim's per-key state shape isn't agent-based, branch on topic and initialize your own state object. |

The chat backend, control panel, and tab/sub-nav UI are **fully generic over this key** — once the six points above are wired, the new sim works end-to-end without touching `app.js`, `chat.js`, `controlPanel.js`, or `chat.py`.

## Frontend architecture

Vanilla JS, no framework, no bundler. Scripts are loaded as plain `<script>` tags in `frontend/index.html` in dependency order:

```
state.js → controlPanel.js → simulation.js → chat.js → app.js
```

Each is an IIFE exposing a single global module (`AppState`, `ControlPanel`, `Simulation`, `Chat`). `app.js` is the boot script — it fetches `/api/groups`, builds the tab bar, and wires `switchGroup` → `switchTopic` → `switchSpecies` → `activateCurrent()`. `activateCurrent()` is the one place that re-renders the control panel, info panel, simulation, and chat history whenever the active key changes.

`AppState.activeKey` always reflects the current `groupId:topicId:speciesId`. State for inactive keys is preserved in the `store` map, so toggling species mid-simulation does not lose progress.

### Simulation module

`Simulation` owns a single `<canvas>` and a `pops` map (`key → simulation state`). Lifecycle:

- `start(key)` stops the current animation, looks up the renderer in the `renderers` registry, calls `resetPop(key)` if the key has no state yet, and kicks off `requestAnimationFrame` loop.
- The frame loop calls `renderer(dt, currentKey)` — the renderer is responsible for clearing the canvas, advancing physics/state, and drawing.
- `resetPop` dispatches by topic: agent-based sims (`aggression`) build a population of `mkAgent` records; the gaze sim (`gaze_following`) builds a trial-state object instead. **When adding a new sim type, add a branch here rather than overloading the agent shape.**
- `window.resetSimulation` is exposed for the "Reset Simulation" button rendered by `ControlPanel`.
- A `control-change` CustomEvent is dispatched (debounced 150ms) when sliders move; the simulation listens to this and resets when structural controls (e.g. `popSize`) change. Non-structural controls are picked up live from `AppState.getState(key).controls` each frame.

Existing renderers worth knowing about:
- `drawAggressionSim` — agent-based, generational. Shared `physUpdate` + species-specific `chimpUpdate` / `bonoboUpdate`, with `nextGen` reproduction every 300 frames.
- `drawGazeSim` — behavioral 4-phase trial loop (`setup → cue → response → resolve`), no generations. Demonstrates dog face-fixation vs wolf gaze-following.

### Chat module

`Chat` posts to `/api/chat` with the active composite key. Chat history is stored **both** client-side (in `AppState`, for instant re-rendering on tab switches) and server-side in `chat_manager.sessions` (in-memory dict, lost on restart). The server is the source of truth for what the model sees; the client copy is for UI.

## Backend architecture

Three files do all the work:

- `backend/app.py` — Flask app, registers two blueprints, serves the frontend as static files from `../frontend`.
- `backend/routes/groups.py` — single `GET /api/groups` that returns `SPECIES_GROUPS` from config. The frontend bootstraps from this.
- `backend/routes/chat.py` — `POST /api/chat` and `POST /api/chat/reset`, both keyed by `(groupId, topicId, speciesId)`. Looks up history + system prompt via `chat_manager`, calls the configured model provider.

`backend/chat_manager.py` is a tiny in-memory session store keyed by the composite string. There is no persistence layer — restarting the backend wipes all chat history.
