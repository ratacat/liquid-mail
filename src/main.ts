import { isatty } from 'node:tty';
import { getArgv, getFlagString, parseArgv } from './cli/argv';
import { LmError } from './cli/errors';
import { outputMode, printJson } from './cli/output';
import { loadConfig } from './config/config';
import { integrateProject, type IntegrateTarget } from './integrate/integrate';
import { chooseTopicFromMatches, type WorkspaceSearchMatch } from './topics/autoTopic';
import { LIQUID_MAIL_VERSION } from './version';

function printHelp(): void {
  const text = [
    'liquid-mail',
    '',
    'Commands:',
    '  post        Post a message (hooks TBD)',
    '  summarize   Show Honcho session summaries (TBD)',
    '  query       Search messages (TBD)',
    '  decisions   List/search decision messages (TBD)',
    '  notify      Context-based notifications (TBD)',
    '  integrate   Install project-level instructions (claude/codex/opencode)',
    '  schema      Print JSON schemas used by Liquid Mail',
    '  topic-demo  Demo topic dominance algorithm (offline)',
    '  config      Show resolved config (redacts secrets)',
    '',
    'Global flags:',
    '  --json, -j   Force JSON output',
    '  --text       Force text output',
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
    const configFlag = getFlagString(flags, 'config');
    const { config, configPath } = await loadConfig(configFlag ? { configPath: configFlag } : undefined);
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

  if (command === 'post') {
    const topicId = getFlagString(flags, 'topic');
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

    if (!topicId) {
      throw new LmError({
        code: 'TOPIC_REQUIRED',
        message: 'No --topic provided. (Honcho integration + auto-topic is not wired yet.)',
        exitCode: 2,
        retryable: false,
        suggestions: ['Re-run with --topic <SESSION_ID>'],
        details: { note: 'Next: implement Honcho workspace search + dominance assignment' },
      });
    }

    if (mode === 'json') printJson({ ok: true, data: { topic_id: topicId, message_preview: message.slice(0, 120) } });
    else process.stdout.write(`Posted to ${topicId}: ${message}\n`);
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
