import type { RequestAuthConfig, RequestKeyValue } from '@/types/request';

export type RequestExampleBodyType = 'none' | 'json' | 'form-data' | 'text';

export interface RequestExample {
  id: number | string;
  request_id: number | string;
  name: string;
  description: string;
  url: string;
  method: string;
  headers: RequestKeyValue[];
  query_params: RequestKeyValue[];
  body: string;
  body_type: RequestExampleBodyType;
  auth?: RequestAuthConfig | null;
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
  url?: string;
  method?: string;
  headers?: RequestKeyValue[];
  query_params?: RequestKeyValue[];
  body?: string;
  body_type?: RequestExampleBodyType;
  auth?: RequestAuthConfig | null;
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
