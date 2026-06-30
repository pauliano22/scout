CREATE TABLE IF NOT EXISTS password_reset_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action TEXT NOT NULL,                      -- 'request' (forgot-password) or 'reset' (reset-password)
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,        -- stores result, error messages, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_audit_email ON password_reset_audit_log (email);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_audit_created_at ON password_reset_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_audit_action ON password_reset_audit_log (action);
