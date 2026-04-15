import pandas as pd
from supabase import create_client
import os
from datetime import datetime

# ==========================================
# CONFIGURATION
# ==========================================

# Your Supabase credentials
SUPABASE_URL = "https://recftqpdnbdandloykms.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlY2Z0cXBkbmJkYW5kbG95a21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYwODU2OCwiZXhwIjoyMDgwMTg0NTY4fQ.p5Hs6kriDGTUoP73WMWmkmORMEhxf1qd0H6yxS9RmFY"

# Cornell's school_id in your database
CORNELL_SCHOOL_ID = "ca438d00-2bf0-48b7-82db-0d83e2b8a1dc"

# Path to your CSV file
CSV_FILE = "cornell_all_sports_alumni_2005_2025.csv"

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def calculate_graduation_year(roster_year, class_year):
    """
    Calculates graduation year from roster year and class standing.
    
    roster_year: The year the roster is from (e.g., 2015)
    class_year: Fr., So., Jr., Sr., Gr., etc.
    """
    # Handle NaN or missing roster_year
    if pd.isna(roster_year):
        roster_year = 2020  # Default fallback
    roster_year = int(roster_year)
    
    if pd.isna(class_year) or class_year == 'N/A' or class_year == '' or str(class_year) == 'nan':
        # If no class year, assume they graduated the roster year
        return roster_year
    
    class_year = str(class_year).lower().strip()
    
    # Map class standing to years until graduation
    class_mapping = {
        'fr': 4,   # Freshman -> 4 years to graduate
        'fr.': 4,
        'freshman': 4,
        'so': 3,   # Sophomore -> 3 years
        'so.': 3,
        'sophomore': 3,
        'jr': 2,   # Junior -> 2 years
        'jr.': 2,
        'junior': 2,
        'sr': 1,   # Senior -> graduates this year
        'sr.': 1,
        'senior': 1,
        'gr': 0,   # Graduate student -> already graduated
        'gr.': 0,
        'graduate': 0,
        'graduate student': 0,
    }
    
    # Find matching class
    for key, years_to_grad in class_mapping.items():
        if key in class_year:
            return roster_year + years_to_grad
    
    # Default: assume graduation same year as roster
    return roster_year


def clean_sport_name(sport):
    """
    Cleans up sport names to be more readable.
    'Mens Basketball' -> 'Men's Basketball'
    """
    sport = str(sport)
    sport = sport.replace('Mens ', "Men's ")
    sport = sport.replace('Womens ', "Women's ")
    return sport


def clean_name(name):
    """
    Cleans up athlete names.
    """
    if pd.isna(name):
        return None
    name = str(name).strip()
    # Remove any extra whitespace
    name = ' '.join(name.split())
    return name if name else None


def prepare_alumni_record(row):
    """
    Transforms a CSV row into a Supabase alumni record.
    """
    name = clean_name(row.get('Name'))
    if not name:
        return None
    
    graduation_year = calculate_graduation_year(
        row.get('Year', 2020),
        row.get('Class_Year', 'N/A')
    )
    
    # Helper to convert NaN/empty to None
    def clean_value(val):
        if pd.isna(val) or val == 'N/A' or val == '' or val == 'nan':
            return None
        return str(val).strip() if val else None
    
    # Build the record
    record = {
        'full_name': name,
        'sport': clean_sport_name(row.get('Sport', '')),
        'graduation_year': int(graduation_year),
        'location': clean_value(row.get('Hometown')),
        'school_id': CORNELL_SCHOOL_ID,
        'source': 'roster_scrape',
        'is_verified': False,
        'is_public': True,
        # These will be filled in later via LinkedIn enrichment
        'email': None,
        'linkedin_url': None,
        'company': None,
        'role': None,
        'industry': None,
    }
    
    return record


# ==========================================
# MAIN EXECUTION
# ==========================================

def main():
    print("="*50)
    print("SUPABASE ALUMNI IMPORT")
    print("="*50)
    
    # 1. Connect to Supabase
    print("\n1. Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("   Connected!")
    
    # 2. Read CSV
    print(f"\n2. Reading CSV: {CSV_FILE}")
    df = pd.read_csv(CSV_FILE)
    print(f"   Found {len(df)} rows")
    
    # 3. Transform data
    print("\n3. Transforming data...")
    records = []
    skipped = 0
    
    for _, row in df.iterrows():
        record = prepare_alumni_record(row)
        if record:
            records.append(record)
        else:
            skipped += 1
    
    print(f"   Prepared {len(records)} records ({skipped} skipped due to missing name)")
    
    # 4. Show sample of what we're about to insert
    print("\n4. Sample records to insert:")
    for i, rec in enumerate(records[:3]):
        print(f"   {i+1}. {rec['full_name']} - {rec['sport']} - Class of {rec['graduation_year']}")
    
    # 5. Confirm before proceeding
    print("\n" + "="*50)
    print("WARNING: This will DELETE all existing alumni data")
    print("and replace it with the scraped data.")
    print("="*50)
    confirm = input("\nType 'yes' to proceed: ")
    
    if confirm.lower() != 'yes':
        print("Aborted.")
        return
    
    # 6. Delete existing alumni data
    print("\n5. Deleting existing alumni data...")
    try:
        # Delete all records from alumni table
        result = supabase.table('alumni').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print(f"   Deleted existing records")
    except Exception as e:
        print(f"   Error deleting: {e}")
        return
    
    # 7. Insert new data in batches
    print(f"\n6. Inserting {len(records)} new records...")
    batch_size = 500
    inserted = 0
    errors = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            result = supabase.table('alumni').insert(batch).execute()
            inserted += len(batch)
            print(f"   Inserted {inserted}/{len(records)} records...")
        except Exception as e:
            print(f"   Error inserting batch {i//batch_size + 1}: {e}")
            errors += 1
            # Try inserting one by one to find problematic records
            for record in batch:
                try:
                    supabase.table('alumni').insert(record).execute()
                    inserted += 1
                except Exception as e2:
                    print(f"   Failed to insert {record['full_name']}: {e2}")
    
    # 8. Summary
    print("\n" + "="*50)
    print("IMPORT COMPLETE")
    print("="*50)
    print(f"Total records inserted: {inserted}")
    print(f"Errors: {errors}")
    
    # 9. Verify by counting
    print("\n7. Verifying...")
    result = supabase.table('alumni').select('id', count='exact').execute()
    print(f"   Alumni table now has {result.count} records")
    
    print("\nDone! You can now check your Supabase dashboard.")


if __name__ == "__main__":
    main()