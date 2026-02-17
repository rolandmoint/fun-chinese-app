// 🔐 SECURE REGISTRATION API - OWASP TOP 10 COMPLIANT
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Security Configuration
const CONFIG = {
  MAX_USERS: 50,           // Limit total users to prevent abuse
  RATE_LIMIT_WINDOW: 3600000,  // 1 hour in milliseconds
  MAX_ATTEMPTS_PER_IP: 5,  // Max registration attempts per IP per hour
  MIN_PASSWORD_LENGTH: 8,
  REQUIRE_EMAIL_VERIFICATION: false  // Set to true if you add email service
};

// In-memory rate limit store (resets on server restart - for serverless)
const rateLimitStore = new Map();

// 🛡️ INPUT VALIDATION & SANITIZATION
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove potentially dangerous characters
  return input
    .trim()
    .replace(/[<>\"'&]/g, '')  // Remove HTML/XML special chars
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')  // Remove control characters
    .substring(0, 100);  // Limit length
}

function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  // Only allow alphanumeric and underscore, 3-20 characters
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// 🔒 PASSWORD HASHING (PBKDF2 - Node.js built-in)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// 🚦 RATE LIMITING
function checkRateLimit(clientIP) {
  const now = Date.now();
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(clientIP)) {
    rateLimitStore.set(clientIP, []);
  }
  
  const attempts = rateLimitStore.get(clientIP);
  // Remove old attempts outside the window
  const validAttempts = attempts.filter(time => time > windowStart);
  
  if (validAttempts.length >= CONFIG.MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfter: Math.ceil((attempts[0] + CONFIG.RATE_LIMIT_WINDOW - now) / 60000) };
  }
  
  validAttempts.push(now);
  rateLimitStore.set(clientIP, validAttempts);
  return { allowed: true };
}

// 📝 SECURE REGISTRATION HANDLER
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 2. Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // 3. Check Rate Limit (OWASP: Brute Force Protection)
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        success: false, 
        error: `Rate limit exceeded. Please try again in ${rateCheck.retryAfter} minutes.` 
      });
    }

    // 4. Parse and validate input
    const { username, password, email, role = 'student' } = req.body;
    
    // Input sanitization (OWASP: Injection Prevention)
    const cleanUsername = sanitizeInput(username).toLowerCase();
    const cleanEmail = sanitizeInput(email).toLowerCase();
    const cleanRole = sanitizeInput(role);
    
    // 5. Validation checks
    if (!cleanUsername || !password || !cleanEmail) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    
    if (!validateUsername(cleanUsername)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username must be 3-20 characters, alphanumeric and underscore only.' 
      });
    }
    
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email format.' });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number.' 
      });
    }
    
    // 6. Load registry
    const registryPath = path.join(process.cwd(), 'api', 'registry.json');
    const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    
    // 7. Check user limits (OWASP: Resource Exhaustion Prevention)
    if (registryData.users.length >= CONFIG.MAX_USERS) {
      return res.status(403).json({ success: false, error: 'Registration limit reached.' });
    }
    
    // 8. Check for existing user (OWASP: User Enumeration Prevention)
    // Use generic message to prevent username enumeration
    const existingUser = registryData.users.find(u => 
      u.username === cleanUsername || u.email === cleanEmail
    );
    
    if (existingUser) {
      // Return same message regardless of whether username or email exists
      return res.status(409).json({ 
        success: false, 
        error: 'Registration failed. Username or email may already be registered.' 
      });
    }
    
    // 9. Hash password (OWASP: Secure Password Storage)
    const { salt, hash } = await hashPassword(password);
    
    // 10. Create new user object
    const newUser = {
      id: crypto.randomUUID(),  // Unique identifier
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hash,       // Store hash, never plain text
      salt: salt,               // Store salt for verification
      role: cleanRole === 'admin' ? 'student' : cleanRole, // Prevent self-promotion to admin
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      emailVerified: false      // For future email verification feature
    };
    
    // 11. Add to registry and save
    registryData.users.push(newUser);
    fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
    
    // 12. Return success (without sensitive data)
    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role
      }
    });
    
  } catch (error) {
    // Log error but don't expose details to client (OWASP: Information Disclosure)
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Registration failed. Please try again later.' 
    });
  }
}
