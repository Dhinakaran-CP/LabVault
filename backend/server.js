require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');
const User = require('./models/User');
const Equipment = require('./models/Equipment');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((item) => item.trim()) : true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/labs', require('./routes/labs'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/bookings', require('./routes/booking'));

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === '23505') {
    return res.status(409).json({ message: 'A record with that value already exists.' });
  }
  if (error.code === '23503') return res.status(400).json({ message: 'Referenced record does not exist.' });
  if (error.code === '23514' || error.code === '22P02' || error.code === '22007') {
    return res.status(400).json({ message: 'Invalid value supplied.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Invalid JSON request body.' });
  }
  console.error(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

const starterEquipment = [
  { name: 'NVIDIA RTX 4090 Workstation', description: 'High-performance workstation for GPU computing and machine-learning labs.', category: 'Computing', location: 'Computer Lab', available: true },
  { name: 'Digital Storage Oscilloscope', description: 'Digital storage oscilloscope for electronics measurement and analysis.', category: 'Electronics', location: 'Engineering Lab A', available: true },
  { name: 'Robotics Arm Kit', description: 'Programmable robotics arm kit for automation and control projects.', category: 'Robotics', location: 'Robotics Lab', available: true },
  { name: '3D Printer Unit', description: 'FDM 3D printer for prototyping and coursework.', category: 'Prototyping', location: 'Maker Space', available: true },
];

async function seedEquipment() {
  const existing = new Set((await Equipment.list()).map((item) => item.name));
  for (const item of starterEquipment) {
    if (!existing.has(item.name)) await Equipment.create(item);
  }
}

async function provisionAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'LabVault Administrator' } = process.env;
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD) {
    console.warn('No administrator configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env to provision one.');
    return;
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to provision the initial administrator.');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  await User.promoteAdmin({
    name: ADMIN_NAME,
    email,
    password: await bcrypt.hash(ADMIN_PASSWORD, 12)
  });
  const configuredAdmin = await User.findByEmail(email);
  await User.assignUnownedStudents(configuredAdmin.id);
  console.log('Administrator credentials synchronized from environment.');
}

async function start() {
  const { DATABASE_URL, JWT_SECRET, PORT = 5000 } = process.env;
  if (!DATABASE_URL && !process.env.PGDATABASE) {
    throw new Error('Set DATABASE_URL or PGDATABASE in backend/.env.');
  }
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters.');
  }
  await db.initializeDatabase();
  await Promise.all([seedEquipment(), provisionAdmin()]);
  app.listen(PORT, () => console.log(`LabVault API listening on port ${PORT}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
