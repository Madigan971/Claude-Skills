const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const API_KEY = process.env.MAILCHIMP_API_KEY;
  const LIST_ID = process.env.MAILCHIMP_LIST_ID;
  const DC = API_KEY.split('-')[1];
  const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

  try {
    const response = await fetch(
      `https://${DC}.api.mailchimp.com/3.0/lists/${LIST_ID}/members/${hash}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `apikey ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: 'subscribed',
          status: 'subscribed',
          tags: ['website-signup'],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: data.detail || 'Subscription failed' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
