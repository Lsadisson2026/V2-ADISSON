-- Add payment_date column to interest_cycles table
ALTER TABLE interest_cycles
ADD COLUMN IF NOT EXISTS payment_date DATE;
