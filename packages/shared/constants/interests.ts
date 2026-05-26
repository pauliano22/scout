/**
 * Canonical interest taxonomy for Scout's preference + recommendation system.
 *
 * INTEREST_SUGGESTIONS — what users see and save (onboarding, YouScreen).
 * INTEREST_ALIASES     — scoring: maps a saved interest to DB industry values
 *                        that count as a match. Covers old exact-match values
 *                        so existing prefs continue to work.
 * INTEREST_DB_INDUSTRIES — query: maps a saved interest to exact DB industry
 *                          values for the .in() filter in fetchRecommendations.
 */

export const INTEREST_SUGGESTIONS: string[] = [
  'Finance',
  'Technology',
  'Engineering',
  'Consulting',
  'Healthcare',
  'Law',
  'Government / Policy',
  'Nonprofit / Social Impact',
  'Media & Entertainment',
  'Sports & Athletics',
  'Education',
  'Real Estate',
  'Manufacturing',
  'Private Equity / Venture Capital',
  'Marketing',
];

export const INTEREST_ALIASES: Record<string, string[]> = {
  // Primary suggestions
  'Finance': ['Finance'],
  'Technology': ['Technology', 'Software'],
  'Engineering': ['Engineering', 'Technology', 'Software', 'Manufacturing'],
  'Consulting': ['Consulting'],
  'Healthcare': ['Healthcare'],
  'Law': ['Law'],
  'Government / Policy': [
    'Government', 'Government / Policy', 'Policy', 'Public Policy',
    'Public Administration', 'Government & Policy', 'Government & Public Policy',
  ],
  'Nonprofit / Social Impact': [
    'Nonprofit', 'Non-profit', 'Non Profit', 'Social Impact', 'NGO',
  ],
  'Media & Entertainment': ['Media', 'Entertainment', 'Media & Entertainment'],
  'Sports & Athletics': ['Sports', 'Athletics', 'Sports & Athletics'],
  'Education': ['Education'],
  'Real Estate': ['Real Estate'],
  'Manufacturing': ['Manufacturing'],
  'Private Equity / Venture Capital': [
    'Finance', 'Private Equity', 'Venture Capital', 'Private Equity / Venture Capital',
  ],
  'Marketing': ['Marketing', 'Advertising', 'Media'],
  // Legacy: raw DB values users may have saved before this taxonomy
  'Government': ['Government'],
  'Nonprofit': ['Nonprofit'],
  'Media': ['Media'],
  'Sports': ['Sports'],
  'Private Equity': ['Finance', 'Private Equity'],
  'Other': [],
};

export const INTEREST_DB_INDUSTRIES: Record<string, string[]> = {
  'Finance': ['Finance'],
  'Technology': ['Technology', 'Software'],
  'Engineering': ['Technology', 'Software', 'Manufacturing'],
  'Consulting': ['Consulting'],
  'Healthcare': ['Healthcare'],
  'Law': ['Law'],
  'Government / Policy': ['Government'],
  'Nonprofit / Social Impact': ['Nonprofit'],
  'Media & Entertainment': ['Media'],
  'Sports & Athletics': ['Sports'],
  'Education': ['Education'],
  'Real Estate': ['Real Estate'],
  'Manufacturing': ['Manufacturing'],
  'Private Equity / Venture Capital': ['Finance'],
  'Marketing': ['Media'],
  // Legacy
  'Government': ['Government'],
  'Nonprofit': ['Nonprofit'],
  'Media': ['Media'],
  'Sports': ['Sports'],
  'Private Equity': ['Finance'],
  'Other': [],
};
