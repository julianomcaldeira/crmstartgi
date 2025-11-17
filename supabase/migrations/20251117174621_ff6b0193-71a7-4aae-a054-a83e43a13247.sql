-- Add 'linkedin' to task_type enum
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'linkedin';

-- Add 'apresentacao' to opportunity_status enum after 'qualified'
-- Step 1: Remove the default constraint
ALTER TABLE opportunities ALTER COLUMN status DROP DEFAULT;

-- Step 2: Create new enum with the new value
CREATE TYPE opportunity_status_new AS ENUM (
  'lead',
  'contacted',
  'qualified',
  'apresentacao',
  'proposal',
  'negotiation',
  'won',
  'lost'
);

-- Step 3: Update the column to use the new enum
ALTER TABLE opportunities 
  ALTER COLUMN status TYPE opportunity_status_new 
  USING status::text::opportunity_status_new;

-- Step 4: Drop old enum and rename new one
DROP TYPE opportunity_status;
ALTER TYPE opportunity_status_new RENAME TO opportunity_status;

-- Step 5: Re-add the default
ALTER TABLE opportunities ALTER COLUMN status SET DEFAULT 'lead'::opportunity_status;