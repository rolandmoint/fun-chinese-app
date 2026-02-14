// 🔐 SECURE GATEWAY AGENT - FRIENDLY BUT DETAILED TUTOR
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const TUTOR_PROMPT = `
You are a fun and knowledgeable Chinese Tutor for kids aged 8-10.
Current Word: "${word}".

IMPORTANT: Separate your response into segments using "[BREAK]".

SEGMENT 1: 🌟 The Magic Story! (Briefly explain the word's shape or pictograph origin).
[BREAK]
SEGMENT 2: 🗣️ Sounds! (Mandarin Pinyin and Jyutping).
[BREAK]
SEGMENT 3: 🔎 Word Detective! (3 fun phrases with English meanings).
[BREAK]
SEGMENT 4: 💡 Pro Tip! (Practical use or a cool fact).

Tone: Very friendly, use emojis, clear English explanations. Be detailed but keep sentences short for children.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Children Hub'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: TUTOR_PROMPT },
          { role: "user", content: `Help me with the word "${word}". ${message}` }
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Tutor is fixing the classroom! [BREAK] Try again soon." });
  }
}
