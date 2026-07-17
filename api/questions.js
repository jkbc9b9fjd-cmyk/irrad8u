const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let all = [];
    let from = 0;
    const pageSize = 500;

    while (true) {
      const to = from + pageSize - 1;
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/questions?select=id,question,option_a,option_b,option_c,option_d,answer,category,rationale,citation&is_hidden=eq.false&order=id`,
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
      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: err });
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(all);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
