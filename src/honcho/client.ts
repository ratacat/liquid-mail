import { LmError } from '../cli/errors';

export type HonchoClientOpts = {
  baseUrl: string;
  apiKey: string;
  workspaceId: string;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class HonchoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  public readonly workspaceId: string;

  public constructor(opts: HonchoClientOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.workspaceId = opts.workspaceId;
  }

  public async requestJson<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
    };

    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(url, init);

    const text = await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const parsed = isJson && text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      throw mapHonchoError(res.status, parsed, text);
    }

    if (!isJson) {
      // Some endpoints may return empty bodies; treat empty as undefined.
      return safeJsonParse(text) as T;
    }

    return (parsed ?? safeJsonParse(text)) as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mapHonchoError(status: number, parsed: unknown, rawText: string): LmError {
  const details = parsed ?? rawText;

  if (status === 401 || status === 403) {
    return new LmError({
      code: 'HONCHO_AUTH_FAILED',
      message: 'Honcho request failed: unauthorized.',
      exitCode: 3,
      retryable: false,
      suggestions: ['Verify LIQUID_MAIL_HONCHO_API_KEY', 'Verify workspace permissions'],
      details,
    });
  }

  if (status === 429) {
    return new LmError({
      code: 'RATE_LIMITED',
      message: 'Honcho request failed: rate limited.',
      exitCode: 4,
      retryable: true,
      suggestions: ['Retry with backoff', 'Reduce request volume'],
      details,
    });
  }

  if (status >= 500) {
    return new LmError({
      code: 'HONCHO_UNAVAILABLE',
      message: 'Honcho request failed: server error.',
      exitCode: 5,
      retryable: true,
      suggestions: ['Retry with backoff'],
      details,
    });
  }

  return new LmError({
    code: 'HONCHO_REQUEST_FAILED',
    message: `Honcho request failed: HTTP ${status}.`,
    exitCode: 6,
    retryable: status >= 500,
    suggestions: ['Re-run with --json and inspect error.details', 'Verify request parameters'],
    details,
  });
}
