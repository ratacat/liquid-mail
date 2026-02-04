# Liquid Mail

Honcho-backed mail/log for agent swarms (messages + metadata).

- Plan: `docs/liquid-mail-complete-plan.md`

## Overview

Liquid Mail is a CLI for recording and retrieving “agent swarm mail” (progress, decisions, issues, user feedback) in a shared Honcho workspace.

High-level architecture:

- Storage: messages live in Honcho sessions (“topics”) with metadata (event/decision/etc).
- CLI: `liquid-mail post` writes; `liquid-mail query/summarize/decisions/notify` reads.
- Window identity: each terminal window sets `LIQUID_MAIL_WINDOW_ID` so concurrent swarms are distinguishable.
- Topic pinning: after the first post, Liquid Mail pins a topic per window id in `./.liquid-mail/state.json` (gitignored).
- Project integration: `liquid-mail integrate --to codex|claude|opencode` writes a managed workflow block into your project’s agent instructions.

## Install

One-touch install (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash
```

This prints a per-window shell snippet (copy/paste). It does not modify shell files.
If the snippet is already detected in your shell rc, the installer will skip printing it.

## Configure

Secrets via env vars:

```bash
export LIQUID_MAIL_HONCHO_API_KEY="hc_your_api_key"
export LIQUID_MAIL_HONCHO_WORKSPACE_ID="ws_your_workspace_id"
```

Honcho-standard env var names are also supported:

```bash
export HONCHO_API_KEY="hc_your_api_key"
export HONCHO_WORKSPACE_ID="ws_your_workspace_id"
export HONCHO_URL="https://api.honcho.dev"
```

Config file (recommended):

```toml
[honcho]
workspace_id = "ws_your_workspace_id"
base_url = "https://api.honcho.dev"
```

`liquid-mail` loads the nearest `./.liquid-mail.toml` by walking up parent directories, and falls back to `~/.liquid-mail.toml`.

To force a config path:

```bash
export LIQUID_MAIL_CONFIG="$PWD/.liquid-mail.toml"
```

## Agent Instructions

Liquid Mail integrates with Beads (`br`) for task tracking. Add the snippet from `docs/AGENTS-snippet.md` to your project's agent instructions.

**Quick workflow:**
```bash
br ready                           # Pick work (Beads)
liquid-mail notify                 # Check context
liquid-mail post "[br-123] ..."    # Log progress
liquid-mail post --decision "..."  # Before risky changes
br close br-123                    # Complete (Beads is authority)
```

**Roles:** Beads owns task state; Liquid Mail owns conversation/decisions.

See `docs/AGENTS-snippet.md` for full conventions, topic management, and pitfalls.

## Window Env

Liquid Mail works best when each terminal window has a semi-persistent identity (`LIQUID_MAIL_WINDOW_ID`) so concurrent swarms are distinguishable, and Liquid Mail can pin a topic per window.

Add this snippet to your shell rc (`~/.zshrc` or `~/.bashrc`):

```bash
# BEGIN LIQUID MAIL WINDOW ENV
if [ -z "${LIQUID_MAIL_WINDOW_ID:-}" ]; then
  if command -v uuidgen >/dev/null 2>&1; then
    LIQUID_MAIL_WINDOW_ID="lm$(uuidgen | tr -d - | tr '[:upper:]' '[:lower:]' | cut -c1-12)"
  else
    LIQUID_MAIL_WINDOW_ID="lm$(date -u +%y%m%d%H%M%S)${RANDOM}${RANDOM}"
  fi
  export LIQUID_MAIL_WINDOW_ID
fi
# END LIQUID MAIL WINDOW ENV
```

## Topic Pinning

Liquid Mail pins a topic per `LIQUID_MAIL_WINDOW_ID` after the first `post` and stores it in `./.liquid-mail/state.json` (gitignored).

## Live Updates (Optional “Push”)

Liquid Mail is pull-based by default (you run `notify`). If you want near-real-time updates in a dedicated terminal pane, use watch-mode (polling):

```bash
liquid-mail watch --topic <topic-id>   # Watch a topic
liquid-mail watch                      # Or watch your pinned topic
```
