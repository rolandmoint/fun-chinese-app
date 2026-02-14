// 🔐 SECURE GATEWAY AGENT - ULTIMATE DIAGNOSTIC
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Secure Grade 3 Tutor'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: `You are a friendly Grade 3 tutor. The word is ${word}. Reply in concise English.` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return res.status(200).json({ reply: data.choices[0].message.content });
    } else {
      // 🕵️ Directly return the full error for root-cause analysis
      return res.status(200).json({ reply: "DEBUG_DATA EXCEPTION: " + JSON.stringify(data) });
    }
  } catch (error) {
    return res.status(200).json({ reply: "DEBUG_FATAL: " + error.message });
  }
}
