import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question_id, user_id, note } = req.body;
  if (!question_id || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { error } = await supabase
    .from('flags')
    .insert({ question_id, user_id, note: note || '' });

  if (error) {
    console.error('Flag error:', error);
    return res.status(500).json({ error: 'Failed to submit flag' });
  }

  return res.status(200).json({ ok: true });
}
