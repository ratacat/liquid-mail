---
title: "feat: Topic Management Redesign"
type: feat
date: 2026-02-04
---

# Topic Management Redesign

## Overview

Overhaul topic management to enforce good naming practices and give agents explicit control over topic lifecycle. Eliminates auto-generated UUID topic names, adds rename/merge commands, removes automatic consolidation.

## Problem Statement

Agents create poorly-named topics like `lm3189ed8785c64e879df0c7f331a04c40` because:
1. `--topic` flag is optional - system auto-creates UUIDs when not provided
2. No validation rejects bad names
3. No tools to fix bad names after creation
4. Auto-consolidation logic is confusing and agents don't understand merges

## Proposed Solution

1. **Require meaningful topic names** - validate format, reject UUIDs
2. **Add `topic rename`** - alias layer for fixing names
3. **Add `topic merge`** - explicit control over consolidation
4. **Remove auto-consolidation** - no more `max_active` magic
5. **Sort topics by recency** - most recently used first

## Technical Approach

### Phase 1: Topic Name Validation

**New file: `src/topics/validate.ts`**

```typescript
// Validation rules:
// - 4-50 characters
// - Lowercase alphanumeric + hyphens
// - Must start with letter
// - Must end with letter or number
// - No consecutive hyphens
// - Not a reserved name
// - Not a UUID pattern

const TOPIC_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED_NAMES = ['all', 'new', 'help', 'merge', 'rename', 'list'];
const UUID_PATTERN = /^lm[0-9a-f]{32}$/i;

export function validateTopicName(name: string): ValidationResult;
export function isReservedName(name: string): boolean;
export function looksLikeUuid(name: string): boolean;
```

**Modify: `src/main.ts`**

- Add validation call after reading `--topic` flag
- Add validation when creating new topics
- Reject UUID-format names with helpful error

**Error codes:**
- `INVALID_TOPIC_NAME` (exit 2) - with specific reason
- `RESERVED_TOPIC_NAME` (exit 2)

### Phase 2: Require --topic Flag

**Modify: `src/main.ts` (post command, ~lines 492-567)**

Current flow:
1. Check `--topic` flag
2. Check pinned topic from window state
3. Run auto-topic detection
4. Error if still unresolved

New flow:
1. Check `--topic` flag → validate if provided
2. Check pinned topic from window state → validate
3. **Error immediately** - no auto-topic detection

```typescript
// Remove lines 529-556 (auto-topic detection block)
// Simplify to:
if (!resolvedTopicId) {
  throw new LmError({
    code: 'TOPIC_REQUIRED',
    message: 'No topic specified. Use --topic <name> or post to a pinned window.',
    exitCode: 2,
    suggestions: [
      'Run "liquid-mail topics" to list existing topics',
      'Use --topic <name> to specify a topic',
    ],
  });
}
```

### Phase 3: State Schema Update

**Modify: `src/state/state.ts`**

Bump schema to V2, add aliases:

```typescript
export type LiquidMailStateV2 = {
  version: 2;
  windows: Record<string, {
    topic_id?: string;
    updated_at?: string;
    watch?: { ... };
  }>;
  aliases: Record<string, string>;  // old_name -> new_name
};

// Migration function
function migrateState(state: unknown): LiquidMailStateV2;

// Alias functions
export async function getAlias(cwd: string, name: string): Promise<string | undefined>;
export async function setAlias(cwd: string, oldName: string, newName: string): Promise<void>;
export async function resolveAlias(cwd: string, name: string): Promise<string>;
export async function flattenAliasChains(cwd: string): Promise<void>;
```

**Alias chain handling**: When setting alias A→C and B already points to A, update B→C automatically.

### Phase 4: Topic Rename Command

**Modify: `src/main.ts`**

Add command: `liquid-mail topic rename <old> <new>`

```typescript
if (command === 'topic' && subcommand === 'rename') {
  const [oldName, newName] = args;

  // Validate new name
  const validation = validateTopicName(newName);
  if (!validation.valid) {
    throw new LmError({ code: 'INVALID_TOPIC_NAME', ... });
  }

  // Check target doesn't exist as a real topic
  const existing = await findTopicByName(client, newName);
  if (existing && existing.id !== oldName) {
    throw new LmError({
      code: 'TOPIC_NAME_CONFLICT',
      message: `Cannot rename to '${newName}': topic already exists.`,
      suggestions: ['Use "liquid-mail topic merge" to combine topics'],
    });
  }

  // Create alias
  await setAlias(cwd, oldName, newName);

  // Update pinned windows referencing old name
  await updatePinnedTopics(cwd, oldName, newName);

  console.log(`Created alias: ${oldName} → ${newName}`);
}
```

### Phase 5: Topic Merge Command

**Modify: `src/main.ts`**

Add command: `liquid-mail topic merge <A> <B> --into <C>`

```typescript
if (command === 'topic' && subcommand === 'merge') {
  const [topicA, topicB] = args;
  const targetName = getFlagString(flags, 'into');

  // Validate inputs
  if (topicA === topicB) {
    throw new LmError({ code: 'INVALID_MERGE_SOURCE', message: 'Cannot merge topic with itself.' });
  }

  const validation = validateTopicName(targetName);
  if (!validation.valid) { ... }

  // Create new topic C
  const topicC = await getOrCreateSession(client, { name: targetName, ... });

  // Post redirect messages to A and B
  await postMessage(client, topicA, {
    content: `⚠️ Topic merged into \`${targetName}\`. Future posts should use --topic ${targetName}`,
    metadata: { 'lm.kind': 'topic_merge_redirect', 'lm.merged_into': targetName },
  });
  await postMessage(client, topicB, { ... });

  // Create aliases A→C, B→C
  await setAlias(cwd, topicA, targetName);
  await setAlias(cwd, topicB, targetName);

  // Update any pinned windows
  await updatePinnedTopics(cwd, topicA, targetName);
  await updatePinnedTopics(cwd, topicB, targetName);

  console.log(`Merged ${topicA} + ${topicB} → ${targetName}`);
}
```

### Phase 6: Remove Auto-Consolidation

**Delete: `src/topics/consolidate.ts`** (entire file)

**Modify: `src/topics/resolveTopic.ts`**
- Remove import of `consolidateTopics`
- Remove `if (config.maxActive !== undefined)` block (lines 79-107)
- Remove from `AutoTopicDecision` type: `'merged' | 'blocked'`, `mergedFrom`, `maxActive`, `activeCount`

**Modify: `src/config/config.ts`**
- Remove `maxActive` and `consolidationStrategy` from types
- Remove from `defaultConfig`
- Add deprecation warning when parsing old configs:

```typescript
if (parsed.topics?.max_active !== undefined) {
  console.warn('Warning: topics.max_active is deprecated and ignored');
}
```

### Phase 7: Sort Topics by Recency

**Modify: `src/honcho/api.ts` (listSessions, ~lines 56-79)**

Sort sessions by `created_at` descending before returning:

```typescript
const sorted = (page.items ?? [])
  .sort((a, b) => {
    const aTime = a.created_at ?? '';
    const bTime = b.created_at ?? '';
    return bTime.localeCompare(aTime);  // Descending (newest first)
  })
  .slice(0, pageSize);
```

**Note**: Using `created_at` since Honcho doesn't expose last-message time. Could enhance later with local tracking.

### Phase 8: Update Agent Documentation

**Modify: `docs/AGENTS-snippet.md`**

Update topic guidelines:
- Document required `--topic` flag
- Document `topic rename` and `topic merge` commands
- Remove references to auto-topic detection
- Add examples of good topic names

## Acceptance Criteria

### Topic Validation
- [ ] Topics must be 4-50 characters
- [ ] Only lowercase letters, numbers, hyphens allowed
- [ ] Must start with letter, end with letter/number
- [ ] No consecutive hyphens (e.g., `my--topic` rejected)
- [ ] Reserved names rejected: `all`, `new`, `help`, `merge`, `rename`, `list`
- [ ] UUID patterns rejected: `lm<32-hex-chars>`, standard UUIDs
- [ ] Clear error messages with suggestions

### Required --topic
- [ ] `post` without `--topic` and no pinned topic → error
- [ ] `post` with pinned topic but no `--topic` → OK (uses pin)
- [ ] `post` with `--topic` → OK (validates name)
- [ ] Error message suggests `liquid-mail topics` to list existing

### Topic Rename
- [ ] `topic rename old new` creates alias in state.json
- [ ] All future references to `old` resolve to `new`
- [ ] Pinned windows using `old` are updated
- [ ] Cannot rename to existing topic name (error with merge suggestion)
- [ ] Alias chains are flattened automatically

### Topic Merge
- [ ] `topic merge A B --into C` creates topic C
- [ ] Redirect messages posted to A and B
- [ ] Aliases A→C and B→C created
- [ ] Cannot merge topic with itself
- [ ] Target name validated

### Remove Auto-Consolidation
- [ ] `consolidate.ts` deleted
- [ ] `max_active` config ignored with deprecation warning
- [ ] No automatic topic merging

### Sort by Recency
- [ ] `topics` list shows most recently created first
- [ ] JSON output includes `created_at` for sorting

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/topics/validate.ts` | CREATE | Topic name validation |
| `src/topics/consolidate.ts` | DELETE | Remove auto-consolidation |
| `src/main.ts` | MODIFY | Add commands, require --topic |
| `src/state/state.ts` | MODIFY | V2 schema with aliases |
| `src/topics/resolveTopic.ts` | MODIFY | Remove consolidation logic |
| `src/config/config.ts` | MODIFY | Remove max_active, add deprecation warning |
| `src/honcho/api.ts` | MODIFY | Sort topics by recency |
| `src/cli/errors.ts` | MODIFY | Add new error codes |
| `docs/AGENTS-snippet.md` | MODIFY | Update topic documentation |

## Error Codes

| Code | Exit | Message |
|------|------|---------|
| `TOPIC_REQUIRED` | 2 | No topic specified |
| `INVALID_TOPIC_NAME` | 2 | Invalid format (with reason) |
| `RESERVED_TOPIC_NAME` | 2 | Name is reserved |
| `TOPIC_NAME_CONFLICT` | 2 | Target already exists |
| `INVALID_MERGE_SOURCE` | 2 | Cannot merge with self |
| `TOPIC_NOT_FOUND` | 2 | Topic doesn't exist |

## Migration Notes

**Breaking change**: Existing UUID-named topics will fail validation when referenced.

Users must rename legacy topics:
```bash
liquid-mail topic rename lm3189ed8785c64e879df0c7f331a04c40 auth-system
```

Consider adding a migration helper:
```bash
liquid-mail topic migrate-legacy  # Lists UUID topics with rename suggestions
```

## References

- Brainstorm: `docs/brainstorms/2026-02-04-topic-management-redesign.md`
- Current topic resolution: `src/topics/resolveTopic.ts`
- State management: `src/state/state.ts`
- Honcho SDK: https://docs.honcho.dev/v2/documentation/reference/sdk
