// 🛡️ SECURITY GATEKEEPER
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  
  // 🔐 Credentials fetched from secure Vercel environment variables
  const TARGET_USER = process.env.APP_USER;
  const TARGET_PASS = process.env.APP_PASS;

  if (!TARGET_USER || !TARGET_PASS) {
    return res.status(500).json({ success: false, error: "Auth system not configured." });
  }

  if (username === TARGET_USER && password === TARGET_PASS) {
    // Return a mock success token (In a full app, this would be a signed JWT)
    return res.status(200).json({ success: true, token: "SECURE_SESSION_ACCESS_GRANT" });
  } else {
    return res.status(401).json({ success: false, error: "Invalid Credentials." });
  }
}
