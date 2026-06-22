#!/usr/bin/env python3
"""
Hermes dashboard data bridge.
Reads state.db, agent logs, sessions, and cron data.
Outputs JSON for the Next.js API route.
"""
import json
import os
import sqlite3
import glob
from pathlib import Path
from datetime import datetime

HOME = Path.home()
HERMES = HOME / ".hermes"
DB_PATH = HERMES / "state.db"
BG_JOBS = HERMES / "bg-jobs"
SESSIONS_DIR = HERMES / "sessions"

def read_sessions():
    """Read recent user prompt sessions from state.db."""
    if not DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        # Get recent sessions with user messages
        rows = conn.execute("""
            SELECT s.id as session_id, s.source, s.title, s.started_at, s.ended_at,
                   s.message_count, s.input_tokens, s.output_tokens,
                   s.estimated_cost_usd, s.model,
                   m.content as last_user_prompt
            FROM sessions s
            LEFT JOIN messages m ON m.session_id = s.id 
                AND m.role = 'user'
                AND m.id = (
                    SELECT MAX(m2.id) FROM messages m2 
                    WHERE m2.session_id = s.id AND m2.role = 'user'
                )
            ORDER BY s.started_at DESC
            LIMIT 20
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        return [{"error": str(e)}]

def read_agent_logs():
    """Read recent agent log entries from bg-jobs."""
    results = {}
    if not BG_JOBS.exists():
        return {}
    for f in sorted(BG_JOBS.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True):
        name = f.stem  # filename without .log
        try:
            content = f.read_text(errors="replace")
            lines = content.strip().split("\n")
            # Get first 3 lines (header) and last 20 lines (summary)
            header = lines[:5] if len(lines) > 5 else lines
            tail = lines[-30:] if len(lines) > 30 else lines
            total_lines = len(lines)
            results[name] = {
                "name": name,
                "total_lines": total_lines,
                "header": header,
                "tail": tail,
                "size_bytes": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            }
        except Exception as e:
            results[name] = {"name": name, "error": str(e)}
    return results

def read_sessions_dir():
    """Read session request dump files."""
    results = []
    if not SESSIONS_DIR.exists():
        return []
    for f in sorted(SESSIONS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:15]:
        try:
            data = json.loads(f.read_text(errors="replace"))
            # Extract key fields if it's a request dump
            prompt = data.get("prompt", data.get("messages", [{}])[0].get("content", "")) if isinstance(data, dict) else ""
            if isinstance(prompt, str):
                prompt = prompt[:200]
            results.append({
                "name": f.stem,
                "prompt": prompt,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                "size_bytes": f.stat().st_size,
            })
        except:
            results.append({
                "name": f.stem,
                "error": "parse error",
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    return results

def read_cron_data():
    """Read cron job data from state.db."""
    if not DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM cron_jobs 
            ORDER BY created_at DESC 
            LIMIT 20
        """).fetchall() if "cron_jobs" in [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()] else []
        conn.close()
        return [dict(r) for r in rows]
    except:
        return []

def main():
    data = {
        "sessions": read_sessions(),
        "agent_logs": read_agent_logs(),
        "session_dumps": read_sessions_dir(),
        "cron_data": read_cron_data(),
    }
    print(json.dumps(data, default=str))

if __name__ == "__main__":
    main()
