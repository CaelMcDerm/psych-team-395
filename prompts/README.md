# System Prompt Versions

This directory contains the system prompt for each iteration of the tutor (v0 → v3), as required by the M3 Prompt Optimization Report (COMP 395 Final Project).

The full prompt is assembled at runtime in `backend/config.py` from three parts: a shared preamble/safeguard block, a per-topic domain prompt, and a shared conduct block. To produce a single, comparable artifact across versions, each `system_prompt_vN.txt` is the **fully assembled prompt for the canonical composite key `chimps_bonobos:aggression`**, in `detailed` response mode where applicable. The same iterative changes apply to every other composite key in the system; this key was chosen because it is the one most cited in the evaluation files.

## Files

| File | Source commit | Notes |
|------|--------------|-------|
| `system_prompt_v0.txt` | `e7f44e8` (`version 0 of system prompts + added gitignore`) | Baseline. |
| `system_prompt_v1.txt` | `33e42c7` (`v1 system prompt`) | First iteration. |
| `system_prompt_v2.txt` | `fb16f48` (`v2 of the system prompt`) | Second iteration. |
| `system_prompt_v3.txt` | current `HEAD` of `simulations-systemPrompt` | Third iteration (current). |

For per-version hypothesis, change rationale, and scenario evidence, see [`../CHANGELOG.md`](../CHANGELOG.md).

For per-version scoring against the test scenario set, see [`../Evaluation_Files/`](../Evaluation_Files/).
