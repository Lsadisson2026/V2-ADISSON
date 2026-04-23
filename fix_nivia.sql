-- ============================================================
-- FIX: Vincular pagamentos órfãos de Nivia ao ciclo correto
-- ============================================================

-- Step 1: Vincular pagamentos ao ciclo 322
UPDATE payments
SET cycle_id = 322
WHERE id IN (369, 370)
  AND cycle_id IS NULL;

-- Step 2: Atualizar ciclo 322 com os pagamentos
UPDATE interest_cycles
SET 
  paid_amount = 550.00,  -- 150 + 400
  status = 'PAID'
WHERE id = 322;

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
WHERE ic.id = 322
GROUP BY ic.id, ic.due_date, ic.base_interest_amount, ic.paid_amount, ic.status;
