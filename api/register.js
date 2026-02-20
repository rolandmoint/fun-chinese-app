// 🔐 SECURE REGISTRATION API - MONGODB OPTIMIZED
import crypto from 'crypto';
import util from 'util';
import clientPromise from './lib/mongodb.js';

const pbkdf2Async = util.promisify(crypto.pbkdf2);

const CONFIG = {
  MAX_USERS: 100,          
  RATE_LIMIT_WINDOW: 3600000,  
  MAX_ATTEMPTS_PER_IP: 5,  
  MIN_PASSWORD_LENGTH: 8,
};

const rateLimitStore = new Map();

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"'&]/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 100);
}

function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function validatePassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);
}

async function hashPasswordAsync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashBuffer = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
  return { salt, hash: hashBuffer.toString('hex') };
}

function checkRateLimit(clientIP) {
  const now = Date.now();
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;
  if (!rateLimitStore.has(clientIP)) rateLimitStore.set(clientIP, []);
  
  const attempts = rateLimitStore.get(clientIP);
  const validAttempts = attempts.filter(time => time > windowStart);
  
  if (validAttempts.length >= CONFIG.MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfter: Math.ceil((attempts[0] + CONFIG.RATE_LIMIT_WINDOW - now) / 60000) };
  }
  
  validAttempts.push(now);
  rateLimitStore.set(clientIP, validAttempts);
  return { allowed: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) return res.status(429).json({ success: false, error: `Rate limit exceeded. Try again later.` });

    const { username, password, email, role = 'student' } = req.body;
    
    const cleanUsername = sanitizeInput(username).toLowerCase();
    const cleanEmail = sanitizeInput(email).toLowerCase();
    const cleanRole = sanitizeInput(role);
    
    if (!cleanUsername || !password || !cleanEmail) return res.status(400).json({ success: false, error: 'All fields are required.' });
    if (!validateUsername(cleanUsername)) return res.status(400).json({ success: false, error: 'Username must be 3-20 characters, alphanumeric and underscore only.' });
    if (!validateEmail(cleanEmail)) return res.status(400).json({ success: false, error: 'Invalid email format.' });
    if (!validatePassword(password)) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters with uppercase, lowercase, and number.' });
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('fun_chinese_db');
    const usersCollection = db.collection('users');
    
    // Check limits via DB
    const userCount = await usersCollection.countDocuments();
    if (userCount >= CONFIG.MAX_USERS) {
      return res.status(403).json({ success: false, error: 'Registration limit reached.' });
    }
    
    // Check if user exists (case insensitive finding)
    const existingUser = await usersCollection.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail }
      ]
    });
    
    if (existingUser) return res.status(409).json({ success: false, error: 'Username or email already registered.' });
    
    // Hash and Save
    const { salt, hash } = await hashPasswordAsync(password);
    
    const newUser = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hash,
      salt: salt,
      role: cleanRole === 'admin' ? 'student' : cleanRole,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      emailVerified: false
    };
    
    // Insert into DB
    await usersCollection.insertOne(newUser);
    
    return res.status(201).json({ 
      success: true, 
      message: 'Registration successful!', 
      user: { id: newUser.id, username: newUser.username, role: newUser.role } 
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed.' });
  }
}
