-- ============================================================
-- DIAGNÓSTICO: Nivia Luiza Linhares de Aguiar
-- ============================================================

-- 1. Encontrar o contrato da Nivia
SELECT 
  c.id as contract_id,
  c.client_id,
  cl.name as client_name,
  c.capital,
  c.interest_rate_monthly,
  c.next_due_date,
  c.status as contract_status,
  c.archived
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%nivia%'
ORDER BY c.created_at DESC;

-- 2. Listar todos os ciclos do contrato da Nivia
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
  WHERE cl.name ILIKE '%nivia%'
)
GROUP BY ic.id, ic.contract_id, ic.due_date, ic.base_interest_amount, ic.paid_amount, ic.status
ORDER BY ic.due_date DESC;

-- 3. Verificar o que get_dashboard retorna para Nivia
-- (Esta query simula o que o backend retorna)
SELECT 
  ic.id,
  ic.contract_id,
  ic.due_date,
  ic.base_interest_amount,
  ic.paid_amount,
  ic.status,
  cl.name as client_name,
  cl.phone as client_phone,
  CASE 
    WHEN ic.due_date < CURRENT_DATE THEN 'overdue'
    WHEN ic.due_date = CURRENT_DATE THEN 'today'
    ELSE 'scheduled'
  END as category
FROM interest_cycles ic
JOIN contracts c ON c.id = ic.contract_id
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%nivia%'
  AND ic.status != 'PAID'
ORDER BY ic.due_date DESC;
