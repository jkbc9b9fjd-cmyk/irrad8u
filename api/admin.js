const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function getAllQuestions() {
  let all = [];
  let from = 0;
  const pageSize = 500;

  while (true) {
    const to = from + pageSize - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?select=*&order=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${from}-${to}`,
          'Range-Unit': 'items',
          'Prefer': 'count=none'
        }
      }
    );
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error(`Parse error: ${text.substring(0,200)}`); }
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function getAllFeedback() {
  let all = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/feedback?select=question_id,vote`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${from}-${to}`,
          'Range-Unit': 'items',
          'Prefer': 'count=none'
        }
      }
    );
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error(`Parse error: ${text.substring(0,200)}`); }
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

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

  if (req.method === 'GET' && action === 'questions') {
    try {
      const all = await getAllQuestions();
      return res.status(200).json(all);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET' && action === 'flags') {
    const r = await sbFetch('flags?select=*,questions(question,category)&resolved=eq.false&order=created_at.desc');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(r.data);
  }

  // Aggregate thumbs up/down feedback per question, joined with question text/category.
  // Only returns questions that have at least one vote, sorted by most downvotes first.
  if (req.method === 'GET' && action === 'feedback') {
    try {
      const [feedbackRows, questions] = await Promise.all([getAllFeedback(), getAllQuestions()]);
      const qMap = {};
      questions.forEach(q => { qMap[q.id] = q; });

      const counts = {};
      feedbackRows.forEach(f => {
        if (!counts[f.question_id]) counts[f.question_id] = { up: 0, down: 0 };
        if (f.vote === 'up') counts[f.question_id].up++;
        else if (f.vote === 'down') counts[f.question_id].down++;
      });

      const result = Object.keys(counts).map(qid => {
        const q = qMap[qid] || {};
        const c = counts[qid];
        return {
          question_id: parseInt(qid),
          question: q.question || '(question not found)',
          category: q.category || '—',
          up: c.up,
          down: c.down,
          net: c.up - c.down,
          total: c.up + c.down
        };
      });

      result.sort((a, b) => (a.net - b.net) || (b.total - a.total));
      return res.status(200).json(result);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST' && action === 'add') {
    const { question, option_a, option_b, option_c, option_d, answer, category, rationale, citation } = req.body;
    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'question, answer, and category are required' });
    }
    const r = await sbFetch('questions', 'POST', { question, option_a, option_b, option_c, option_d, answer, category, rationale, citation, is_hidden: false });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json(Array.isArray(r.data) ? r.data[0] : r.data);
  }

  if (req.method === 'PATCH' && action === 'hide') {
    const { id, is_hidden } = req.body;
    const r = await sbFetch(`questions?id=eq.${id}`, 'PATCH', { is_hidden });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH' && action === 'edit') {
    const { id, ...fields } = req.body;
    const r = await sbFetch(`questions?id=eq.${id}`, 'PATCH', fields);
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE' && action === 'delete') {
    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    // Delete associated flags first to avoid foreign key violation
    await sbFetch(`flags?question_id=eq.${id}`, 'DELETE');
    await sbFetch(`feedback?question_id=eq.${id}`, 'DELETE');
    const r = await sbFetch(`questions?id=eq.${id}`, 'DELETE');
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH' && action === 'resolve-flag') {
    const { id } = req.body;
    const r = await sbFetch(`flags?id=eq.${id}`, 'PATCH', { resolved: true });
    if (!r.ok) return res.status(500).json({ error: r.data });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
