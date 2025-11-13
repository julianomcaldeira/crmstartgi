-- Add distributor and services fields to clients table
ALTER TABLE clients
ADD COLUMN distributor text,
ADD COLUMN services text;