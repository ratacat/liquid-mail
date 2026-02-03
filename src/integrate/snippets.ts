export const LIQUID_MAIL_AGENTS_BLOCK_START = '<!-- BEGIN LIQUID MAIL -->';
export const LIQUID_MAIL_AGENTS_BLOCK_END = '<!-- END LIQUID MAIL -->';

export const OPENCODE_INSTRUCTIONS_RELATIVE_PATH = './.opencode/liquid-mail.md';

// Keep this short, deterministic, and easy for agents to follow.
export const LIQUID_MAIL_AGENT_SNIPPET = `
## Liquid Mail

If a command errors, run \`liquid-mail --help\`.

### Quick Start

1. Start work by checking for relevant updates: \`liquid-mail notify --agent-id <you>\`.
2. Post progress + decisions: \`liquid-mail post "…" --agent-id <you>\`.
3. Before a major decision, scan prior decisions: \`liquid-mail decisions --topic <id>\`.

### Posting Format

- Prefer 5-15 lines over walls of text.
- Use explicit prefixes:
- \`Decision:\` one clear decision per message
- \`Finding:\` evidence or surprising observation
- \`Question:\` what you need answered
- \`Next:\` concrete next action
`;

