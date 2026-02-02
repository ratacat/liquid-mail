# Liquid Mail - Complete Implementation Plan with Decision Rationales

**Status**: Planning Phase | **License**: MIT | **Version**: 1.0.0

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

4. **Honcho provides representation API**: Topics as peers means Honcho can build representations of topics (what's discussed, patterns, conclusions). This is valuable for future features (topic health, topic understanding).

5. **Less to deploy**: Single binary vs binary + SQLite files + Git repo setup. One-touch install is simpler.

6. **Honcho is designed for this**: Honcho's primitives (workspaces, peers, sessions, messages, conclusions, representations) map naturally to our needs (topics, agents, conversations, messages, decisions, topic understanding).

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

6. **Topics as peers still works**: Topics are peers in Honcho (for topic-level representation). Agent IDs are also peers (for message attribution). Both coexist fine.

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

### Decision 6: Auto-Topic Detection with 0.8 Threshold

**WHAT**: When posting, automatically detect topic from content using semantic search. Assign to existing topic if confidence ≥ 0.8, create new if < 0.8.

**WHY**:
1. **0.8 is conservative but usable**: High enough confidence to avoid wrong assignments (false negatives), but low enough to match most relevant topics (true positives).

2. **Prevents over-clustering**: 0.7 would merge too many topics into one. 0.9 would create too many new topics. 0.8 is sweet spot.

3. **Balances false positives vs. false negatives**:
   - Too low (0.6): High true positives (correct matches) but also high false positives (wrong topic assignments)
   - Too high (0.9): Low false positives but high false negatives (creating new topics when existing one exists)
   - 0.8: Balanced tradeoff

4. **Honcho semantic search is good**: Honcho's semantic search is the mechanism. Trusting it with 0.8 threshold is reasonable.

5. **Fallback to create**: If no topic matches well (< 0.8), create new topic with Honcho-generated name. Better than forcing wrong assignment.

**ALTERNATIVES CONSIDERED**:
- 0.7 threshold: Too permissive, too many wrong assignments
- 0.9 threshold: Too conservative, too many new topics
- No threshold, always create new topic: Defeats purpose of topic detection
- User-specified topics only: No auto-assignment, agents must know topic ID (doesn't scale)

**DECISION**: 0.8 threshold for auto-assignment, create new if < 0.8.

---

### Decision 7: Summarization Every 50 Messages

**WHAT**: Every 50th message in a topic triggers automatic summary generation. Also support manual summarization.

**WHY**:
1. **Consistent triggers**: 50 messages is predictable. Agents know when summary will be generated. Time-based triggers (daily) are unpredictable - some topics get summaries too often, some too rarely.

2. **Good balance of frequency**: 50 messages is enough to generate meaningful summary but not so frequent that we spam with summaries. For active topic (100 messages/day): 2 summaries/day. For quiet topic (10 messages/day): summary every 5 days.

3. **Token efficiency**: Summarizing 50 messages is reasonable cost. 100 messages might be expensive, 25 messages might be too brief.

4. **Honcho's context window**: 50 messages fits well within Honcho's context window for summarization.

5. **Manual option still available**: Agents can call `liquid-mail summarize` anytime if they need summary before 50th message.

**ALTERNATIVES CONSIDERED**:
- Every 25 messages: Too frequent, noisy, higher cost
- Every 100 messages: Too infrequent, stale information
- Time-based (daily): Unpredictable frequency, inconsistent value
- Manual only: Agents forget, no automatic organization

**DECISION**: Every 50th message triggers summary, manual option available.

---

### Decision 8: Conflict Detection with Blocking

**WHAT**: When agent posts decision/statement/finding, check for contradictions with existing conclusions. If conflict detected and confidence ≥ 0.7, BLOCK post. Allow post only with `--yes` flag.

**WHY**:
1. **Prevents wasted work**: Without blocking, agents might miss conflict warnings and implement contradictory solutions. Blocking forces acknowledgment.

2. **Forces review**: Agent must read conflict and consciously decide: "Do I agree, or do I disagree and use `--yes`?" Reduces accidental conflicts.

3. **High compliance**: In automated systems at 2am, warnings are often ignored. Blocking errors cannot be ignored.

4. **Escape hatch exists**: `--yes` flag allows agents who genuinely disagree to override. Blocking doesn't prevent legitimate disagreement, just makes it deliberate.

5. **Confidence threshold 0.7 is reasonable**:
   - High enough to avoid blocking on non-conflicts (false positives)
   - Low enough to catch real contradictions (true positives)
   - Matches Honcho's reasoning quality (Honcho is confident about contradictions it identifies)

6. **Swarm coordination**: This is lightweight coordination mechanism for unorganized swarms. No meetings, no explicit coordination, just conflict detection.

**ALTERNATIVES CONSIDERED**:
- Warning only (non-blocking): High risk agents ignore warnings and proceed anyway
- No conflict detection: Agents work at cross-purposes, massive waste
- 0.9 threshold: Too conservative, many real conflicts slip through
- No `--yes` escape: Forces consensus, prevents legitimate disagreement

**DECISION**: Blocking with 0.7 confidence, `--yes` escape hatch.

---

### Decision 9: Decision Extraction Automatic

**WHAT**: Automatically extract decisions from decision/statement/finding messages and create indexed entries. Use Honcho's reasoning to identify implicit decisions.

**WHY**:
1. **Institutional knowledge capture**: Decisions are the most valuable content in any project. Without extraction, decisions are lost in message noise.

2. **Zero manual effort**: Agents don't need to tag "this is a decision". System identifies both explicit ("We decided to use Redis") and implicit ("I'm going to add retry logic").

3. **Leverages Honcho's reasoning**: Honcho's formal logic reasoning is designed to extract insights from text. Perfect for decision extraction.

4. **Queryable**: Extracted decisions create index. `liquid-mail decisions` is fast query, doesn't require searching all messages.

5. **Supports "what did we decide about X?"**: This is one of the most common questions in any project. Decision extraction makes it answerable.

**ALTERNATIVES CONSIDERED**:
- Manual tagging only: Agents forget to tag, decisions lost
- No extraction: Decisions not queryable, agents can't find them
- Extract only explicit decisions: Misses implicit decisions ("I'm going to add retry logic")

**DECISION**: Automatic extraction of explicit and implicit decisions.

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

5. **Community and ecosystem**: TypeScript has great tooling (yargs, testing frameworks), large community for help.

**ALTERNATIVES CONSIDERED**:
- Rust: Faster but more complex, no Honcho SDK (would need to build bindings)
- Python: Slower, pdb-mem is TypeScript (different languages in same project is confusing)
- Pure JavaScript: Loses type safety, harder to maintain complex code

**DECISION**: TypeScript with Bun. Matches pdb-mem, fast, typed, SDK available.

---

### Decision 12: yargs for CLI Framework

**WHAT**: Use yargs library for CLI parsing and command structure.

**WHY**:
1. **Consistency with pdb-mem**: pdb-mem uses yargs. Same mental model, same code patterns.

2. **Robust**: yargs is mature, handles edge cases well, good error messages.

3. **Subcommand structure**: Natural fit for our command set (post, notify, query, etc.).

4. **Help generation**: yargs generates `--help` automatically. Less documentation code to maintain.

5. **Validation**: yargs validates arguments (choices, required, types). Reduces custom validation code.

**ALTERNATIVES CONSIDERED**:
- commander: Popular but different API, less consistent with pdb-mem
- oclif: More complex, steeper learning curve
- Custom parsing: Reinventing the wheel, more code to maintain

**DECISION**: yargs. Matches pdb-mem, mature, proven.

---

### Decision 13: JSON-First Output with Auto-Switch

**WHAT**: All commands support `--json` flag. Output automatically switches to JSON when piped.

**WHY**:
1. **Agent tooling compatibility**: Many agent frameworks (Codex, Claude Code) pipe output and expect JSON. Auto-switch makes it seamless.

2. **Human readability**: When running manually (TTY), output is human-readable text. When piping (agent use), output is JSON.

3. **Structured output**: JSON is structured, parseable. Text output is for humans only.

4. **Consistent with pdb-mem**: pdb-mem uses same pattern. Familiar.

5. **Robot-mode**: "Robot-friendly CLI" means predictable JSON for automation. Auto-switch is key pattern.

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

3. **Atomic operations**: Post, check conflicts, extract decisions, trigger summary - all in one command transaction. Either all succeed or none.

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
- `summaries.enabled`: Enable/disable auto-summaries
- `summaries.trigger_interval`: Adjust message count threshold

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

### Decision 24: Vitest for Testing Framework

**WHAT**: Use Vitest for unit and integration tests.

**WHY**:
1. **Modern and fast**: Vitest is faster than Jest, better TypeScript support.

2. **Built for Vite/Bun ecosystem**: We're using Bun. Vitest works natively with Bun. No config needed.

3. **Familiarity**: If you use Vitest elsewhere, consistent tooling.

4. **Feature-rich**: Mocking, snapshot testing, coverage - all built-in.

5. **Community**: Large and growing ecosystem, good documentation.

**ALTERNATIVES CONSIDERED**:
- Jest: Older, slower, more complex configuration
- Mocha: Less modern, requires more setup
- No testing framework: Can't test reliably, manual only

**DECISION**: Vitest. Fast, modern, Bun-native.

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

## Summary of All Decisions

| # | Decision | Rationale (Why) |
|----|-----------|-------------------|
| 1 | CLI-only, no SDK | Ephemeral agents, robot-mode pattern, universal compatibility, simpler mental model |
| 2 | Honcho-only storage | Leverages Honcho's strengths, minimal infrastructure, reasoning is key differentiator |
| 3 | Topics as Sessions | Natural mapping, topic representations, message isolation, scalability |
| 4 | Ephemeral agent IDs | No coordination overhead, privacy, unorganized swarms, simpler implementation |
| 5 | Four core features only | MVP focus, risk reduction, user feedback loop, implementation clarity |
| 6 | Auto-topic 0.8 threshold | Conservative but usable, prevents over-clustering, balanced tradeoffs |
| 7 | Summarize every 50 messages | Consistent triggers, good frequency, token efficiency, Honcho context window |
| 8 | Conflict detection blocking | Prevents wasted work, forces review, high compliance, escape hatch exists |
| 9 | Decision extraction automatic | Institutional knowledge capture, zero manual effort, leverages Honcho, queryable |
| 10 | Context-based notifications | Ephemeral agents, more intelligent than subscriptions, no coordination overhead |
| 11 | TypeScript + Bun | Familiarity, Honcho SDK, performance, type safety, community |
| 12 | yargs CLI framework | Consistency with pdb-mem, robust, subcommand structure, help generation |
| 13 | JSON-first output | Agent tooling compatibility, human readability, consistent with pdb-mem |
| 14 | Robot-mode errors | Deterministic agent behavior, helpful suggestions, retryable flag, exit codes |
| 15 | Four core commands | Minimal cognitive load, progressive disclosure, clear mental model, less API surface |
| 16 | Hooks inside commands | Zero coordination, consistent execution, atomic operations, encapsulation |
| 17 | MIT License | Permissive, standard, simple, your preference |
| 18 | Standalone GitHub repo | Reusability, clear ownership, independent versioning, one-touch install |
| 19 | One-touch install script | Minimum friction, handles dependencies, creates config, verifies installation |
| 20 | Progressive disclosure | Token efficiency, learn as you go, reduced cognitive load, matches pdb-mem |
| 21 | Config + env vars | Flexibility, security, Git-friendly, user preference |
| 22 | Configurable features | Opt-out, performance tuning, A/B testing, debugging, future-proofing |
| 23 | Three-tier testing | Layered confidence, different purposes, swarm simulation, comprehensive coverage |
| 24 | Vitest testing | Modern and fast, Bun-native, familiarity, feature-rich |
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

## Next Steps

This plan is complete and ready for implementation. Once you confirm, I will:

1. Create standalone GitHub repository
2. Initialize project structure
3. Implement in order of phases
4. Test at each phase
5. Write documentation alongside code
6. Create examples and demos
7. Build install script
8. Release version 1.0.0

**Questions for Final Confirmation**:
1. Are you ready to proceed with implementation?
2. Any decisions in this plan you'd like to reconsider?
3. Should I create GitHub repository now, or wait for your go-ahead?

---

**Document Version**: 1.0
**Last Updated**: 2025-02-02
**Status**: Planning Complete, Ready for Implementation
