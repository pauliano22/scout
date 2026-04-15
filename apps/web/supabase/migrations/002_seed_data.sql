-- Seed Data for Scout
-- Run this after the schema migration

INSERT INTO public.alumni (full_name, sport, graduation_year, company, role, industry, location, linkedin_url, is_verified, is_public, source) VALUES
-- Finance
('Marcus Chen', 'Basketball', 2018, 'Goldman Sachs', 'VP, Investment Banking', 'Finance', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Emily Rodriguez', 'Lacrosse', 2020, 'JPMorgan Chase', 'Associate', 'Finance', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Michael Torres', 'Baseball', 2014, 'Morgan Stanley', 'Executive Director', 'Finance', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Olivia Washington', 'Track & Field', 2013, 'BlackRock', 'Managing Director', 'Finance', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'public_record'),
('Daniel Kim', 'Golf', 2019, 'Citadel', 'Quantitative Analyst', 'Finance', 'Chicago, IL', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Rachel Greene', 'Field Hockey', 2016, 'KKR', 'Principal', 'Finance', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'referral'),

-- Technology
('Sarah Williams', 'Soccer', 2015, 'Google', 'Senior Product Manager', 'Technology', 'San Francisco, CA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('David Park', 'Tennis', 2016, 'Stripe', 'Engineering Manager', 'Technology', 'San Francisco, CA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Jessica Liu', 'Volleyball', 2021, 'Meta', 'Product Designer', 'Technology', 'Menlo Park, CA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Kevin Patel', 'Wrestling', 2017, 'Amazon', 'Senior Software Engineer', 'Technology', 'Seattle, WA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Lauren Mitchell', 'Rowing', 2019, 'Apple', 'Hardware Engineer', 'Technology', 'Cupertino, CA', 'https://linkedin.com/in/example', true, true, 'referral'),
('Alex Thompson', 'Swimming', 2020, 'OpenAI', 'Research Engineer', 'Technology', 'San Francisco, CA', 'https://linkedin.com/in/example', true, true, 'opt_in'),

-- Consulting
('James Okafor', 'Football', 2012, 'McKinsey & Company', 'Partner', 'Consulting', 'Chicago, IL', 'https://linkedin.com/in/example', true, true, 'public_record'),
('Amanda Foster', 'Swimming', 2019, 'Bain & Company', 'Consultant', 'Consulting', 'Boston, MA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Ryan McCarthy', 'Hockey', 2017, 'Deloitte', 'Senior Manager', 'Consulting', 'Boston, MA', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Sophia Anderson', 'Gymnastics', 2018, 'BCG', 'Project Leader', 'Consulting', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Chris Martinez', 'Lacrosse', 2015, 'Accenture', 'Managing Director', 'Consulting', 'Washington, DC', 'https://linkedin.com/in/example', true, true, 'referral'),

-- Healthcare
('Dr. Maria Santos', 'Cross Country', 2010, 'Mayo Clinic', 'Physician', 'Healthcare', 'Rochester, MN', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Jennifer Wu', 'Tennis', 2014, 'Pfizer', 'Senior Research Scientist', 'Healthcare', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Dr. Nathan Brooks', 'Soccer', 2008, 'Johns Hopkins', 'Surgeon', 'Healthcare', 'Baltimore, MD', 'https://linkedin.com/in/example', true, true, 'public_record'),

-- Law
('Elizabeth Taylor', 'Rowing', 2013, 'Cravath, Swaine & Moore', 'Partner', 'Law', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('William Johnson', 'Basketball', 2016, 'Skadden', 'Associate', 'Law', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Victoria Chang', 'Fencing', 2015, 'Sullivan & Cromwell', 'Counsel', 'Law', 'New York, NY', 'https://linkedin.com/in/example', true, true, 'referral'),

-- Media & Entertainment
('Brandon Lee', 'Basketball', 2017, 'ESPN', 'Sports Analyst', 'Media', 'Bristol, CT', 'https://linkedin.com/in/example', true, true, 'public_record'),
('Samantha Davis', 'Soccer', 2018, 'Netflix', 'Content Strategist', 'Media', 'Los Angeles, CA', 'https://linkedin.com/in/example', true, true, 'opt_in'),

-- Startups / Entrepreneurship
('Tyler Robinson', 'Football', 2016, 'Founder @ TechStartup', 'CEO', 'Technology', 'Austin, TX', 'https://linkedin.com/in/example', true, true, 'opt_in'),
('Grace Kim', 'Volleyball', 2019, 'Founder @ HealthTech', 'CEO', 'Healthcare', 'Boston, MA', 'https://linkedin.com/in/example', true, true, 'opt_in');
