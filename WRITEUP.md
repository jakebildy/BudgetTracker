# Writeup

## What I built

The full spec plus one enhancement, Ask AI, following a design I made first in Claude Design.

I designed the architecture before any code was written:

- **Shared Zod contracts.** Every request, response, tool input and streamed event has one definition in `shared/`, so client and server can't drift.
- **Layers with one wiring point.** Routes call services, services call repositories, and storage, the model and the clock are injected in one place, so tests run the real app with a scripted model.
- **Money in integer cents, dates as plain strings,** so totals never drift and dates never shift.
- **JSON storage behind a repository interface,** so SQLite would be one new class.

Where the spec was ambiguous (a monthly view vs. "list all", fixed categories, date handling), my calls are in the README under "Decisions and assumptions".

## The enhancement: Ask AI

People keep a budget to answer questions about their money. Ask AI answers them in plain words: "how much have I spent on Spotify in the last 3 months?" returns the exact total, the dates it covered and a chart when it helps. "Move the camping gear to Entertainment" returns a proposal to approve.

That only helps if the numbers can be trusted, so I designed three guarantees:

- **The model never does math.** Every amount comes from a tool running our code, charts are built server-side, and a grounding check flags any figure no tool returned.
- **It can't change data.** It only proposes. Approving applies the change and refuses if the transaction was edited since.
- **It stays on topic.** A scope check runs in parallel and off-topic questions get a fixed reply.

## How I used AI

Claude wrote most of the code. I designed the architecture and the evals, and reviewed every change.

**What worked:** given a clear design, Claude was fast and accurate on implementation, tests and UI.

**Where I steered:**

- Claude planned a read-only agent. I wanted edits behind my approval, which became the proposal flow.
- Only a prompt line stopped it answering "what's the capital of Portugal?", so I added the scope check.
- The prompt still let the model subtract two values. I removed that and had the`add_or_subtract` tool built, accepting only amounts earlier tools returned.
- When the agent called its own correct figures made up, I asked for a diagnosis before any fix. History held its answers without the tool calls behind them, so each answer now carries a note of its tool calls. I declined Claude's "trust your earlier answers" prompt line.
- Claude's first context docs described the code. I limited `AGENTS.md` to what an agent can't reliably get from the code: why it's shaped this way and the constraints around it.

**What didn't work, and how I found it:** I built the evals around traces: 20 real-model cases, including multi-turn ones, where every failure prints each tool call's input and output.

- Haiku returned all-time totals for "food in October". The traces showed it never set dates when it also set a category: strict tool inputs are written in schema order, and the optional dates came first. Making the dates required fixed it.
- The traces also showed when an eval was wrong, such as "Nothing has been deleted yet" read as a deletion.

The final run passed all 20 cases, with a median answer time under 4 seconds.

## What I'd do next

As a real product, it would first need sign-ups and a real database. After that, the biggest gap is getting data in: today every transaction has to be added and kept up to date by hand. I'd add bank CSV import, then live bank sync through Plaid. Plaid waits on the first step, because bank access tokens need authentication and encrypted storage.
