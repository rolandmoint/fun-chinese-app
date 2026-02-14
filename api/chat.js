// 🔐 FIXED GATEWAY AGENT
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ reply: "Configuration Error: API Key Missing." });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Secure Grade 3 Tutor'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp", 
        messages: [
          { role: "system", content: `You are a friendly Grade 3 tutor for children. The current word is ${word}. Keep your answer very concise and encouraging.` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return res.status(200).json({ reply: data.choices[0].message.content });
    } else {
      return res.status(500).json({ reply: "AI reasoning failure. Please try another question." });
    }
  } catch (error) {
    return res.status(500).json({ reply: "Network Security Handshake Error." });
  }
}
