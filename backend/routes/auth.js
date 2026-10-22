const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash } = require('crypto');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, adminCode } = req.body;
    if (!name || !email || !password || typeof adminCode !== 'string' || !adminCode.trim()) {
      return res.status(400).json({ message: 'Name, email, password, and admin registration code are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const codeHash = createHash('sha256').update(adminCode.trim().toLowerCase()).digest('hex');
    const admin = await User.findAdminByRegistrationCodeHash(codeHash);
    if (!admin) return res.status(400).json({ message: 'Invalid admin registration code.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'student',
      adminId: admin.id,
    });
    return res.status(201).json({
      token: issueToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findByEmail(String(email).trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    return res.json({
      token: issueToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
});

module.exports = router;
