# Budget Tracker

A personal budget tracker: log income and expenses, see a monthly summary, filter and search your history, and ask questions about your spending in plain words. Node + TypeScript API, React + TypeScript client.

> **Ask AI needs an Anthropic API key.** Put it in `server/.env` (see Setup) before you start the app. Without it, the rest of the app works and the AI panel explains how to turn it on.

## Prerequisites

- Node.js 22.12 or newer (`nvm use` reads `.nvmrc`). Node 18 is end of life, and current Vite and Vitest need 22.12+.
- npm
- An Anthropic API key for Ask AI.

## Setup

Install dependencies (one install covers `client/`, `server/` and `shared/`, which are npm workspaces):

```bash
npm install
```

Add your API key:

```bash
cp server/.env.example server/.env
# then set ANTHROPIC_API_KEY in server/.env
```

## Run the app

```bash
npm run dev
```

This starts the API on http://localhost:3001 and the client on http://localhost:5173. Open http://localhost:5173.

Or run each side in its own terminal:

- Terminal 1 (backend): `cd server && npm run dev`
- Terminal 2 (frontend): `cd client && npm run dev`

## Environment variables

Set in `server/.env`. See `server/.env.example`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | For Ask AI | none | Lets Ask AI call the model |
| `AGENT_MODEL` | No | `claude-haiku-5-5` | Model for the Ask AI agent |
| `FAST_MODEL` | No | `claude-haiku-5-5` | Model for the scope check that runs alongside Ask AI |
| `PORT` | No | `3001` | API port |
| `DATA_FILE` | No | `data/db.json` | Where transactions are stored, relative to `server/` |

## Other commands

| Command | What it does |
|---|---|
| `npm run check` | Typecheck, lint, boundary check and all tests. No API key needed. |
| `npm test` | Tests only |
| `npm run eval` | Runs the Ask AI eval cases against the real model (needs the key) |
| `npm run db:reset` | Restores the sample data |

## Notes

- **Data.** Transactions are stored in `server/data/db.json`, created from `server/data/seed.json` (four months of sample data, July to October 2026) the first time the server starts.
- **Data model.** Each transaction has `id`, `date`, `description`, `amount`, `type` and `category`, plus `source` (`manual` or `agent`, for changes approved from Ask AI), `createdAt` and `updatedAt`. Amounts are positive dollars with at most two decimals. Categories are a fixed list per type.
- **API additions.** An optional `month` param on `GET /api/transactions` and `GET /api/summary` (the summary then includes the previous month's totals for comparison), and new endpoints: `GET /api/months`, `POST /api/insights/ask` (streams Server-Sent Events), and `POST /api/proposals/:id/approve` and `/reject`.
- **Try Ask AI.** "Show my spending as a pie chart", "What subscriptions do I pay for?", "How much have I spent on Spotify in the last 3 months?", "Delete the patio dinner", "Move the camping gear to Entertainment", "What is the capital of Portugal?" (off topic, so it gets a fixed reply). You can also tap a category in the list to change it.

## Decisions and assumptions

Choices worth knowing about:

- **All transactions vs. a monthly view.** The UI is month-based, and the summary panel shows the selected month. `GET /api/transactions` still lists everything with no params; the optional `month` param scopes it. `GET /api/summary` returns all-time totals without `month`.
- **Filtering happens on the server,** through the `type`, `category` and `search` query params. `category` matches in any case.
- **Categories are a fixed list per type,** validated on the server. That makes colored pills and consistent charts possible, and gives Ask AI a known set to filter by.
- **Amounts are positive dollars with at most two decimals.** Totals are added in integer cents, so they never drift.
- **Dates are `YYYY-MM-DD` strings,** which avoids timezone shifts.
- **Node 22.12 or newer.** Node 18 is end of life, and current Vite and Vitest need 22.12+.

Known limitations:

- Single user, local only, no auth.
- No bank import. Transactions are added by hand or through Ask AI.
- Chat history lives in the browser tab, and pending AI proposals live in server memory for 15 minutes.
- One currency, formatted as dollars. Transfers between your own accounts aren't modeled.
- The grounding check confirms dollar amounts and percentages in an answer, not dates or counts.
