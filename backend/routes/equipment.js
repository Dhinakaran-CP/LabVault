const express = require('express');
const Equipment = require('../models/Equipment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [authenticate, requireRole('admin')];
const editableFields = ['name', 'description', 'category', 'location', 'imageUrl', 'available'];
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

router.post('/', ...adminOnly, async (req, res, next) => {
  try {
    const fields = pickEquipmentFields(req.body);
    if (!fields.name || !fields.category || !fields.location) {
      return res.status(400).json({ message: 'Equipment name, category, and location are required.' });
    }
    const equipment = await Equipment.create(fields);
    return res.status(201).json({ equipment });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Equipment with this name already exists.' });
    return next(error);
  }
});

router.patch('/:id', ...adminOnly, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    const changes = pickEquipmentFields(req.body);
    if (!Object.keys(changes).length) {
      return res.status(400).json({ message: 'Provide at least one valid equipment field to update.' });
    }
    const equipment = await Equipment.update(req.params.id, changes);
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ equipment });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Equipment with this name already exists.' });
    return next(error);
  }
});

router.patch('/:id/availability', ...adminOnly, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
    if (typeof req.body.available !== 'boolean') {
      return res.status(400).json({ message: 'Available must be a boolean.' });
    }
    const equipment = await Equipment.update(req.params.id, { available: req.body.available });
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    return res.json({ equipment });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', ...adminOnly, async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id.' });
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
