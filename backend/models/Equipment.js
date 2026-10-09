const db = require('../db');

const columns = `id AS "_id", name, description, category, location,
                 image_url AS "imageUrl", available, created_at AS "createdAt",
                 updated_at AS "updatedAt"`;

async function list({ category, available } = {}) {
  const conditions = [];
  const values = [];
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (typeof available === 'boolean') {
    values.push(available);
    conditions.push(`available = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(`SELECT ${columns} FROM equipment ${where} ORDER BY name`, values);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${columns} FROM equipment WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ name, description = '', category, location, imageUrl = '', available = true }) {
  const { rows } = await db.query(
    `INSERT INTO equipment (name, description, category, location, image_url, available)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${columns}`,
    [name, description, category, location, imageUrl, available]
  );
  return rows[0];
}

async function update(id, changes) {
  const fieldMap = {
    name: 'name',
    description: 'description',
    category: 'category',
    location: 'location',
    imageUrl: 'image_url',
    available: 'available'
  };
  const values = [];
  const assignments = [];
  for (const [key, value] of Object.entries(changes)) {
    values.push(value);
    assignments.push(`${fieldMap[key]} = $${values.length}`);
  }
  if (!assignments.length) return findById(id);
  values.push(id);
  const { rows } = await db.query(
    `UPDATE equipment SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING ${columns}`,
    values
  );
  return rows[0] || null;
}

async function deleteIfUnused(id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const active = await client.query(
      `SELECT 1 FROM bookings
       WHERE equipment_id = $1 AND status IN ('pending', 'approved')
         AND (booking_date + end_time) > NOW()
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
