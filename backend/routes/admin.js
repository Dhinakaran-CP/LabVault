const express = require('express');
const bcrypt = require('bcryptjs');
const { createHash, randomBytes } = require('crypto');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/students', async (req, res, next) => {
  try {
    const students = await User.listStudents(req.user.id);
    return res.json({ students });
  } catch (error) {
    return next(error);
  }
});

router.get('/admins', async (req, res, next) => {
  try {
    const admins = await User.listAdmins();
    return res.json({ admins });
  } catch (error) {
    return next(error);
  }
});

router.post('/admins', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string') {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 12) {
      return res.status(400).json({ message: 'Administrator password must be at least 12 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const admin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'admin'
    });
    return res.status(201).json({ admin });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
});

router.post('/registration-code', async (req, res, next) => {
  try {
    const registrationCode = randomBytes(16).toString('hex');
    const codeHash = createHash('sha256').update(registrationCode).digest('hex');
    await User.setRegistrationCodeHash(req.user.id, codeHash);
    return res.status(201).json({ registrationCode });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
