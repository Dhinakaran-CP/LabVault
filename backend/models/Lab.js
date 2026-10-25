const db = require('../db');

async function listDepartments() {
  const { rows } = await db.query(
    `SELECT id, name FROM departments ORDER BY name`
  );
  return rows;
}

async function listLabs() {
  const { rows } = await db.query(
    `SELECT l.id, l.name, l.department_id AS "departmentId",
            d.name AS "departmentName", l.incharge_id AS "inchargeId",
            u.name AS "inchargeName", u.email AS "inchargeEmail"
     FROM labs l
     INNER JOIN departments d ON d.id = l.department_id
     LEFT JOIN users u ON u.id = l.incharge_id
     ORDER BY d.name, l.name`
  );
  return rows;
}

async function findByIncharge(inchargeId) {
  const { rows } = await db.query(
    `SELECT id, department_id AS "departmentId", name, incharge_id AS "inchargeId"
     FROM labs WHERE incharge_id = $1`,
    [inchargeId]
  );
  return rows[0] || null;
}

async function createDepartment(name) {
  const { rows } = await db.query(
    `INSERT INTO departments (name) VALUES ($1) RETURNING id, name`,
    [name]
  );
  return rows[0];
}

async function createLab({ departmentId, name, inchargeId }) {
  const { rows } = await db.query(
    `INSERT INTO labs (department_id, name, incharge_id)
     VALUES ($1, $2, $3)
     RETURNING id, department_id AS "departmentId", name, incharge_id AS "inchargeId"`,
    [departmentId, name, inchargeId || null]
  );
  return rows[0];
}

async function assignIncharge(labId, inchargeId) {
  const { rows } = await db.query(
    `UPDATE labs SET incharge_id = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, department_id AS "departmentId", name, incharge_id AS "inchargeId"`,
    [labId, inchargeId || null]
  );
  return rows[0] || null;
}

module.exports = { listDepartments, listLabs, findByIncharge, createDepartment, createLab, assignIncharge };
