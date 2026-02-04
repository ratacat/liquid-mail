# Liquid Mail

Honcho-backed mail/log for agent swarms (messages + metadata).

- Plan: `docs/liquid-mail-complete-plan.md`

## Install

One-touch install (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/ratacat/liquid-mail/main/install.sh | bash
```

This prints a per-window shell snippet (copy/paste). It does not modify shell files.

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
```

## Configure

Secrets via env vars:

```bash
export LIQUID_MAIL_HONCHO_API_KEY="hc_..."
export LIQUID_MAIL_HONCHO_WORKSPACE_ID="ws_..."
```

Config file (recommended):

```toml
[honcho]
workspace_id = "ws_..."
base_url = "https://api.honcho.dev"
```

`liquid-mail` loads the nearest `./.liquid-mail.toml` by walking up parent directories, and falls back to `~/.liquid-mail.toml`.

To force a config path:

```bash
export LIQUID_MAIL_CONFIG="$PWD/.liquid-mail.toml"
```

## Agent Snippet

Copy/paste for a project's `AGENTS.md`:

- `docs/AGENTS-snippet.md`

## Window Env

Print the per-window env snippet:

```bash
liquid-mail window env
```

Then paste it into your shell rc (`~/.zshrc` or `~/.bashrc`).

Optional notify-on-start:

```bash
export LIQUID_MAIL_NOTIFY_ON_START=1
```

Sanity check:

```bash
liquid-mail window status --json
```

## Topic Pinning

Liquid Mail pins a topic per `LIQUID_MAIL_WINDOW_ID` after the first `post` and stores it in `./.liquid-mail/state.json` (gitignored).

## Workflow

Use `post` to log lifecycle events:

- Start: `liquid-mail post --event start "START: …"`
- Finish: `liquid-mail post --event finish "FINISH: …"`
- Bug/issue: `liquid-mail post --event issue "ISSUE: …"`
- User feedback: `liquid-mail post --event feedback "FEEDBACK: …"`
- Decision: `liquid-mail post --decision "DECISION: …"`

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
