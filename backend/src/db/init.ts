import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const bootstrapSql = `
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'worker';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_category AS ENUM ('garbage', 'pothole', 'water_leakage', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_priority AS ENUM ('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('pending', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  points_balance INTEGER NOT NULL DEFAULT 0,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category issue_category NOT NULL,
  priority issue_priority NOT NULL,
  status issue_status NOT NULL DEFAULT 'pending',
  image_url TEXT NOT NULL,
  resolved_image_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  assigned_to TEXT,
  assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assignment_start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  resolution_verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_verified_by_user_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  verification_summary TEXT,
  authenticity_score DOUBLE PRECISION,
  authenticity_confidence DOUBLE PRECISION,
  authenticity_explanation TEXT,
  coverage_percentage DOUBLE PRECISION,
  density_score DOUBLE PRECISION,
  detected BOOLEAN,
  explanation TEXT,
  is_real_image BOOLEAN,
  image_subject TEXT,
  location_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image_source TEXT NOT NULL DEFAULT 'gallery',
  captured_latitude DOUBLE PRECISION,
  captured_longitude DOUBLE PRECISION,
  reward_points INTEGER NOT NULL DEFAULT 0,
  worker_points INTEGER NOT NULL DEFAULT 0,
  worker_bonus_points INTEGER NOT NULL DEFAULT 0,
  confidence_score DOUBLE PRECISION,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignment_start_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignment_response_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignment_responded_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_verified_by_user_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verification_summary TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS authenticity_score DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS authenticity_confidence DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS authenticity_explanation TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS coverage_percentage DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS density_score DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS detected BOOLEAN;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_real_image BOOLEAN;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS image_subject TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS location_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS image_source TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS captured_latitude DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS captured_longitude DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS reward_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS worker_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS worker_bonus_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS upvotes (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(issue_id, user_id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  aadhaar_number TEXT UNIQUE,
  role_title TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  work_latitude DOUBLE PRECISION,
  work_longitude DOUBLE PRECISION,
  work_address TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  invited_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS invited_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS role_title TEXT;
ALTER TABLE worker_profiles ALTER COLUMN aadhaar_number DROP NOT NULL;
UPDATE worker_profiles
SET is_verified = TRUE,
    verified_at = COALESCE(verified_at, NOW())
WHERE onboarding_completed = TRUE
  AND is_verified = FALSE;

CREATE TABLE IF NOT EXISTS worker_reports (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  status TEXT NOT NULL,
  image_url TEXT,
  image_verification_status TEXT NOT NULL DEFAULT 'pending',
  image_verification_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_upvotes_issue_id ON upvotes(issue_id);
CREATE INDEX IF NOT EXISTS idx_timeline_issue_id ON timeline_events(issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_worker_id ON issues(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_reports_issue_id ON worker_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_worker_reports_worker_id ON worker_reports(worker_id);
`;

export async function initializeDatabase() {
  await pool.query(bootstrapSql);
  await ensureSeedAdmin();
}

async function ensureSeedAdmin() {
  if (!env.adminEmail || !env.adminPassword) {
    return;
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [
    env.adminEmail.toLowerCase(),
  ]);

  if (existing.rowCount && existing.rowCount > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')`,
    [env.adminName, env.adminEmail.toLowerCase(), passwordHash],
  );

  logger.info({ email: env.adminEmail }, "Seed admin created");
}
