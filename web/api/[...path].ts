import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://api.kest.dev';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace('/api', '') || '/';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Forward authorization header
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization as string;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: req.method || 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
