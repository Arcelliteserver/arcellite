-- Arcellite Database Schema
-- PostgreSQL schema for user authentication and application data

-- Users table (single admin user)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  storage_path TEXT DEFAULT '~/arcellite-data',
  is_setup_complete BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(10),
  verification_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (with device tracking)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50) DEFAULT 'unknown',
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_current_host BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: add device columns if they don't exist on older databases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='device_name') THEN
    ALTER TABLE sessions ADD COLUMN device_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='device_type') THEN
    ALTER TABLE sessions ADD COLUMN device_type VARCHAR(50) DEFAULT 'unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='ip_address') THEN
    ALTER TABLE sessions ADD COLUMN ip_address VARCHAR(45);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='user_agent') THEN
    ALTER TABLE sessions ADD COLUMN user_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='is_current_host') THEN
    ALTER TABLE sessions ADD COLUMN is_current_host BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Recent files tracking
CREATE TABLE IF NOT EXISTS recent_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  category VARCHAR(50),
  size_bytes BIGINT,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, file_path)
);

-- File metadata (favorites, tags, custom properties)
CREATE TABLE IF NOT EXISTS file_metadata (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  tags TEXT[], -- PostgreSQL array type
  custom_properties JSONB, -- JSON storage for flexible metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, file_path)
);

-- Connected apps & integrations
CREATE TABLE IF NOT EXISTS connected_apps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  app_type VARCHAR(50) NOT NULL, -- 'google_drive', 'onedrive', 'dropbox', etc.
  app_name VARCHAR(100),
  credentials_encrypted TEXT, -- Encrypted JSON of credentials
  config JSONB, -- App-specific configuration
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  preferences JSONB, -- Flexible JSON storage for all preferences
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'login', 'upload', 'delete', 'share', etc.
  details TEXT, -- Human-readable description
  resource_type VARCHAR(50), -- 'file', 'folder', 'setting', etc.
  resource_path TEXT,
  metadata JSONB, -- Additional context
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: add details column if it doesn't exist on older databases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_log' AND column_name='details') THEN
    ALTER TABLE activity_log ADD COLUMN details TEXT;
  END IF;
END $$;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
  category VARCHAR(50) DEFAULT 'system', -- 'system', 'security', 'storage', 'update'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_files_user ON recent_files(user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_metadata_user ON file_metadata(user_id, file_path);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- Family sharing / sub-accounts
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer',          -- 'viewer', 'editor', 'admin'
  storage_quota BIGINT DEFAULT 5368709120,    -- 5 GB default (bytes)
  storage_used BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',       -- 'pending', 'active', 'disabled'
  invite_token VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  notes TEXT,
  last_active TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_family_members_owner ON family_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_invite ON family_members(invite_token);

-- Migration: link accepted invites to a real user account
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='family_members' AND column_name='user_id'
  ) THEN
    ALTER TABLE family_members
      ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Plan & billing columns on users (migration: safe to run on existing DB)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_type') THEN
    ALTER TABLE users ADD COLUMN account_type VARCHAR(20) DEFAULT 'personal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plan_type') THEN
    ALTER TABLE users ADD COLUMN plan_type VARCHAR(20) DEFAULT 'free';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='billing_status') THEN
    ALTER TABLE users ADD COLUMN billing_status VARCHAR(20) DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plan_activated_at') THEN
    ALTER TABLE users ADD COLUMN plan_activated_at TIMESTAMP;
  END IF;
END $$;

-- Chat tables are managed in the arcellite_chat_history database (see server/routes/chat.routes.ts)

-- AI Task Automation
CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_execution_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  trigger_value JSONB,
  action_result JSONB,
  attempt_count INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_exec_logs_rule ON rule_execution_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_exec_logs_user ON rule_execution_logs(user_id, created_at DESC);

-- Downgrade enforcement columns (migration: safe to run on existing DB)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='enforcement_status') THEN
    ALTER TABLE automation_rules ADD COLUMN enforcement_status VARCHAR(50) DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='enforcement_status') THEN
    ALTER TABLE users ADD COLUMN enforcement_status VARCHAR(50) DEFAULT 'active';
  END IF;
END $$;
