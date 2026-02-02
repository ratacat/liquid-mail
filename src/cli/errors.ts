export type LmErrorJson = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestions?: string[];
    details?: unknown;
  };
};

export class LmError extends Error {
  public readonly code: string;
  public readonly exitCode: number;
  public readonly retryable: boolean;
  public readonly suggestions: string[] | undefined;
  public readonly details: unknown | undefined;

  public constructor(opts: {
    code: string;
    message: string;
    exitCode: number;
    retryable: boolean;
    suggestions?: string[];
    details?: unknown;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.exitCode = opts.exitCode;
    this.retryable = opts.retryable;
    this.suggestions = opts.suggestions;
    this.details = opts.details;
  }

  public toJson(): LmErrorJson {
    const error: LmErrorJson['error'] = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };

    if (this.suggestions !== undefined) error.suggestions = this.suggestions;
    if (this.details !== undefined) error.details = this.details;

    return {
      ok: false,
      error,
    };
  }
}
