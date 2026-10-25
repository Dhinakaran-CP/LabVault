const db = require('../db');

const columns = `id AS "_id", name, description, category, location,
                 image_url AS "imageUrl", quantity, lab_id AS "labId", available, created_at AS "createdAt",
                 updated_at AS "updatedAt"`;
const equipmentFrom = `FROM equipment e
  LEFT JOIN labs l ON l.id = e.lab_id
  LEFT JOIN departments d ON d.id = l.department_id`;
const equipmentColumns = `e.id AS "_id", e.name, e.description, e.category, e.location,
  e.image_url AS "imageUrl", e.quantity, e.lab_id AS "labId", l.name AS "labName",
  d.name AS "departmentName", e.available,
  GREATEST(e.quantity - (
    SELECT COUNT(*)::int FROM bookings b
    WHERE b.equipment_id = e.id AND b.status = 'approved' AND b.returned_at IS NULL
  ), 0)::int AS "availableQuantity",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt"`;

async function list({ category, available, inchargeId } = {}) {
  const conditions = [];
  const values = [];
  if (category) {
    values.push(category);
    conditions.push(`e.category = $${values.length}`);
  }
  if (typeof available === 'boolean') {
    values.push(available);
    conditions.push(`e.available = $${values.length}`);
  }
  if (inchargeId) {
    values.push(inchargeId);
    conditions.push(`l.incharge_id = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(`SELECT ${equipmentColumns} ${equipmentFrom} ${where} ORDER BY e.name`, values);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT ${equipmentColumns} ${equipmentFrom} WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create({
  name, description = '', category, location, imageUrl = '', quantity = 1, labId, available = true
}) {
  const { rows } = await db.query(
    `INSERT INTO equipment (name, description, category, location, image_url, quantity, lab_id, available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${columns}`,
    [name, description, category, location, imageUrl, quantity, labId || null, available]
  );
  return findById(rows[0]._id);
}

async function update(id, changes) {
  const fieldMap = {
    name: 'name',
    description: 'description',
    category: 'category',
    location: 'location',
    imageUrl: 'image_url',
    quantity: 'quantity',
    labId: 'lab_id',
    available: 'available'
  };
  const values = [];
  const assignments = [];
  for (const [key, value] of Object.entries(changes)) {
    values.push(value);
    assignments.push(`${fieldMap[key]} = $${values.length}`);
  }
  if (!assignments.length) return findById(id);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
    if (Object.prototype.hasOwnProperty.call(changes, 'quantity')) {
      const occupancy = await client.query(
        `SELECT COUNT(*)::int AS allocated FROM bookings
         WHERE equipment_id = $1 AND status = 'approved' AND returned_at IS NULL`,
        [id]
      );
      if (changes.quantity < occupancy.rows[0].allocated) {
        await client.query('ROLLBACK');
        return { conflict: true };
      }
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'labId')) {
      const active = await client.query(
        `SELECT 1 FROM bookings
         WHERE equipment_id = $1 AND (
           (status IN ('pending_mentor', 'pending_lab') AND booking_date + end_time > NOW())
           OR (status = 'approved' AND returned_at IS NULL)
         )
         LIMIT 1`,
        [id]
      );
      if (active.rowCount) {
        await client.query('ROLLBACK');
        return { activeBookings: true };
      }
    }
    values.push(id);
    const { rows } = await client.query(
      `UPDATE equipment SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING ${columns}`,
      values
    );
    await client.query('COMMIT');
    return rows[0] ? findById(id) : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteIfUnused(id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
    const active = await client.query(
      `SELECT 1 FROM bookings
       WHERE equipment_id = $1 AND (
         (status IN ('pending_mentor', 'pending_lab') AND booking_date + end_time > NOW())
         OR (status = 'approved' AND returned_at IS NULL)
       )
       LIMIT 1`,
      [id]
    );
    if (active.rowCount) {
      await client.query('ROLLBACK');
      return { conflict: true };
    }
    const deleted = await client.query(
      `DELETE FROM equipment WHERE id = $1 RETURNING ${columns}`,
      [id]
    );
    await client.query('COMMIT');
    return { equipment: deleted.rows[0] || null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { list, findById, create, update, deleteIfUnused };
