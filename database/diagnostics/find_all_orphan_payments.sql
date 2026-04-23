-- ============================================================
-- ENCONTRAR TODOS OS PAGAMENTOS ÓRFÃOS
-- Pagamentos de juros sem cycle_id vinculado
-- ============================================================

-- Pagamentos de JUROS sem ciclo vinculado
SELECT 
  p.id as payment_id,
  p.contract_id,
  p.amount,
  p.payment_type,
  p.created_at as payment_date,
  cl.name as client_name,
  c.next_due_date as contract_next_due,
  ic.id as possible_cycle_id,
  ic.due_date as cycle_due_date,
  ic.status as cycle_status,
  ic.base_interest_amount
FROM payments p
JOIN contracts c ON p.contract_id = c.id
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN interest_cycles ic ON ic.contract_id = p.contract_id 
  AND ic.status != 'PAID'
  AND DATE(ic.due_date) >= DATE(p.created_at) - INTERVAL '30 days'
  AND DATE(ic.due_date) <= DATE(p.created_at) + INTERVAL '30 days'
WHERE p.cycle_id IS NULL
  AND p.payment_type IN ('INTEREST', 'PARTIAL', 'ADVANCE_INTEREST')
ORDER BY p.created_at DESC;

-- ============================================================
-- RESULTADO: Lista todos os pagamentos que precisam ser corrigidos
-- Para cada linha, você verá:
-- - payment_id: ID do pagamento órfão
-- - possible_cycle_id: ID do ciclo que provavelmente deveria estar vinculado
-- - client_name: Nome do cliente
-- ============================================================
