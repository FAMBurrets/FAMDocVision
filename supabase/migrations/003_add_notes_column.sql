-- Add notes column to folders table
ALTER TABLE folders ADD COLUMN IF NOT EXISTS notes TEXT;
