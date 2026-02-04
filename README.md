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

## Window Env (Recommended)

Print the per-window env snippet:

```bash
liquid-mail window env
```

Then paste it into your shell rc (`~/.zshrc` or `~/.bashrc`) and optionally enable:

```bash
export LIQUID_MAIL_NOTIFY_ON_START=1
```

## Window ID + Topic Pinning (Recommended for swarms)

- Set `LIQUID_MAIL_WINDOW_ID` (unique per terminal window).
- Liquid Mail will automatically pin a topic per window id after the first `post`.

## Agent Workflow (Recommended)

Use `post` to log lifecycle events:

- Start: `liquid-mail post --event start "START: …"`
- Finish: `liquid-mail post --event finish "FINISH: …"`
- Bug/issue: `liquid-mail post --event issue "ISSUE: …"`
- User feedback: `liquid-mail post --event feedback "FEEDBACK: …"`

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
