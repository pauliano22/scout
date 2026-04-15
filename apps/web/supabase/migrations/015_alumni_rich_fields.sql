-- Add rich career fields to alumni table
-- work_history, skills, education: structured JSON from LinkedIn enrichment
-- display_headline: human-readable "Role at Company" string
-- path_summary_stub: career path summary, e.g. "Cornell | Goldman → Google → Startup"
-- current_status_type: data confidence level (current, likely_current, last_known, unknown)

alter table alumni
  add column if not exists work_history      jsonb    default null,
  add column if not exists skills            jsonb    default null,
  add column if not exists education         jsonb    default null,
  add column if not exists display_headline  text     default null,
  add column if not exists path_summary_stub text     default null,
  add column if not exists current_status_type text   default null;

-- Index display_headline for search
create index if not exists alumni_display_headline_idx
  on alumni using gin(to_tsvector('english', coalesce(display_headline, '')));

-- Index work_history + skills as JSONB for future filtering
create index if not exists alumni_work_history_idx on alumni using gin(work_history);
create index if not exists alumni_skills_idx       on alumni using gin(skills);
