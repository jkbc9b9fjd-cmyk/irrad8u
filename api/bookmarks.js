const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

module.exports = async function handler(req, res) {
  const { user_id, question_id } = req.method === 'GET' ? req.query : (req.body || {});

  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  // GET all bookmarks for user
  if (req.method === 'GET') {
    const r = await sbFetch(`bookmarks?user_id=eq.${user_id}&select=question_id&order=created_at.desc`);
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(r.data);
  }

  // POST add bookmark
  if (req.method === 'POST') {
    if (!question_id) return res.status(400).json({ error: 'Missing question_id' });
    const r = await sbFetch('bookmarks', 'POST', { user_id, question_id });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  // DELETE remove bookmark
  if (req.method === 'DELETE') {
    const id = req.query.question_id || question_id;
    if (!id) return res.status(400).json({ error: 'Missing question_id' });
    const r = await sbFetch(`bookmarks?user_id=eq.${user_id}&question_id=eq.${id}`, 'DELETE');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
