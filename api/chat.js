// 🔐 SECURE GATEWAY AGENT - SEGMENTED TUTOR
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const SEGMENTED_PROMPT = `
You are an expert Chinese Language Coach for children. 
Current Character: "${word}".

CRITICAL RULE: You must separate your response into 4 distinct segments using the delimiter "[BREAK]".

SEGMENT 1: 🌟 The Magic Story (Pictographic origin).
[BREAK]
SEGMENT 2: 🗣️ How to say it (Mandarin Pinyin and Jyutping).
[BREAK]
SEGMENT 3: 🔎 Word Detective (3 useful phrases with meanings).
[BREAK]
SEGMENT 4: 💡 Pro Tip (Practical use or fun fact).

Tone: Encouraging and structured. English only for explanations.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Segmented G3 Hub'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: SEGMENTED_PROMPT },
          { role: "user", content: `Tell me about "${word}". ${message}` }
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Tutor is resting! [BREAK] Please try again soon." });
  }
}
