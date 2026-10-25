const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'labvault',
        user: process.env.PGUSER || 'labvault_app',
        password: process.env.PGPASSWORD
      }
);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin', 'lab_incharge')),
      admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
      registration_code_hash CHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_email_format CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_code_hash CHAR(64);
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('student', 'admin', 'super_admin', 'lab_incharge'));
    CREATE INDEX IF NOT EXISTS users_admin_id_idx ON users (admin_id);

    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON departments (name);

    CREATE TABLE IF NOT EXISTS labs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      name VARCHAR(120) NOT NULL,
      incharge_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (department_id, name),
      UNIQUE (incharge_id)
    );

    CREATE INDEX IF NOT EXISTS labs_incharge_id_idx ON labs (incharge_id);

    CREATE TABLE IF NOT EXISTS equipment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      description VARCHAR(2000) NOT NULL DEFAULT '',
      category VARCHAR(80) NOT NULL,
      location VARCHAR(120) NOT NULL,
      image_url VARCHAR(2048) NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
      lab_id UUID REFERENCES labs(id) ON DELETE RESTRICT,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0);
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES labs(id) ON DELETE RESTRICT;
    ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_name_key;
    CREATE UNIQUE INDEX IF NOT EXISTS equipment_lab_name_key ON equipment (lab_id, name);

    CREATE INDEX IF NOT EXISTS equipment_category_available_idx
      ON equipment (category, available);

    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id UUID NOT NULL REFERENCES equipment(id),
      student_id UUID NOT NULL REFERENCES users(id),
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      purpose VARCHAR(1000) NOT NULL DEFAULT 'Equipment reservation',
      status VARCHAR(24) NOT NULL DEFAULT 'pending_mentor',
      mentor_reviewed_by UUID REFERENCES users(id),
      lab_decided_by UUID REFERENCES users(id),
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      returned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT bookings_valid_time CHECK (start_time < end_time)
    );

    ALTER TABLE bookings ALTER COLUMN status TYPE VARCHAR(24);
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    UPDATE bookings SET status = 'pending_mentor' WHERE status = 'pending';
    ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'pending_mentor';
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('pending_mentor', 'pending_lab', 'approved', 'rejected', 'cancelled'));
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mentor_reviewed_by UUID REFERENCES users(id);
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lab_decided_by UUID REFERENCES users(id);
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS bookings_equipment_overlap_idx
      ON bookings (equipment_id, booking_date, status, start_time, end_time);
    CREATE INDEX IF NOT EXISTS bookings_student_created_idx
      ON bookings (student_id, created_at DESC);
  `);
}

module.exports = { pool, query: (...args) => pool.query(...args), connect: () => pool.connect(), initializeDatabase };
