import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import random
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# ==========================================
# CONFIGURATION
# ==========================================

# Comprehensive list of Cornell sport "slugs" - verified from cornellbigred.com
# Note: Some sports use different URL patterns than expected
TARGET_SPORTS = [
    # Men's sports
    'baseball',
    'mens-basketball',
    'mens-cross-country',
    'football',
    'mens-golf',
    'mens-ice-hockey',
    'mens-lacrosse',
    'rowing',  # Men's heavyweight rowing
    'mens-rowing',  # Men's lightweight rowing
    'mens-soccer',
    'sprint-football',
    'mens-squash',
    'mens-swimming-and-diving',  # Note: uses 'and' not just hyphen
    'mens-tennis',
    'mens-track-and-field',
    'wrestling',
    
    # Women's sports
    'womens-basketball',
    'womens-cross-country',
    'equestrian',
    'fencing',
    'field-hockey',
    'womens-gymnastics',  # Note: 'womens-' prefix
    'womens-ice-hockey',
    'womens-lacrosse',
    'womens-rowing',
    'womens-sailing',
    'womens-soccer',
    'softball',
    'womens-squash',
    'womens-swimming-and-diving',
    'womens-tennis',
    'womens-track-and-field',
    'womens-volleyball',
]

# Set your year range - go as far back as archives exist
START_YEAR = 1970
END_YEAR = 2025

# Output file path
OUTPUT_FILE = "cornell_all_sports_alumni_1970_2025.csv"

# Delay between requests (in seconds) - reduced for faster scraping
MIN_DELAY = 0.3
MAX_DELAY = 0.6

# Number of parallel threads (be careful: too many may get you blocked)
# 4-6 is usually safe for most sites
MAX_WORKERS = 5

# Headers to mimic a real browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

# ==========================================
# LOGGING SETUP
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==========================================
# SESSION SETUP WITH RETRY LOGIC
# ==========================================

def create_session():
    """
    Creates a requests session with automatic retry logic.
    This helps handle temporary network issues and rate limiting.
    """
    session = requests.Session()
    
    # Retry strategy: retry 3 times with backoff for these status codes
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,  # Wait 1, 2, 4 seconds between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(HEADERS)
    
    return session

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_possible_urls(sport, year):
    """
    Returns a list of possible URL formats for a given sport/year.
    
    Different sports use different URL conventions:
    - Spring sports (baseball, softball, lacrosse, etc.): Single year (e.g., /roster/2005)
    - Fall/Winter sports (basketball, hockey, football): Split year (e.g., /roster/2005-06)
    
    We try the most likely format first based on sport type.
    """
    next_year_short = str(year + 1)[-2:]
    
    # Spring sports typically use single year
    spring_sports = [
        'baseball', 'softball', 
        'mens-lacrosse', 'womens-lacrosse',
        'mens-golf', 'womens-golf',
        'mens-tennis', 'womens-tennis',
        'rowing', 'mens-rowing', 'womens-rowing',
        'mens-track-and-field', 'womens-track-and-field',
        'womens-sailing',
    ]
    
    # Fall/Winter sports typically use split year
    fall_winter_sports = [
        'football', 'sprint-football',
        'mens-basketball', 'womens-basketball',
        'mens-ice-hockey', 'womens-ice-hockey',
        'mens-soccer', 'womens-soccer',
        'womens-volleyball',
        'field-hockey',
        'mens-cross-country', 'womens-cross-country',
        'wrestling',
        'mens-squash', 'womens-squash',
        'mens-swimming-and-diving', 'womens-swimming-and-diving',
        'fencing',
        'womens-gymnastics',
        'equestrian',
    ]
    
    url_single = f"https://cornellbigred.com/sports/{sport}/roster/{year}"
    url_split = f"https://cornellbigred.com/sports/{sport}/roster/{year}-{next_year_short}"
    
    # Return URLs in order of likelihood based on sport type
    if sport in spring_sports:
        return [url_single, url_split]
    else:
        return [url_split, url_single]


def is_valid_page(soup, expected_year=None):
    """
    Checks if the page is a valid roster page (not a 404 or redirect).
    Also verifies the page is for the expected year if provided.
    """
    # Check for "Page Not Found" in title
    if soup.title and "Page Not Found" in soup.title.get_text():
        return False
    
    # Check for common 404 indicators in page content
    page_text = soup.get_text().lower()
    if "page not found" in page_text or "404" in page_text[:500]:
        return False
    
    # Verify the page is for the expected year
    if expected_year:
        title_text = soup.title.get_text() if soup.title else ""
        page_header = soup.find('h1') or soup.find('h2')
        header_text = page_header.get_text() if page_header else ""
        
        # Look for year in title or header
        year_str = str(expected_year)
        next_year_short = str(expected_year + 1)[-2:]
        split_year = f"{expected_year}-{next_year_short}"
        
        # Check if the expected year appears in the page title/header
        combined_text = f"{title_text} {header_text}"
        
        if year_str not in combined_text and split_year not in combined_text:
            # Year not found in title/header - this might be a redirect to current roster
            # Do additional check in the roster dropdown if it exists
            season_dropdown = soup.find('select', {'name': lambda x: x and 'roster' in x.lower()}) if soup.find('select') else None
            if season_dropdown:
                selected_option = season_dropdown.find('option', selected=True)
                if selected_option:
                    selected_text = selected_option.get_text()
                    if year_str not in selected_text and split_year not in selected_text:
                        return False
            else:
                # No dropdown found, check if year appears anywhere prominent
                # Look for the year in the first 2000 chars of page text
                if year_str not in page_text[:2000] and split_year.lower() not in page_text[:2000]:
                    return False
    
    return True


def parse_roster(soup, sport, year, url):
    """
    Extracts athlete data from the HTML soup.
    
    Tries multiple parsing strategies to handle different page templates:
    1. HTML table with roster data (modern Sidearm)
    2. Sidearm list view 
    3. Sidearm table view (older template)
    """
    extracted = []
    
    # Strategy 1: Look for roster tables (most reliable for modern Sidearm)
    # These tables have headers like #, Name, Pos., Cl., Ht., Wt., Hometown
    tables = soup.find_all('table')
    for table in tables:
        headers = table.find_all('th')
        header_text = [h.get_text(strip=True).lower() for h in headers]
        
        # Check if this looks like a roster table
        if any(h in header_text for h in ['name', 'full name', 'player']):
            rows = table.find_all('tr')[1:]  # Skip header row
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    player_data = extract_from_table_row(cells, header_text, sport, year, url)
                    if player_data and player_data['Name'] != 'N/A':
                        extracted.append(player_data)
            
            if extracted:
                return extracted  # Found data in table, return it
    
    # Strategy 2: Sidearm List View 
    players = soup.find_all('li', class_='sidearm-roster-player')
    
    # Strategy 3: Sidearm Table View (older archives)
    if not players:
        players = soup.find_all('tr', class_='sidearm-roster-player')
    
    # Strategy 4: Look for any roster container
    if not players:
        roster_container = soup.find(class_='sidearm-roster-players')
        if roster_container:
            players = roster_container.find_all(['li', 'tr'])
    
    for p in players:
        try:
            player_data = extract_player_data(p, sport, year, url)
            if player_data and player_data['Name'] != 'N/A':
                extracted.append(player_data)
        except Exception as e:
            logger.debug(f"Error parsing player: {e}")
            continue
    
    return extracted


def extract_from_table_row(cells, headers, sport, year, url):
    """
    Extracts player data from a table row.
    """
    player_data = {
        'Name': 'N/A',
        'Sport': sport.replace('-', ' ').title(),
        'Year': year,
        'Class_Year': 'N/A',
        'Position': 'N/A',
        'Hometown': 'N/A',
        'High_School': 'N/A',
        'Height': 'N/A',
        'Weight': 'N/A',
        'Source_URL': url
    }
    
    # Map common header variations to our fields
    header_mapping = {
        'name': 'Name',
        'full name': 'Name',
        'player': 'Name',
        'pos': 'Position',
        'pos.': 'Position',
        'position': 'Position',
        'cl': 'Class_Year',
        'cl.': 'Class_Year',
        'class': 'Class_Year',
        'yr': 'Class_Year',
        'yr.': 'Class_Year',
        'year': 'Class_Year',  # Added - baseball uses "Year" for class
        'academic year': 'Class_Year',
        'ht': 'Height',
        'ht.': 'Height',
        'height': 'Height',
        'wt': 'Weight',
        'wt.': 'Weight',
        'weight': 'Weight',
        'hometown': 'Hometown',
        'hometown/high school': 'Hometown',  # Combined field
        'hometown / high school': 'Hometown',  # With spaces
    }
    
    for i, cell in enumerate(cells):
        if i < len(headers):
            header = headers[i]
            field = header_mapping.get(header)
            
            if field:
                text = cell.get_text(strip=True)
                
                # Handle combined hometown/high school field
                if 'hometown' in header and '/' in text:
                    parts = text.split('/')
                    player_data['Hometown'] = parts[0].strip()
                    player_data['High_School'] = parts[1].strip() if len(parts) > 1 else 'N/A'
                elif field == 'Name':
                    # Clean up name (remove jersey numbers)
                    name = ''.join(c for c in text if not c.isdigit()).strip()
                    player_data['Name'] = name
                else:
                    player_data[field] = text
    
    return player_data


def extract_player_data(element, sport, year, url):
    """
    Extracts individual player data from an HTML element.
    """
    player_data = {
        'Name': 'N/A',
        'Sport': sport.replace('-', ' ').title(),
        'Year': year,
        'Class_Year': 'N/A',
        'Position': 'N/A',
        'Hometown': 'N/A',
        'High_School': 'N/A',
        'Height': 'N/A',
        'Weight': 'N/A',
        'Source_URL': url
    }
    
    # Extract Name (try multiple class names)
    name_classes = [
        'sidearm-roster-player-name',
        'sidearm-roster-player-name-last-first',
        'roster-player-name'
    ]
    for cls in name_classes:
        name_tag = element.find(class_=cls)
        if name_tag:
            # Clean up the name (remove jersey numbers, extra whitespace)
            name_text = name_tag.get_text(strip=True)
            # Remove leading numbers (jersey numbers)
            name_text = ''.join(c for c in name_text if not c.isdigit()).strip()
            player_data['Name'] = name_text
            break
    
    # If still no name, try finding any link with player profile
    if player_data['Name'] == 'N/A':
        link = element.find('a', href=lambda x: x and '/roster/' in str(x))
        if link:
            player_data['Name'] = link.get_text(strip=True)
    
    # Extract other fields with fallbacks
    field_mappings = {
        'Class_Year': [
            'sidearm-roster-player-academic-year', 
            'sidearm-roster-player-year',
            'sidearm-roster-player-class',
            'roster-player-year',
            'roster-player-class',
            'academic-year',
            'class-year',
        ],
        'Position': ['sidearm-roster-player-position', 'roster-player-position', 'position'],
        'Hometown': ['sidearm-roster-player-hometown', 'roster-player-hometown', 'hometown'],
        'High_School': ['sidearm-roster-player-highschool', 'roster-player-highschool', 'high-school'],
        'Height': ['sidearm-roster-player-height', 'roster-player-height', 'height'],
        'Weight': ['sidearm-roster-player-weight', 'roster-player-weight', 'weight'],
    }
    
    for field, class_names in field_mappings.items():
        for cls in class_names:
            tag = element.find(class_=cls)
            if tag:
                text = tag.get_text(strip=True)
                if text:
                    player_data[field] = text
                    break
    
    return player_data


def scrape_roster(session, sport, year):
    """
    Attempts to scrape a roster for a given sport and year.
    Returns (data, url) if successful, (None, None) otherwise.
    """
    possible_urls = get_possible_urls(sport, year)
    
    for url in possible_urls:
        try:
            response = session.get(url, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Verify page is valid AND is for the correct year
                if not is_valid_page(soup, expected_year=year):
                    continue
                
                data = parse_roster(soup, sport, year, url)
                
                if data:
                    return data, url
                    
        except requests.exceptions.RequestException as e:
            logger.debug(f"Request failed for {url}: {e}")
            continue
    
    return None, None


# ==========================================
# MAIN EXECUTION (PARALLEL VERSION)
# ==========================================

# Thread-safe list for collecting results
results_lock = threading.Lock()


def scrape_sport_year(args):
    """
    Scrapes a single sport/year combination.
    Designed to be called in parallel.
    """
    session, sport, year = args
    
    # Small random delay to avoid hammering the server
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
    
    data, url = scrape_roster(session, sport, year)
    
    if data:
        return {
            'sport': sport,
            'year': year,
            'data': data,
            'count': len(data),
            'success': True
        }
    else:
        return {
            'sport': sport,
            'year': year,
            'data': [],
            'count': 0,
            'success': False
        }


def main():
    logger.info(f"Starting scrape: {START_YEAR} to {END_YEAR}")
    logger.info(f"Sports to scrape: {len(TARGET_SPORTS)}")
    logger.info(f"Using {MAX_WORKERS} parallel workers")
    
    # Create a session for each worker (sessions aren't thread-safe)
    sessions = [create_session() for _ in range(MAX_WORKERS)]
    
    # Build list of all (sport, year) combinations to scrape
    tasks = []
    for sport in TARGET_SPORTS:
        for year in range(START_YEAR, END_YEAR + 1):
            # Round-robin assign sessions to tasks
            session = sessions[len(tasks) % MAX_WORKERS]
            tasks.append((session, sport, year))
    
    logger.info(f"Total requests to make: {len(tasks)}")
    
    master_list = []
    stats = {'success': 0, 'failed': 0}
    sport_counts = {}
    
    start_time = time.time()
    
    # Process tasks in parallel
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        future_to_task = {executor.submit(scrape_sport_year, task): task for task in tasks}
        
        completed = 0
        for future in as_completed(future_to_task):
            completed += 1
            result = future.result()
            
            sport = result['sport']
            year = result['year']
            
            if result['success']:
                master_list.extend(result['data'])
                stats['success'] += 1
                sport_counts[sport] = sport_counts.get(sport, 0) + result['count']
                logger.info(f"[{completed}/{len(tasks)}] OK {sport} {year}: {result['count']} athletes")
            else:
                stats['failed'] += 1
                logger.debug(f"[{completed}/{len(tasks)}] MISS {sport} {year}: not found")
            
            # Progress update every 50 requests
            if completed % 50 == 0:
                elapsed = time.time() - start_time
                rate = completed / elapsed
                remaining = (len(tasks) - completed) / rate
                logger.info(f"Progress: {completed}/{len(tasks)} ({completed/len(tasks)*100:.1f}%) - ETA: {remaining/60:.1f} min")
    
    elapsed_time = time.time() - start_time
    
    # ==========================================
    # EXPORT RESULTS
    # ==========================================
    
    logger.info(f"\n{'='*50}")
    logger.info("SCRAPE COMPLETE")
    logger.info(f"{'='*50}")
    logger.info(f"Time elapsed: {elapsed_time/60:.1f} minutes")
    logger.info(f"Total records: {len(master_list)}")
    logger.info(f"Successful pages: {stats['success']}")
    logger.info(f"Failed pages: {stats['failed']}")
    
    if master_list:
        df = pd.DataFrame(master_list)
        
        # Clean up duplicates
        original_count = len(df)
        df.drop_duplicates(subset=['Name', 'Sport', 'Year'], inplace=True)
        dupes_removed = original_count - len(df)
        
        if dupes_removed > 0:
            logger.info(f"Duplicates removed: {dupes_removed}")
        
        # Sort by sport, year, name
        df.sort_values(['Sport', 'Year', 'Name'], inplace=True)
        
        # Save to CSV
        df.to_csv(OUTPUT_FILE, index=False)
        logger.info(f"Data saved to: {OUTPUT_FILE}")
        
        # Print summary by sport
        logger.info("\nRecords by sport:")
        for sport, count in df.groupby('Sport').size().sort_values(ascending=False).items():
            logger.info(f"   {sport}: {count}")
    else:
        logger.warning("No data extracted. Check your internet connection or the website structure.")


if __name__ == "__main__":
    main()