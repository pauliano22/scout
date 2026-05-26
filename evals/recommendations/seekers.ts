// 20 synthetic student-athlete seekers across diverse fields.
//
// The realism that matters: a user can only pick `industries` from the 13
// INTEREST_SUGGESTIONS (or skip the step). `picks` = what a real user in that
// field would realistically select. `expectedIndustries` = the DB `industry`
// values that are *actually* relevant to their field (used to score relevance,
// independent of what they were able to pick). When picks→DB mapping doesn't
// reach expectedIndustries — or picks is empty because nothing fit — that is the
// taxonomy gap the audit predicts.

import type { UserPreferences } from '../../apps/mobile/src/services/recommendationScoring';

export interface Seeker {
  id: string;
  field: string;
  /** Why this user picked what they picked (documents the taxonomy fit). */
  note: string;
  /** DB industry values genuinely relevant to this field (relevance target). */
  expectedIndustries: string[];
  /** Is this field finance? (control) */
  isFinance: boolean;
  prefs: UserPreferences;
}

function prefs(
  picks: string[],
  sport: string,
  roles: string[],
  locations: string[] = [],
): UserPreferences {
  return {
    industries: picks,
    sports: [sport],
    locations,
    roles,
    companies: [],
    priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
  };
}

export const SEEKERS: Seeker[] = [
  {
    id: 'medicine', field: 'Medicine', isFinance: false,
    note: "Picks 'Healthcare' — clean mapping to DB 'Healthcare'.",
    expectedIndustries: ['Healthcare'],
    prefs: prefs(['Healthcare'], 'Field Hockey', ['Physician', 'Resident', 'Medical'], ['Boston, Mass.']),
  },
  {
    id: 'law', field: 'Law', isFinance: false,
    note: "Picks 'Law' — clean mapping to DB 'Law'.",
    expectedIndustries: ['Law'],
    prefs: prefs(['Law'], 'Wrestling', ['Attorney', 'Associate', 'Counsel'], ['New York, N.Y.']),
  },
  {
    id: 'education', field: 'Education', isFinance: false,
    note: "Picks 'Education' — clean mapping to DB 'Education'.",
    expectedIndustries: ['Education'],
    prefs: prefs(['Education'], "Women's Rowing", ['Teacher', 'Professor', 'Educator']),
  },
  {
    id: 'art_design', field: 'Art / Design', isFinance: false,
    note: "No art/design option. User picks nearest 'Media & Entertainment'.",
    expectedIndustries: ['Media'],
    prefs: prefs(['Media & Entertainment'], "Women's Lacrosse", ['Designer', 'Creative', 'Artist']),
  },
  {
    id: 'nonprofit', field: 'Nonprofit', isFinance: false,
    note: "Picks 'Nonprofit / Social Impact' -> DB 'Nonprofit' (thin corpus).",
    expectedIndustries: ['Nonprofit'],
    prefs: prefs(['Nonprofit / Social Impact'], 'Rowing', ['Program', 'Coordinator', 'Director']),
  },
  {
    id: 'trades', field: 'Skilled Trades', isFinance: false,
    note: 'No trades option and nothing fits — user skips the industry step (empty).',
    expectedIndustries: ['Manufacturing'],
    prefs: prefs([], 'Sprint Football', ['Electrician', 'Technician', 'Foreman']),
  },
  {
    id: 'military', field: 'Military', isFinance: false,
    note: "No military option. User picks nearest 'Government / Policy' -> DB 'Government'.",
    expectedIndustries: ['Government'],
    prefs: prefs(['Government / Policy'], 'Football', ['Officer', 'Analyst', 'Veteran']),
  },
  {
    id: 'sports', field: 'Sports', isFinance: false,
    note: "Picks 'Sports & Athletics' -> DB 'Sports'.",
    expectedIndustries: ['Sports'],
    prefs: prefs(['Sports & Athletics'], 'Football', ['Coach', 'Scout', 'Operations']),
  },
  {
    id: 'entertainment', field: 'Entertainment', isFinance: false,
    note: "Picks 'Media & Entertainment' -> DB 'Media'.",
    expectedIndustries: ['Media'],
    prefs: prefs(['Media & Entertainment'], 'Baseball', ['Producer', 'Talent', 'Manager'], ['Los Angeles, Calif.']),
  },
  {
    id: 'journalism', field: 'Journalism', isFinance: false,
    note: "No journalism option. User picks 'Media & Entertainment' -> DB 'Media'.",
    expectedIndustries: ['Media'],
    prefs: prefs(['Media & Entertainment'], "Women's Track And Field", ['Reporter', 'Editor', 'Writer']),
  },
  {
    id: 'engineering', field: 'Engineering', isFinance: false,
    note: "Picks 'Engineering' (chip added; maps to Technology + Software + Manufacturing in DB).",
    expectedIndustries: ['Technology', 'Manufacturing'],
    prefs: prefs(['Engineering'], 'Men’s Track And Field', ['Engineer', 'Developer', 'Scientist']),
  },
  {
    id: 'academia', field: 'Academia', isFinance: false,
    note: "Picks 'Education' -> DB 'Education'.",
    expectedIndustries: ['Education'],
    prefs: prefs(['Education'], 'Women’s Cross Country', ['Professor', 'Researcher', 'PhD']),
  },
  {
    id: 'hospitality', field: 'Hospitality', isFinance: false,
    note: 'No hospitality option and nothing fits — user skips (empty industries).',
    expectedIndustries: [],
    prefs: prefs([], 'Baseball', ['Hotel', 'Hospitality', 'Manager']),
  },
  {
    id: 'agriculture', field: 'Agriculture', isFinance: false,
    note: 'No agriculture option and nothing fits — user skips (empty industries).',
    expectedIndustries: [],
    prefs: prefs([], 'Wrestling', ['Farm', 'Agriculture', 'Agronomist']),
  },
  {
    id: 'social_work', field: 'Social Work', isFinance: false,
    note: "Picks 'Nonprofit / Social Impact' -> DB 'Nonprofit' (thin corpus).",
    expectedIndustries: ['Nonprofit'],
    prefs: prefs(['Nonprofit / Social Impact'], 'Field Hockey', ['Social Worker', 'Caseworker', 'Counselor']),
  },
  {
    id: 'ministry', field: 'Ministry', isFinance: false,
    note: "No ministry option. User picks nearest 'Nonprofit / Social Impact' -> DB 'Nonprofit'.",
    expectedIndustries: ['Nonprofit'],
    prefs: prefs(['Nonprofit / Social Impact'], 'Men’s Lacrosse', ['Pastor', 'Minister', 'Chaplain']),
  },
  {
    id: 'real_estate', field: 'Real Estate', isFinance: false,
    note: "Picks 'Real Estate' -> DB 'Real Estate'.",
    expectedIndustries: ['Real Estate'],
    prefs: prefs(['Real Estate'], 'Rowing', ['Broker', 'Realtor', 'Agent']),
  },
  {
    id: 'manufacturing', field: 'Manufacturing', isFinance: false,
    note: "Picks 'Manufacturing' (chip added) -> DB 'Manufacturing'.",
    expectedIndustries: ['Manufacturing'],
    prefs: prefs(['Manufacturing'], 'Football', ['Manufacturing', 'Plant', 'Production']),
  },
  {
    id: 'government', field: 'Government', isFinance: false,
    note: "Picks 'Government / Policy' -> DB 'Government' (via alias).",
    expectedIndustries: ['Government'],
    prefs: prefs(['Government / Policy'], "Women's Track And Field", ['Policy', 'Analyst', 'Government'], ['Washington, D.C.']),
  },
  {
    id: 'finance', field: 'Finance (control)', isFinance: true,
    note: "Picks 'Finance' -> DB 'Finance'. Control: must not regress.",
    expectedIndustries: ['Finance'],
    prefs: prefs(['Finance'], 'Football', ['Analyst', 'Associate', 'Investment'], ['New York, N.Y.']),
  },
];
