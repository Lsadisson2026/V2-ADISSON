-- ============================================================
-- FIX: Pagamentos órfãos de Lucas e Elizabete
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

-- Step 3: Investigar Elizabete - encontrar todos os ciclos dela
SELECT 
  c.id as contract_id,
  cl.name as client_name,
  c.next_due_date,
  ic.id as cycle_id,
  ic.due_date,
  ic.status,
  ic.base_interest_amount,
  ic.paid_amount
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
LEFT JOIN interest_cycles ic ON ic.contract_id = c.id
WHERE cl.name ILIKE '%elizabete%'
ORDER BY ic.due_date DESC;

-- Step 4: Verificar pagamentos de Elizabete
SELECT 
  p.id as payment_id,
  p.amount,
  p.payment_type,
  p.created_at as payment_date,
  p.cycle_id,
  c.next_due_date
FROM payments p
JOIN contracts c ON c.id = p.contract_id
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%elizabete%'
ORDER BY p.created_at DESC;

-- Step 5: Verificar resultado de Lucas
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
