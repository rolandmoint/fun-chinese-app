import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;

  try {
    // 1. Load Secure Registry
    const registryPath = path.join(process.cwd(), 'api', 'registry.json');
    const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    // 2. Locate the specific user
    const targetUser = registryData.users.find(u => u.username === username.toLowerCase());

    if (!targetUser) {
      return res.status(401).json({ success: false, error: "Access Denied: Identity unknown." });
    }

    // 3. Validate Individual Password
    if (password === targetUser.password) {
      return res.status(200).json({ 
        success: true, 
        token: "SECURE_SESSION_ID_" + Math.random().toString(36).substring(7),
        role: targetUser.role 
      });
    } else {
      return res.status(401).json({ success: false, error: "Invalid Credentials." });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: "Auth System Error." });
  }
}
