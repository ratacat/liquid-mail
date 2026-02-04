## Integrating Liquid Mail with Beads

**Beads** manages task status, priority, and dependencies (`br` CLI).
**Liquid Mail** provides the shared log—progress, decisions, and context that survives sessions.

### Conventions

- **Single source of truth**: Beads owns task state; Liquid Mail owns conversation/decisions
- **Shared identifiers**: Include the Beads issue ID in posts (e.g., `[br-123] Refactoring auth module`)
- **Decisions before action**: Post `DECISION:` messages before risky changes, not after
- **Identity in user updates**: In every user-facing reply, include your window-name (derived from `LIQUID_MAIL_WINDOW_ID`) so humans can distinguish concurrent agents.

### Typical Flow

**1. Pick ready work (Beads)**
```bash
br ready                    # Find available work (no blockers)
br show br-123              # Review details
br update br-123 --status in_progress
```

**2. Check context (Liquid Mail)**
```bash
liquid-mail notify          # See what changed since last session
liquid-mail query "br-123"  # Find prior discussion on this issue
```

**3. Work and log progress**
```bash
liquid-mail post "[br-123] Analyzing the auth module structure"
liquid-mail post "[br-123] FINDING: Token refresh happens in middleware, not service layer"
```

**4. Decisions before risky changes**
```bash
liquid-mail post --decision "[br-123] DECISION: Moving token refresh to AuthService because middleware can't access user context"
# Then implement
```

### Decision Conflicts (Preflight)

When you post a decision (via `--decision` or a `DECISION:` line), Liquid Mail can preflight-check for conflicts with prior decisions **in the same topic**.

- If a conflict is detected, `liquid-mail post` fails with `DECISION_CONFLICT`.
- Review prior decisions: `liquid-mail decisions --topic <topic-id>`.
- If you intend to supersede the old decision, re-run with `--yes` and include a note about what changed and why.

This conflict layer is enforced by the Liquid Mail CLI (it uses Honcho search + Honcho chat under the hood), not by Honcho “automatically”.

**5. Complete (Beads is authority)**
```bash
br close br-123             # Mark complete in Beads
liquid-mail post "[br-123] Completed: Auth refactor merged in abc123"
```

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: `FINDING:`, `DECISION:`, `QUESTION:`, `NEXT:`
- **Include file paths** so others can jump in: `src/services/auth.ts:42`
- **Include issue IDs** in brackets: `[br-123]`
- **User-facing replies**: include `AGENT: <window-name>` near the top. Get it with `liquid-mail window name`.

### Topics

Liquid Mail organizes messages into **topics** (Honcho sessions). Topics are **soft boundaries**—search spans all topics by default.

Topic workflow (recommended):

1. **Check for an existing topic** that fits your current workstream (component/system channel).
2. If one fits, **reuse it**.
3. If none fits, **create a new topic** (slug) and keep using it.

Guidelines:

- **Component topics beat task topics**: prefer durable channels like `auth-system` over one-off task IDs.
- **Right-sized breadth**: broad enough for adjacent work by other agents, narrow enough to stay searchable.
- **Valid IDs**: use slugs like `auth-system`, `db-system`, `dashboards` (avoid spaces/punctuation).

Commands:

- **List topics**: `liquid-mail topics`
- **Find an existing stream**: `liquid-mail query "auth"` then reuse that topic id
- **Auto-topic**: if you omit `--topic`, Liquid Mail attempts to find a matching session based on content
- **Window pinning**: once a topic is assigned to your window, subsequent posts go there automatically

Examples (component topic + Beads id in the subject):
```bash
liquid-mail post --topic auth-system "[br-123] START: Investigating token refresh failures"
liquid-mail post --topic auth-system "[br-123] FINDING: refresh happens in middleware, not service layer"
liquid-mail post --topic auth-system --decision "[br-123] DECISION: Move refresh logic into AuthService"

liquid-mail post --topic dashboards "[br-456] START: Adding latency panel"
```

### Mapping Cheat-Sheet

| Concept | In Beads | In Liquid Mail |
|---------|----------|----------------|
| Work item | `br-123` (issue ID) | Include `[br-123]` in posts |
| Workstream | — | `--topic auth-system` |
| Subject prefix | — | `[br-123] ...` |
| Commit message | Include `br-123` | — |
| Status | `br update --status` | Post progress messages |

### Event Mirroring (Optional Automation)

- **On `br update --status blocked`**: Post a high-importance message describing the blocker
- **On decision conflict/overdue ack**: Add a Beads label (`needs-ack`) or bump priority to surface in `br ready`

### Pitfalls

- **Don't manage tasks in Liquid Mail**—Beads is the single task queue
- **Always include `br-xxx`** in topic and subject to avoid ID drift across tools
- **Don't dump logs**—keep posts short and structured

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | `liquid-mail notify` |
| Log progress | `liquid-mail post "[br-xxx] ..."` |
| Before risky change | `liquid-mail post --decision "[br-xxx] DECISION: ..."` |
| Find history | `liquid-mail query "search term"` |
| Prior decisions | `liquid-mail decisions` |
| Show config | `liquid-mail config` |
| List topics | `liquid-mail topics` |
