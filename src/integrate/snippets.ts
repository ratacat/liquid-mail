import { execSync } from 'node:child_process';

export const LIQUID_MAIL_AGENTS_BLOCK_START = '<!-- BEGIN LIQUID MAIL -->';
export const LIQUID_MAIL_AGENTS_BLOCK_END = '<!-- END LIQUID MAIL -->';

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

**2. Log progress as you work**
\`\`\`bash
liquid-mail post "Analyzing the auth module structure"
liquid-mail post "FINDING: Token refresh happens in middleware, not service layer"
\`\`\`

**3. Decisions before risky changes**
\`\`\`bash
liquid-mail post --decision "DECISION: Moving token refresh to AuthService because middleware can't access user context"
# Then implement
\`\`\`

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- **Include file paths** so others can jump in: \`src/services/auth.ts:42\`

### Topics

Liquid Mail organizes messages into **topics** (Honcho sessions). Topics are **soft boundaries**—search spans all topics by default.

- **Workspace-wide search**: \`liquid-mail query\` and \`notify\` search across all topics unless you filter with \`--topic\`
- **Auto-topic**: If you omit \`--topic\` when posting, Liquid Mail finds a matching session based on content
- **Explicit topic**: Use \`--topic <id>\` when you know which conversation stream you're in
- **Window pinning**: Once a topic is assigned to your window, subsequent posts go there automatically

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | \`liquid-mail notify\` |
| Log progress | \`liquid-mail post "..."\` |
| Before risky change | \`liquid-mail post --decision "DECISION: ..."\` |
| Find history | \`liquid-mail query "search term"\` |
| Prior decisions | \`liquid-mail decisions\` |
| List topics | \`liquid-mail topics\` |
`;

// Beads-integrated snippet
export const LIQUID_MAIL_AGENT_SNIPPET_WITH_BEADS = `
## Integrating Liquid Mail with Beads

**Beads** manages task status, priority, and dependencies (\`br\` CLI).
**Liquid Mail** provides the shared log—progress, decisions, and context that survives sessions.

### Conventions

- **Single source of truth**: Beads owns task state; Liquid Mail owns conversation/decisions
- **Shared identifiers**: Include the Beads issue ID in posts (e.g., \`[br-123] Refactoring auth module\`)
- **Decisions before action**: Post \`DECISION:\` messages before risky changes, not after

### Typical Flow

**1. Pick ready work (Beads)**
\`\`\`bash
br ready                    # Find available work (no blockers)
br show br-123              # Review details
br update br-123 --status in_progress
\`\`\`

**2. Check context (Liquid Mail)**
\`\`\`bash
liquid-mail notify          # See what changed since last session
liquid-mail query "br-123"  # Find prior discussion on this issue
\`\`\`

**3. Work and log progress**
\`\`\`bash
liquid-mail post "[br-123] Analyzing the auth module structure"
liquid-mail post "[br-123] FINDING: Token refresh happens in middleware, not service layer"
\`\`\`

**4. Decisions before risky changes**
\`\`\`bash
liquid-mail post --decision "[br-123] DECISION: Moving token refresh to AuthService because middleware can't access user context"
# Then implement
\`\`\`

**5. Complete (Beads is authority)**
\`\`\`bash
br close br-123             # Mark complete in Beads
liquid-mail post "[br-123] Completed: Auth refactor merged in abc123"
\`\`\`

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- **Include file paths** so others can jump in: \`src/services/auth.ts:42\`
- **Include issue IDs** in brackets: \`[br-123]\`

### Topics

Liquid Mail organizes messages into **topics** (Honcho sessions). Topics are **soft boundaries**—search spans all topics by default.

- **Workspace-wide search**: \`liquid-mail query\` and \`notify\` search across all topics unless you filter with \`--topic\`
- **Auto-topic**: If you omit \`--topic\` when posting, Liquid Mail finds a matching session based on content
- **Explicit topic**: Use \`--topic <id>\` when you know which conversation stream you're in
- **Window pinning**: Once a topic is assigned to your window, subsequent posts go there automatically
- **List topics**: \`liquid-mail topics\` shows all sessions

For beads-linked work, you can create a topic per issue:
\`\`\`bash
liquid-mail post --topic br-123 "[br-123] Starting work on auth refactor"
# Subsequent posts in this window will use br-123 topic
\`\`\`

### Mapping Cheat-Sheet

| Concept | In Beads | In Liquid Mail |
|---------|----------|----------------|
| Work item | \`br-123\` (issue ID) | \`--topic br-123\` |
| Subject prefix | — | \`[br-123] ...\` |
| Commit message | Include \`br-123\` | — |
| Status | \`br update --status\` | Post progress messages |

### Pitfalls

- **Don't manage tasks in Liquid Mail**—Beads is the single task queue
- **Always include \`br-xxx\`** in topic and subject to avoid ID drift across tools
- **Don't dump logs**—keep posts short and structured

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | \`liquid-mail notify\` |
| Log progress | \`liquid-mail post "[br-xxx] ..."\` |
| Before risky change | \`liquid-mail post --decision "[br-xxx] DECISION: ..."\` |
| Find history | \`liquid-mail query "search term"\` |
| Prior decisions | \`liquid-mail decisions\` |
| Show config | \`liquid-mail config\` |
| List topics | \`liquid-mail topics\` |
`;
