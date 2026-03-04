import requests
import time
import re
from supabase import create_client

# ==========================================
# CONFIGURATION
# ==========================================

# Serper.dev API Key
SERPER_API_KEY = "cf407b7c1990467853c02e0bce31778b6828f37d"

# Supabase credentials
SUPABASE_URL = "https://recftqpdnbdandloykms.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlY2Z0cXBkbmJkYW5kbG95a21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYwODU2OCwiZXhwIjoyMDgwMTg0NTY4fQ.p5Hs6kriDGTUoP73WMWmkmORMEhxf1qd0H6yxS9RmFY"

DELAY_BETWEEN_CALLS = 0.5

# ==========================================
# INDUSTRY MAPPING
# ==========================================

# Map common companies to industries
COMPANY_TO_INDUSTRY = {
    # Finance
    'goldman sachs': 'Finance',
    'morgan stanley': 'Finance',
    'jpmorgan': 'Finance',
    'jp morgan': 'Finance',
    'blackstone': 'Finance',
    'blackrock': 'Finance',
    'citadel': 'Finance',
    'jane street': 'Finance',
    'two sigma': 'Finance',
    'bank of america': 'Finance',
    'citi': 'Finance',
    'citibank': 'Finance',
    'barclays': 'Finance',
    'credit suisse': 'Finance',
    'ubs': 'Finance',
    'deutsche bank': 'Finance',
    'hsbc': 'Finance',
    'wells fargo': 'Finance',
    'fidelity': 'Finance',
    'vanguard': 'Finance',
    'bridgewater': 'Finance',
    'point72': 'Finance',
    'capital one': 'Finance',
    'lazard': 'Finance',
    'evercore': 'Finance',
    'centerview': 'Finance',
    'moelis': 'Finance',
    'rothschild': 'Finance',
    'guggenheim': 'Finance',
    'pimco': 'Finance',
    'kkr': 'Finance',
    'carlyle': 'Finance',
    'apollo': 'Finance',
    'tpg': 'Finance',
    'warburg': 'Finance',
    'general atlantic': 'Finance',
    'silver lake': 'Finance',
    'hellman': 'Finance',
    'bain capital': 'Finance',
    'advent': 'Finance',
    'vista equity': 'Finance',
    'thoma bravo': 'Finance',
    
    # Consulting
    'mckinsey': 'Consulting',
    'bain & company': 'Consulting',
    'bain and company': 'Consulting',
    'bcg': 'Consulting',
    'boston consulting': 'Consulting',
    'deloitte': 'Consulting',
    'pwc': 'Consulting',
    'kpmg': 'Consulting',
    'ernst & young': 'Consulting',
    'ey ': 'Consulting',
    'accenture': 'Consulting',
    'booz allen': 'Consulting',
    'oliver wyman': 'Consulting',
    'strategy&': 'Consulting',
    'parthenon': 'Consulting',
    'lek consulting': 'Consulting',
    'altman solon': 'Consulting',
    'alvarez': 'Consulting',
    'huron': 'Consulting',
    
    # Technology
    'google': 'Technology',
    'meta': 'Technology',
    'facebook': 'Technology',
    'amazon': 'Technology',
    'apple': 'Technology',
    'microsoft': 'Technology',
    'netflix': 'Technology',
    'uber': 'Technology',
    'lyft': 'Technology',
    'airbnb': 'Technology',
    'stripe': 'Technology',
    'openai': 'Technology',
    'anthropic': 'Technology',
    'nvidia': 'Technology',
    'salesforce': 'Technology',
    'oracle': 'Technology',
    'ibm': 'Technology',
    'intel': 'Technology',
    'cisco': 'Technology',
    'adobe': 'Technology',
    'palantir': 'Technology',
    'databricks': 'Technology',
    'snowflake': 'Technology',
    'doordash': 'Technology',
    'instacart': 'Technology',
    'robinhood': 'Technology',
    'coinbase': 'Technology',
    'plaid': 'Technology',
    'figma': 'Technology',
    'notion': 'Technology',
    'slack': 'Technology',
    'zoom': 'Technology',
    'dropbox': 'Technology',
    'spotify': 'Technology',
    'twitter': 'Technology',
    'linkedin': 'Technology',
    'snap': 'Technology',
    'snapchat': 'Technology',
    'pinterest': 'Technology',
    'reddit': 'Technology',
    'tiktok': 'Technology',
    'bytedance': 'Technology',
    'samsung': 'Technology',
    'sony': 'Technology',
    'software': 'Technology',
    'engineer': 'Technology',
    'developer': 'Technology',
    
    # Healthcare
    'pfizer': 'Healthcare',
    'johnson & johnson': 'Healthcare',
    'merck': 'Healthcare',
    'unitedhealth': 'Healthcare',
    'cvs': 'Healthcare',
    'hospital': 'Healthcare',
    'medical': 'Healthcare',
    'healthcare': 'Healthcare',
    'health system': 'Healthcare',
    'physician': 'Healthcare',
    'doctor': 'Healthcare',
    'nurse': 'Healthcare',
    'pharma': 'Healthcare',
    'biotech': 'Healthcare',
    'abbvie': 'Healthcare',
    'amgen': 'Healthcare',
    'gilead': 'Healthcare',
    'regeneron': 'Healthcare',
    'moderna': 'Healthcare',
    'biogen': 'Healthcare',
    
    # Law
    'law firm': 'Law',
    'legal': 'Law',
    'attorney': 'Law',
    'lawyer': 'Law',
    ' llp': 'Law',
    'skadden': 'Law',
    'sullivan & cromwell': 'Law',
    'cravath': 'Law',
    'wachtell': 'Law',
    'kirkland': 'Law',
    'latham': 'Law',
    'davis polk': 'Law',
    'simpson thacher': 'Law',
    'paul weiss': 'Law',
    'cleary gottlieb': 'Law',
    'weil gotshal': 'Law',
    'gibson dunn': 'Law',
    'sidley': 'Law',
    'jones day': 'Law',
    'white & case': 'Law',
    'wilmerhale': 'Law',
    'debevoise': 'Law',
    'covington': 'Law',
    
    # Media & Sports
    'disney': 'Media',
    'warner': 'Media',
    'nbc': 'Media',
    'cbs': 'Media',
    'espn': 'Media',
    'fox sports': 'Media',
    'nfl': 'Media',
    'nba': 'Media',
    'mlb': 'Media',
    'nhl': 'Media',
    'mls': 'Media',
    'sports': 'Media',
    'athletic': 'Media',
    'coach': 'Media',
    'journalist': 'Media',
    'reporter': 'Media',
    'news': 'Media',
    'media': 'Media',
    'entertainment': 'Media',
    'paramount': 'Media',
    'comcast': 'Media',
    'viacom': 'Media',
}

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def search_linkedin(name, sport=None, loose=False):
    """
    Searches Serper.dev for a person's LinkedIn profile.
    loose=True uses a broader query (name + Cornell only, no sport).
    Returns dict with linkedin_url, role, company, location, industry.
    """
    if loose or not sport:
        query = f'"{name}" Cornell site:linkedin.com/in'
    else:
        query = f'"{name}" Cornell {sport} site:linkedin.com/in'

    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    payload = {'q': query, 'num': 3}

    try:
        response = requests.post(
            'https://google.serper.dev/search',
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return parse_search_results(response.json(), name)
    except Exception as e:
        safe_err = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"   Error searching for {name.encode('ascii','replace').decode('ascii')}: {safe_err}")
        return None


def parse_search_results(data, name):
    """
    Parses Serper search results to extract LinkedIn info.
    """
    organic = data.get('organic', [])
    
    if not organic:
        return None
    
    # Find the best LinkedIn result
    for result in organic:
        link = result.get('link', '')
        
        # Make sure it's a LinkedIn profile URL
        if 'linkedin.com/in/' not in link:
            continue
        
        title = result.get('title', '')
        snippet = result.get('snippet', '')
        
        # Extract info from title (usually "Name - Role at Company")
        role, company = extract_role_company(title, name)
        
        # Try to get location from snippet
        location = extract_location(snippet)
        
        # Determine industry from company
        industry = determine_industry(company, title, snippet)
        
        return {
            'linkedin_url': link,
            'role': role,
            'company': company,
            'location': location,
            'industry': industry
        }
    
    return None


def extract_role_company(title, name):
    """
    Extracts role and company from LinkedIn title.
    Title format is usually: "Name - Role at Company | LinkedIn"
    """
    role = None
    company = None
    
    # Remove " | LinkedIn" suffix
    title = re.sub(r'\s*\|\s*LinkedIn.*$', '', title, flags=re.IGNORECASE)
    
    # Remove the person's name from the beginning
    name_parts = name.lower().split()
    title_lower = title.lower()
    
    # Try to find where the name ends and title begins
    if ' - ' in title:
        parts = title.split(' - ', 1)
        if len(parts) > 1:
            role_company = parts[1]
            
            # Split by " at " or " @ "
            if ' at ' in role_company.lower():
                role_parts = re.split(r'\s+at\s+', role_company, flags=re.IGNORECASE)
                role = role_parts[0].strip()
                if len(role_parts) > 1:
                    company = role_parts[1].strip()
            elif ' @ ' in role_company:
                role_parts = role_company.split(' @ ')
                role = role_parts[0].strip()
                if len(role_parts) > 1:
                    company = role_parts[1].strip()
            else:
                # Maybe just role, no company
                role = role_company.strip()
    
    # Clean up
    if role and len(role) > 100:
        role = role[:100]
    if company and len(company) > 100:
        company = company[:100]
    
    return role, company


def extract_location(snippet):
    """
    Tries to extract location from the snippet.
    """
    # Common location patterns
    location_patterns = [
        r'((?:Greater\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*,\s*[A-Z]{2})\s+',  # City, ST
        r'(New York|San Francisco|Los Angeles|Chicago|Boston|Seattle|Austin|Denver|Miami|Atlanta)',
    ]
    
    for pattern in location_patterns:
        match = re.search(pattern, snippet)
        if match:
            return match.group(1).strip()
    
    return None


def determine_industry(company, title, snippet):
    """
    Determines industry based on company name and context.
    """
    if not company:
        text = f"{title} {snippet}".lower()
    else:
        text = company.lower()
    
    for keyword, industry in COMPANY_TO_INDUSTRY.items():
        if keyword in text:
            return industry
    
    return None


# ==========================================
# MAIN EXECUTION
# ==========================================

def run_pass(supabase, alumni, loose, pass_name):
    """Search a list of alumni and update DB. Returns (found, not_found, errors)."""
    found = not_found = errors = 0
    start = time.time()

    for i, person in enumerate(alumni):
        name = person['full_name']
        sport = person['sport']
        elapsed = time.time() - start
        rate = (i + 1) / elapsed if elapsed > 0 else 1
        eta = (len(alumni) - i - 1) / rate

        safe_name = name.encode('ascii', 'replace').decode('ascii')
        print(f"[{pass_name} {i+1}/{len(alumni)}] {safe_name} ", end="", flush=True)

        try:
            result = search_linkedin(name, sport, loose=loose)
        except Exception:
            result = None

        if result and result.get('linkedin_url'):
            role = (result.get('role') or '')[:30].encode('ascii', 'replace').decode('ascii')
            company = (result.get('company') or '')[:20].encode('ascii', 'replace').decode('ascii')
            print(f"-> {role} @ {company}")
            update = {k: result[k] for k in ('linkedin_url', 'role', 'company', 'industry', 'location') if result.get(k)}
            try:
                supabase.table('alumni').update(update).eq('id', person['id']).execute()
                found += 1
            except Exception as e:
                print(f"  DB error: {e}")
                errors += 1
        else:
            print("-> Not found")
            try:
                supabase.table('alumni').update({'linkedin_url': ''}).eq('id', person['id']).execute()
                not_found += 1
            except Exception:
                errors += 1

        if (i + 1) % 100 == 0:
            print(f"\n--- {i+1}/{len(alumni)} | Found: {found} | Not found: {not_found} | ETA: {eta/60:.1f} min ---\n")

        time.sleep(DELAY_BETWEEN_CALLS)

    return found, not_found, errors


def main():
    import sys
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    current_year = 2026

    # ── Pass 1: true NULLs — strict query (name + sport + Cornell) ──
    print("=" * 60)
    print("PASS 1: Never-searched alumni (true NULL linkedin_url)")
    print("=" * 60)
    res = supabase.table('alumni') \
        .select('id, full_name, sport, graduation_year') \
        .is_('linkedin_url', 'null') \
        .lte('graduation_year', current_year) \
        .order('graduation_year', desc=True) \
        .execute()
    pass1 = res.data
    print(f"Found {len(pass1)} alumni to search")

    # ── Pass 2: empty string — loose query (name + Cornell only) ──
    print("\n" + "=" * 60)
    print("PASS 2: Previously searched but not found — retrying with looser query")
    print("=" * 60)
    res2 = supabase.table('alumni') \
        .select('id, full_name, sport, graduation_year') \
        .eq('linkedin_url', '') \
        .lte('graduation_year', current_year) \
        .order('graduation_year', desc=True) \
        .execute()
    pass2 = res2.data
    print(f"Found {len(pass2)} alumni to retry")

    total = len(pass1) + len(pass2)
    est = (total * DELAY_BETWEEN_CALLS) / 60
    print(f"\nTotal to search: {total:,} (~{est:.0f} min / {est/60:.1f} hrs)")

    if '--yes' not in sys.argv:
        confirm = input("\nType 'yes' to start: ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            return

    f1 = nf1 = e1 = 0
    if pass1:
        f1, nf1, e1 = run_pass(supabase, pass1, loose=False, pass_name="P1")

    f2 = nf2 = e2 = 0
    if pass2:
        f2, nf2, e2 = run_pass(supabase, pass2, loose=True, pass_name="P2")

    # Final counts
    real = supabase.table('alumni').select('id', count='exact') \
        .not_.is_('linkedin_url', 'null').neq('linkedin_url', '').execute().count

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)
    print(f"Pass 1 (strict):  {f1} found, {nf1} not found, {e1} errors")
    print(f"Pass 2 (loose):   {f2} found, {nf2} not found, {e2} errors")
    print(f"Total new URLs:   {f1 + f2}")
    print(f"Real LinkedIn URLs in DB now: {real:,}")


if __name__ == "__main__":
    main()