// 🔐 SECURE GATEWAY AGENT - REFINED
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ reply: "Cloud Configuration Error: Missing API Key." });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'X-Title': 'Secure Grade 3 Tutor'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: `You are a friendly Grade 3 tutor. Current word is ${word}. Concise English only.` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    
    // Safety check for data structure
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      const reply = data.choices[0].message.content;
      return res.status(200).json({ reply });
    } else {
      return res.status(500).json({ reply: "Provider communication error." });
    }
  } catch (error) {
    return res.status(500).json({ reply: "Gateway Security Failure." });
  }
}
