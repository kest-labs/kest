export const config = {
  runtime: 'edge',
};

const API_BASE = 'https://api.kest.dev';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api', '');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Forward relevant headers
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
