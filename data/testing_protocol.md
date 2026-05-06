# Testing Protocol

## Overview

This document describes the protocol used to evaluate the tutoring system across prompt versions. The system is a web application designed to teach concepts of evolutionary psychology through visual aids — specifically, agent-based simulations that model phenomena such as aggression in primates, cultural transmission, gaze following, self-domestication, and theory of mind. Each simulation is paired with an AI tutor that guides the student through the material and poses a transfer question to assess understanding.

---

## Recruitment

Participants are recruited through convenience sampling. There are no demographic restrictions or prerequisites for participation. Testers do not need prior knowledge of evolutionary psychology, comparative cognition, or agent-based modeling.

---

## Instructions Given to Testers

Testers are told the following before they begin:

- The application is designed to teach concepts of evolutionary psychology through visual aids — the simulations they will interact with.
- They are free to interact with the simulations and the chat tutor with little guidance. There is no required sequence, no time limit, and no set number of simulations they must explore.
- If they have a question about the application itself (e.g., how to navigate, what a button does, or what the study is about), we are available to answer.

Testers are not told about the transfer questions, the evaluation rubric, or the specific behaviors being assessed. They interact with the system as naturally as possible.

---

## Session Structure

Each tester uses the application at their own pace. A session consists of one or more interactions with the available simulation groups and their associated chat tutors. The simulation groups are:

- Nonhuman Primates (chimpanzees and bonobos) — Aggression and Culture topics
- Dogs and Wolves — Gaze Following topic
- Humans — Self-Domestication topic
- Elephants — Theory of Mind topic

Testers may explore any combination of simulations and topics. They may switch between simulations, revisit earlier topics, or focus on a single domain for the entire session. No constraints are placed on how long they spend or which simulations they choose.

---

## Data Collection

The primary data collected from each session is the full chat transcript between the tester and the AI tutor. Each transcript captures the complete message history for every simulation topic the tester engaged with. No audio, video, or screen recording is collected. Tester are anonymized.

After completing their session, testers are asked to fill out a post-session survey via Google Form (see below).

---

## Post-Session Survey

After each session, testers complete a Google Form containing the following questions. The survey captures both quantitative usability data and qualitative feedback on the learning experience.

### Usability (Likert scale)

**How easy was it to interact with the simulations?**
1 — Easy peasy, 2, 3, 4, 5 — Very hard

**How easy was it to use the chatbot?**
1 — Easy peasy, 2, 3, 4, 5 — Very hard

**How fast/slow was the chat?**
1 — Very slow, 2, 3, 4, 5 — Very fast

### Self-Reported Learning (per topic)

Testers rate each of the five topics on a 5-point scale reflecting how much they feel they picked up. The scale is:

1. No clue what this is
2. Sounds familiar
3. I remember some things but not enough
4. With more help I could master this topic
5. I could teach someone else about this

The topics rated are:

- Gaze following in dogs vs. wolves
- Aggression in chimpanzees vs. bonobos
- Culture in vervet monkeys
- Self-domestication in humans
- Theory of mind in elephants

### Open-Ended Questions

- Was anything particularly helpful for teaching you about this subject?
- Was anything particularly confusing for teaching you about this subject?
- One thing you would change about this project? (Chatbot, simulation, visuals, language, etc.)
- One thing that should be kept about this project?

---

## Prompt Versioning

Each version of the system prompt is tested against the same 17 scenarios and scored on the same rubric. The process follows this cycle:

1. Run tester sessions on the current prompt version.
2. Collect and evaluate transcripts against the rubric.
3. Identify failure patterns and score deficits.
4. Revise the system prompt to address identified issues, incorporating tester feedback where applicable.
5. Document changes in the changelog.
6. Repeat with the new prompt version.

Baseline scores are recorded at v0. All subsequent versions are compared against the same rubric to measure improvement or regression.
