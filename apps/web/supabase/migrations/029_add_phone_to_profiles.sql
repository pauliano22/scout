-- Add phone number column to profiles for validated contact info.
-- Phone is optional but validated on signup (US/CAN format: 10 digits).
ALTER TABLE profiles ADD COLUMN phone TEXT;
