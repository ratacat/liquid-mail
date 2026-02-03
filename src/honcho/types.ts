export type HonchoId = string;

export type HonchoMetadataValue = string | number | boolean | null;

export type HonchoMetadataFilter =
  | HonchoMetadataValue
  | HonchoMetadataValue[]
  | {
      op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
      value: HonchoMetadataValue | HonchoMetadataValue[];
    };

export type HonchoSearchFilters = {
  session_ids?: HonchoId[];
  peer_ids?: HonchoId[];
  metadata?: Record<string, HonchoMetadataFilter>;
  since?: string;
  until?: string;
};

export type HonchoSearchRequest = {
  query: string;
  limit?: number;
  filters?: HonchoSearchFilters;
};

export type HonchoSearchMatch = {
  session_id: HonchoId;
  message_id?: HonchoId;
  peer_id?: HonchoId;
  score?: number;
  snippet?: string;
  created_at?: string;
};

export type HonchoSearchResponse = {
  matches: HonchoSearchMatch[];
  total?: number;
  next?: string | null;
};

export type HonchoSession = {
  id: HonchoId;
  title?: string;
  created_at?: string;
  metadata?: Record<string, HonchoMetadataValue>;
};

export type HonchoSessionGetOrCreateRequest = {
  session_id?: HonchoId;
  title?: string;
  metadata?: Record<string, HonchoMetadataValue>;
};

export type HonchoSessionGetOrCreateResponse = {
  session: HonchoSession;
};

export type HonchoSessionListRequest = {
  limit?: number;
  cursor?: string;
};

export type HonchoSessionListResponse = {
  sessions: HonchoSession[];
  next?: string | null;
};

export type HonchoMessage = {
  id: HonchoId;
  session_id: HonchoId;
  peer_id: HonchoId;
  content: string;
  created_at?: string;
  metadata?: Record<string, HonchoMetadataValue>;
};

export type HonchoMessageCreateRequest = {
  peer_id: HonchoId;
  content: string;
  metadata?: Record<string, HonchoMetadataValue>;
};

export type HonchoMessageCreateResponse = {
  message: HonchoMessage;
};

export type HonchoSummary = {
  id?: HonchoId;
  session_id: HonchoId;
  kind?: 'short' | 'long' | string;
  content: string;
  created_at?: string;
};

export type HonchoSummaryListResponse = {
  summaries: HonchoSummary[];
};

export type HonchoChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type HonchoChatResponseFormat = {
  type: 'json_schema';
  json_schema: {
    name?: string;
    schema: unknown;
  };
};

export type HonchoChatRequest = {
  messages: HonchoChatMessage[];
  temperature?: number;
  response_format?: HonchoChatResponseFormat;
};

export type HonchoChatResponse = {
  message: HonchoChatMessage;
  output_text?: string;
  output_json?: unknown;
};
