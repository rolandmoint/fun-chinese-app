// 🔐 SECURE LOGIN API - OPTIMIZED FOR VERCEL (ASYNC)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import util from 'util';

// Promisify pbkdf2 to avoid blocking the main thread
const pbkdf2Async = util.promisify(crypto.pbkdf2);

// Rate limiting for login
const loginAttempts = new Map();
const LOGIN_RATE_LIMIT = 5;  // attempts
const LOGIN_WINDOW = 900000; // 15 minutes

function checkLoginRateLimit(clientIP) {
  const now = Date.now();
  const windowStart = now - LOGIN_WINDOW;
  
  if (!loginAttempts.has(clientIP)) {
    loginAttempts.set(clientIP, []);
  }
  
  const attempts = loginAttempts.get(clientIP);
  const validAttempts = attempts.filter(time => time > windowStart);
  
  if (validAttempts.length >= LOGIN_RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((attempts[0] + LOGIN_WINDOW - now) / 60000) };
  }
  
  validAttempts.push(now);
  loginAttempts.set(clientIP, validAttempts);
  return { allowed: true };
}

// Verify password asynchronously
async function verifyPasswordAsync(password, salt, hash) {
  const computedHashBuffer = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
  return computedHashBuffer.toString('hex') === hash;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    const rateCheck = checkLoginRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return res.status(429).json({ success: false, error: `Too many login attempts. Try again in ${rateCheck.retryAfter} minutes.` });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required." });
    }

    const cleanUsername = username.toLowerCase().trim();
    
    // TEMPORARY JSON DB LOGIC - To be replaced by MongoDB/SQL
    const registryPath = path.join(process.cwd(), 'api', 'registry.json');
    const registryDataStr = fs.readFileSync(registryPath, 'utf8');
    const registryData = JSON.parse(registryDataStr);

    const targetUser = registryData.users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!targetUser) return res.status(401).json({ success: false, error: "Invalid credentials." });
    if (targetUser.isActive === false) return res.status(403).json({ success: false, error: "Account disabled." });

    let passwordValid = false;
    const legacyPassword = (registryData.legacyPasswords && (registryData.legacyPasswords[cleanUsername] || registryData.legacyPasswords[username.trim()]));
    
    if (targetUser.passwordHash && targetUser.salt) {
      // ✅ Await async check so thread isn't blocked!
      passwordValid = await verifyPasswordAsync(password, targetUser.salt, targetUser.passwordHash);
    } else if (targetUser.password) {
      passwordValid = (password === targetUser.password);
    } else if (legacyPassword) {
      passwordValid = (password === legacyPassword);
    }

    if (passwordValid) {
      targetUser.lastLogin = new Date().toISOString();
      
      // Note: WriteFileSync on Vercel is ephemeral. 
      // It won't persist across lambda spins. Needs Real DB.
      try {
        fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
      } catch (writeErr) {
        // expected to fail on true serverless
      }
      
      loginAttempts.delete(clientIP);
      return res.status(200).json({ 
        success: true, 
        token: "SECURE_SESSION_" + crypto.randomUUID(),
        role: targetUser.role,
        user: { id: targetUser.id || 'legacy_' + cleanUsername, username: targetUser.username, email: targetUser.email || null }
      });
    } else {
      return res.status(401).json({ success: false, error: "Invalid credentials." });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ success: false, error: "Authentication system error." });
  }
}
