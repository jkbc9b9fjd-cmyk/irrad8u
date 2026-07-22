const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

module.exports = async function handler(req, res) {
  const { user_id, question_id, vote } = req.method === 'GET' ? req.query : (req.body || {});

  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  // GET all feedback votes for user (used to restore button state)
  if (req.method === 'GET') {
    const r = await sbFetch(`feedback?user_id=eq.${user_id}&select=question_id,vote`);
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(r.data);
  }

  // POST upsert a vote ('up' or 'down'). Upsert on (user_id, question_id) unique constraint.
  if (req.method === 'POST') {
    if (!question_id || !vote) return res.status(400).json({ error: 'Missing question_id or vote' });
    if (vote !== 'up' && vote !== 'down') return res.status(400).json({ error: 'Invalid vote' });
    const r = await sbFetch('feedback?on_conflict=user_id,question_id', 'POST', { user_id, question_id, vote });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  // DELETE remove a vote (toggle off)
  if (req.method === 'DELETE') {
    const qid = req.query.question_id || question_id;
    if (!qid) return res.status(400).json({ error: 'Missing question_id' });
    const r = await sbFetch(`feedback?user_id=eq.${user_id}&question_id=eq.${qid}`, 'DELETE');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
