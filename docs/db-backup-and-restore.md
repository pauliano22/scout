# Database Backup & Point-in-Time Recovery

> **Status:** Active  
> **Schedule:** Daily at 04:00 UTC  
> **Retention:** 7 days  
> **Tool:** `scripts/backup-db.sh`

## Overview

Scout uses [Supabase](https://supabase.com) (PostgreSQL) as its production database.
This document describes the automated backup job and the procedure to restore
the database from a backup file or to a specific point in time.

---

## Backup Strategy

### Schedule

| Aspect        | Value              |
|---------------|--------------------|
| Frequency     | Daily              |
| Time          | 04:00 UTC          |
| Format        | pg_dump custom     |
| Compression   | Level 9 (maximum)  |
| Retention     | 7 days             |
| Storage       | `backups/postgres/` |

### What Gets Backed Up

A full logical dump of the entire database — all schemas, tables, indexes,
functions, triggers, and data — using `pg_dump` in **custom format** (`-Fc`).

Custom format is chosen because:

- **Compressed** — smaller on disk than plain SQL.
- **Restorable selectively** — you can restore a single table with `pg_restore -t tablename`.
- **Parallel restore** — can use multiple cores for faster recovery.
- **Preserves metadata** — retains object ownership and ACL information in the
  dump file (though the script strips local ownership/ACL with `--no-owner`
  and `--no-acl` since the Supabase-managed user is fixed).

### Retention Policy

Backups older than **7 days** are automatically removed on each new backup run.
This keeps storage bounded and ensures at least 7 recovery points are always
available.

---

## Running the Backup Manually

### Prerequisites

- `pg_dump` (>= 14) and `pg_restore` installed.
  Install via Homebrew: `brew install libpq && brew link --force libpq`
- A `DATABASE_URL` connection string.

### One-shot backup

```bash
# From repo root:
DATABASE_URL="postgresql://postgres:***@db.xxxxx.supabase.co:5432/postgres" \
  ./scripts/backup-db.sh
```

The script also reads `DATABASE_URL` from `apps/web/.env.local` if the env
variable is not set explicitly.

### Verify a backup

```bash
pg_restore --list backups/postgres/scout-db-20250623-040000.dump | head -20
```

---

## Restore Procedure

### Full Restore

To restore the entire database from a backup file:

```bash
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --verbose \
  backups/postgres/scout-db-YYYYMMDD-HHMMSS.dump
```

**Flags explained:**

| Flag          | Purpose                                 |
|---------------|-----------------------------------------|
| `--clean`     | DROP existing objects before restoring  |
| `--if-exists` | Suppress errors if object doesn't exist |
| `--no-owner`  | Skip ownership commands (Supabase-managed) |
| `--no-acl`    | Skip privilege commands (Supabase-managed) |

### Selective Restore (single table)

```bash
# List available tables in the backup:
pg_restore --list scout-db-YYYYMMDD-HHMMSS.dump | grep TABLE

# Restore a single table:
pg_restore \
  --dbname="$DATABASE_URL" \
  --table="profiles" \
  --data-only \
  --verbose \
  scout-db-YYYYMMDD-HHMMSS.dump
```

### Point-in-Time Recovery (PITR)

Supabase **Pro plan and above** includes Point-in-Time Recovery managed by the
Supabase platform. This is the preferred method for recovering from a recent
data-loss incident (e.g., accidental DELETE, bad migration).

**To perform PITR in Supabase:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Project → Database.
2. Click **"Create a restore"** in the **Backups** section.
3. Select the desired point in time (up to the PITR window, typically 7 days).
4. Supabase spins up a temporary database at that point.
5. Once the temporary database is ready, use `pg_dump` to extract the needed
   data and load it into your production database.

```bash
# After Supabase creates the PITR instance, extract specific data:
pg_dump \
  "postgresql://postgres:***@pitr-instance.supabase.co:5432/postgres" \
  --table="profiles" \
  --data-only \
  --file="restored-profiles.sql"

# Then apply it to production:
psql "$DATABASE_URL" -f restored-profiles.sql
```

> **Note:** If your Supabase plan does not include PITR, use the daily
> `pg_dump` custom-format backups instead — they contain the full database
> state as of the last backup run.

---

## Setting Up the Automated Schedule

### Option A: GitHub Actions (recommended)

Create `.github/workflows/db-backup.yml`:

```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 4 * * *'   # daily at 04:00 UTC
  workflow_dispatch:       # allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backup
        run: ./scripts/backup-db.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: scout-db-backup
          path: backups/postgres/
          retention-days: 7
```

### Option B: Cron (VPS / self-hosted)

```cron
# m h dom mon dow   command
  0 4 *   *   *    cd /home/user/scout && ./scripts/backup-db.sh
```

### Option C: launchd (macOS)

```xml
<!-- ~/Library/LaunchAgents/com.scout.db-backup.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scout.db-backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/q/Developer/scout/scripts/backup-db.sh</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DATABASE_URL</key>
        <string>postgresql://postgres:***@db.xxxxx.supabase.co:5432/postgres</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>4</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/q/Developer/scout/backups/postgres/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/q/Developer/scout/backups/postgres/launchd.err</string>
</dict>
</plist>
```

---

## Emergency Recovery Playbook

### Scenario: Accidental DELETE of user data

1. **Immediately** identify the approximate time of the delete.
2. If within the Supabase PITR window (< 7 days on Pro plan):
   - Create a PITR restore in the Supabase Dashboard.
   - Extract only the affected table(s) with `pg_dump`.
   - Re-insert into production.
3. If outside the PITR window:
   - Find the most recent daily backup before the deletion.
   - Restore it to a temporary database.
   - Extract the lost rows and apply them to production.

### Scenario: Corrupt migration

1. **Do not** run further migrations.
2. Restore the database from the most recent daily backup before the migration:
   ```bash
   pg_restore \
     --dbname="$DATABASE_URL" \
     --clean \
     --if-exists \
     --no-owner \
     --no-acl \
     backups/postgres/scout-db-BEFORE-MIGRATION.dump
   ```
3. Review and fix the migration, then re-apply.

---

## Monitoring & Alerts

- Check the backup log at `backups/postgres/backup.log` after each run.
- Monitor that the backup file is non-empty and grows roughly as expected.
- Set up a cron wrapper that emails on failure:
  ```bash
  ./scripts/backup-db.sh || echo "Backup failed!" | mail -s "Scout DB Backup Alert" admin@scout.app
  ```

---

## Restoring to Local Development Database

```bash
# Drop and recreate the local DB
dropdb scout_dev --if-exists
createdb scout_dev

# Restore from backup
pg_restore \
  --dbname="postgresql://localhost:5432/scout_dev" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backups/postgres/scout-db-YYYYMMDD-HHMMSS.dump

# Run any pending migrations
npm run dev:web
```
