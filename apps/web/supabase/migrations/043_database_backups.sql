-- IDEA 55: Database Backup Automation
-- Creates backup_files table for storing JSON snapshots of key tables

CREATE TABLE IF NOT EXISTS backup_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  data            JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for chronological queries and cleanup
CREATE INDEX IF NOT EXISTS idx_backup_files_created_at ON backup_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_files_table_name  ON backup_files (table_name);

-- Auto-cleanup: delete backups older than 7 days on every insert
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM backup_files
  WHERE created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_old_backups ON backup_files;
CREATE TRIGGER trigger_cleanup_old_backups
  AFTER INSERT ON backup_files
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_backups();

ALTER TABLE backup_files ENABLE ROW LEVEL SECURITY;

-- Only service role (internal cron/API) can read/write backup_files
CREATE POLICY "Service role can read backup_files"
  ON backup_files FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert backup_files"
  ON backup_files FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete backup_files"
  ON backup_files FOR DELETE
  USING (auth.role() = 'service_role');
