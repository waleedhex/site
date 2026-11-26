const supabase = process.env.SUPABASE_URL || 'https://poxlnqwjzepnxqpxymto.supabase.co';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_A-8c5QBeywouKmPGHTJGRQ__ilBGlNf';
const imageId = /^[a-z0-9_-]{1,80}$/;
const imageData = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-z0-9+/]+={0,2})$/i;

module.exports = async function handler(req, res) {
  const empty = status => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).end();
  };
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return empty(405);
  }
  const { id } = req.query;
  if (typeof id !== 'string' || !imageId.test(id)) return empty(404);

  try {
    const query = new URLSearchParams({ select: 'data', id: 'eq.' + id, limit: '1' });
    const response = await fetch(supabase + '/rest/v1/site_images?' + query, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return empty(503);
    const [row] = await response.json();
    const match = typeof row?.data === 'string' && row.data.match(imageData);
    if (!match) return empty(404);

    const body = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', match[1].toLowerCase());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(body);
  } catch {
    return empty(503);
  }
};
