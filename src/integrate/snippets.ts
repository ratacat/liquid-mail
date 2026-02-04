import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX = '<!-- BEGIN LIQUID MAIL';
export const LIQUID_MAIL_AGENTS_BLOCK_END = '<!-- END LIQUID MAIL -->';

/**
 * Compute a short hash of the snippet content for staleness detection.
 */
export function computeSnippetHash(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex').slice(0, 8);
}

/**
 * Build the block start marker with hash.
 */
export function buildBlockStart(hash: string): string {
  return `${LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX} (v:${hash}) -->`;
}

/**
 * Extract the hash from an existing block start marker.
 */
export function extractHashFromBlock(text: string): string | undefined {
  const match = text.match(/<!-- BEGIN LIQUID MAIL \(v:([a-f0-9]+)\) -->/);
  return match?.[1];
}

/**
 * Check if text contains a Liquid Mail managed block (with or without hash).
 */
export function hasLiquidMailBlock(text: string): boolean {
  return text.includes(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX) && text.includes(LIQUID_MAIL_AGENTS_BLOCK_END);
}

/**
 * Legacy block start marker (for backwards compatibility).
 * @deprecated Use buildBlockStart(hash) instead
 */
export const LIQUID_MAIL_AGENTS_BLOCK_START = '<!-- BEGIN LIQUID MAIL -->';

export const OPENCODE_INSTRUCTIONS_RELATIVE_PATH = './.opencode/liquid-mail.md';

/**
 * Check if beads (br or bd) is available in PATH.
 */
export function hasBeadsInstalled(): boolean {
  try {
    execSync('which br', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync('which bd', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the appropriate snippet based on whether beads is installed.
 */
export function getAgentSnippet(): string {
  return hasBeadsInstalled() ? LIQUID_MAIL_AGENT_SNIPPET_WITH_BEADS : LIQUID_MAIL_AGENT_SNIPPET_STANDALONE;
}

// Standalone snippet (no Beads dependency)
export const LIQUID_MAIL_AGENT_SNIPPET_STANDALONE = `
## Liquid Mail

Liquid Mail provides a shared log—progress, decisions, and context that survives sessions.

### Workflow

**1. Check context**
\`\`\`bash
liquid-mail notify          # See what changed since last session
\`\`\`

**2. Log progress as you work (topic required)**
\`\`\`bash
liquid-mail post --topic auth-system "Analyzing the auth module structure"
liquid-mail post "FINDING: Token refresh happens in middleware"  # Uses pinned topic
\`\`\`

**3. Decisions before risky changes**
\`\`\`bash
liquid-mail post --decision "DECISION: Moving token refresh to AuthService"
# Then implement
\`\`\`

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- **Include file paths** so others can jump in: \`src/services/auth.ts:42\`
- **User-facing replies**: include \`AGENT: <window-name>\` near the top. Get it with \`liquid-mail window name\`.

### Topics (Required)

Liquid Mail organizes messages into **topics**. The \`--topic\` flag is required for your first post; after that, the topic is pinned to your window.

Topic names must be 4-50 characters, lowercase letters/numbers/hyphens only (e.g., \`auth-system\`, \`db-migrations\`).

- **List topics (newest first)**: \`liquid-mail topics\`
- **Find context**: \`liquid-mail query "auth"\`
- **Rename a topic**: \`liquid-mail topic rename <old> <new>\`
- **Merge topics**: \`liquid-mail topic merge <A> <B> --into <C>\`

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | \`liquid-mail notify\` |
| Log progress | \`liquid-mail post --topic <name> "..."\` |
| Before risky change | \`liquid-mail post --decision "DECISION: ..."\` |
| Find history | \`liquid-mail query "search term"\` |
| Prior decisions | \`liquid-mail decisions --topic <name>\` |
| List topics | \`liquid-mail topics\` |
| Rename topic | \`liquid-mail topic rename <old> <new>\` |
| Merge topics | \`liquid-mail topic merge <A> <B> --into <C>\` |
`;

// Beads-integrated snippet
export const LIQUID_MAIL_AGENT_SNIPPET_WITH_BEADS = `
## Integrating Liquid Mail with Beads

**Beads** manages task status, priority, and dependencies (\`br\` CLI).
**Liquid Mail** provides the shared log—progress, decisions, and context that survives sessions.

### Conventions

- **Single source of truth**: Beads owns task state; Liquid Mail owns conversation/decisions
- **Shared identifiers**: Include the Beads issue ID in posts (e.g., \`[lm-jht] Topic validation rules\`)
- **Decisions before action**: Post \`DECISION:\` messages before risky changes, not after
- **Identity in user updates**: In every user-facing reply, include your window-name (derived from \`LIQUID_MAIL_WINDOW_ID\`) so humans can distinguish concurrent agents.

### Typical Flow

**1. Pick ready work (Beads)**
\`\`\`bash
br ready                    # Find available work (no blockers)
br show lm-jht              # Review details
br update lm-jht --status in_progress
\`\`\`

**2. Check context (Liquid Mail)**
\`\`\`bash
liquid-mail notify          # See what changed since last session
liquid-mail query "lm-jht"  # Find prior discussion on this issue
\`\`\`

**3. Work and log progress (topic required)**

The \`--topic\` flag is required for your first post. After that, the topic is pinned to your window.
\`\`\`bash
liquid-mail post --topic auth-system "[lm-jht] START: Reviewing current topic id patterns"
liquid-mail post "[lm-jht] FINDING: IDs like lm3189... are being used as topic names"
liquid-mail post "[lm-jht] NEXT: Add validation + rename guidance"
\`\`\`

**4. Decisions before risky changes**
\`\`\`bash
liquid-mail post --decision "[lm-jht] DECISION: Reject UUID-like topic names; require slugs"
# Then implement
\`\`\`

### Decision Conflicts (Preflight)

When you post a decision (via \`--decision\` or a \`DECISION:\` line), Liquid Mail can preflight-check for conflicts with prior decisions **in the same topic**.

- If a conflict is detected, \`liquid-mail post\` fails with \`DECISION_CONFLICT\`.
- Review prior decisions: \`liquid-mail decisions --topic <topic>\`.
- If you intend to supersede the old decision, re-run with \`--yes\` and include what changed and why.

**5. Complete (Beads is authority)**
\`\`\`bash
br close lm-jht             # Mark complete in Beads
liquid-mail post "[lm-jht] Completed: Topic validation shipped in 177267d"
\`\`\`

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- **Include file paths** so others can jump in: \`src/services/auth.ts:42\`
- **Include issue IDs** in brackets: \`[lm-jht]\`
- **User-facing replies**: include \`AGENT: <window-name>\` near the top. Get it with \`liquid-mail window name\`.

### Topics (Required)

Liquid Mail organizes messages into **topics** (Honcho sessions). Topics are **soft boundaries**—search spans all topics by default.

**Rule:** \`liquid-mail post\` requires a topic:
- Provide \`--topic <name>\`, OR
- Post inside a window that already has a pinned topic.

Topic names must be:
- 4–50 characters
- lowercase letters/numbers with hyphens
- start with a letter, end with a letter/number
- no consecutive hyphens
- not reserved (\`all\`, \`new\`, \`help\`, \`merge\`, \`rename\`, \`list\`)
- not UUID-like (\`lm<32-hex>\` or standard UUIDs)

Good examples: \`auth-system\`, \`db-system\`, \`dashboards\`

Commands:

- **List topics (newest first)**: \`liquid-mail topics\`
- **Find context across topics**: \`liquid-mail query "auth"\`, then pick a topic name
- **Rename a topic (alias)**: \`liquid-mail topic rename <old> <new>\`
- **Merge two topics into a new one**: \`liquid-mail topic merge <A> <B> --into <C>\`

Examples (component topic + Beads id in the subject):
\`\`\`bash
liquid-mail post --topic auth-system "[lm-jht] START: Investigating token refresh failures"
liquid-mail post --topic auth-system "[lm-jht] FINDING: refresh happens in middleware, not service layer"
liquid-mail post --topic auth-system --decision "[lm-jht] DECISION: Move refresh logic into AuthService"

liquid-mail post --topic dashboards "[lm-1p5] START: Adding latency panel"
\`\`\`

### Context Refresh (Before New Work / After Redirects)

If you see redirect/merge messages, refresh context before acting:
\`\`\`bash
liquid-mail notify
liquid-mail window status --json
liquid-mail summarize --topic <topic>
liquid-mail decisions --topic <topic>
\`\`\`

If you discover a newer "canonical" topic (for example after a topic merge), switch to it explicitly:
\`\`\`bash
liquid-mail post --topic <new-topic> "[lm-xxxx] CONTEXT: Switching topics (rename/merge)"
\`\`\`

### Live Updates (Polling)

Liquid Mail is pull-based by default (you run \`notify\`). For near-real-time updates:
\`\`\`bash
liquid-mail watch --topic <topic>   # watch a topic
liquid-mail watch                   # or watch your pinned topic
\`\`\`

### Mapping Cheat-Sheet

| Concept | In Beads | In Liquid Mail |
|---------|----------|----------------|
| Work item | \`lm-jht\` (issue ID) | Include \`[lm-jht]\` in posts |
| Workstream | — | \`--topic auth-system\` |
| Subject prefix | — | \`[lm-jht] ...\` |
| Commit message | Include \`lm-jht\` | — |
| Status | \`br update --status\` | Post progress messages |

### Pitfalls

- **Don't manage tasks in Liquid Mail**—Beads is the single task queue
- **Always include \`lm-xxx\`** in posts to avoid ID drift across tools
- **Don't dump logs**—keep posts short and structured

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | \`liquid-mail notify\` |
| Log progress | \`liquid-mail post "[lm-xxx] ..."\` |
| Before risky change | \`liquid-mail post --decision "[lm-xxx] DECISION: ..."\` |
| Find history | \`liquid-mail query "search term"\` |
| Prior decisions | \`liquid-mail decisions --topic <topic>\` |
| Show config | \`liquid-mail config\` |
| List topics | \`liquid-mail topics\` |
| Rename topic | \`liquid-mail topic rename <old> <new>\` |
| Merge topics | \`liquid-mail topic merge <A> <B> --into <C>\` |
| Polling watch | \`liquid-mail watch [--topic <topic>]\` |
`;
