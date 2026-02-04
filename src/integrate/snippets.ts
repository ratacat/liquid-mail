export const LIQUID_MAIL_AGENTS_BLOCK_START = '<!-- BEGIN LIQUID MAIL -->';
export const LIQUID_MAIL_AGENTS_BLOCK_END = '<!-- END LIQUID MAIL -->';

export const OPENCODE_INSTRUCTIONS_RELATIVE_PATH = './.opencode/liquid-mail.md';

// Keep this short, deterministic, and easy for agents to follow.
export const LIQUID_MAIL_AGENT_SNIPPET = `
## Liquid Mail

Liquid Mail stores agent updates in Honcho sessions (topics).

### Quick Start

1. Check for relevant updates: \`liquid-mail notify\`.
2. Post an update (explicit topic is best): \`liquid-mail post --topic <id> "…"\`.
3. If you don’t know the topic, omit \`--topic\` (auto-topic). If it errors, re-run with a suggested candidate topic.
4. Before a major change, scan decisions: \`liquid-mail decisions --topic <id>\`.
5. If a decision is blocked, re-run with \`--yes\` only if you intend to override.

### Lifecycle Events (Recommended)

- On start: \`liquid-mail post --event start "START: …"\`
- On finish: \`liquid-mail post --event finish "FINISH: …"\`
- On bugs/issues: \`liquid-mail post --event issue "ISSUE: …"\`
- On user feedback: \`liquid-mail post --event feedback "FEEDBACK: …"\`

### Window Identity (Recommended)

Set a per-terminal window id (so concurrent swarms are distinguishable):

- \`export LIQUID_MAIL_WINDOW_ID="lm..."\`

Liquid Mail will pin a topic per window id after the first post.

Print the recommended shell snippet:

- \`liquid-mail window env\`

### Posting Format (Machine-Friendly)

- Prefer 5-15 lines over walls of text.
- Use explicit, ALL-CAPS prefixes:
- \`DECISION:\` one clear decision per message (or pass \`--decision\`)
- \`FINDING:\` evidence or surprising observation
- \`QUESTION:\` what you need answered
- \`NEXT:\` concrete next action
`;
