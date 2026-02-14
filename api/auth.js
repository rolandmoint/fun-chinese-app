import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  const APP_PASS = process.env.APP_PASS; // Master access password

  // 1. Load Secure Registry
  const registryPath = path.join(process.cwd(), 'api', 'registry.json');
  const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  // 2. Validate User Existence
  const userExists = registryData.users.find(u => u.username === username.toLowerCase());

  if (!userExists) {
    return res.status(401).json({ success: false, error: "Access Denied: Identity unknown." });
  }

  // 3. Validate Password (Linked to your Vercel Master Secret)
  if (password === APP_PASS) {
    return res.status(200).json({ 
      success: true, 
      token: "SECURE_SESSION_ID_" + Date.now(),
      role: userExists.role 
    });
  } else {
    return res.status(401).json({ success: false, error: "Invalid Credentials." });
  }
}
