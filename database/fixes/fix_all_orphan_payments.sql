-- ============================================================================
-- FIX ALL ORPHAN PAYMENTS
-- ============================================================================
-- This script fixes all payments that were registered with cycle_id = NULL
-- by matching them to their correct cycles based on payment_date and contract
-- ============================================================================

-- Step 1: Find and link orphan payments to their correct cycles
-- Links payments to the NEXT pending cycle (handles advance payments)
UPDATE payments p
SET cycle_id = (
  SELECT ic.id
  FROM interest_cycles ic
  WHERE ic.contract_id = p.contract_id
    AND ic.status = 'PENDING'
    AND ic.due_date >= DATE(p.created_at) - INTERVAL '7 days'  -- Allow payments up to 7 days before due date
  ORDER BY ic.due_date ASC  -- Get the NEXT pending cycle
  LIMIT 1
)
WHERE p.cycle_id IS NULL
  AND p.payment_type IN ('INTEREST', 'PARTIAL')
  AND EXISTS (
    SELECT 1
    FROM interest_cycles ic
    WHERE ic.contract_id = p.contract_id
      AND ic.status = 'PENDING'
      AND ic.due_date >= DATE(p.created_at) - INTERVAL '7 days'
  );

-- Step 2: Update cycle status and paid_amount for affected cycles
UPDATE interest_cycles ic
SET 
  paid_amount = COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.cycle_id = ic.id
      AND p.payment_type IN ('INTEREST', 'PARTIAL')
  ), 0),
  status = CASE
    WHEN COALESCE((
      SELECT SUM(p.amount)
      FROM payments p
      WHERE p.cycle_id = ic.id
        AND p.payment_type IN ('INTEREST', 'PARTIAL')
    ), 0) >= ic.base_interest_amount THEN 'PAID'
    ELSE 'PENDING'
  END
WHERE ic.id IN (
  SELECT DISTINCT cycle_id
  FROM payments
  WHERE cycle_id IS NOT NULL
    AND payment_type IN ('INTEREST', 'PARTIAL')
);

-- Step 3: Show affected cycles after fix
SELECT 
  ic.id as cycle_id,
  cl.name as client_name,
  ic.due_date,
  ic.status,
  ic.paid_amount,
  ic.base_interest_amount,
  COUNT(p.id) as payment_count,
  SUM(p.amount) as total_paid
FROM interest_cycles ic
JOIN contracts c ON c.id = ic.contract_id
JOIN clients cl ON cl.id = c.client_id
LEFT JOIN payments p ON p.cycle_id = ic.id AND p.payment_type IN ('INTEREST', 'PARTIAL')
WHERE ic.id IN (181, 227, 655, 267)
GROUP BY ic.id, cl.name, ic.due_date, ic.status, ic.paid_amount, ic.base_interest_amount
ORDER BY ic.due_date DESC;
