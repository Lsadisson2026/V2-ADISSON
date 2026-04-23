-- ============================================================
-- DIAGNÓSTICO: Elizabete Jesus dos Santos Silva
-- ============================================================

-- 1. Encontrar o contrato de Elizabete
SELECT 
  c.id as contract_id,
  cl.name as client_name,
  c.capital,
  c.interest_rate_monthly,
  c.next_due_date,
  c.status as contract_status,
  c.archived
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%elizabete%'
ORDER BY c.created_at DESC;

-- 2. Listar todos os ciclos de Elizabete
SELECT 
  ic.id as cycle_id,
  ic.contract_id,
  ic.due_date,
  ic.base_interest_amount,
  ic.paid_amount,
  ic.status as cycle_status,
  COUNT(p.id) as payment_count,
  COALESCE(SUM(p.amount), 0) as total_paid
FROM interest_cycles ic
LEFT JOIN payments p ON p.cycle_id = ic.id
WHERE ic.contract_id IN (
  SELECT c.id FROM contracts c
  JOIN clients cl ON cl.id = c.client_id
  WHERE cl.name ILIKE '%elizabete%'
)
GROUP BY ic.id, ic.contract_id, ic.due_date, ic.base_interest_amount, ic.paid_amount, ic.status
ORDER BY ic.due_date DESC;

-- 3. Verificar pagamentos de Elizabete
SELECT 
  p.id as payment_id,
  p.contract_id,
  p.cycle_id,
  p.amount,
  p.payment_type,
  p.payment_method,
  p.created_at as payment_date,
  c.next_due_date
FROM payments p
JOIN contracts c ON c.id = p.contract_id
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%elizabete%'
ORDER BY p.created_at DESC;
