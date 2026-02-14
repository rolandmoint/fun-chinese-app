// 🔐 DIAGNOSTIC GATEWAY AGENT
export default async function handler(req, res) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  // STEP 1: KEY CHECK
  if (!OPENROUTER_API_KEY) {
    return res.status(200).json({ reply: "DEBUG_: Environmental key NOT FOUND in Vercel settings." });
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
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{ role: "user", content: "hi" }]
      })
    });

    const data = await response.json();
    
    if (response.status === 200) {
      return res.status(200).json({ reply: "Connection Successful! AI says: " + data.choices[0].message.content });
    } else {
      return res.status(200).json({ reply: `DEBUG_: Provider returned error ${response.status}: ${JSON.stringify(data.error)}` });
    }
  } catch (error) {
    return res.status(200).json({ reply: "DEBUG_: Critical network failure: " + error.message });
  }
}
