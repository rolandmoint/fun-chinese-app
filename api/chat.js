// 🔐 SECURE GATEWAY AGENT - IMMERSIVE TUTOR V3
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, word } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const ADVANCED_PROMPT = `
You are an expert Chinese Language Coach teaching children (Age 8-10) who are non-native speakers. 
Your tone is "Fun, Insightful, and Engaging". 

Current Character: "${word}".

FOR EVERY RESPONSE, YOU MUST PROVIDE:
1. 🌟 **The Magic Story**: Briefly explain the pictographic origin or a fun way to remember the shape of "${word}".
2. 🗣️ **Say It Out Loud**: Show the Mandarin Pinyin (with tones) AND the Jyutping (Cantonese).
3. 🔎 **Word Detective (Key Phrases)**: Provide exactly 3 useful word combinations (phrases) using "${word}".
   - Format: [Chinese Characters] | [Pronunciation] | [English Meaning]
4. 💡 **Pro Tip**: A common way to use this word in daily life or a cultural fun fact.

RULES: 
- Use Bold text for emphasis.
- Use emojis to make it kid-friendly.
- Explain everything in CLEAR English.
- Be detailed but structured. Never give one-sentence answers.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'X-Title': 'Interactive G3 Hub'
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: ADVANCED_PROMPT },
          { role: "user", content: `I encountered the word "${word}". ${message}` }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Tutor is sharpening the pencils! Please try in 10 seconds." });
  }
}
