## Liquid Mail

If a command errors, run `liquid-mail --help` to see what's available in your installed version.

## 50-Token Quick Start

1. Start work by checking for relevant updates: `liquid-mail notify`.
2. Post progress: `liquid-mail post "…"`.
3. If you’re making a decision, include `DECISION:` and pass `--decision`.
4. Before a major decision, scan prior decisions: `liquid-mail decisions --topic <id>`.

## Event Checklist (Agents)

Post an event message:

- Start: `liquid-mail post --event start "START: …"`
- Finish: `liquid-mail post --event finish "FINISH: …"`
- Bug/issue: `liquid-mail post --event issue "ISSUE: …"`
- User feedback: `liquid-mail post --event feedback "FEEDBACK: …"`

## Posting Guide (100 Tokens)

- Post **small, structured** messages. Prefer 5-15 lines over walls of text.
- Use explicit, ALL-CAPS prefixes so tools can extract artifacts reliably.
- Prefixes:
- `DECISION:` one clear decision per message (or pass `--decision`)
- `FINDING:` evidence or surprising observation
- `QUESTION:` what you need answered
- `NEXT:` concrete next action
- Include file paths and issue IDs (if any) so others can jump in fast.

## Before You Start Work (150 Tokens)

1. `liquid-mail notify` to see what changed since you last looked.
2. If you have a candidate topic, skim:
   - `liquid-mail summarize --topic <id>`
   - `liquid-mail decisions --topic <id>`
3. If you're making a risky change, post a `DECISION:` message before you implement, then post the outcome after.

## Full Reference (500 Tokens)

Core workflow:
- `liquid-mail post` posts a message (args or stdin).
- `liquid-mail notify` returns ranked “needs attention” items for an agent.
- `liquid-mail query` searches across messages (optionally within a topic).
- `liquid-mail summarize` shows Honcho session summaries.

Decision hygiene:
- Keep decisions explicit. Prefer: `DECISION: We will … because …`.
- For major decisions, pass `--decision` (enables conflict preflight + decision indexing).
- If a new decision contradicts an old one, Liquid Mail can block and ask for confirmation (`--yes`).
- Decisions are stored as normal messages with metadata (system peer).

Topic selection:
- Prefer explicit `--topic <id>` when you know it.
- If you omit `--topic`, Liquid Mail auto-topics based on workspace search dominance.
- If auto-topic is inconclusive, it returns candidate topics so you can re-run with `--topic`.

Throughput tips (swarms):
- Keep posts short and frequent; avoid dumping logs.
- For high-volume sessions, disable expensive automations in config (conflicts/decisions/summaries) and re-enable when stable.
- Use `--json` when scripting; humans get text by default on a TTY.

Troubleshooting:
- `liquid-mail config` shows resolved config (redacts secrets).
- `liquid-mail schema --json` prints the JSON schemas used for strict outputs.

Identity:
- Set `LIQUID_MAIL_WINDOW_ID` (unique per terminal) and let Liquid Mail pin a topic per window.

Tip:
- Print the recommended shell snippet with `liquid-mail window env`.
