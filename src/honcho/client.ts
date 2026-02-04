import { AuthenticationError, Honcho, HonchoError, PermissionDeniedError, RateLimitError, ServerError } from '@honcho-ai/sdk';

import { LmError } from '../cli/errors';

export type HonchoClientOpts = {
  baseUrl: string;
  apiKey: string;
  workspaceId: string;
  maxRetries?: number;
  timeoutMs?: number;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class HonchoClient {
  public readonly honcho: Honcho;
  public readonly workspaceId: string;

  public constructor(opts: HonchoClientOpts) {
    this.honcho = new Honcho({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
      workspaceId: opts.workspaceId,
      maxRetries: opts.maxRetries,
      timeout: opts.timeoutMs,
    });
    this.workspaceId = this.honcho.workspaceId;
  }

  public get baseUrl(): string {
    return this.honcho.baseURL;
  }

  public async requestJson<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const { requestPath, query } = normalizeRequestPath(path, this.baseUrl);

    try {
      return await this.honcho.http.request<T>(method, requestPath, {
        ...(body !== undefined ? { body } : {}),
        ...(query ? { query } : {}),
      });
    } catch (err) {
      throw mapHonchoSdkError(err);
    }
  }
}

function normalizeRequestPath(
  path: string,
  baseUrl: string,
): { requestPath: string; query?: Record<string, string | number | boolean | undefined> } {
  if (!path.startsWith('http')) return { requestPath: path };

  const url = new URL(path);
  const base = new URL(baseUrl);

  if (url.origin !== base.origin) {
    return { requestPath: url.toString() };
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return { requestPath: `${url.pathname}`, ...(Object.keys(query).length ? { query } : {}) };
}

function mapHonchoSdkError(err: unknown): LmError {
  const detailsFromError = (e: HonchoError): unknown => e.body ?? { message: e.message };

  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new LmError({
      code: 'HONCHO_AUTH_FAILED',
      message: 'Honcho request failed: unauthorized.',
      exitCode: 3,
      retryable: false,
      suggestions: ['Verify LIQUID_MAIL_HONCHO_API_KEY', 'Verify workspace permissions'],
      details: err instanceof HonchoError ? detailsFromError(err) : undefined,
    });
  }

  if (err instanceof RateLimitError) {
    return new LmError({
      code: 'RATE_LIMITED',
      message: 'Honcho request failed: rate limited.',
      exitCode: 4,
      retryable: true,
      suggestions: ['Retry with backoff', 'Reduce request volume'],
      details: detailsFromError(err),
    });
  }

  if (err instanceof ServerError) {
    return new LmError({
      code: 'HONCHO_UNAVAILABLE',
      message: 'Honcho request failed: server error.',
      exitCode: 5,
      retryable: true,
      suggestions: ['Retry with backoff'],
      details: detailsFromError(err),
    });
  }

  if (err instanceof HonchoError) {
    return new LmError({
      code: 'HONCHO_REQUEST_FAILED',
      message: `Honcho request failed: HTTP ${err.status}.`,
      exitCode: 6,
      retryable: err.status >= 500,
      suggestions: ['Re-run with --json and inspect error.details', 'Verify request parameters'],
      details: detailsFromError(err),
    });
  }

  return new LmError({
    code: 'HONCHO_REQUEST_FAILED',
    message: 'Honcho request failed.',
    exitCode: 6,
    retryable: true,
    suggestions: ['Retry the command', 'Inspect network connectivity'],
    details: err instanceof Error ? err.message : err,
  });
}
