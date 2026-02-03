## Liquid Mail

If a command errors, run `liquid-mail --help` to see what's available in your installed version.

## 50-Token Quick Start

1. Start work by checking for relevant updates: `liquid-mail notify --agent-id <you>`.
2. Post important progress + decisions: `liquid-mail post "…" --agent-id <you>`.
3. If you're about to decide something, scan prior decisions first: `liquid-mail decisions --topic <id>`.

## Posting Guide (100 Tokens)

- Post **small, structured** messages. Prefer 5-15 lines over walls of text.
- Use explicit prefixes so tools can extract artifacts reliably.
- Prefixes:
- `Decision:` one clear decision per message
- `Finding:` evidence or surprising observation
- `Question:` what you need answered
- `Next:` concrete next action
- Include file paths and issue IDs (if any) so others can jump in fast.

## Before You Start Work (150 Tokens)

1. `liquid-mail notify --agent-id <you>` to see what changed since you last looked.
2. If you have a candidate topic, skim:
   - `liquid-mail summarize --topic <id>`
   - `liquid-mail decisions --topic <id>`
3. If you're making a risky change, post a `Decision:` message before you implement, then post the outcome after.

## Full Reference (500 Tokens)

Core workflow:
- `liquid-mail post` posts a message (args or stdin).
- `liquid-mail notify` returns ranked “needs attention” items for an agent.
- `liquid-mail query` searches across messages (optionally within a topic).
- `liquid-mail summarize` shows Honcho session summaries.

Decision hygiene:
- Keep decisions explicit. Prefer: `Decision: We will … because …`.
- If a new decision contradicts an old one, Liquid Mail can block and ask for confirmation (`--yes`).
- Decisions are stored as normal messages with metadata (system peer).

Throughput tips (swarms):
- Keep posts short and frequent; avoid dumping logs.
- For high-volume sessions, disable expensive hooks in config (conflicts/decisions/summaries) and re-enable when stable.
- Use `--json` when scripting; humans get text by default on a TTY.

Troubleshooting:
- `liquid-mail config` shows resolved config (redacts secrets).
- `liquid-mail schema --json` prints the JSON schemas used for strict outputs.
