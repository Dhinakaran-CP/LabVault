const express = require('express');
const Booking = require('../models/Booking');
const Equipment = require('../models/Equipment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const overlapMessage = 'Time slot already booked!';

router.use(authenticate);

router.post('/', async (req, res, next) => {
  try {
    const { equipment: equipmentId, purpose } = req.body;
    if (!equipmentId || !uuidPattern.test(equipmentId)) {
      return res.status(400).json({ message: 'A valid equipment id is required.' });
    }
    if (purpose !== undefined && (typeof purpose !== 'string' || !purpose.trim())) {
      return res.status(400).json({ message: 'Purpose must be a non-empty string when provided.' });
    }
    const interval = parseInterval(req.body);
    if (interval.error) return res.status(400).json({ message: interval.error });

    const equipment = await Equipment.findById(equipmentId);
    if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
    if (!equipment.available) return res.status(400).json({ message: 'Equipment is currently unavailable.' });

    const result = await Booking.create({
      equipmentId,
      studentId: req.user.id,
      ...interval,
      purpose: purpose ? purpose.trim() : undefined
    });
    if (result.conflict) return res.status(400).json({ message: overlapMessage });
    return res.status(201).json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const bookings = await Booking.list({
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
      adminId: req.user.id,
      status: req.query.status
    });
    return res.json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking id.' });
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }
    const result = await Booking.review({
      bookingId: req.params.id,
      status,
      reviewerId: req.user.id
    });
    if (result.missing) return res.status(404).json({ message: 'Booking not found.' });
    if (result.notPending) {
      return res.status(409).json({ message: 'Only pending bookings can be approved or rejected.' });
    }
    if (result.conflict) return res.status(400).json({ message: overlapMessage });
    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/cancel', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking id.' });
    const result = await Booking.cancel({
      bookingId: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin'
    });
    if (result.missing) return res.status(404).json({ message: 'Booking not found.' });
    if (result.notCancellable) {
      return res.status(409).json({ message: 'This booking cannot be cancelled.' });
    }
    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

function parseInterval(body) {
  const { date, startTime, endTime } = body;
  if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
    return { error: 'Date must be YYYY-MM-DD and times must be HH:mm.' };
  }
  if (startTime >= endTime) return { error: 'End time must be after start time.' };

  const startAt = new Date(`${date}T${startTime}:00.000Z`);
  if (startAt <= new Date()) return { error: 'Bookings must start in the future.' };
  return { date, startTime, endTime };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

module.exports = router;
