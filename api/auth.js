// 🔐 SECURE LOGIN API - UPDATED FOR HASHED PASSWORDS
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// Verify password against hash
function verifyPassword(password, salt, hash) {
  const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return computedHash === hash;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    // Rate limiting check
    const rateCheck = checkLoginRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        success: false, 
        error: `Too many login attempts. Try again in ${rateCheck.retryAfter} minutes.` 
      });
    }

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required." });
    }

    // Sanitize - Now case-insensitive for username lookup
    const cleanUsername = username.toLowerCase().trim();
    
    // Load registry
    const registryPath = path.join(process.cwd(), 'api', 'registry.json');
    const registryDataStr = fs.readFileSync(registryPath, 'utf8');
    const registryData = JSON.parse(registryDataStr);

    // Find user - Case-insensitive match against username in registry
    const targetUser = registryData.users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!targetUser) {
      // Generic error to prevent username enumeration
      return res.status(401).json({ success: false, error: "Invalid credentials." });
    }

    // Check if account is active
    if (targetUser.isActive === false) {
      return res.status(403).json({ success: false, error: "Account disabled." });
    }

    // Verify password (support both old plain text and new hashed)
    let passwordValid = false;
    
    // Check legacyPasswords map from registry.json
    const legacyPassword = (registryData.legacyPasswords && (registryData.legacyPasswords[cleanUsername] || registryData.legacyPasswords[username.trim()]));
    
    if (targetUser.passwordHash && targetUser.salt) {
      // New format: hashed password
      passwordValid = verifyPassword(password, targetUser.salt, targetUser.passwordHash);
    } else if (targetUser.password) {
      // Old format: plain text inside user object
      passwordValid = (password === targetUser.password);
    } else if (legacyPassword) {
      // Compatibility with registry's top-level legacyPasswords map
      passwordValid = (password === legacyPassword);
    }

    if (passwordValid) {
      // Update last login
      targetUser.lastLogin = new Date().toISOString();
      fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
      
      // Clear login attempts on success
      loginAttempts.delete(clientIP);
      
      return res.status(200).json({ 
        success: true, 
        token: "SECURE_SESSION_" + crypto.randomUUID(),
        role: targetUser.role,
        user: {
          id: targetUser.id || 'legacy_' + cleanUsername,
          username: targetUser.username,
          email: targetUser.email || null
        }
      });
    } else {
      return res.status(401).json({ success: false, error: "Invalid credentials." });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ success: false, error: "Authentication system error." });
  }
}

// Helper for auto-migration
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
