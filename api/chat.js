// 🔐 SECURE GATEWAY AGENT
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  
  // 🛡️ The API KEY is fetched from secure environment variables at runtime
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://grade3-language-hub.vercel.app',
        'X-Title': 'Secure Grade 3 Tutor'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: `You are a friendly Grade 3 tutor for the word: ${word}. Answer concisely in English.` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;
    
    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: 'Gateway Security Failure' });
  }
}
