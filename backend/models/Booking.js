const db = require('../db');

const bookingSelect = `
  b.id AS "_id",
  b.equipment_id AS "equipmentId",
  b.student_id AS "studentId",
  b.booking_date::text AS date,
  to_char(b.start_time, 'HH24:MI') AS "startTime",
  to_char(b.end_time, 'HH24:MI') AS "endTime",
  b.booking_date::text || 'T' || to_char(b.start_time, 'HH24:MI:SS') || '.000Z' AS "startAt",
  b.booking_date::text || 'T' || to_char(b.end_time, 'HH24:MI:SS') || '.000Z' AS "endAt",
  b.purpose,
  b.status,
  b.reviewed_by AS "reviewedById",
  b.reviewed_at AS "reviewedAt",
  b.created_at AS "createdAt",
  b.updated_at AS "updatedAt",
  jsonb_build_object(
    '_id', e.id, 'name', e.name, 'category', e.category, 'location', e.location,
    'imageUrl', e.image_url
  ) AS equipment,
  jsonb_build_object('_id', s.id, 'name', s.name, 'email', s.email) AS student,
  CASE WHEN reviewer.id IS NULL THEN NULL ELSE
    jsonb_build_object('_id', reviewer.id, 'name', reviewer.name, 'email', reviewer.email)
  END AS "reviewedBy"
`;

function joins(whereClause) {
  return `SELECT ${bookingSelect}
    FROM bookings b
    INNER JOIN equipment e ON e.id = b.equipment_id
    INNER JOIN users s ON s.id = b.student_id
    LEFT JOIN users reviewer ON reviewer.id = b.reviewed_by
    ${whereClause}`;
}

async function create({ equipmentId, studentId, date, startTime, endTime, purpose }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [equipmentId]);
    const conflict = await client.query(
      `SELECT 1 FROM bookings
       WHERE equipment_id = $1 AND booking_date = $2
         AND status IN ('pending', 'approved')
         AND start_time < $4::time AND end_time > $3::time
       LIMIT 1`,
      [equipmentId, date, startTime, endTime]
    );
    if (conflict.rowCount) {
      await client.query('ROLLBACK');
      return { conflict: true };
    }
    const inserted = await client.query(
      `INSERT INTO bookings
        (equipment_id, student_id, booking_date, start_time, end_time, purpose)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [equipmentId, studentId, date, startTime, endTime, purpose || 'Equipment reservation']
    );
    const result = await client.query(joins('WHERE b.id = $1'), [inserted.rows[0].id]);
    await client.query('COMMIT');
    return { booking: result.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function list({ userId, isAdmin, adminId, status }) {
  const conditions = [];
  const values = [];
  if (isAdmin) {
    values.push(adminId);
    conditions.push(`s.admin_id = $${values.length}`);
  } else {
    values.push(userId);
    conditions.push(`b.student_id = $${values.length}`);
  }
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    values.push(status);
    conditions.push(`b.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(`${joins(where)} ORDER BY b.created_at DESC`, values);
  return rows;
}

async function review({ bookingId, status, reviewerId }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT b.id, b.equipment_id, b.booking_date, b.start_time, b.end_time, b.status,
              s.admin_id AS student_admin_id
       FROM bookings b
       INNER JOIN users s ON s.id = b.student_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );
    const booking = found.rows[0];
    if (!booking || booking.student_admin_id !== reviewerId) {
      await client.query('ROLLBACK');
      return { missing: true };
    }
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');
      return { notPending: true };
    }
    if (status === 'approved') {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [booking.equipment_id]);
      const conflict = await client.query(
        `SELECT 1 FROM bookings
         WHERE equipment_id = $1 AND booking_date = $2 AND id <> $3
           AND status = 'approved'
           AND start_time < $5::time AND end_time > $4::time
         LIMIT 1`,
        [booking.equipment_id, booking.booking_date, booking.id, booking.start_time, booking.end_time]
      );
      if (conflict.rowCount) {
        await client.query('ROLLBACK');
        return { conflict: true };
      }
    }
    await client.query(
      `UPDATE bookings SET status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [bookingId, status, reviewerId]
    );
    const result = await client.query(joins('WHERE b.id = $1'), [bookingId]);
    await client.query('COMMIT');
    return { booking: result.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cancel({ bookingId, userId, isAdmin }) {
  const { rows } = await db.query(
    `UPDATE bookings
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1
       AND status IN ('pending', 'approved')
       AND (
         (NOT $3::boolean AND student_id = $2)
         OR ($3::boolean AND EXISTS (
           SELECT 1 FROM users s WHERE s.id = bookings.student_id AND s.admin_id = $2
         ))
       )
     RETURNING id`,
    [bookingId, userId, isAdmin]
  );
  if (!rows[0]) {
    const { rows: existing } = await db.query(
      `SELECT status FROM bookings
       WHERE id = $1
         AND (
           (NOT $3::boolean AND student_id = $2)
           OR ($3::boolean AND EXISTS (
             SELECT 1 FROM users s WHERE s.id = bookings.student_id AND s.admin_id = $2
           ))
         )`,
      [bookingId, userId, isAdmin]
    );
    if (!existing[0]) return { missing: true };
    return { notCancellable: true };
  }
  const result = await db.query(joins('WHERE b.id = $1'), [bookingId]);
  return { booking: result.rows[0] };
}

module.exports = { create, list, review, cancel };
