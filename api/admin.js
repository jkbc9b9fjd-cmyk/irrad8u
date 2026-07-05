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

function auth(req) {
  return req.headers['x-admin-token'] === process.env.ADMIN_PASSWORD;
}

module.exports = async function handler(req, res) {
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.query;

  // GET all questions
  if (req.method === 'GET' && action === 'questions') {
    const r = await sbFetch('questions?select=*&order=id');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(r.data);
  }

  // GET unresolved flags
  if (req.method === 'GET' && action === 'flags') {
    const r = await sbFetch('flags?select=*,questions(question,category)&resolved=eq.false&order=created_at.desc');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(r.data);
  }

  // POST add question
  if (req.method === 'POST' && action === 'add') {
    const { question, option_a, option_b, option_c, option_d, answer, category, rationale, citation } = req.body;
    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'question, answer, and category are required' });
    }
    const r = await sbFetch('questions', 'POST', { question, option_a, option_b, option_c, option_d, answer, category, rationale, citation, is_hidden: false });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(Array.isArray(r.data) ? r.data[0] : r.data);
  }

  // PATCH hide/show
  if (req.method === 'PATCH' && action === 'hide') {
    const { id, is_hidden } = req.body;
    const r = await sbFetch(`questions?id=eq.${id}`, 'PATCH', { is_hidden });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  // PATCH edit question
  if (req.method === 'PATCH' && action === 'edit') {
    const { id, ...fields } = req.body;
    const r = await sbFetch(`questions?id=eq.${id}`, 'PATCH', fields);
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  // DELETE question
  if (req.method === 'DELETE' && action === 'delete') {
    const { id } = req.body;
    const r = await sbFetch(`questions?id=eq.${id}`, 'DELETE');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  // PATCH resolve flag
  if (req.method === 'PATCH' && action === 'resolve-flag') {
    const { id } = req.body;
    const r = await sbFetch(`flags?id=eq.${id}`, 'PATCH', { resolved: true });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
