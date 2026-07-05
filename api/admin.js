const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function auth(req) {
  const token = req.headers['x-admin-token'];
  return token === process.env.ADMIN_PASSWORD;
}

module.exports = async function handler(req, res) {
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.query;

  if (req.method === 'GET' && action === 'questions') {
    const { data, error } = await supabase.from('questions').select('*').order('id');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'GET' && action === 'flags') {
    const { data, error } = await supabase
      .from('flags')
      .select('*, questions(question, category)')
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST' && action === 'add') {
    const { question, option_a, option_b, option_c, option_d, answer, category, rationale, citation } = req.body;
    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'question, answer, and category are required' });
    }
    const { data, error } = await supabase
      .from('questions')
      .insert({ question, option_a, option_b, option_c, option_d, answer, category, rationale, citation })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH' && action === 'hide') {
    const { id, is_hidden } = req.body;
    const { error } = await supabase.from('questions').update({ is_hidden }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH' && action === 'edit') {
    const { id, ...fields } = req.body;
    const { error } = await supabase.from('questions').update(fields).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE' && action === 'delete') {
    const { id } = req.body;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH' && action === 'resolve-flag') {
    const { id } = req.body;
    const { error } = await supabase.from('flags').update({ resolved: true }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
