import { isatty } from 'node:tty';
import { getArgv, getFlagString, parseArgv } from './cli/argv';
import { LmError } from './cli/errors';
import { outputMode, printJson } from './cli/output';
import { loadConfig } from './config/config';
import { requireHonchoAuth } from './config/config';
import { HonchoClient } from './honcho/client';
import { createMessage, getSessionSummaries, listSessions, searchWorkspace } from './honcho/api';
import { buildSearchFilters, filtersForSession, metadataEq } from './honcho/filters';
import { checkDecisionConflicts } from './conflicts/check';
import { detectDecision } from './decisions/detectDecision';
import { extractDecisions } from './decisions/extract';
import { indexDecisions } from './decisions/index';
import { integrateProject, type IntegrateTarget } from './integrate/integrate';
import { windowEnvSnippet } from './window/envSnippet';
import { notifyForAgent } from './notify/notify';
import { chooseTopicFromMatches, type WorkspaceSearchMatch } from './topics/autoTopic';
import { resolveTopicForMessage } from './topics/resolveTopic';
import { LIQUID_MAIL_VERSION } from './version';
import { getPinnedTopicId, setPinnedTopicId } from './state/state';
import { statePathForCwd } from './state/state';

function printHelp(): void {
  const text = [
    'liquid-mail',
    '',
    'Commands:',
    '  post        Post a message',
    '  summarize   Show Honcho session summaries (TBD)',
    '  query       Search messages (TBD)',
    '  decisions   List/search decision messages (TBD)',
    '  topics      List Honcho sessions (TBD)',
    '  notify      Context-based notifications (TBD)',
    '  window      Show window/topic state',
    '  integrate   Install project-level instructions (claude/codex/opencode)',
    '  schema      Print JSON schemas used by Liquid Mail',
    '  topic-demo  Demo topic dominance algorithm (offline)',
    '  config      Show resolved config (redacts secrets)',
    '',
    'Global flags:',
    '  --json, -j   Force JSON output',
    '  --text       Force text output',
    '  --config     Use config at path',
    '  --version, -v Show version',
    '  --help, -h   Show help',
    '',
    'Examples:',
    '  liquid-mail schema --json',
    '  liquid-mail topic-demo A A A A B',
    '  liquid-mail integrate --to claude',
  ];
  process.stdout.write(text.join('\n') + '\n');
}

async function readAllStdin(): Promise<string> {
  return await new Response(process.stdin as any).text();
}

async function readMessage(positionals: string[]): Promise<string> {
  if (positionals.length > 0) return positionals.join(' ').trim();
  if (!isatty(0)) return (await readAllStdin()).trim();
  return '';
}

type SchemaBundle = {
  prompts: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

function getSchemas(): SchemaBundle {
  return {
    prompts: {
      decision_extract_v1: {
        type: 'object',
        properties: {
          decisions: { type: 'array', items: { type: 'string' } },
        },
        required: ['decisions'],
        additionalProperties: false,
      },
      conflict_classify_v1: {
        type: 'object',
        properties: {
          conflicts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prior_decision_id: { type: 'string' },
                confidence: { type: 'number' },
                rationale: { type: 'string' },
                suggested_action: { type: 'string' },
              },
              required: ['prior_decision_id', 'confidence'],
              additionalProperties: false,
            },
          },
        },
        required: ['conflicts'],
        additionalProperties: false,
      },
    },
    outputs: {
      ok_v1: {
        type: 'object',
        properties: { ok: { const: true }, data: {} },
        required: ['ok', 'data'],
        additionalProperties: true,
      },
      error_v1: {
        type: 'object',
        properties: {
          ok: { const: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              retryable: { type: 'boolean' },
            },
            required: ['code', 'message', 'retryable'],
            additionalProperties: true,
          },
        },
        required: ['ok', 'error'],
        additionalProperties: false,
      },
    },
  };
}

async function run(): Promise<void> {
  const { command, flags, positionals } = parseArgv(getArgv());
  const mode = outputMode(flags);
  const configFlag = getFlagString(flags, 'config');
  const loadConfigResolved = async () => await loadConfig(configFlag ? { configPath: configFlag } : undefined);

  if (flags.version === true || flags.v === true) {
    if (mode === 'json') printJson({ ok: true, data: { version: LIQUID_MAIL_VERSION } });
    else process.stdout.write(`${LIQUID_MAIL_VERSION}\n`);
    return;
  }

  if (flags.help === true || flags.h === true || !command) {
    printHelp();
    return;
  }

  if (command === 'schema') {
    const schemas = getSchemas();
    if (mode === 'json') printJson({ ok: true, data: schemas });
    else process.stdout.write(JSON.stringify(schemas, null, 2) + '\n');
    return;
  }

  if (command === 'config') {
    const { config, configPath } = await loadConfigResolved();
    const redacted = {
      ...config,
      honcho: {
        ...config.honcho,
        apiKey: config.honcho.apiKey ? '***' : undefined,
      },
    };

    if (mode === 'json') printJson({ ok: true, data: { config: redacted, config_path: configPath } });
    else process.stdout.write(JSON.stringify({ config: redacted, config_path: configPath }, null, 2) + '\n');
    return;
  }

  if (command === 'topic-demo') {
    const matches: WorkspaceSearchMatch[] = positionals.map((sessionId) => ({ sessionId }));
    const threshold = Number(getFlagString(flags, 'threshold') ?? '0.8');
    const minHits = Number(getFlagString(flags, 'minHits') ?? '2');
    const choice = chooseTopicFromMatches(matches, { threshold, minHits });
    if (mode === 'json') printJson({ ok: true, data: choice });
    else process.stdout.write(`chosen=${choice.chosenTopicId ?? '(none)'} dominance=${choice.dominance}\n`);
    return;
  }

  if (command === 'summarize') {
    const topicId = getFlagString(flags, 'topic');
    if (!topicId) {
      throw new LmError({
        code: 'TOPIC_REQUIRED',
        message: 'Missing --topic for summarize.',
        exitCode: 2,
        retryable: false,
        suggestions: ['Re-run with --topic <SESSION_ID>'],
      });
    }

    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);
    const summaries = await getSessionSummaries(client, topicId);

    if (mode === 'json') {
      printJson({ ok: true, data: summaries });
    } else {
      process.stdout.write(JSON.stringify(summaries, null, 2) + '\n');
    }
    return;
  }

  if (command === 'query') {
    const query = await readMessage(positionals);
    if (!query) {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Missing query text (provide args or pipe stdin).',
        exitCode: 2,
        retryable: false,
        suggestions: ['Pass a query: liquid-mail query "find this"', 'Or pipe stdin'],
      });
    }

    const limit = Number(getFlagString(flags, 'limit') ?? '10');
    const topicId = getFlagString(flags, 'topic');
    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);

    const filters = topicId ? filtersForSession(topicId) : undefined;
    const searchRequest = { query, limit } as { query: string; limit: number; filters?: ReturnType<typeof filtersForSession> };
    if (filters) searchRequest.filters = filters;
    const results = await searchWorkspace(client, searchRequest);

    if (mode === 'json') printJson({ ok: true, data: results });
    else process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  if (command === 'topics') {
    const limit = Number(getFlagString(flags, 'limit') ?? '50');
    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);
    const sessions = await listSessions(client, { limit });

    if (mode === 'json') printJson({ ok: true, data: sessions });
    else process.stdout.write(JSON.stringify(sessions, null, 2) + '\n');
    return;
  }

  if (command === 'decisions') {
    const limit = Number(getFlagString(flags, 'limit') ?? '10');
    const topicId = getFlagString(flags, 'topic');
    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);

    const filterParams: { sessionIds?: string[]; metadata?: Record<string, ReturnType<typeof metadataEq>> } = {
      metadata: { 'lm.kind': metadataEq('decision') },
    };
    if (topicId) filterParams.sessionIds = [topicId];
    const filters = buildSearchFilters(filterParams);

    const results = await searchWorkspace(client, {
      query: 'decision',
      limit,
      filters,
    });

    if (mode === 'json') printJson({ ok: true, data: results });
    else process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  if (command === 'notify') {
    const agentId =
      getFlagString(flags, 'agent-id') ??
      getFlagString(flags, 'agentId') ??
      process.env.LIQUID_MAIL_WINDOW_ID ??
      process.env.LIQUID_MAIL_AGENT_ID;
    const since = getFlagString(flags, 'since');
    if (!agentId) {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Missing --agent-id for notify.',
        exitCode: 2,
        retryable: false,
        suggestions: ['Re-run with --agent-id <PEER_ID>', 'Or set LIQUID_MAIL_WINDOW_ID'],
      });
    }

    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);
    const notifyParams: { client: HonchoClient; agentId: string; since?: string } = { client, agentId };
    if (since) notifyParams.since = since;
    const items = await notifyForAgent(notifyParams);

    if (mode === 'json') printJson({ ok: true, data: { items } });
    else process.stdout.write(JSON.stringify({ items }, null, 2) + '\n');
    return;
  }

  if (command === 'hooks') {
    const sub = positionals[0] ?? '';
    if (sub !== 'install') {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Expected: liquid-mail hooks install (deprecated; use: liquid-mail window env)',
        exitCode: 2,
        retryable: false,
        suggestions: ['Run: liquid-mail window env'],
      });
    }

    const shellPath = process.env.SHELL ?? '';
    const shellName = shellPath.split('/').pop() ?? '';
    const shell = shellName === 'zsh' ? 'zsh' : 'bash';
    const snippet = windowEnvSnippet(shell);

    if (mode === 'json') printJson({ ok: true, data: { shell, snippet } });
    else process.stdout.write(`${snippet}\n`);
    return;
  }

  if (command === 'window') {
    const sub = positionals[0] ?? '';
    if (sub === 'env') {
      const shellPath = process.env.SHELL ?? '';
      const shellName = shellPath.split('/').pop() ?? '';
      const shell = shellName === 'zsh' ? 'zsh' : 'bash';
      const snippet = windowEnvSnippet(shell);

      if (mode === 'json') printJson({ ok: true, data: { shell, snippet } });
      else process.stdout.write(`${snippet}\n`);
      return;
    }

    if (sub !== 'status') {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Expected: liquid-mail window status|env',
        exitCode: 2,
        retryable: false,
        suggestions: ['Run: liquid-mail window status', 'Run: liquid-mail window env'],
      });
    }

    const windowId = process.env.LIQUID_MAIL_WINDOW_ID;
    if (!windowId) {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Missing LIQUID_MAIL_WINDOW_ID.',
        exitCode: 2,
        retryable: false,
        suggestions: ['Set LIQUID_MAIL_WINDOW_ID (per terminal)', 'Or run: liquid-mail window env'],
      });
    }

    const statePath = statePathForCwd(process.cwd());
    const pinnedTopicId = await getPinnedTopicId(process.cwd(), windowId);
    const payload = { window_id: windowId, pinned_topic_id: pinnedTopicId ?? null, state_path: statePath };

    if (mode === 'json') printJson({ ok: true, data: payload });
    else process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }

  if (command === 'post') {
    const topicId = getFlagString(flags, 'topic');
    const agentId =
      getFlagString(flags, 'agent-id') ??
      getFlagString(flags, 'agentId') ??
      process.env.LIQUID_MAIL_WINDOW_ID ??
      process.env.LIQUID_MAIL_AGENT_ID;
    const decisionFlag = flags['decision'] === true || getFlagString(flags, 'decision') === 'true';
    const bypassConflicts = flags['yes'] === true || flags['y'] === true;
    const event = getFlagString(flags, 'event');
    const message = await readMessage(positionals);

    if (!message) {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Missing message text (provide args or pipe stdin).',
        exitCode: 2,
        retryable: false,
        suggestions: ['Pass a message: liquid-mail post "Hello"', 'Or pipe stdin: echo "Hello" | liquid-mail post'],
      });
    }

    const { config } = await loadConfigResolved();
    const auth = requireHonchoAuth(config);
    const client = new HonchoClient(auth);

    let resolvedTopicId = topicId;
    let topicDecision = undefined as Awaited<ReturnType<typeof resolveTopicForMessage>> | undefined;

    if (!resolvedTopicId) {
      const windowId = process.env.LIQUID_MAIL_WINDOW_ID;
      if (windowId) {
        const pinned = await getPinnedTopicId(process.cwd(), windowId);
        if (pinned) resolvedTopicId = pinned;
      }
    }

    if (!resolvedTopicId) {
      topicDecision = await resolveTopicForMessage({
        client,
        message,
        config: config.topics,
        titleHint: message.slice(0, 80),
        systemPeerId: config.decisions.systemPeerId,
      });

      if (topicDecision.action === 'assigned') {
        resolvedTopicId = topicDecision.chosenTopicId;
      } else if (topicDecision.action === 'created' || topicDecision.action === 'merged') {
        resolvedTopicId = topicDecision.createdTopicId;
      } else {
        const errorCode = topicDecision.action === 'blocked' ? 'TOPIC_LIMIT_REACHED' : 'TOPIC_REQUIRED';
        throw new LmError({
          code: errorCode,
          message:
            topicDecision.action === 'blocked'
              ? 'Topic cap reached; cannot auto-create new topic.'
              : 'No --topic provided and auto-topic was inconclusive.',
          exitCode: 2,
          retryable: false,
          suggestions: ['Re-run with --topic <SESSION_ID>', 'Adjust topics.auto_create or topics.max_active'],
          details: { topicDecision },
        });
      }
    }

    if (!resolvedTopicId) {
      throw new LmError({
        code: 'TOPIC_REQUIRED',
        message: 'Unable to resolve topic.',
        exitCode: 2,
        retryable: false,
        suggestions: ['Re-run with --topic <SESSION_ID>'],
        details: { topicDecision },
      });
    }

    const decisionDetection = detectDecision(message, {
      decisionFlag,
      allowHeuristic: config.conflicts.decisionsOnly === false,
    });

    const conflicts: Array<Awaited<ReturnType<typeof checkDecisionConflicts>>> = [];
    if (config.conflicts.enabled && decisionDetection.isDecision) {
      const proposed = decisionDetection.decisions.length > 0 ? decisionDetection.decisions : [message];
      for (const decisionText of proposed) {
        const conflict = await checkDecisionConflicts({
          client,
          peerId: config.decisions.systemPeerId,
          sessionId: resolvedTopicId,
          proposedDecision: decisionText,
          shortlistLimit: 5,
          threshold: config.conflicts.confidenceThreshold,
        });
        conflicts.push(conflict);
        if (conflict.blocking && !bypassConflicts) {
          const strongest = conflict.conflicts.reduce(
            (best, item) => (item.confidence > best.confidence ? item : best),
            conflict.conflicts[0] ?? { prior_decision_id: '', confidence: 0 },
          );
          throw new LmError({
            code: 'DECISION_CONFLICT',
            message: 'Decision conflicts with prior decisions.',
            exitCode: 3,
            retryable: false,
            suggestions: ['Review prior decisions', 'Re-run with --yes to override'],
            details: { conflict: strongest, conflicts: conflict.conflicts },
          });
        }
      }
    }

    const peerId = agentId ?? 'liquid-mail';
    const messageRequest: { peer_id: string; content: string; metadata?: Record<string, string> } = {
      peer_id: peerId,
      content: message,
    };
    if (event && (event === 'start' || event === 'finish' || event === 'issue' || event === 'feedback')) {
      messageRequest.metadata = { 'lm.kind': 'event', 'lm.event': event, 'lm.agent_id': peerId };
    }
    const created = await createMessage(client, resolvedTopicId, messageRequest);

    const windowId = process.env.LIQUID_MAIL_WINDOW_ID;
    if (windowId) {
      try {
        await setPinnedTopicId(process.cwd(), windowId, resolvedTopicId);
      } catch {
        // Non-fatal; state is best-effort only.
      }
    }

    let decisionIndexResult: unknown = undefined;
    if (config.decisions.enabled && decisionDetection.isDecision) {
      try {
        const extracted = await extractDecisions({
          client,
          peerId: config.decisions.systemPeerId,
          message,
        });

        decisionIndexResult = await indexDecisions({
          client,
          sessionId: resolvedTopicId,
          systemPeerId: config.decisions.systemPeerId,
          sourceMessageId: created.message.id,
          decisions: extracted.decisions,
        });
      } catch (err) {
        decisionIndexResult = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (mode === 'json') {
      printJson({
        ok: true,
        data: {
          message: created.message,
          topic_decision: topicDecision,
          conflicts,
          decision_index: decisionIndexResult,
        },
      });
    } else {
      process.stdout.write(`Posted to ${resolvedTopicId} as ${peerId}\n`);
    }
    return;
  }

  if (command === 'integrate') {
    const to = (getFlagString(flags, 'to') ?? '').trim();
    if (to !== 'claude' && to !== 'codex' && to !== 'opencode') {
      throw new LmError({
        code: 'INVALID_INPUT',
        message: 'Missing or invalid --to (expected: claude|codex|opencode).',
        exitCode: 2,
        retryable: false,
        suggestions: ['Run: liquid-mail integrate --to claude', 'Run: liquid-mail integrate --to opencode'],
        details: { to },
      });
    }

    const result = await integrateProject({ cwd: process.cwd(), target: to as IntegrateTarget });
    if (mode === 'json') printJson({ ok: true, data: result });
    else {
      for (const file of result.files) process.stdout.write(`${file.action}: ${file.path}\n`);
    }
    return;
  }

  throw new LmError({
    code: 'UNKNOWN_COMMAND',
    message: `Unknown command: ${command}`,
    exitCode: 2,
    retryable: false,
    suggestions: ['Run: liquid-mail --help'],
  });
}

run().catch((err: unknown) => {
  if (err instanceof LmError) {
    printJson(err.toJson());
    process.exit(err.exitCode);
  }
  printJson({
    ok: false,
    error: {
      code: 'UNEXPECTED_ERROR',
      message: err instanceof Error ? err.message : String(err),
      retryable: true,
    },
  });
  process.exit(1);
});
