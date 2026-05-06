# Project Changelog

Full history of application changes from project start to present. Entries are grouped by development phase and listed in reverse chronological order within each phase. For system prompt–specific changes (v0 → v3), see [PROMPT_CHANGELOG.md](PROMPT_CHANGELOG.md).

---

## Phase 6 — Submission Preparation (May 5, 2026)

**Repository structure cleanup** *(Andrew)*
Moved `Evaluation_Files/` (scenarios, evaluation transcripts) and `testing_protocol.md` into a new `data/` directory to match the required submission layout. Created a root-level `requirements.txt` mirroring `backend/requirements.txt` so the app can be installed with a single `pip install -r requirements.txt`. Updated all internal cross-references that pointed to the old paths.

**README overhaul** *(Andrew)*
Rewrote the README to include a project description, a 2-sentence learning theory grounding (transfer-appropriate processing and Socratic scaffolding), team member names (Cael Andrew McDermott, Aurelia Maria Mendez-Ortega, Andrew Torres), an AI disclosure statement covering both the in-app chatbot and Claude Code's use during development, and a pip-based setup path alongside the existing uv instructions.

**Prompt changelog renamed; project-wide changelog added** *(Andrew)*
Renamed the existing `CHANGELOG.md` (which covered only system prompt iterations) to `PROMPT_CHANGELOG.md` to make its scope explicit. Created this file as a new project-wide `CHANGELOG.md` covering all application changes from the initial commit forward. Updated `prompts/README.md` to point to the renamed file.

**Pytest test suite** *(Andrew)*
Created `tests/conftest.py` and `tests/test_app.py` with 15 passing tests covering: GET `/api/groups` routing and response shape, POST `/api/chat` and `/api/chat/reset` input validation, the chat success path and `[TRANSFER_PASSED]` marker stripping with a mocked LLM call, LLM failure returning 502, guest session append/retrieve/reset/isolation via `chat_manager`, and `config.py` data structure integrity (every `group:topic` key has a system prompt). Added `pytest` as a dev dependency via `uv add --dev pytest`.

**`.env.example`** *(Andrew)*
Created `backend/.env.example` documenting all nine environment variables used by the app (`MODEL_PROVIDER`, `ANTHROPIC_API_KEY`, `LOCAL_API_URL`, `LOCAL_MODEL`, `LOCAL_NUM_CTX`, `LOCAL_NUM_PREDICT`, `SECRET_KEY`, `DATABASE_URL`, `PORT`) with placeholder values and inline comments. No real credentials included.

**User-friendly LLM error messages** *(Andrew)*
Replaced the single `except Exception as e: return jsonify({"error": str(e)})` handler in `backend/routes/chat.py` with four specific handlers: `ConnectionError` (Ollama not running), `Timeout` (service too slow), `HTTPError` with status 429 (rate-limited), and a generic `HTTPError` fallback. The catch-all `Exception` branch no longer forwards `str(e)` to the client, preventing internal details such as API URLs from leaking into the browser.

---

## Phase 5 — Final Polish & Productionization (May 2, 2026)

**Model upgrade to qwen3.5:9b** *(Cael)*
Swapped the default local model from `gemma3:4b` to `qwen3.5:9b`. The 4B-class model failed to reliably follow the v2 prompt's safeguard rules under adversarial inputs; the 9B model has substantially stronger instruction-following. Accompanying inference changes: `think: false` to suppress hidden reasoning tokens, context window raised from 2048 → 4096, `num_predict` lowered from 512 → 300 to keep responses tight under the heavier model. This constitutes the v3 prompt iteration alongside the new `[TRANSFER_PASSED]` signal token.

**v3 system prompt** *(Cael)*
Added machine-readable `[TRANSFER_PASSED]` token for reliable transfer-pass detection, and applied model + inference changes listed above. See [PROMPT_CHANGELOG.md](PROMPT_CHANGELOG.md) for full v2→v3 rationale.

**Productionization plan** *(Aurelia)*
Added `docs/productionization.md` covering hosting architecture (Docker + Fly.io), model choice at scale (Claude Haiku 3.5), data privacy (FERPA/COPPA, session IDs, 90-day retention), cost model (100 and 1,000 DAU estimates), and failure modes.

---

## Phase 4 — UX Polish & Progress Tracking (Apr 22–24, 2026)

**Collapsible simulation graphs** *(Andrew)*
Graphs can now be minimized so students can focus on the chat panel without losing access to the simulation controls.

**Simulation info panel moved to top** *(Andrew)*
Moved the per-topic description text above the simulation canvas so it is visible before the student starts interacting, improving initial orientation.

**Animal photos added to side panel** *(Aurelia)*
Added species photos to the info panel so students can visually identify the animals they are studying alongside the agent-based simulation.

**Tutorial for new users** *(Andrew, Cael)*
Added a step-by-step tutorial that walks new users through the app's features (switching species, using the chat, reading simulation controls). Guests see it every visit; registered users see it once on first login. The tutorial was subsequently improved for clarity and expanded to better orient users to the transfer task mechanic.

**Sound effects** *(Cael)*
Added the first round of audio feedback tied to simulation events, improving engagement with the agent-based animations.

**Transfer task progress tracker** *(Andrew)*
Added per-topic checkmarks visible in the navigation so students can see which transfer tasks they have successfully completed across sessions. Progress is persisted in the database for registered users.

---

## Phase 3 — Prompt Iteration & Evaluation (Apr 17–20, 2026)

**v2 system prompt** *(Andrew)*
Added user-adjustable response length (concise / detailed toggle), stricter no-exclamation-mark rule, first-message and mid-conversation jailbreak guards, capability-anchor scope lock, cross-domain contamination rule, and a predefined greeting displayed when chat opens. See [PROMPT_CHANGELOG.md](PROMPT_CHANGELOG.md) for full v1→v2 rationale.

**User account database** *(Andrew)*
Integrated Flask-SQLAlchemy and Flask-Login to support persistent user accounts. Registered users can save chat history and transfer-task progress across sessions; guests continue to work with an in-memory session.

**Evaluation files and documentation** *(Andrew)*
Committed scenario scripts, per-version evaluation transcripts (v0–v2), PROMPT_CHANGELOG, testing protocol, and the hypothesis written before the first prompt iteration.

**v0 evaluation run** *(Andrew)*
Ran and scored all 17 test scenarios against v0 to establish a baseline before writing v1.

**v1 system prompt** *(Aurelia)*
Added anti-leak instructions, mandatory transfer question rule, calibrated praise guidance, stricter format rules (no bullet points or headers), wrong-answer Socratic examples, and tightened out-of-scope redirect. See [PROMPT_CHANGELOG.md](PROMPT_CHANGELOG.md) for full v0→v1 rationale.

---

## Phase 2 — Simulations Expanded & Visual Polish (Apr 10–15, 2026)

**v0 system prompts** *(Aurelia)*
Wrote the baseline system prompt covering all five simulation domains (aggression, culture, gaze-following, self-domestication, theory of mind), each with a transfer task, information-withholding instructions, and pedagogical conduct rules. Added `.gitignore`.

**Theory of mind simulation — Elephants** *(Aurelia)*
Added two elephant simulations: Cooperative Rope Pulling (goal-directed coordination) and Human Pointing (comprehension of communicative intent), grounded in comparative cognition research.

**Culture and self-domestication simulations** *(Andrew)*
Added the Normative Conformity vs. Cumulative Culture simulation (vervet monkeys) and the Self-Domestication simulation (prosocial humans forming cooperative groups against predators), completing the full set of five simulation domains.

**Chat shared across species within a topic** *(Andrew)*
Unified chat history at the topic level rather than per-species so conversations are preserved when switching between, e.g., chimpanzees and bonobos within the Aggression topic. Renamed the top-level tab from "Chimpanzees & Bonobos" to "Nonhuman Primates" to accommodate future additions.

**Emojis and wolf simulation visual improvements** *(Cael)*
Added emoji-based visual flair to the wolf and dog simulations (merged from `emojiBranch`). Subsequent sprite polish made dog, wolf, and elephant agents visually distinct and cuter.

**config.py input safeguards** *(Cael)*
Added server-side validation in `config.py` to guard against malformed or missing simulation parameters before they reach the model or simulation logic.

**Chat timeout fix** *(Andrew)*
Switched the local API call to streaming mode with a split connect/read timeout `(10, 300)` so individual chunk reads do not time out on slow hardware during initial model load.

---

## Phase 1 — Project Setup & Core Architecture (Mar 27 – Apr 8, 2026)

**Dogs/wolves gaze-following simulation** *(Joel)*
Added the first cross-species behavioral simulation contrasting dogs (face-fixation) and wolves (gaze-following into space) based on Miklósi et al. (2003). Also migrated dependency management from pip to [uv](https://docs.astral.sh/uv/) via `pyproject.toml`.

**Simulation controls simplified; target distance range widened** *(Joel)*
Streamlined the gaze-following sim's control panel and extended the range of the target distance slider for more varied trials.

**Chat panel layout fix** *(Andrew)*
Moved the chat panel so it no longer overlaps the simulation information section on the left side of the screen.

**Pivot to evolutionary psychology simulations** *(Andrew)*
Replaced the original physics-based simulation content with agent-based evolutionary psychology simulations. Established the `group:topic:species` composite key architecture that drives the entire UI and backend.

**Initial simulation dashboard** *(Cael)*
Built the foundational application: Flask backend serving a vanilla JS frontend, an agent-based aggression simulation for chimpanzees and bonobos, a chat panel wired to a local LLM via Ollama, and the tab/sub-nav structure for switching between species.

**Repository created** *(Cael)*
Initial commit establishing the repository.
