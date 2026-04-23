-- ============================================================
-- FIX: Pagamento órfão de Lucas Pereira de Assis
-- ============================================================

-- Step 1: Vincular pagamento de Lucas ao ciclo 710
UPDATE payments
SET cycle_id = 710
WHERE id = 356
  AND cycle_id IS NULL;

-- Step 2: Atualizar ciclo 710 de Lucas
UPDATE interest_cycles
SET 
  paid_amount = paid_amount + 30.00,
  status = CASE
    WHEN (paid_amount + 30.00) >= base_interest_amount THEN 'PAID'
    ELSE 'PENDING'
  END
WHERE id = 710;

-- Step 3: Verificar resultado
SELECT 
  ic.id as cycle_id,
  ic.due_date,
  ic.base_interest_amount,
  ic.paid_amount,
  ic.status,
  COUNT(p.id) as payment_count,
  SUM(p.amount) as total_paid
FROM interest_cycles ic
LEFT JOIN payments p ON p.cycle_id = ic.id
WHERE ic.id = 710
GROUP BY ic.id, ic.due_date, ic.base_interest_amount, ic.paid_amount, ic.status;
