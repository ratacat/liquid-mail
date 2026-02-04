---
date: 2026-02-04
topic: topic-management-redesign
---

# Topic Management Redesign

## What We're Building

Overhauling topic management to enforce good naming practices and give agents explicit control over topic lifecycle. The current system auto-generates UUID topic names when agents don't specify, leading to unhelpful names like `lm3189ed8785c64e879df0c7f331a04c40`. We're moving to required explicit topic names with validation.

## Changes

### 1. Require `--topic` flag on `post`
- `liquid-mail post` without `--topic` fails with helpful error
- Error suggests checking existing topics with `liquid-mail topics`

### 2. Topic name validation
- Format: lowercase alphanumeric + hyphens only
- Regex: `^[a-z][a-z0-9-]*[a-z0-9]$` (or single char `^[a-z]$`)
- Length: 1-50 characters
- Reject UUIDs and random strings

### 3. Add `topic rename` command
- Alias layer stored in `.liquid-mail/state.json`
- Maps old name → new name
- All commands resolve aliases transparently
- No cross-machine sync (local state only)

### 4. Add `topic merge` command
- `liquid-mail topic merge <topic-a> <topic-b> --into <new-topic-name>`
- Creates new topic C with specified name
- Posts redirect messages to both A and B pointing to C
- No message migration (messages stay in original topics, still searchable)

### 5. Remove max_active auto-consolidation
- Delete `consolidate.ts` and related code
- Remove `max_active` and `consolidation_strategy` config options
- Topics persist until explicitly merged

### 6. Sort topics by recency
- `liquid-mail topics` lists most recently updated first
- Already may be doing this, verify and fix if not

## Why This Approach

- **Explicit over implicit**: Requiring `--topic` forces agents to think about organization
- **Simple aliases**: Local JSON aliases are simpler than Honcho metadata and sufficient for single-machine agent workflows
- **Redirect-only merge**: Keeps implementation simple, messages remain searchable via global search
- **No auto-consolidation**: Automatic merging was confusing; explicit control is clearer

## Key Decisions

- **Slug format**: Lowercase alphanumeric + hyphens only (no underscores, no mixed case)
- **Alias storage**: Local `.liquid-mail/state.json`, no cross-machine sync
- **Merge behavior**: Redirect messages only, no message migration
- **Validation timing**: Validate on topic creation and when specifying `--topic`

## Open Questions

None - requirements are clear.

## Next Steps

→ Implementation planning
