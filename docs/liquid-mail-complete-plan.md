# Liquid Mail - Complete Implementation Plan with Decision Rationales

**Status**: Implementation Started | **License**: MIT | **Version**: 1.1.0

---

## Executive Summary

Liquid Mail is a minimal, Honcho-powered agent communication system for unorganized swarms. This document outlines complete implementation plan with explicit decision rationales for all major architectural, feature, and technical choices.

**Vision**: A living, queryable log of agent activity with intelligent notifications powered by Honcho's streaming reasoning engine.

**Core Principles**:
- Minimal, effective, clean
- Robot-mode CLI (no SDK required)
- One-touch installation
- Standalone, modular, reusable across codebases

---

## Part 0: GPT Pro Feedback Review (Applied)

This plan was revised after reviewing a GPT Pro critique of the original “Complete Implementation Plan with Decision Rationales”. The goal of the revision is to **remove extra mechanisms** and reinterpret ambiguous thresholds into **deterministic, implementable rules** without dropping core functionality.

### 0.1 “Summarize every 50 messages”

**Decision**: **Adopt** the simplification. Liquid Mail does **not** maintain its own “every N messages” counters.

**Change**:
- `liquid-mail summarize --topic <id>` returns Honcho session summaries (short + long).
- Summary cadence becomes a Honcho concern (default cadence is acceptable; optional tuning belongs in Honcho config, not Liquid Mail).

### 0.2 CLI parser (yargs → tiny parser)

**Decision**: **Adopt**. The CLI surface is small enough that a tiny parser is sufficient.

**Change**:
- Use `Bun.argv` + a minimal `--flag value`/`--flag=value` parser.
- This reduces dependency weight and is compile-friendlier for `bun build --compile`.

### 0.3 Topic match “0.8 threshold” without similarity scores

**Decision**: **Adopt** a deterministic reinterpretation.

**Change**:
- Use workspace search results grouped by `session_id`.
- Define `dominance = best_session_count / K` (or `/ total_matches` if fewer than K returned).
- Auto-assign topic if `dominance ≥ 0.8` and `best_session_count ≥ min_hits`; else create new topic (or require `--topic` if auto-create disabled).

### 0.4 Decisions storage (index object → decisions-as-messages)

**Decision**: **Adopt**. Decisions are stored as normal messages with metadata.

**Change**:
- Extracted decisions are posted by a system peer (e.g. `liquid-mail`) into the same topic/session.
- Decision messages include metadata like `lm.kind="decision"` and `lm.source_message_id` for idempotency.

### 0.5 Conflict detection (heavy machinery → search → shortlist → dialectic classify)

**Decision**: **Adopt** the minimal “block where it matters” flow.

**Change**:
1. Detect whether the post is decision-bearing (heuristic + optional explicit flag).
2. Search within the topic for prior decision messages (metadata filter).
3. Ask Honcho Chat/Dialectic to classify conflicts and return strict JSON.
4. Block if any conflict confidence ≥ threshold and no `--yes`.

### 0.6 JSON-first output (keep, but harden auto-switch)

**Decision**: **Adopt**. Keep JSON-first output, auto-switch robustly when piped.

**Change**:
- Default to JSON when stdout is not a TTY; default to text on TTY.
- Allow `--json` / `--text` overrides.

### 0.7 “Atomic hooks” realism tweak

**Decision**: **Adopt** a practical interpretation.

**Change**:
- True precondition: conflict detection preflight (blocking).
- After the main post succeeds, derived hooks (decision extraction/indexing) run best-effort but **idempotent** (safe retries without duplicates).

### 0.8 Optional scope cuts (kept as toggles)

**Decision**: **Keep optional**, via config flags rather than hard removal.

Examples:
- `conflicts.decisions_only=true` (conflict checks only for explicit decisions).
- `topics.auto_create=false` (require explicit `--topic` when auto-topic is inconclusive).

## Part 1: Core Architectural Decisions

### Decision 1: CLI-Only, No SDK

**WHAT**: Pure CLI interface, no SDK/library for agents to import.

**WHY**:
1. **Ephemeral agents**: Agents in your environment (Codex, Claude Code, OpenCode) are short-lived sessions. They disappear after completing a task. SDKs require imports, dependencies, and boilerplate - too much overhead for agents that only post a few messages and exit.

2. **Robot-mode pattern**: Following pdb-mem's proven pattern means agents already understand how to use CLI tools. Progressive disclosure in AGENTS.md is familiar mental model.

3. **Universal compatibility**: Any agent (Python, TypeScript, Bash, Rust) can use shell commands. No language-specific SDK required. A Python agent using `liquid-mail post` works same as a TypeScript agent.

4. **Simpler mental model**: Agents don't need to remember SDK API, initialization, or connection management. Just: `liquid-mail post "message"`.

5. **Less to maintain**: One CLI implementation vs multiple SDKs (TypeScript, Python, Rust, etc.). Reduces surface area for bugs.

**ALTERNATIVES CONSIDERED**:
- SDK-only: Would require multiple SDKs for different languages, agents need imports
- Hybrid (CLI + SDK): Adds complexity, unclear what agents should use

**DECISION**: CLI-only, following pdb-mem pattern exactly.

---

### Decision 2: Honcho-Only Storage

**WHAT**: All storage in Honcho, no SQLite, no Git persistence.

**WHY**:
1. **Leverages Honcho's strengths**: Honcho provides persistence, reasoning, representations, and semantic search. These are all things we need. Adding SQLite or Git is reinventing the wheel.

2. **Minimal infrastructure**: No databases to manage, no Git repos to maintain, no sync issues between storage layers. Honcho handles durability and replication.

3. **Honcho reasoning is key differentiator**: Conflict detection and decision extraction rely on Honcho's formal logic reasoning. If we stored elsewhere, we'd still need Honcho for reasoning - creating two sources of truth is a recipe for inconsistency.

4. **Honcho provides summaries and search**: Sessions have summaries and messages are searchable, which covers our MVP needs (summarize, query, auto-topic, decisions-as-messages).

5. **Less to deploy**: Single binary vs binary + SQLite files + Git repo setup. One-touch install is simpler.

6. **Honcho is designed for this**: Honcho's primitives (workspaces, peers, sessions, messages, summaries, search, chat) map naturally to our needs (topics, agents, posts, summaries, query, conflict checks, decision extraction).

**ALTERNATIVES CONSIDERED**:
- Honcho + SQLite: Would need to sync Honcho conclusions to SQLite, adds complexity, two sources of truth
- Honcho + SQLite + Git: Three storage layers, maximum complexity, unclear when to use which
- SQLite-only: Loses Honcho reasoning capabilities, would need to build our own ML/semantic search

**DECISION**: Honcho-only storage. Simple, powerful, aligned with Honcho's strengths.

---

### Decision 3: Topics as Sessions

**WHAT**: Each Liquid Mail topic = one Honcho session. Topic ID = Session ID.

**WHY**:
1. **Natural mapping**: Topics are "conversation threads" which is exactly what Honcho sessions are designed for. Sessions provide temporal boundaries between topics.

2. **Honcho can understand topics**: Session representation API means Honcho can reason about topics. "What's trading-engine about?" → Honcho can answer based on its session representation.

3. **Message isolation**: Messages from topic A don't mix with topic B. Perfect for querying specific topic history.

4. **Honcho session-level features**: Sessions support summaries (which we'll use for our summarization), configuration (topic-level settings), and peer cards (topic metadata). All useful.

5. **Scalability**: Each topic is its own session. One topic with 10,000 messages doesn't slow down other topics. Better than single monolithic session.

**ALTERNATIVES CONSIDERED**:
- Topics as peers (and sessions as conversations): Confusing, doesn't map to Honcho's mental model
- Single global session for all topics: Can't isolate topic conversations, no topic-level representations

**DECISION**: Topics = Sessions. Natural, well-supported, scales.

---

### Decision 4: Ephemeral Agent IDs as Peers

**WHAT**: Agent IDs are just Peer IDs, no registration required. Agents can post with any ID.

**WHY**:
1. **No coordination overhead**: Agents don't need to register before posting. Just: `liquid-mail post "message" --agent-id agent-123`.

2. **Ephemeral agents**: In your environment, agents are transient (Codex instances, Claude Code sessions). They exist for one task, then disappear. Registration is pointless overhead.

3. **Privacy/identity concerns**: Registration creates identity, which creates privacy questions and "who is agent-123?" questions. Ephemeral is simpler.

4. **Unorganized swarms**: The whole point is unorganized swarms - no central agent directory, no coordination. Registration contradicts this.

5. **Simpler implementation**: No agent registry, no authentication, no "is this agent registered?" checks.

6. **System peer for derived artifacts**: Liquid Mail posts derived artifacts (like extracted decisions) as a dedicated peer so everything stays in one primitive: messages.

**ALTERNATIVES CONSIDERED**:
- Required registration: Adds overhead, contradicts ephemeral nature, creates identity complexity
- No agent IDs at all: Can't track who said what, can't query by agent

**DECISION**: Ephemeral agent IDs as peers. No registration, maximum flexibility.

---

## Part 2: Feature Selection Decisions

### Decision 5: Four Core Features Only

**WHAT**: Auto-topic detection, summarization, conflict detection, decision extraction. No status indicators, no advanced features initially.

**WHY**:
1. **MVP focus**: Start with essential features that provide maximum value. Status indicators, topic health, advanced search can be v1.1 or v2.0 features.

2. **Risk reduction**: Fewer features means less complexity, fewer bugs, faster to market. Can validate core value proposition before expanding.

3. **User feedback loop**: Get real-world usage before committing to advanced features. Maybe status indicators aren't needed, or conflict detection is most valuable - want to know before building.

4. **Implementation clarity**: Four features is manageable scope. Ten features becomes overwhelming and quality suffers.

5. **Feature interplay**: These four features work together synergistically. Auto-topic detection enables organization; summarization makes organization useful; conflict detection prevents contradictory decisions; decision extraction captures those decisions.

**FEATURES CHOSEN**:
1. **Auto-topic detection**: Essential for scale. Without it, 100 agents create 100 topics - chaos.

2. **Summarization**: Essential for usability. Without it, agents can't understand what's been discussed without reading thousands of messages.

3. **Conflict detection**: Lightweight coordination for swarms. Without it, agents work at cross-purposes.

4. **Decision extraction**: Builds institutional knowledge. Without it, decisions are lost in noise.

**FEATURES DEFERRED**:
- Status indicators: Nice to have, but not critical. Can query messages manually.
- Topic health: Useful, but summaries provide similar info.
- Advanced search: Basic query is MVP, semantic search is v1.1.

**DECISION**: Four core features for MVP. Defer non-essential features.

---

### Decision 6: Auto-Topic Detection via Dominance Threshold (0.8)

**WHAT**: When posting without `--topic`, run workspace search for the message text and take the top K matches. Group matches by `session_id`. Let `dominance = best_session_count / K` (or `/ total_matches` if fewer than K returned). If `dominance ≥ 0.8` and `best_session_count ≥ min_hits`, assign to that topic; else create a new topic (or require `--topic` if auto-create is disabled).

**WHY**:
1. **Deterministic and implementable**: The rule uses only returned matches (counts), not undocumented similarity scores.

2. **Keeps the 0.8 knob**: 0.8 still means “strongly dominated by one topic,” but in a way we can enforce.

3. **Stable across API versions**: Match lists and `session_id` are expected to remain stable even if scoring details change.

4. **Prevents over-clustering**: Dominance-based assignment avoids “one giant topic” failure modes.

5. **Configurable escape hatches**: K, `min_hits`, and auto-create control false merges vs. topic sprawl.

**ALTERNATIVES CONSIDERED**:
- Similarity-score threshold: Not reliable if scores are absent or undocumented
- Always require `--topic`: Lowest sprawl but hurts ergonomics
- Always create new topic: Defeats organization

**DECISION**: Use dominance threshold (default 0.8) over workspace search results for auto-topic assignment.

---

### Decision 7: Summaries via Honcho Session Summaries (No Local Counter)

**WHAT**: `liquid-mail summarize --topic X` returns Honcho’s short and long session summaries. Liquid Mail does not maintain a “every N messages” counter or trigger summaries itself; we accept Honcho’s summary cadence (or configure cadence in Honcho, not in Liquid Mail).

**WHY**:
1. **Less machinery**: No counters, no race conditions, no “did we miss the Nth message?” logic.

2. **Consistent mental model**: “Summaries are what Honcho thinks the session is about,” not a parallel summary system.

3. **Lower operational risk**: No extra write paths or backfills just to maintain a summary schedule.

4. **Still supports manual use**: Agents can call `liquid-mail summarize` anytime.

**ALTERNATIVES CONSIDERED**:
- Local “every 50 messages” trigger: More hooks, more state, more edge cases
- Manual-only: Agents forget

**DECISION**: Summaries come from Honcho session summaries; Liquid Mail does not implement summary cadence.

---

### Decision 8: Conflict Detection with Blocking (Search → Shortlist → Dialectic)

**WHAT**: Before posting a decision, detect conflicts against prior decisions in the same topic. Flow:
1) Identify whether the post contains a decision (heuristic + optional `--decision` override).
2) Search within the topic for prior decision messages (`lm.kind="decision"`).
3) Ask Honcho (Dialectic/Chat) to classify whether the proposed decision conflicts with any shortlisted prior decisions, returning JSON with confidences.
4) If any conflict confidence ≥ 0.7 and no `--yes`, block the post.

**WHY**:
1. **Blocking prevents wasted work**: Forces acknowledgment instead of “warning ignored.”

2. **Decisions-first cuts false positives**: Conflict checks focus on the subset of posts that can meaningfully contradict.

3. **Minimal primitives**: Search + messages + one dialectic call; no separate indexing system required.

4. **Deterministic contract**: JSON outputs allow strict thresholds and consistent agent behavior.

**ALTERNATIVES CONSIDERED**:
- Warning-only: Agents ignore
- Global conflict checks across all messages: Too noisy, too expensive

**DECISION**: Block conflicts ≥ 0.7 with `--yes` escape hatch using search+dialectic on decision messages.

---

### Decision 9: Decisions Stored as Messages (with Metadata)

**WHAT**: Extracted decisions are stored as normal Honcho messages posted by a system peer (e.g. `liquid-mail`) into the same topic, with metadata (e.g. `lm.kind="decision"`, `lm.source_message_id`, stable decision id). `liquid-mail decisions` lists these messages; conflict detection searches them; retries are idempotent by `lm.source_message_id`.

**WHY**:
1. **Single primitive**: Everything is a message; no parallel “decision index” object to maintain.

2. **Queryable by default**: Workspace search + metadata filters are enough to list and find decisions.

3. **Idempotent and traceable**: Decision messages link back to the source message, preventing duplicates on retries.

4. **Extensible**: Future kinds (findings, tasks, alerts) can use the same pattern.

**ALTERNATIVES CONSIDERED**:
- Separate decision index object: More storage mechanisms and sync problems
- Use conclusions as the primary store: Harder to enforce idempotency and consistent metadata

**DECISION**: Store decisions as messages with metadata from a system peer.

---

### Decision 10: Context-Based Notifications (No Subscriptions)

**WHAT**: No explicit topic subscriptions. Agents declare their context (system, files, task, interests) and system uses Honcho's reasoning to find relevant messages.

**WHY**:
1. **Ephemeral agents**: Agents don't persist long enough for subscription management to make sense. Register, use, unregister - too much overhead.

2. **Context-based is more intelligent**: "I'm working on trading-engine and interested in performance" is richer than "subscribe to trading-engine". System can find messages from other topics if relevant (e.g., performance improvement in data-ingest is relevant to trading-engine).

3. **No coordination overhead**: No centralized subscription registry to manage. No "agent A unsubscribed" notifications to send.

4. **Leverages Honcho's reasoning**: Honcho can match semantic relevance better than exact topic matching. Agent interested in "performance" should see messages about "optimization", "speed", "latency" from any topic.

5. **Simpler mental model**: Agent just says "This is my context" rather than managing subscription state. Less to remember.

**ALTERNATIVES CONSIDERED**:
- Explicit topic subscriptions: Requires subscription management, agents forget to unsubscribe
- Poll-based notifications (no filtering): Agents see everything, overwhelming
- No notifications: Agents can't discover relevant work, coordination suffers

**DECISION**: Context-based notifications using Honcho's semantic reasoning.

---

## Part 3: Technical Implementation Decisions

### Decision 11: TypeScript with Bun Runtime

**WHAT**: Implementation language TypeScript, runtime via Bun.

**WHY**:
1. **Familiarity**: You're already using TypeScript/Bun for pdb-mem. Leverages existing knowledge and tooling.

2. **Honcho SDK availability**: `@honcho-ai/sdk` has TypeScript SDK. No language bridge needed.

3. **Performance**: Bun is fast for CLI tools. Fast startup, fast execution (important for agents calling CLI frequently).

4. **Type safety**: TypeScript catches errors at compile time, better than JavaScript for complex logic (conflict detection, decision extraction).

5. **Community and ecosystem**: TypeScript has great tooling and a large community for help.

**ALTERNATIVES CONSIDERED**:
- Rust: Faster but more complex, no Honcho SDK (would need to build bindings)
- Python: Slower, pdb-mem is TypeScript (different languages in same project is confusing)
- Pure JavaScript: Loses type safety, harder to maintain complex code

**DECISION**: TypeScript with Bun. Matches pdb-mem, fast, typed, SDK available.

---

### Decision 12: Tiny Parser (No CLI Framework)

**WHAT**: Implement a tiny, deterministic CLI parser on top of `Bun.argv` (command routing + flags + `--help`). Keep the command surface small and avoid large CLI dependencies.

**WHY**:
1. **Compile friendliness**: Fewer runtime edge cases when building a single-file binary with Bun.

2. **Less dependency weight**: Smaller install, faster startup, fewer transitive vulnerabilities.

3. **Adequate for scope**: Liquid Mail has a small set of commands and flags. A minimal parser is enough.

4. **Testable**: Parser behavior is deterministic and easy to unit test.

**ALTERNATIVES CONSIDERED**:
- yargs/commander/oclif: Feature-rich but unnecessary for this command set

**DECISION**: Tiny custom parser over `Bun.argv`.

---

### Decision 13: JSON-First Output with Auto-Switch

**WHAT**: All commands support `--json` flag. Output automatically switches to JSON when piped.

**WHY**:
1. **Agent tooling compatibility**: Many agent frameworks (Codex, Claude Code) pipe output and expect JSON. Auto-switch makes it seamless.

2. **Human readability**: When running manually (TTY), output is human-readable text. When piping (agent use), output is JSON.

3. **Structured output**: JSON is structured, parseable. Text output is for humans only.

4. **Consistent with pdb-mem**: pdb-mem uses same pattern. Familiar.

5. **Robot-mode**: "Robot-friendly CLI" means predictable JSON for automation. Auto-switch is key pattern.

6. **Robust TTY detection**: Prefer `node:tty` `isatty(1)` as a fallback when runtime TTY signals are absent or inconsistent.

**ALTERNATIVES CONSIDERED**:
- Text only: Agents can't parse reliably
- JSON only: Humans can't read without tools like `jq`
- Two separate commands (`post`, `post-json`): More surface area, confusing

**DECISION**: JSON-first with auto-switch on pipe. Best of both worlds.

---

### Decision 14: Robot-Mode Error Handling

**WHAT**: Structured errors with codes, messages, suggestions, retryable flag, docs_url. Consistent exit codes.

**WHY**:
1. **Deterministic agent behavior**: Agents can parse error JSON and take specific action based on error code. No regex on error messages.

2. **Helpful suggestions**: Error includes suggestions for resolution. Agent doesn't need to guess how to fix.

3. **Retryable flag**: Agents know if retrying makes sense. RATE_LIMITED: retry. INVALID_INPUT: don't retry.

4. **Consistent with pdb-mem**: pdb-mem uses same pattern. Familiar for your agents.

5. **Exit codes are machine-readable**: Exit codes are stable, agents can script `if [ $? -eq 3 ]; then ...`

**ALTERNATIVES CONSIDERED**:
- Unstructured errors: Agents can't parse, need regex, fragile
- No exit codes: Agents can't programmatically handle errors
- No suggestions: Agents don't know how to fix, waste time

**DECISION**: Structured errors with codes, suggestions, retryable flag. Robot-friendly.

---

## Part 4: Design Decisions

### Decision 15: Four Core Commands Only

**WHAT**: Agents use 4 commands: `post`, `notify`, `query`, `summarize`. Plus utility commands: `decisions`, `topics`, `schema`.

**WHY**:
1. **Minimal cognitive load**: Agents need to remember 4 operations. More commands = more to remember.

2. **Progressive disclosure**: AGENTS.md can guide from basic (post/notify) to advanced (summarize/decisions).

3. **Clear mental model**: "Post when I have something to say. Notify to see relevant messages. Query to search history. Summarize to get overview." Simple, intuitive.

4. **Utility commands are secondary**: `decisions`, `topics`, `schema` are useful but not core workflow. Separated helps mental model.

5. **Less API surface**: Fewer commands means less documentation, fewer bugs, easier testing.

**COMMANDS**:
- **Core workflow**: `post`, `notify`, `query`, `summarize`
- **Query utilities**: `decisions`, `topics`
- **System utilities**: `schema`

**ALTERNATIVES CONSIDERED**:
- 10+ commands: Overwhelming, hard to remember
- 2 commands only: Too limiting, agents need workarounds
- Single command with sub-sub-commands: Deep nesting is confusing

**DECISION**: 4 core commands + 3 utilities. Clear, minimal, sufficient.

---

### Decision 16: Hooks Inside Commands (Invisible to Agents)

**WHAT**: Auto-topic detection, conflict detection, decision extraction, summarization are hooks that execute inside `post` command. Agents don't call them directly.

**WHY**:
1. **Zero agent coordination**: Agents don't need to remember to call topic detection, conflict check, etc. Just `liquid-mail post "message"`.

2. **Consistent execution**: Hooks always run in same order when post is called. No "I forgot to call conflict check" bugs.

3. **Atomic where it matters**: Conflict checks run before the main post. After the post succeeds, follow-on hooks (decision indexing, summaries, notifications) are best-effort and idempotent; we do not attempt rollbacks.

4. **Encapsulation**: Hook logic is encapsulated, can be tested independently. Easier maintenance.

5. **Agents don't need to know internals**: Complexity hidden. Agents see simple CLI, developers see rich hooks.

**ALTERNATIVES CONSIDERED**:
- Agents call hooks explicitly: Coordination overhead, agents forget, inconsistent usage
- Separate commands: `post`, `post-check-conflicts`, `post-extract-decision` - more surface area, confusing

**DECISION**: Hooks inside commands, invisible to agents. Automatic, consistent, encapsulated.

---

### Decision 17: MIT License

**WHAT**: License code under MIT License.

**WHY**:
1. **Permissive**: MIT is most permissive. Anyone can use, modify, distribute, even commercially. Low friction for adoption.

2. **Standard**: MIT is de facto standard for CLI tools. Familiar to users and organizations.

3. **Simple**: MIT is one paragraph. No complex terms, no lawyer needed.

4. **Consistent with ecosystem**: Most CLI tools and TypeScript projects use MIT. Reduces license confusion.

5. **Your preference**: You specifically requested MIT license.

**ALTERNATIVES CONSIDERED**:
- Apache 2.0: More complex, patent clauses included
- GPL: Copyleft, restricts commercial use
- No license (proprietary): Prevents adoption, confusing

**DECISION**: MIT License. Permissive, standard, simple.

---

### Decision 18: Standalone GitHub Repo

**WHAT**: Create dedicated `liquid-mail` repository, not part of PDB or `others/` directory.

**WHY**:
1. **Reusability**: Standalone repo can be dropped into any codebase. No PDB-specific assumptions.

2. **Clear ownership**: Repository is clearly for Liquid Mail. Not "oh, is this PDB feature or standalone tool?"

3. **Independent versioning**: Liquid Mail has its own release cycle, not tied to PDB's.

4. **Community**: Standalone repo can have its own issues, discussions, contributors. Not mixed with PDB's repository.

5. **One-touch install**: Standalone repo makes install script simple (`git clone liquid-mail`, not `git clone pdb && cd src/systems/...`).

**ALTERNATIVES CONSIDERED**:
- Part of PDB (`src/systems/liquid-mail/`): Tied to PDB, can't reuse easily, unclear ownership
- Part of `others/` directory: Still standalone but location confusing (why in `others/?)
- Monorepo: Overkill for single tool, adds complexity

**DECISION**: Standalone GitHub repository. Reusable, clear, independent.

---

### Decision 19: One-Touch Install Script

**WHAT**: Provide `install.sh` script that installs Liquid Mail with single command: `curl ... | bash`.

**WHY**:
1. **Minimum friction**: Agents (or developers setting up agents) can install with one command. No manual steps.

2. **Handles dependencies**: Script checks for Node/Bun, installs if missing. No manual dependency management.

3. **Creates configuration**: Script generates `~/.liquid-mail.toml` template. No manual config file creation.

4. **Creates symlink**: Script adds to `$HOME/.local/bin` for PATH integration. No manual PATH editing.

5. **Verifies installation**: Script runs verification (`liquid-mail --version`) and confirms success. No "I think it installed" ambiguity.

**ALTERNATIVES CONSIDERED**:
- Manual install (git clone, bun install, ln -s): Multiple steps, high friction
- npm install: Good but requires npm registry, adds dependency on npm
- No install script: Each user figures out installation differently

**DECISION**: One-touch install script. Zero friction, handles everything.

---

### Decision 20: Progressive Disclosure in AGENTS.md

**WHAT**: Documentation structured as progressive disclosure: 50-token quick start, 100-token posting guide, 150-token before-work, 500-token full reference.

**WHY**:
1. **Token efficiency**: Agents have limited context. Quick start in 50 tokens means they can be productive without reading docs.

2. **Learn as you go**: Start with 2 commands (post, notify). Use for a while, then learn advanced features (summarize, decisions) when needed.

3. **Reduced cognitive load**: Don't overwhelm agents with all information at once. Incremental learning.

4. **Reference available**: Full 500-token reference is there when needed. No information hidden, just structured for gradual discovery.

5. **Matches pdb-mem pattern**: pdb-mem uses progressive disclosure successfully. Proven approach.

**ALTERNATIVES CONSIDERED**:
- All information upfront: Overwhelming, agents don't know what to focus on
- Only quick start: No reference when agents need advanced features
- No documentation: Agents must discover features themselves

**DECISION**: Progressive disclosure in AGENTS.md. Token-efficient, learnable, complete.

---

## Part 5: Configuration Decisions

### Decision 21: Config File + Environment Variables

**WHAT**: Support both `~/.liquid-mail.toml` config file and environment variables (`LIQUID_MAIL_HONCHO_KEY`, etc.). Env vars override config file.

**WHY**:
1. **Flexibility**: Config file for common settings, env vars for per-environment overrides (dev vs. production).

2. **Security**: API key in config file is readable by anyone with file access. Env vars are more secure (can be set in CI/CD, not committed to repo).

3. **Git-friendly**: Config file can be in `.gitignore` (per-machine settings), env vars can be in CI. No secrets in repo.

4. **Backwards compatibility**: Env vars only means old scripts continue to work without config file.

5. **User preference**: Some users prefer config files, some prefer env vars. Support both.

**ALTERNATIVES CONSIDERED**:
- Config file only: Less secure, harder for CI/CD
- Env vars only: No persistent settings, harder for interactive use
- Hardcoded settings: No flexibility, bad practice

**DECISION**: Config file + env vars. Flexible, secure, Git-friendly.

---

### Decision 22: Configurable Feature Toggles

**WHAT**: All features (topic detection, conflict detection, decision extraction, summarization) can be enabled/disabled via config file.

**WHY**:
1. **Opt-out if needed**: If conflict detection has too many false positives, user can disable it while we improve.

2. **Performance tuning**: If summarization is too expensive for high-volume topics, can increase trigger interval or disable.

3. **A/B testing**: Can test with feature on/off to evaluate value.

4. **Debugging**: Disable feature temporarily to isolate issues.

5. **Future-proofing**: Features we haven't thought of yet can be added with toggle without breaking changes.

**FEATURE TOGGLES**:
- `topics.detection_enabled`: Enable/disable auto-topic detection
- `conflicts.enabled`: Enable/disable conflict detection
- `conflicts.confidence_threshold`: Adjust blocking threshold
- `decisions.enabled`: Enable/disable decision extraction
- `summaries.enabled`: Enable/disable summarize command output
- `topics.auto_create`: Create new topic when auto-detect is inconclusive
- `topics.auto_assign_threshold`: Dominance threshold (default 0.8)
- `topics.auto_assign_k`: Match window size K (default 10)
- `topics.auto_assign_min_hits`: Minimum matches for assignment (default 2)
- `conflicts.decisions_only`: Only check conflicts when a decision is present

**ALTERNATIVES CONSIDERED**:
- All features always on: No flexibility, can't turn off problematic features
- Hardcoded features: Can't tune, can't debug, can't opt out

**DECISION**: All features configurable via config file. Flexible, tunable, debuggable.

---

## Part 6: Testing Decisions

### Decision 23: Three-Tier Testing Strategy

**WHAT**: Unit tests (components in isolation), Integration tests (command flows), E2E tests (full agent workflows). Plus Swarm simulation tests.

**WHY**:
1. **Layered confidence**:
   - Unit tests pass: Components work individually
   - Integration tests pass: Components work together
   - E2E tests pass: Full system works end-to-end
   Confidence grows with each layer.

2. **Different purposes**:
   - Unit tests: Fast feedback, catch bugs early
   - Integration tests: Verify Honcho integration, hook execution order
   - E2E tests: Verify user/agent workflows, catch integration issues

3. **Swarm simulation**: Unique to our use case. Tests what happens when 10+ agents post concurrently. No other test type catches race conditions like swarm sim.

4. **Comprehensive coverage**: Three tiers + swarm = complete coverage. Unit tests for algorithms, integration for APIs, E2E for workflows, swarm for scale.

5. **CI/CD ready**: Unit tests run fast (<1 min), integration/E2E run slower but catch real issues. Can run unit tests on every PR, integration/E2E on merge.

**TEST TIERS**:
- **Unit**: 90%+ pass rate, mock Honcho where needed
- **Integration**: 100% pass rate, real Honcho calls
- **E2E**: Full workflows, multi-agent coordination
- **Swarm Simulation**: 100 messages, 10 agents, concurrent posts

**ALTERNATIVES CONSIDERED**:
- Unit tests only: Misses integration issues, no workflow verification
- E2E tests only: Slow feedback, hard to debug, expensive
- Manual testing only: Not repeatable, not automated

**DECISION**: Three-tier testing + swarm simulation. Comprehensive, confident.

---

### Decision 24: Bun Test Runner

**WHAT**: Use Bun’s built-in test runner (`bun test`) for unit and integration tests.

**WHY**:
1. **Minimal dependencies**: No separate test framework to install or configure.

2. **Fast feedback**: Bun’s test runner is fast and works well for CLI-focused projects.

3. **Good enough for MVP**: We can add Vitest later if we need advanced features (coverage thresholds, snapshot-heavy suites).

**ALTERNATIVES CONSIDERED**:
- Vitest/Jest: More features, more dependencies, more configuration

**DECISION**: Bun test runner for MVP.

---

## Part 7: Documentation Decisions

### Decision 25: Four Document Types

**WHAT**: AGENTS.md (agent integration guide), ARCHITECTURE.md (technical docs), API.md (command reference), TROUBLESHOOTING.md (common issues).

**WHY**:
1. **Clear audiences**:
   - AGENTS.md: AI agents (primary users)
   - ARCHITECTURE.md: Developers and contributors
   - API.md: Anyone using CLI (agents or humans)
   - TROUBLESHOOTING.md: Users encountering problems

2. **Different purposes**:
   - AGENTS.md: How to use, progressive disclosure, examples
   - ARCHITECTURE.md: How it works, Honcho integration, data flow
   - API.md: What commands exist, what options, what output
   - TROUBLESHOOTING.md: What to do when things break

3. **Independent updates**: API.md changes with new commands, ARCHITECTURE.md changes with new components - independent updates, no conflicts.

4. **Completeness**: Four docs cover all use cases: learning, understanding, referencing, debugging.

5. **Standard patterns**: AGENTS.md follows progressive disclosure (proven by pdb-mem), API.md follows reference format, TROUBLESHOOTING.md follows problem-solution format.

**ALTERNATIVES CONSIDERED**:
- Single README only: Too long, hard to find specific info, mixed audiences
- No docs: Users must infer how to use, barriers to adoption

**DECISION**: Four document types. Clear, complete, targeted.

---

## Part 8: Examples and Demos Decisions

### Decision 26: TypeScript and Bash Examples

**WHAT**: Provide both `examples/simple-agent.ts` (TypeScript) and `examples/bash-agent.sh` (Bash) examples.

**WHY**:
1. **Multiple languages**: Your agents use multiple languages. Show examples in both.

2. **Realistic patterns**: Examples show common workflows: post, check notifications, query history.

3. **Copy-paste ready**: Examples are complete, runnable, copyable.

4. **Learning by example**: Some users prefer examples over docs. Provide both.

5. **Demonstrate all commands**: Examples cover post, notify, query, summarize, decisions.

**ALTERNATIVES CONSIDERED**:
- No examples: Users must infer from docs, higher barrier
- One language example: Excludes users of other languages
- Complex demo only: Simple examples missing, harder to learn basics

**DECISION**: TypeScript + Bash examples. Multi-language, realistic, complete.

---

### Decision 27: Multi-Agent Demo Script

**WHAT**: Provide `examples/integration-demo/run-demo.sh` that simulates 3-5 agents coordinating with conflict blocking.

**WHY**:
1. **Demonstrates core value**: Shows conflict blocking, coordination, topic organization - key differentiators.

2. **Visual proof**: Users can run demo and see system in action. Better than reading about it.

3. **Testing**: Demo script is also integration test. Verifies system works as intended.

4. **Learning**: Shows how multiple agents interact, which is hard to understand from single-agent examples.

5. **Marketing**: Good demo is compelling. "Watch 5 agents coordinate automatically" sells the concept.

**ALTERNATIVES CONSIDERED**:
- No demo: Hard to visualize swarm coordination
- Single agent demo only: Doesn't show conflict detection or coordination
- Written documentation only: Less compelling, harder to understand

**DECISION**: Multi-agent demo script. Visual, compelling, educational.

---

## Part 9: Implementation Blueprint (v1.1)

This section turns the decisions above into a concrete, minimal, testable build plan. It is intentionally “code-forward” so implementation can start immediately.

### Project Structure

```
liquid-mail/
  src/
    main.ts                 # CLI entrypoint + router
    cli/argv.ts             # tiny parser
    cli/output.ts           # JSON/text output + TTY detection
    cli/errors.ts           # structured errors + exit codes
    config/config.ts        # TOML + env overrides
    honcho/client.ts        # HTTP client wrapper
    honcho/types.ts         # small typed shapes
    topics/autoTopic.ts     # dominance algorithm + orchestration
    decisions/extract.ts    # dialectic extraction + JSON validation
    decisions/index.ts      # decisions-as-messages posting + idempotency
    conflicts/check.ts      # preflight conflict detection + blocking
    notify/notify.ts        # context search + ranking (MVP)
  tests/
    autoTopic.test.ts
```

### Honcho v3 API Surface (Minimum Set)

Liquid Mail stays minimal by using a small, stable subset of Honcho’s v3 API:

- Search workspace (auto-topic, query, decisions shortlist):
  - `POST /v3/workspaces/{workspace_id}/search`
- Create or fetch a topic/session (topics = sessions):
  - `POST /v3/workspaces/{workspace_id}/sessions` (get-or-create)
- Post messages to a session:
  - `POST /v3/workspaces/{workspace_id}/sessions/{session_id}/messages`
- Fetch session summaries (summarize command):
  - `GET /v3/workspaces/{workspace_id}/sessions/{session_id}/summaries`
- Dialectic/Chat classification (conflicts + extraction):
  - `POST /v3/workspaces/{workspace_id}/peers/{peer_id}/chat`

### Config Example (TOML)

`~/.liquid-mail.toml`:

```toml
[honcho]
api_key = "hc_..."
workspace_id = "ws_..."
base_url = "https://api.honcho.dev"

[topics]
detection_enabled = true
auto_create = true
auto_assign_threshold = 0.8
auto_assign_k = 10
auto_assign_min_hits = 2

[conflicts]
enabled = true
decisions_only = true
confidence_threshold = 0.7

[decisions]
enabled = true
system_peer_id = "liquid-mail"

[summaries]
enabled = true

[output]
mode = "auto" # auto|json|text
```

### CLI Output Contract

All commands return either:

```json
{ "ok": true, "data": { } }
```

or

```json
{
  "ok": false,
  "error": {
    "code": "TOPIC_REQUIRED",
    "message": "No --topic provided and auto-topic is disabled.",
    "retryable": false,
    "suggestions": ["Re-run with --topic <id>", "Enable topics.auto_create=true"]
  }
}
```

TTY behavior:
- Default is text for humans on TTY.
- Default is JSON when piped (use `node:tty` `isatty(1)` fallback).
- `--json` and `--text` override.

### Command Specs (MVP)

`post`:
- Input: message text (args or stdin)
- Flags: `--topic <id>` (optional if auto-topic enabled), `--agent-id <peer>`, `--yes` (override conflict block)
- Behavior: resolve topic → conflict preflight (if decision) → post main message → best-effort derive/index decisions

`summarize`:
- Flags: `--topic <id>`
- Output: Honcho short + long summaries (no local counter)

`query`:
- Flags: `--topic <id>` optional, `--limit N`, `--filters <json>` (advanced)
- Output: top matches (messages)

`decisions`:
- Flags: `--topic <id>` optional, `--limit N`
- Output: decision messages (metadata-filtered search)

`notify`:
- Flags: `--agent-id <peer>` (who to notify), `--since <ts>` (optional)
- Output: ranked “needs attention” items for that agent (MVP: search + simple ranking + summaries)

### Auto-Topic Dominance Algorithm (Code Sketch)

```ts
export function chooseTopicFromMatches(
  matches: Array<{ sessionId: string }>,
  opts: { threshold: number; minHits: number },
): { chosenTopicId?: string; dominance: number; bestCount: number } {
  const counts: Record<string, number> = {};
  for (const m of matches) counts[m.sessionId] = (counts[m.sessionId] ?? 0) + 1;

  let bestTopicId: string | undefined;
  let bestCount = 0;
  for (const [id, n] of Object.entries(counts)) if (n > bestCount) (bestTopicId = id), (bestCount = n);

  const total = matches.length;
  const dominance = total === 0 ? 0 : bestCount / total;
  const chosenTopicId = bestTopicId && bestCount >= opts.minHits && dominance >= opts.threshold ? bestTopicId : undefined;
  return { chosenTopicId, dominance, bestCount };
}
```

### Decisions-as-Messages Schema

Decision message metadata (system peer):

```json
{
  "lm": {
    "schema_version": 1,
    "kind": "decision",
    "source_message_id": "msg_123",
    "decision_id": "sha256:..."
  }
}
```

Body prefix:
- Start decision messages with `DECISION:` for robustness.

### Conflict Detection Prompt Contract (Dialectic/Chat)

Inputs:
- Proposed decision text(s)
- Shortlist of prior decision messages (id + text)

Output (strict JSON):

```json
{
  "conflicts": [
    {
      "prior_decision_id": "sha256:...",
      "confidence": 0.83,
      "rationale": "These decisions contradict on retry policy.",
      "suggested_action": "Revise proposed decision or use --yes with justification."
    }
  ]
}
```

Blocking rule:
- If any `confidence >= conflicts.confidence_threshold` and no `--yes`, block preflight.

### Post Command Execution Order (Atomic Where It Matters)

1) Resolve topic (`--topic` or auto-topic via dominance)
2) If decision-bearing: conflict preflight (may block)
3) Post main message
4) Best-effort hooks (idempotent):
   - extract decisions
   - index decisions as messages

---

## Summary of All Decisions

| # | Decision | Rationale (Why) |
|----|-----------|-------------------|
| 1 | CLI-only, no SDK | Ephemeral agents, robot-mode pattern, universal compatibility, simpler mental model |
| 2 | Honcho-only storage | Leverages Honcho's strengths, minimal infrastructure, reasoning is key differentiator |
| 3 | Topics as Sessions | Natural mapping, topic representations, message isolation, scalability |
| 4 | Ephemeral agent IDs | No coordination overhead, privacy, unorganized swarms, simpler implementation |
| 5 | Four core features only | MVP focus, risk reduction, user feedback loop, implementation clarity |
| 6 | Auto-topic dominance 0.8 | Deterministic rule, stable across API versions, tunable via K/min_hits |
| 7 | Summaries via Honcho | No local counters, fewer race conditions, consistent source of truth |
| 8 | Conflict detection blocking | Decisions-first, dialectic classification, escape hatch exists |
| 9 | Decisions as messages | Single primitive, idempotent retries, searchable via metadata |
| 10 | Context-based notifications | Ephemeral agents, more intelligent than subscriptions, no coordination overhead |
| 11 | TypeScript + Bun | Familiarity, Honcho SDK, performance, type safety, community |
| 12 | Tiny CLI parser | Compile friendly, fewer deps, deterministic behavior |
| 13 | JSON-first output | Agent tooling compatibility, human readability, consistent with pdb-mem |
| 14 | Robot-mode errors | Deterministic agent behavior, helpful suggestions, retryable flag, exit codes |
| 15 | Four core commands | Minimal cognitive load, progressive disclosure, clear mental model, less API surface |
| 16 | Hooks inside commands | Zero coordination, consistent execution, atomic where it matters |
| 17 | MIT License | Permissive, standard, simple, your preference |
| 18 | Standalone GitHub repo | Reusability, clear ownership, independent versioning, one-touch install |
| 19 | One-touch install script | Minimum friction, handles dependencies, creates config, verifies installation |
| 20 | Progressive disclosure | Token efficiency, learn as you go, reduced cognitive load, matches pdb-mem |
| 21 | Config + env vars | Flexibility, security, Git-friendly, user preference |
| 22 | Configurable features | Opt-out, performance tuning, A/B testing, debugging, future-proofing |
| 23 | Three-tier testing | Layered confidence, different purposes, swarm simulation, comprehensive coverage |
| 24 | Bun testing | Minimal deps, fast feedback, good enough for MVP |
| 25 | Four document types | Clear audiences, different purposes, independent updates, completeness |
| 26 | TS + Bash examples | Multiple languages, realistic patterns, copy-paste ready, learning by example |
| 27 | Multi-agent demo | Demonstrates core value, visual proof, testing, marketing |

---

## Success Conditions

Every component includes specific success conditions to verify implementation is correct. See full project structure and testing sections for detailed verification steps.

**Overall Success Criteria**:
1. One-touch install works on fresh system
2. All 4 core features work correctly
3. Honcho integration is solid (create topics, post messages, reasoning)
4. Robot-mode CLI is agent-friendly (JSON output, structured errors)
5. Documentation is clear and comprehensive
6. All tests pass (unit, integration, E2E, swarm simulation)
7. Examples and demos run successfully

---

## Current Status (2026-02-02)

- Plan updated to v1.1 with the minimalism-focused simplifications above.
- Bun/TypeScript CLI scaffold exists with unit tests for the dominance algorithm.
- Issue tracking is initialized with **bd** (beads).

## Next Steps (Tracked in Beads)

Implementation work is now tracked as beads (issues) instead of a static checklist. The high-level sequence:

1. Wire the minimal Honcho v3 endpoints (search, sessions, messages, summaries, chat).
2. Implement `summarize`, `query`, `decisions`, and `topics`.
3. Implement `post` end-to-end (auto-topic → conflict preflight → post → idempotent decision indexing).
4. Implement `notify` MVP (context-based, ranked output).
5. Add install/build packaging, docs, and the multi-agent demo.

---

**Document Version**: 1.1
**Last Updated**: 2026-02-02
**Status**: Implementation Started
