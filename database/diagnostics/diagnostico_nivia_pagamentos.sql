-- ============================================================
-- DIAGNÓSTICO: Pagamentos de Nivia
-- ============================================================

-- Encontrar todos os pagamentos de Nivia
SELECT 
  p.id as payment_id,
  p.contract_id,
  p.cycle_id,
  p.amount,
  p.payment_type,
  p.payment_method,
  p.created_at as payment_date,
  p.received_by,
  ic.id as cycle_id_check,
  ic.due_date,
  ic.status as cycle_status
FROM payments p
JOIN contracts c ON c.id = p.contract_id
JOIN clients cl ON cl.id = c.client_id
LEFT JOIN interest_cycles ic ON ic.id = p.cycle_id
WHERE cl.name ILIKE '%nivia%'
ORDER BY p.created_at DESC;

-- Verificar o contrato atual
SELECT 
  c.id,
  c.next_due_date,
  c.status,
  c.capital,
  c.interest_rate_monthly
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE cl.name ILIKE '%nivia%';
