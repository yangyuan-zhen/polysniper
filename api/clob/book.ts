import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token_id } = req.query;
  
  if (!token_id) {
    return res.status(400).json({ error: 'token_id is required' });
  }

  const targetUrl = `https://clob.polymarket.com/book?token_id=${token_id}`;
  
  console.log('[API] Fetching order book:', targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[API] Order book error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Upstream API error',
        status: response.status 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[API] Order book request failed:', error);
    return res.status(500).json({ 
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
