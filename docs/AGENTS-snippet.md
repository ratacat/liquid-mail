## Integrating Liquid Mail with Beads

**Beads** manages task status, priority, and dependencies (`br` CLI).
**Liquid Mail** provides the shared log—progress, decisions, and context that survives sessions.

### Conventions

- **Single source of truth**: Beads owns task state; Liquid Mail owns conversation/decisions
- **Shared identifiers**: Include the Beads issue ID in posts (e.g., `[lm-jht] Topic validation rules`)
- **Soft locks (beads + files)**: When you start work, post a lock message with an expiry (“please respect the lock”)
- **Check for locks before you start**: Before claiming a bead or editing files, scan for active locks; if unclear/expired, ask or proceed
- **Identity in user updates**: In every user-facing reply, include your window-name (derived from `LIQUID_MAIL_WINDOW_ID`) so humans can distinguish concurrent agents.

### Typical Flow

**0. Check for locks (Liquid Mail)**
```bash
liquid-mail notify
liquid-mail query "LOCK:"
liquid-mail query "lm-jht LOCK"
```

**1. Pick ready work (Beads)**
```bash
br ready
br show lm-jht
br update lm-jht --status in_progress
```

**2. Lock the bead + expected files (Liquid Mail)**

Use a durable component topic (pins your window after the first post).
```bash
liquid-mail post --topic auth-system "[lm-jht] LOCK: bead=lm-jht files=src/topics/validate.ts tests/topicValidate.test.ts ttl=60m until=<ISO8601> agent=$(liquid-mail window name)"
```

If you need more time, renew the lock:
```bash
liquid-mail post "[lm-jht] LOCK: EXTEND ttl=60m until=<ISO8601>"
```

When done, release:
```bash
liquid-mail post "[lm-jht] UNLOCK: bead=lm-jht files=src/topics/validate.ts tests/topicValidate.test.ts"
```

Lock etiquette:
- If a lock is active and you need the same files: post a short `QUESTION:` asking to coordinate.
- If the lock expiry is > ~60m old: it’s okay to proceed, but leave a note that you’re taking over.

**3. Check context (Liquid Mail)**
```bash
liquid-mail notify
liquid-mail query "lm-jht"
liquid-mail topics
```

**4. Work and log progress (topic required)**

After the first `--topic` post pins the window, you can omit `--topic` as long as the window is pinned.
```bash
liquid-mail post --topic auth-system "[lm-jht] START: Reviewing current topic id patterns"
liquid-mail post             "[lm-jht] FINDING: IDs like lm3189... are being used as topic names"
liquid-mail post             "[lm-jht] NEXT: Add validation + rename guidance"
```

### Discuss Decisions (Same Decision Space)

If you’re about to change something that affects shared behavior in a topic/system, discuss it in that same topic first (so others see it), then implement.

```bash
liquid-mail post --decision "[lm-jht] DECISION: Reject UUID-like topic names; require slugs"
```

### Decision Conflicts (Preflight)

When you post a decision (via `--decision` or a `DECISION:` line), Liquid Mail can preflight-check for conflicts with prior decisions **in the same topic**.

- If a conflict is detected, `liquid-mail post` fails with `DECISION_CONFLICT`.
- Review prior decisions: `liquid-mail decisions --topic <topic>`.
- If you intend to supersede the old decision, re-run with `--yes` and include what changed and why.

This conflict layer is enforced by the Liquid Mail CLI (Honcho search + chat), not by Honcho “automatically”.

**5. Complete (Beads is authority)**
```bash
br close lm-jht
liquid-mail post "[lm-jht] Completed: Topic validation shipped in 177267d"
```

### Posting Format

- **Short** (5-15 lines, not walls of text)
- **Prefixed** with ALL-CAPS tags: `LOCK:`, `UNLOCK:`, `FINDING:`, `DECISION:`, `QUESTION:`, `NEXT:`
- **Include file paths** so others can jump in: `src/services/auth.ts:42`
- **Include issue IDs** in brackets: `[lm-jht]`
- **User-facing replies**: include `AGENT: <window-name>` near the top. Get it with `liquid-mail window name`.

### Topics (Required)

Liquid Mail organizes messages into **topics** (Honcho sessions). Topics are **soft boundaries**—search spans all topics by default.

**Rule:** `liquid-mail post` requires a topic:
- Provide `--topic <name>`, OR
- Post inside a window that already has a pinned topic.

Topic workflow (recommended):

1. **Check for an existing topic** that fits your current workstream (component/system channel).
2. If one fits, **reuse it**.
3. If none fits, **create a new topic** (slug) and keep using it.

Guidelines:

- **Component topics beat task topics**: prefer durable channels like `auth-system` over one-off task IDs.
- **Right-sized breadth**: broad enough for adjacent work by other agents, narrow enough to stay searchable.
- **Valid IDs**: use slugs like `auth-system`, `db-system`, `dashboards` (avoid spaces/punctuation).

Topic names must be:
- 4–50 characters
- lowercase letters/numbers with hyphens
- start with a letter, end with a letter/number
- no consecutive hyphens
- not reserved (`all`, `new`, `help`, `merge`, `rename`, `list`)
- not UUID-like (`lm<32-hex>` or standard UUIDs)

Good examples:
- `auth-system`, `db-system`, `dashboards`

Commands:

- **List topics (newest first)**: `liquid-mail topics`
- **Find context across topics**: `liquid-mail query "auth"`, then pick a topic name
- **Rename a topic (alias)**: `liquid-mail topic rename <old> <new>`
- **Merge two topics into a new one**: `liquid-mail topic merge <A> <B> --into <C>`

Examples (component topic + Beads id in the subject):
```bash
liquid-mail post --topic auth-system "[lm-jht] START: Investigating token refresh failures"
liquid-mail post --topic auth-system "[lm-jht] FINDING: refresh happens in middleware, not service layer"
liquid-mail post --topic auth-system --decision "[lm-jht] DECISION: Move refresh logic into AuthService"

liquid-mail post --topic dashboards "[lm-1p5] START: Adding latency panel"
```

### Context Refresh (Before New Work / After Redirects)

If you see redirect/merge messages, refresh context before acting:
```bash
liquid-mail notify
liquid-mail window status --json
liquid-mail summarize --topic <topic>
liquid-mail decisions --topic <topic>
```

If you discover a newer “canonical” topic (for example after a topic merge), switch to it explicitly and let window pinning follow:
```bash
liquid-mail post --topic <new-topic> "[lm-xxxx] CONTEXT: Switching topics (rename/merge)"
```

### Live Updates (Polling)

Liquid Mail is pull-based by default (you run `notify`). If you want near-real-time updates in a dedicated terminal pane, use watch-mode (polling):
```bash
liquid-mail watch --topic <topic>   # watch a topic
liquid-mail watch                  # or watch your pinned topic
```

### Mapping Cheat-Sheet

| Concept | In Beads | In Liquid Mail |
|---------|----------|----------------|
| Work item | `lm-jht` (issue ID) | Include `[lm-jht]` in posts |
| Workstream | — | `--topic auth-system` |
| Subject prefix | — | `[lm-jht] ...` |
| Commit message | Include `lm-jht` | — |
| Status | `br update --status` | Post progress messages |

### Pitfalls

- **Don't manage tasks in Liquid Mail**—Beads is the single task queue
- **Always include `lm-xxx`** in posts to avoid ID drift across tools
- **Don't dump logs**—keep posts short and structured

### Quick Reference

| Need | Command |
|------|---------|
| What changed? | `liquid-mail notify` |
| Check locks | `liquid-mail query "LOCK:"` |
| Lock bead/files | `liquid-mail post --topic <topic> "[lm-xxx] LOCK: bead=... files=... ttl=60m until=... agent=..."` |
| Log progress | `liquid-mail post "[lm-xxx] ..."` |
| Discuss decisions (same decision space) | `liquid-mail post --decision "[lm-xxx] DECISION: ..."` |
| Find history | `liquid-mail query "search term"` |
| Prior decisions | `liquid-mail decisions --topic <topic>` |
| Show config | `liquid-mail config` |
| List topics | `liquid-mail topics` |
| Rename topic | `liquid-mail topic rename <old> <new>` |
| Merge topics | `liquid-mail topic merge <A> <B> --into <C>` |
| Polling watch | `liquid-mail watch [--topic <topic>]` |

