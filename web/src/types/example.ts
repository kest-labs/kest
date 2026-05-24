import type { RequestAuthConfig, RequestKeyValue } from '@/types/request';

export type RequestExampleBodyType =
  | 'none'
  | 'json'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'binary'
  | 'graphql'
  | 'text';

export type RequestExampleCategory = 'general' | 'positive' | 'negative' | 'boundary' | 'security';
export type RequestExampleSource = 'manual' | 'ai';

export interface RequestExampleAssertion {
  type: string;
  path?: string;
  operator?: string;
  expect?: unknown;
  message?: string;
}

export interface RequestExample {
  id: number | string;
  request_id: number | string;
  name: string;
  description: string;
  category?: RequestExampleCategory;
  source?: RequestExampleSource;
  url: string;
  method: string;
  headers: RequestKeyValue[];
  query_params: RequestKeyValue[];
  body: string;
  body_type: RequestExampleBodyType;
  auth?: RequestAuthConfig | null;
  assertions?: RequestExampleAssertion[];
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string;
  response_time: number;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RequestExamplePathParams {
  projectId: number | string;
  collectionId: number | string;
  requestId: number | string;
}

export interface CreateExampleRequest {
  name: string;
  description?: string;
  category?: RequestExampleCategory;
  source?: RequestExampleSource;
  url?: string;
  method?: string;
  headers?: RequestKeyValue[];
  query_params?: RequestKeyValue[];
  body?: string;
  body_type?: RequestExampleBodyType;
  auth?: RequestAuthConfig | null;
  assertions?: RequestExampleAssertion[];
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  response_time?: number;
  is_default?: boolean;
  sort_order?: number;
}

export type UpdateExampleRequest = Partial<CreateExampleRequest>;

export interface SaveExampleResponseRequest {
  response_status: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  response_time: number;
}

export interface GenerateAIExamplesRequest {
  count?: number;
  categories?: RequestExampleCategory[];
  instructions?: string;
  preview_only?: boolean;
}

export interface RequestExampleDraft {
  name: string;
  description: string;
  category?: RequestExampleCategory;
  source?: RequestExampleSource;
  url: string;
  method: string;
  headers: RequestKeyValue[];
  query_params: RequestKeyValue[];
  body: string;
  body_type: RequestExampleBodyType;
  auth?: RequestAuthConfig | null;
  assertions?: RequestExampleAssertion[];
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string;
  sort_order: number;
}

export interface GenerateAIExamplesResponse {
  total: number;
  items: RequestExample[];
  drafts?: RequestExampleDraft[];
  preview_only?: boolean;
}
