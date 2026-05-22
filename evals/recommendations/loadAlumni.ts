// Loads apps/web/data/alumnidots.csv into Alumni-shaped rows for the eval.
//
// This is the same file imported into the live `alumni` table, so the eval pool
// matches production data. Enrichment fields absent from the CSV (work_history,
// bio, photo, education, skills) are left empty — faithful to the real rows,
// 85% of which also lack a company.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computePrestigeScore } from './prestige';

const CSV_PATH = join(__dirname, '../../apps/web/data/alumnidots.csv');

export interface EvalAlumni {
  id: string;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  sport: string | null;
  graduation_year: number | null;
  company: string | null;
  role: string | null;
  industry: string | null;
  location: string | null;
  prestige_score: number;
  is_public: boolean;
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields w/ commas + escaped quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length > 0) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function clean(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

let cached: EvalAlumni[] | null = null;

export function loadAlumni(): EvalAlumni[] {
  if (cached) return cached;
  const text = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(text);
  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const ci = {
    full_name: idx('full_name'),
    email: idx('email'),
    linkedin_url: idx('linkedin_url'),
    sport: idx('sport'),
    graduation_year: idx('graduation_year'),
    company: idx('company'),
    role: idx('role'),
    industry: idx('industry'),
    location: idx('location'),
  };

  cached = rows.slice(1).filter((r) => r.length > 1).map((r, i) => {
    const company = clean(r[ci.company]);
    const role = clean(r[ci.role]);
    const industry = clean(r[ci.industry]);
    const gy = clean(r[ci.graduation_year]);
    return {
      id: `csv_${i}`,
      full_name: clean(r[ci.full_name]) ?? 'Scout Alumnus',
      email: clean(r[ci.email]),
      linkedin_url: clean(r[ci.linkedin_url]),
      sport: clean(r[ci.sport]),
      graduation_year: gy ? parseInt(gy, 10) : null,
      company,
      role,
      industry,
      location: clean(r[ci.location]),
      prestige_score: computePrestigeScore(company, industry, role),
      is_public: true,
    };
  });
  return cached;
}
