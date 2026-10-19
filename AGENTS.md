# AGENTS.md

Context for anyone, human or agent, working in this repo. The code describes itself; this file records what the code can't: why it is shaped this way, and the constraints that come from outside it.

## The situation

A personal budget tracker: a Node + TypeScript API, a React + TypeScript client, and Zod contracts shared between them. It runs locally for a single user, with no auth, and keeps its data in a JSON file. Anyone should be able to clone it and run it cold with one `npm install`.

## The product thesis

People keep a budget to answer questions about their money, and most apps make them dig for the answers. Here you ask in plain words: Ask AI answers from your transactions, draws a chart when it helps, and proposes fixes that you approve.

## Principles, and why

- **Contracts live in `shared/`.** Zod schemas are the single source of truth for request bodies, responses, tool inputs and streamed events, so the client and server can't drift apart. Types are inferred from schemas, never written twice.
- **The model never does arithmetic.** Every number in an Ask AI answer comes from a tool that runs our own code, including any addition or subtraction (`add_or_subtract`). Charts are built by the server from stored tool results. A grounding check flags any amount that didn't come from a tool. Money must be traceable to code.
- **The agent cannot change data on its own.** It has no tool that writes. It can only create proposals, and the only way to apply one is the Approve button, which re-checks that nothing changed in the meantime. The user owns their records.
- **Dependencies point one way.** `shared` depends on nothing in the app. Routes call services, services call repositories. Only `server/src/llm/anthropicClient.ts` imports the Anthropic SDK. Client components never call `fetch`. `npm run boundaries` enforces this.
- **Outside things sit behind interfaces wired in one place.** Storage, the model, and the clock are injected in `server/src/container.ts`, so tests run the real app with an in-memory store, a scripted model and a fixed date.
- **Code should read plainly.** Straightforward names, small files, comments that explain why. No casts except where untrusted data is parsed.

## Working agreements

- Run `npm run check` before calling anything done. It runs typecheck, lint, the boundary check and every test, with no API key needed.
- `npm run eval` runs the Ask AI cases against the real model. Run it after changing the prompt, the tools or the model.
- When you make a choice someone might question, note it in the README's "Decisions and assumptions" section, or in WRITEUP.md if it's about Ask AI.
- Commits are small, one change each, in conventional format (`feat(agent): ...`).
- Docs and UI copy: plain words, no em dashes, no filler.

## Where to look

- `README.md`: setup, the API additions, and the decisions and assumptions behind them
- `WRITEUP.md`: what was built, how AI was used, and what's next
