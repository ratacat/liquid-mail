export type TopicNameValidationErrorCode = 'INVALID_TOPIC_NAME' | 'RESERVED_TOPIC_NAME';

export type TopicNameValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: TopicNameValidationErrorCode;
      reason: string;
    };

const TOPIC_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED_NAMES = new Set(['all', 'new', 'help', 'merge', 'rename', 'list']);
const LM_HEX_ID_REGEX = /^lm[0-9a-f]{32}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReservedName(name: string): boolean {
  return RESERVED_NAMES.has(name);
}

export function looksLikeUuid(name: string): boolean {
  return LM_HEX_ID_REGEX.test(name) || UUID_REGEX.test(name);
}

export function validateTopicName(name: string): TopicNameValidationResult {
  if (name.length < 4 || name.length > 50) {
    return {
      valid: false,
      code: 'INVALID_TOPIC_NAME',
      reason: 'Topic name must be 4-50 characters.',
    };
  }

  if (isReservedName(name)) {
    return {
      valid: false,
      code: 'RESERVED_TOPIC_NAME',
      reason: `Topic name '${name}' is reserved.`,
    };
  }

  if (looksLikeUuid(name)) {
    return {
      valid: false,
      code: 'INVALID_TOPIC_NAME',
      reason: 'Topic name looks like a UUID. Use a meaningful name instead.',
    };
  }

  if (!TOPIC_NAME_REGEX.test(name)) {
    return {
      valid: false,
      code: 'INVALID_TOPIC_NAME',
      reason:
        'Topic names must be lowercase letters/numbers with hyphens, start with a letter, end with a letter/number, and not contain consecutive hyphens.',
    };
  }

  return { valid: true };
}

