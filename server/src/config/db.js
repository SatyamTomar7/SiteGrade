import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

let pool;

const isEnabled = (value) => ['1', 'true', 'yes', 'on', 'require'].includes(String(value).trim().toLowerCase());

const shouldUseSslMode = (value) => {
  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (['0', 'false', 'no', 'off', 'disable'].includes(normalized)) {
    return false;
  }

  return true;
};

const shouldUseSsl = (connectionString) => {
  if (process.env.DATABASE_SSL !== undefined) {
    return isEnabled(process.env.DATABASE_SSL);
  }

  if (process.env.PGSSLMODE !== undefined) {
    return shouldUseSslMode(process.env.PGSSLMODE);
  }

  try {
    const url = new URL(connectionString);
    const host = (url.hostname || '').toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1') {
      return false;
    }

    return true;
  } catch {
    return process.env.NODE_ENV === 'production';
  }
};

const bootstrapStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      refresh_token_version INTEGER NOT NULL DEFAULT 0,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      email_verification_otp_hash TEXT,
      email_verification_otp_expires_at TIMESTAMPTZ,
      password_reset_otp_hash TEXT,
      password_reset_otp_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      members JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS website_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      workspace_context JSONB NOT NULL DEFAULT '{"workspaceId":null,"workspaceName":""}'::jsonb,
      analysis_config JSONB NOT NULL DEFAULT '{"scanMode":"single","crawlMaxPages":1,"auditProfiles":["mobile"],"competitorUrls":[],"websiteType":"auto","enableFixMode":true}'::jsonb,
      schedule_context JSONB NOT NULL DEFAULT '{"scheduleId":null,"triggeredBy":"manual"}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      scores JSONB NOT NULL DEFAULT '{"performance":0,"seo":0,"accessibility":0,"security":0,"bestPractices":0}'::jsonb,
      overall_score INTEGER NOT NULL DEFAULT 0,
      ai_review TEXT NOT NULL DEFAULT '',
      ai_review_structured JSONB NOT NULL DEFAULT '{}'::jsonb,
      lighthouse_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      puppeteer_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      crawl_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      benchmark_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      field_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      site_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      fix_mode JSONB NOT NULL DEFAULT '{}'::jsonb,
      collaboration JSONB NOT NULL DEFAULT '{"comments":[],"tasks":[]}'::jsonb,
      tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
      error_message TEXT,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      public_share_token TEXT UNIQUE,
      shared_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS scan_schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      analysis_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      frequency TEXT NOT NULL DEFAULT 'weekly',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      next_run_at TIMESTAMPTZ NOT NULL,
      last_run_at TIMESTAMPTZ,
      last_report_id TEXT,
      last_status TEXT NOT NULL DEFAULT 'idle',
      delivery_channels JSONB NOT NULL DEFAULT '[{"type":"in_app","enabled":true,"target":""}]'::jsonb,
      last_alert_summary TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS deploy_hooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      analysis_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      token TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_workspaces_owner_created ON workspaces(owner_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reports_user_created ON website_reports(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reports_status_created ON website_reports(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reports_user_score_created ON website_reports(user_id, overall_score DESC, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reports_public_token ON website_reports(public_share_token)',
  'CREATE INDEX IF NOT EXISTS idx_schedules_user_created ON scan_schedules(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_schedules_active_next_run ON scan_schedules(active, next_run_at)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_deploy_hooks_user_created ON deploy_hooks(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_deploy_hooks_token ON deploy_hooks(token)'
];

export const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const useSsl = shouldUseSsl(connectionString);

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
};

export const query = async (text, params = []) => {
  return getPool().query(text, params);
};

export const connectDB = async () => {
  try {
    const db = getPool();
    await db.query('SELECT 1');

    for (const statement of bootstrapStatements) {
      await db.query(statement);
    }

    logger.info('PostgreSQL connected and schema verified');
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }
};
