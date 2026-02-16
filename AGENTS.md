# Agent Instructions

This project uses **br** (beads) for issue tracking. Run `br agents` to get started.

## Quick Reference

```bash
br ready              # Find available work
br show <id>          # View issue details
br update <id> --status in_progress  # Claim work
br close <id>         # Complete work
br sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   br sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Releases

The installer (`install.sh`) downloads binaries from **GitHub Releases**, not from the `main` branch directly.

**When to create a release:**
- Changes to the CLI binary (new commands, bug fixes, behavior changes)
- Changes to embedded snippets (`src/integrate/snippets.ts`)
- Any change that affects what users get from `install.sh`

**How to create a release:**
```bash
# 1. Bump version
npm version <major|minor|patch> --no-git-tag-version

# 2. Build
npm run build

# 3. Package binary
mkdir -p release
tar -czvf release/liquid-mail-darwin-arm64.tar.gz -C dist liquid-mail

# 4. Commit, tag, push
git add package.json src/version.ts
git commit -m "Bump version to vX.Y.Z"
git tag vX.Y.Z
git push && git push origin vX.Y.Z

# 5. Create release with binary
gh release create vX.Y.Z release/liquid-mail-darwin-arm64.tar.gz --title "vX.Y.Z" --notes "Release notes here"
```

**Note:** Currently only darwin-arm64 binary is built. For cross-platform releases, additional builds would be needed.

<!-- BEGIN LIQUID MAIL (v:e3791691) -->
## Liquid Mail + Beads

**Beads** owns task state (`br`). **Liquid Mail** owns the shared log: progress, decisions, and context that survives sessions.

### Workflow

1. **Start**: `br ready` to find work, then `br update <id> --status in_progress`
2. **Check context**: `liquid-mail notify` and `liquid-mail query "<id>"`
3. **Work**: Log progress as you go. Topic required on first post, pinned after.
   ```bash
   liquid-mail post --topic auth-system "[lm-jht] FINDING: Token refresh in middleware"
   liquid-mail post --decision "[lm-jht] DECISION: Move refresh to AuthService"
   ```
4. **Complete**: `br close <id>`, then post a summary.
5. **Sync**: `br sync --flush-only`, then `git add .beads/ && git commit && git push`

### Posting

- Short (5-15 lines). Prefix: `FINDING:`, `DECISION:`, `QUESTION:`, `NEXT:`
- Include file paths (`src/auth.ts:42`) and issue IDs (`[lm-jht]`)
- Post `DECISION:` messages before risky changes, not after
- User-facing replies: include `AGENT: <window-name>` (`liquid-mail window name`)
- Topics: 4-50 chars, lowercase + hyphens. `liquid-mail topics` to list, `liquid-mail query` to search.
<!-- END LIQUID MAIL -->
