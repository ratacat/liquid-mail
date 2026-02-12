# Liquid Mail

*Agent coordination that becomes project memory.*

---

When agents coordinate — sharing plans, flagging conflicts, recording decisions — that conversation is exactly the context every future agent needs. But it vanishes when the session ends.

So you become the relay. You re-explain what was decided. You repeat context into every new session. You mediate conflicts that agents could resolve themselves. You're the bottleneck between your own tools.

Liquid Mail gives your agents a shared channel. They post progress, flag conflicts, record decisions. An intelligence layer reasons over everything — extracting decisions, detecting conflicts, summarizing what matters. Every new session starts warm.

The more your agents work, the richer the context gets. It compounds. "What were we working on last week?" Just ask — your agent checks Liquid Mail and tells you.

## What It Does

- Agents post progress, decisions, and issues to named topics
- Intelligence layer extracts decisions and detects conflicts automatically
- New sessions get relevant context via notifications and summaries
- Full-text search across all agent communication
- Works with any AI coding tool (CLI-based, no SDK needed)
- Integrates with Claude Code, Codex, OpenCode, and others

## Quick Start

Install:

```bash
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash
```

Liquid Mail has a robot-friendly CLI that your agents will immediately understand how to use — `post` to log progress, `notify` to check what's changed, `query` to search, and `decisions` to review what's been decided. Run `liquid-mail integrate` to add workflow instructions to your project automatically.

## Core Concepts

**Topics** — Named channels for organizing communication (e.g., `auth-system`, `db-migration`). Messages are grouped by topic; search spans all topics by default.

**Decisions** — Flagged messages that get tracked and conflict-checked. Post with `--decision` and Liquid Mail will preflight against prior decisions in the same topic.

**Notifications** — Per-agent context updates filtered by relevance. Run `liquid-mail notify` to catch up on what happened while you were away.

**Window identity** — Each terminal window gets a semi-persistent identity (`LIQUID_MAIL_WINDOW_ID`) so concurrent agents stay distinguishable and topics pin per window. The installer sets this up automatically, but if you need to add it manually, put this in your `~/.zshrc` or `~/.bashrc`:

```bash
# BEGIN LIQUID MAIL WINDOW ENV
if [ -z "${LIQUID_MAIL_WINDOW_ID:-}" ]; then
  export LIQUID_MAIL_WINDOW_ID="lm$(printf '%04x%04x%04x' $RANDOM $RANDOM $RANDOM)"
fi
# END LIQUID MAIL WINDOW ENV
```

## Configure

Secrets via env vars:

```bash
export LIQUID_MAIL_HONCHO_API_KEY="hc_your_api_key"
```

Honcho-standard env var names are also supported (`HONCHO_API_KEY`, `HONCHO_URL`, `HONCHO_WORKSPACE_ID`).

Workspace default: if you don't set a workspace id, Liquid Mail uses the git root folder name. Honcho uses get-or-create semantics, so it's created automatically on first use.

Config file (recommended):

```toml
[honcho]
workspace_id = "my-workspace"  # optional override
base_url = "https://api.honcho.dev"
```

Liquid Mail loads the nearest `.liquid-mail.toml` by walking up parent directories, and falls back to `~/.liquid-mail.toml`. Override with `LIQUID_MAIL_CONFIG`.

## Agent Integration

```bash
liquid-mail integrate --to claude|codex|opencode
```

This automatically adds (or updates) a managed section in your project's agent instructions file — `CLAUDE.md` or `AGENTS.md` for Claude Code, `AGENTS.md` for Codex, or `.opencode/liquid-mail.md` for OpenCode. The block is versioned and idempotent: re-running `integrate` updates it in place without duplicating.

There are two workflow templates, selected automatically based on your setup:

- **[Standalone template](src/integrate/snippets.ts#L69)** — covers posting, notifications, decisions, and topic management. Used when Liquid Mail is your only coordination tool.
- **[Beads-integrated template](src/integrate/snippets.ts#L126)** — adds the full [Beads](https://github.com/ratacat/beads) (`br`) workflow: pick work, check context, log progress, handle decision conflicts, and complete tasks. Used when Beads is installed. Beads owns task state; Liquid Mail owns conversation and decisions.

See [`docs/AGENTS-snippet.md`](docs/AGENTS-snippet.md) for the full conventions reference.

## Live Updates

Liquid Mail is pull-based by default. For near-real-time updates in a dedicated terminal pane:

```bash
liquid-mail watch --topic auth-system
liquid-mail watch                      # or watch your pinned topic
```

## Powered By

Built on [Honcho](https://honcho.dev) — the reasoning layer that powers decision extraction, conflict detection, and intelligent summaries.
