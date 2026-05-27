import { env } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PROXY_TIMEOUT_MS = 100000;

const normalizeBasePath = (value: string) => {
  if (!value) {
    return '';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

const apiOrigin = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
const apiBasePath = normalizeBasePath(env.NEXT_PUBLIC_API_BASE_PATH);

const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type ProxyRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const buildTargetUrl = (pathSegments: string[], search: string) => {
  const path = pathSegments.map(segment => encodeURIComponent(segment)).join('/');
  const suffix = path ? `/${path}` : '';
  return `${apiOrigin}${apiBasePath}${suffix}${search}`;
};

const copyRequestHeaders = (request: Request) => {
  const headers = new Headers(request.headers);
  for (const header of hopByHopHeaders) {
    headers.delete(header);
  }
  headers.delete('host');
  return headers;
};

const copyResponseHeaders = (response: Response) => {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
};

async function proxyRequest(request: Request, context: ProxyRouteContext) {
  if (!apiOrigin) {
    return Response.json({ code: 500, message: 'API proxy target is not configured' }, { status: 500 });
  }

  const { path = [] } = await context.params;
  const sourceUrl = new URL(request.url);
  const targetUrl = buildTargetUrl(path, sourceUrl.search);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: copyRequestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: copyResponseHeaders(response),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return Response.json(
        { code: 504, message: 'API proxy request timed out' },
        { status: 504 }
      );
    }

    return Response.json(
      {
        code: 502,
        message: 'API proxy request failed',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
