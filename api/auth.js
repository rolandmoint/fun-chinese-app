// 🔐 SECURE LOGIN API - MONGODB OPTIMIZED
import crypto from 'crypto';
import util from 'util';
import clientPromise from './lib/mongodb.js';

const pbkdf2Async = util.promisify(crypto.pbkdf2);

// Rate limiting for login
const loginAttempts = new Map();
const LOGIN_RATE_LIMIT = 5;  
const LOGIN_WINDOW = 900000; 

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
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('fun_chinese_db');
    const usersCollection = db.collection('users');

    // Find the user in MongoDB
    const targetUser = await usersCollection.findOne({ username: cleanUsername });

    if (!targetUser) return res.status(401).json({ success: false, error: "Invalid credentials." });
    if (targetUser.isActive === false) return res.status(403).json({ success: false, error: "Account disabled." });

    let passwordValid = false;
    
    // For legacy registry.json passwords
    // Note: If you want to migrate existing users, you'd need to insert them into Mongo first. 
    // New users register straight into memory with salt & hash.
    if (targetUser.passwordHash && targetUser.salt) {
      passwordValid = await verifyPasswordAsync(password, targetUser.salt, targetUser.passwordHash);
    } else if (targetUser.password) {
      // Legacy unhashed support
      passwordValid = (password === targetUser.password);
    }

    if (passwordValid) {
      // Update last login in DB
      await usersCollection.updateOne(
        { _id: targetUser._id },
        { $set: { lastLogin: new Date().toISOString() } }
      );
      
      loginAttempts.delete(clientIP);
      
      return res.status(200).json({ 
        success: true, 
        token: "SECURE_SESSION_" + crypto.randomUUID(),
        role: targetUser.role || 'student',
        user: { 
            id: targetUser.id || targetUser._id.toString(), 
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
