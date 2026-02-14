// 🔐 SECURE GATEWAY AGENT - ULTRA-CONCISE TUTOR
export default async function handler(req, res) {
  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const CONCISE_PROMPT = `
You are a fun Chinese Tutor for children. 
Current Word: "${word}".

CRITICAL INSTRUCTIONS:
1. Be EXTREMELY brief. Max 2 short sentences per segment.
2. You MUST use "[BREAK]" to separate exactly 4 parts.

SEGMENT 1: 🌟 Magic Story (How to remember the shape).
[BREAK]
SEGMENT 2: 🗣️ Sounds (Mandarin and Cantonese pronunciation).
[BREAK]
SEGMENT 3: 🔎 2 Simple Examples (e.g., [Chinese] - [Meaning]).
[BREAK]
SEGMENT 4: 💡 Fun Fact (Short cultural tip).

English only for instructions. Kid-friendly tone.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Hyper-Concise Hub'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "system", content: CONCISE_PROMPT }, { role: "user", content: `Explain "${word}".` }]
      })
    });

    const data = await response.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Tutor is napping. [BREAK] Please wait." });
  }
}
