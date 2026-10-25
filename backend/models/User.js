const db = require('../db');

async function findById(id) {
  const { rows } = await db.query(
    'SELECT id, name, email, role, admin_id AS "adminId" FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await db.query(
    'SELECT id, name, email, password_hash, role, admin_id AS "adminId" FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function create({ name, email, password, role = 'student', adminId }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, admin_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, admin_id AS "adminId"`,
    [name, email, password, role, adminId || null]
  );
  return rows[0];
}

async function findAdminByRegistrationCodeHash(codeHash) {
  const { rows } = await db.query(
    `SELECT id, name FROM users
     WHERE role IN ('admin', 'super_admin') AND registration_code_hash = $1`,
    [codeHash]
  );
  return rows[0] || null;
}

async function setRegistrationCodeHash(adminId, codeHash) {
  await db.query(
    `UPDATE users SET registration_code_hash = $2, updated_at = NOW()
     WHERE id = $1 AND role IN ('admin', 'super_admin')`,
    [adminId, codeHash]
  );
}

async function listStudents(adminId) {
  const { rows } = await db.query(
    `SELECT id, name, email, created_at AS "createdAt"
     FROM users WHERE role = 'student' AND admin_id = $1
     ORDER BY name, email`,
    [adminId]
  );
  return rows;
}

async function listAdmins() {
  const { rows } = await db.query(
    `SELECT id, name, email, created_at AS "createdAt"
     FROM users WHERE role = 'admin'
     ORDER BY name, email`
  );
  return rows;
}

async function listIncharges() {
  const { rows } = await db.query(
    `SELECT id, name, email, created_at AS "createdAt"
     FROM users WHERE role = 'lab_incharge'
     ORDER BY name, email`
  );
  return rows;
}

async function promoteAdmin({ name, email, password }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, admin_id, registration_code_hash)
     VALUES ($1, $2, $3, 'super_admin', NULL, NULL)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = 'super_admin',
           admin_id = NULL
     RETURNING id, name, email, role, admin_id AS "adminId"`,
    [name, email, password]
  );
  return rows[0];
}

async function assignUnownedStudents(adminId) {
  await db.query(
    `UPDATE users SET admin_id = $1, updated_at = NOW()
     WHERE role = 'student' AND admin_id IS NULL`,
    [adminId]
  );
}

module.exports = {
  findById,
  findByEmail,
  create,
  findAdminByRegistrationCodeHash,
  setRegistrationCodeHash,
  listStudents,
  listAdmins,
  listIncharges,
  promoteAdmin,
  assignUnownedStudents
};
