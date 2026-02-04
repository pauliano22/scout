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

# Process ALL alumni (set high number)
BATCH_SIZE = 10000

# Delay between API calls (seconds) - be nice to the API
DELAY_BETWEEN_CALLS = 0.5  # Faster since we're paying

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

def search_linkedin(name, sport, graduation_year):
    """
    Searches Serper.dev for a person's LinkedIn profile.
    Returns dict with linkedin_url, role, company, location, industry
    """
    # Build search query
    query = f'"{name}" Cornell {sport} site:linkedin.com/in'
    
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'q': query,
        'num': 3  # Get top 3 results
    }
    
    try:
        response = requests.post(
            'https://google.serper.dev/search',
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse the results
        return parse_search_results(data, name)
        
    except Exception as e:
        print(f"   Error searching for {name}: {e}")
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

def main():
    print("="*60)
    print("LINKEDIN ENRICHMENT - FULL RUN")
    print("="*60)
    
    # Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("   Connected!")
    
    # Fetch un-enriched alumni (no linkedin_url yet)
    # Only get people who have graduated (not current students)
    # Prioritize recent graduates who are more likely to have LinkedIn
    print(f"\n2. Fetching un-enriched alumni...")
    
    current_year = 2025  # Current year - only enrich people who have graduated
    
    result = supabase.table('alumni') \
        .select('id, full_name, sport, graduation_year') \
        .is_('linkedin_url', 'null') \
        .lte('graduation_year', current_year) \
        .order('graduation_year', desc=True) \
        .limit(BATCH_SIZE) \
        .execute()
    
    alumni = result.data
    print(f"   Found {len(alumni)} alumni to enrich")
    
    if not alumni:
        print("\n   No more alumni to enrich! All done!")
        return
    
    # Estimate time
    est_minutes = (len(alumni) * DELAY_BETWEEN_CALLS) / 60
    print(f"   Estimated time: {est_minutes:.0f} minutes ({est_minutes/60:.1f} hours)")
    
    # Confirm before starting (skip if --yes flag passed)
    import sys
    if '--yes' not in sys.argv:
        confirm = input("\n   Type 'yes' to start enrichment: ")
        if confirm.lower() != 'yes':
            print("   Aborted.")
            return
    
    # Enrich each alumni
    print(f"\n3. Searching LinkedIn for each alumni...")
    print("-"*60)
    
    enriched_count = 0
    not_found_count = 0
    error_count = 0
    start_time = time.time()
    
    for i, person in enumerate(alumni):
        name = person['full_name']
        sport = person['sport']
        grad_year = person['graduation_year']
        
        # Progress indicator (every person)
        elapsed = time.time() - start_time
        rate = (i + 1) / elapsed if elapsed > 0 else 0
        remaining = (len(alumni) - i - 1) / rate if rate > 0 else 0
        
        # Handle Unicode characters safely for Windows console
        safe_name = name.encode('ascii', 'replace').decode('ascii')
        print(f"[{i+1}/{len(alumni)}] {safe_name} ({sport}, {grad_year}) ", end="")
        
        # Search for their LinkedIn
        result = search_linkedin(name, sport, grad_year)
        
        if result and result.get('linkedin_url'):
            role_display = result.get('role', 'N/A')[:30] if result.get('role') else 'N/A'
            company_display = result.get('company', 'N/A')[:20] if result.get('company') else 'N/A'
            print(f"-> {role_display} @ {company_display}")
            
            # Update Supabase
            update_data = {}
            if result.get('linkedin_url'):
                update_data['linkedin_url'] = result['linkedin_url']
            if result.get('role'):
                update_data['role'] = result['role']
            if result.get('company'):
                update_data['company'] = result['company']
            if result.get('industry'):
                update_data['industry'] = result['industry']
            if result.get('location'):
                update_data['location'] = result['location']
            
            if update_data:
                try:
                    supabase.table('alumni').update(update_data).eq('id', person['id']).execute()
                    enriched_count += 1
                except Exception as e:
                    print(f"      DB Error: {e}")
                    error_count += 1
        else:
            print("-> Not found")
            # Mark as searched so we don't keep trying
            try:
                supabase.table('alumni').update({'linkedin_url': ''}).eq('id', person['id']).execute()
                not_found_count += 1
            except Exception as e:
                error_count += 1
        
        # Progress update every 100 people
        if (i + 1) % 100 == 0:
            print(f"\n--- Progress: {i+1}/{len(alumni)} | Found: {enriched_count} | Not found: {not_found_count} | ETA: {remaining/60:.1f} min ---\n")
        
        # Delay between calls
        time.sleep(DELAY_BETWEEN_CALLS)
    
    # Summary
    total_time = time.time() - start_time
    print("\n" + "="*60)
    print("ENRICHMENT COMPLETE")
    print("="*60)
    print(f"Total time:    {total_time/60:.1f} minutes")
    print(f"Enriched:      {enriched_count}")
    print(f"Not found:     {not_found_count}")
    print(f"Errors:        {error_count}")
    print(f"Success rate:  {enriched_count/(enriched_count+not_found_count)*100:.1f}%")
    
    # Check remaining
    remaining_result = supabase.table('alumni') \
        .select('id', count='exact') \
        .is_('linkedin_url', 'null') \
        .lte('graduation_year', current_year) \
        .execute()
    
    print(f"\nRemaining un-enriched: {remaining_result.count}")


if __name__ == "__main__":
    main()