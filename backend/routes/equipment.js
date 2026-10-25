const express = require('express');
const Equipment = require('../models/Equipment');
const Lab = require('../models/Lab');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const equipmentManagers = [authenticate, requireRole('super_admin', 'lab_incharge')];
const editableFields = ['name', 'description', 'category', 'location', 'imageUrl', 'quantity', 'labId', 'available'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/', async (req, res, next) => {
  try {
    const available = ['true', 'false'].includes(req.query.available)
      ? req.query.available === 'true'
      : undefined;
    const equipment = await Equipment.list({
      category: req.query.category ? String(req.query.category) : undefined,
      available
    });
    return res.json({ equipment });
  } catch (error) {
    return next(error);
  }
});

router.get('/mine', authenticate, requireRole('lab_incharge'), async (req, res, next) => {
  try {
    const equipment = await Equipment.list({ inchargeId: req.user.id });
    return res.json({ equipment });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ equipment });
  } catch (error) {
    return next(error);
  }
});

router.post('/', ...equipmentManagers, async (req, res, next) => {
  try {
    const fields = pickEquipmentFields(req.body);
    if (!fields.name || !fields.category || !fields.location) {
      return res.status(400).json({ message: 'Equipment name, category, and location are required.' });
    }
    if (fields.quantity === undefined) fields.quantity = 1;
    if (!Number.isInteger(fields.quantity) || fields.quantity < 0) {
      return res.status(400).json({ message: 'Quantity must be a non-negative whole number.' });
    }
    if (req.user.role === 'lab_incharge') {
      const lab = await Lab.findByIncharge(req.user.id);
      if (!lab) return res.status(403).json({ message: 'You are not assigned to a lab.' });
      fields.labId = lab.id;
    } else if (!fields.labId || !uuidPattern.test(fields.labId)) {
      return res.status(400).json({ message: 'A valid lab is required for equipment.' });
    }
    if (!await Lab.listLabs().then((labs) => labs.some((lab) => lab.id === fields.labId))) {
      return res.status(400).json({ message: 'Selected lab does not exist.' });
    }
    const equipment = await Equipment.create(fields);
    return res.status(201).json({ equipment });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Equipment with this name already exists in this lab.' });
    return next(error);
  }
});

router.patch('/:id', ...equipmentManagers, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    const existing = await Equipment.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Equipment not found.' });
    if (req.user.role === 'lab_incharge') {
      const lab = await Lab.findByIncharge(req.user.id);
      if (!lab || existing.labId !== lab.id) {
        return res.status(403).json({ message: 'You can only manage equipment assigned to your lab.' });
      }
    }
    const changes = pickEquipmentFields(req.body);
    if (!Object.keys(changes).length) {
      return res.status(400).json({ message: 'Provide at least one valid equipment field to update.' });
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'quantity')
      && (!Number.isInteger(changes.quantity) || changes.quantity < 0)) {
      return res.status(400).json({ message: 'Quantity must be a non-negative whole number.' });
    }
    if (req.user.role === 'lab_incharge' && Object.prototype.hasOwnProperty.call(changes, 'labId')) {
      return res.status(403).json({ message: 'Only the main administrator can move equipment between labs.' });
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'labId')
      && (typeof changes.labId !== 'string' || !uuidPattern.test(changes.labId)
        || !await Lab.listLabs().then((labs) => labs.some((lab) => lab.id === changes.labId)))) {
      return res.status(400).json({ message: 'A valid lab is required for equipment.' });
    }
    const equipment = await Equipment.update(req.params.id, changes);
    if (equipment?.conflict) {
      return res.status(409).json({ message: 'Quantity cannot be lower than the units currently allocated to students.' });
    }
    if (equipment?.activeBookings) {
      return res.status(409).json({ message: 'Equipment cannot be moved while it has active requests or bookings.' });
    }
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ equipment });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Equipment with this name already exists in this lab.' });
    return next(error);
  }
});

router.patch('/:id/availability', ...equipmentManagers, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    if (typeof req.body.available !== 'boolean') {
      return res.status(400).json({ message: 'Available must be a boolean.' });
    }
    const existing = await Equipment.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Equipment not found.' });
    if (req.user.role === 'lab_incharge') {
      const lab = await Lab.findByIncharge(req.user.id);
      if (!lab || existing.labId !== lab.id) {
        return res.status(403).json({ message: 'You can only manage equipment assigned to your lab.' });
      }
    }
    const equipment = await Equipment.update(req.params.id, { available: req.body.available });
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ equipment });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', ...equipmentManagers, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    if (req.user.role === 'lab_incharge') {
      const [lab, item] = await Promise.all([
        Lab.findByIncharge(req.user.id),
        Equipment.findById(req.params.id)
      ]);
      if (!item) return res.status(404).json({ message: 'Equipment not found.' });
      if (!lab || item.labId !== lab.id) {
        return res.status(403).json({ message: 'You can only manage equipment assigned to your lab.' });
      }
    }
    const result = await Equipment.deleteIfUnused(req.params.id);
    if (result.conflict) {
      return res.status(409).json({ message: 'Equipment with active bookings cannot be deleted.' });
    }
    if (!result.equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ message: 'Equipment deleted.' });
  } catch (error) {
    return next(error);
  }
});

function pickEquipmentFields(body) {
  return editableFields.reduce((fields, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key];
    return fields;
  }, {});
}

module.exports = router;
