-- Add cycle_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS cycle_id BIGINT REFERENCES interest_cycles(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payments_cycle_id ON payments(cycle_id);
