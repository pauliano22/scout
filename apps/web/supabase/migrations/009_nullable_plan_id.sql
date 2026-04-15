-- Migration 009: Make plan_id nullable in plan_custom_contacts
-- Allows custom contacts to exist independently of a networking plan
-- (e.g., contacts added directly from the Network page)

ALTER TABLE plan_custom_contacts
  ALTER COLUMN plan_id DROP NOT NULL;
