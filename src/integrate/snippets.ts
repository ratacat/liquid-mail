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

Shared log for progress, decisions, and context that survives sessions.

### Workflow

1. **Check context**: \`liquid-mail notify\`
2. **Work**: Log progress as you go. Topic required on first post, pinned after.
   \`\`\`bash
   liquid-mail post --topic auth-system "Analyzing the auth module structure"
   liquid-mail post "FINDING: Token refresh happens in middleware"
   liquid-mail post --decision "DECISION: Moving token refresh to AuthService"
   \`\`\`
3. **Sync**: Commit and push your changes.

### Posting

- Short (5-15 lines). Prefix: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- Include file paths: \`src/services/auth.ts:42\`
- Post \`DECISION:\` messages before risky changes, not after
- User-facing replies: include \`AGENT: <window-name>\` (\`liquid-mail window name\`)
- Topics: 4-50 chars, lowercase + hyphens. \`liquid-mail topics\` to list, \`liquid-mail query\` to search.
`;

// Beads-integrated snippet
export const LIQUID_MAIL_AGENT_SNIPPET_WITH_BEADS = `
## Liquid Mail + Beads

**Beads** owns task state (\`br\`). **Liquid Mail** owns the shared log: progress, decisions, and context that survives sessions.

### Workflow

1. **Start**: \`br ready\` to find work, then \`br update <id> --status in_progress\`
2. **Check context**: \`liquid-mail notify\` and \`liquid-mail query "<id>"\`
3. **Work**: Log progress as you go. Topic required on first post, pinned after.
   \`\`\`bash
   liquid-mail post --topic auth-system "[lm-jht] FINDING: Token refresh in middleware"
   liquid-mail post --decision "[lm-jht] DECISION: Move refresh to AuthService"
   \`\`\`
4. **Complete**: Run quality gates (tests, lints, build) first. Then \`br close <id>\` and post a summary.
5. **Sync**: \`br sync --flush-only\`, then \`git add .beads/ && git commit && git push\`

### Posting

- Short (5-15 lines). Prefix: \`FINDING:\`, \`DECISION:\`, \`QUESTION:\`, \`NEXT:\`
- Include file paths (\`src/auth.ts:42\`) and issue IDs (\`[lm-jht]\`)
- Post \`DECISION:\` messages before risky changes, not after
- User-facing replies: include \`AGENT: <window-name>\` (\`liquid-mail window name\`)
- Topics: 4-50 chars, lowercase + hyphens. \`liquid-mail topics\` to list, \`liquid-mail query\` to search.
`;
