const express = require('express');
const Booking = require('../models/Booking');
const Equipment = require('../models/Equipment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const capacityMessage = 'No equipment units are currently available.';

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
    if (!equipment.labId) return res.status(400).json({ message: 'This equipment has not been assigned to a lab yet.' });

    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can request equipment.' });
    }
    const result = await Booking.create({
      equipmentId,
      studentId: req.user.id,
      ...interval,
      purpose: purpose ? purpose.trim() : undefined
    });
    if (result.missing) return res.status(404).json({ message: 'Equipment not found.' });
    if (result.unavailable) return res.status(400).json({ message: 'Equipment is currently unavailable.' });
    if (result.noIncharge) return res.status(400).json({ message: 'This lab does not have an assigned incharge yet.' });
    if (result.conflict) return res.status(400).json({ message: capacityMessage });
    return res.status(201).json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const bookings = await Booking.list({
      userId: req.user.id,
      role: req.user.role,
      status: req.query.status
    });
    return res.json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking id.' });
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }
    const result = await Booking.reviewMentor({
      bookingId: req.params.id,
      status,
      reviewerId: req.user.id
    });
    if (result.missing) return res.status(404).json({ message: 'Booking not found.' });
    if (result.notPending) {
      return res.status(409).json({ message: 'Only pending bookings can be approved or rejected.' });
    }
    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/lab-decision', requireRole('lab_incharge'), async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking id.' });
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }
    const result = await Booking.reviewIncharge({
      bookingId: req.params.id,
      status,
      reviewerId: req.user.id
    });
    if (result.missing) return res.status(404).json({ message: 'Booking not found.' });
    if (result.notPending) {
      return res.status(409).json({ message: 'Only mentor-approved requests can be decided by a lab incharge.' });
    }
    if (result.conflict) return res.status(409).json({ message: capacityMessage });
    return res.json({ booking: result.booking });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/return', requireRole('lab_incharge'), async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking id.' });
    const result = await Booking.markReturned({
      bookingId: req.params.id,
      inchargeId: req.user.id
    });
    if (result.missing) return res.status(404).json({ message: 'Booking not found in your lab.' });
    if (result.notIssued) return res.status(409).json({ message: 'Only allocated equipment that has not been returned can be marked returned.' });
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
      isAdmin: ['admin', 'super_admin'].includes(req.user.role)
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
