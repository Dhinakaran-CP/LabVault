const express = require('express');
const bcrypt = require('bcryptjs');
const Lab = require('../models/Lab');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'super_admin', 'lab_incharge'));

router.get('/departments', async (req, res, next) => {
  try {
    return res.json({ departments: await Lab.listDepartments() });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    return res.json({ labs: await Lab.listLabs() });
  } catch (error) {
    return next(error);
  }
});

router.get('/incharges', requireRole('super_admin'), async (req, res, next) => {
  try {
    return res.json({ incharges: await User.listIncharges() });
  } catch (error) {
    return next(error);
  }
});

router.post('/departments', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required.' });
    }
    const department = await Lab.createDepartment(name.trim());
    return res.status(201).json({ department });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Department already exists.' });
    return next(error);
  }
});

router.post('/', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { departmentId, name, inchargeId } = req.body;
    if (typeof departmentId !== 'string' || !uuidPattern.test(departmentId)
      || typeof name !== 'string' || !name.trim()
      || (inchargeId !== undefined && inchargeId !== null
        && (typeof inchargeId !== 'string' || !uuidPattern.test(inchargeId)))) {
      return res.status(400).json({ message: 'A department, lab name, and valid optional incharge are required.' });
    }
    if (inchargeId) {
      const incharge = await User.findById(inchargeId);
      if (!incharge || incharge.role !== 'lab_incharge') {
        return res.status(400).json({ message: 'Selected account is not a lab incharge.' });
      }
    }
    const lab = await Lab.createLab({ departmentId, name: name.trim(), inchargeId });
    return res.status(201).json({ lab });
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ message: 'Department or incharge does not exist.' });
    if (error.code === '23505') return res.status(409).json({ message: 'Lab name or incharge assignment already exists.' });
    return next(error);
  }
});

router.patch('/:id/incharge', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { inchargeId } = req.body;
    if (!uuidPattern.test(req.params.id)
      || (inchargeId !== null && (typeof inchargeId !== 'string' || !uuidPattern.test(inchargeId)))) {
      return res.status(400).json({ message: 'Valid lab and incharge ids are required.' });
    }
    if (inchargeId) {
      const incharge = await User.findById(inchargeId);
      if (!incharge || incharge.role !== 'lab_incharge') {
        return res.status(400).json({ message: 'Selected account is not a lab incharge.' });
      }
    }
    const lab = await Lab.assignIncharge(req.params.id, inchargeId);
    if (!lab) return res.status(404).json({ message: 'Lab not found.' });
    return res.json({ lab });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Incharge is already assigned to another lab.' });
    return next(error);
  }
});

router.post('/incharges', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()
      || typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ message: 'Name, email, and a password of at least 12 characters are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findByEmail(normalizedEmail)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const incharge = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'lab_incharge'
    });
    return res.status(201).json({ incharge });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports = router;
