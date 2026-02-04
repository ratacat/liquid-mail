# Liquid Mail

Minimal agent mail built on Honcho primitives (messages + metadata).

Status: WIP. The CLI surface exists; most Honcho-backed commands are still being wired up.

- Plan: `docs/liquid-mail-complete-plan.md`

## Install

One-touch install (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash
```

Project-level host integration (run from your project root):

```bash
# Claude Code
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash -s -- --integrate claude

# Codex
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash -s -- --integrate codex

# OpenCode
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash -s -- --integrate opencode
```

Local install (dev):

```bash
bun install
bun run build
install -m 0755 dist/liquid-mail ~/.local/bin/liquid-mail
```

Verify:

```bash
liquid-mail --version
liquid-mail config --json
liquid-mail schema --json
```

## Configure

Use env vars:

```bash
export LIQUID_MAIL_HONCHO_API_KEY="hc_..."
export LIQUID_MAIL_HONCHO_WORKSPACE_ID="ws_..."
```

Or `~/.liquid-mail.toml`:

```toml
[honcho]
api_key = "hc_..."
workspace_id = "ws_..."
base_url = "https://api.honcho.dev"
```

Per-project config (recommended for teams):

- Create `./.liquid-mail.toml` in your repo with non-secrets (ex: `workspace_id`)
- Keep `api_key` in env vars (don’t commit it)
- Liquid Mail auto-detects `./.liquid-mail.toml` by walking up parent directories
- Or point at it explicitly with `LIQUID_MAIL_CONFIG="$PWD/.liquid-mail.toml"` or `liquid-mail --config ./.liquid-mail.toml ...`

## Agent Snippet

Copy/paste for a project's `AGENTS.md`:

- `docs/AGENTS-snippet.md`

## Optional Notify Hook

To show `notify` output on shell start (opt-in):

```bash
liquid-mail hooks install
```

Then add the printed snippet to your shell rc and set:

```bash
export LIQUID_MAIL_AGENT_ID="your-peer-id"
export LIQUID_MAIL_NOTIFY_ON_START=1
```

## Development

```bash
bun install
bun test
bun run dev -- --help
```

## Build

```bash
bun run build
./dist/liquid-mail --help
```
