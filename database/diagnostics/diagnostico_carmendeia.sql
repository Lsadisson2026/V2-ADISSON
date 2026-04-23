-- ============================================================
-- DIAGNÓSTICO: Carmendeia Rodrigues Matos
-- Execute cada query separadamente no SQL Editor do Supabase
-- ============================================================

-- ─── QUERY 1: Informações do Contrato e Ciclos ──────────────
-- Mostra o contrato, data de vencimento e todos os ciclos
SELECT 
  c.id as contract_id,
  c.capital,
  c.monthly_interest_amount,
  c.next_due_date,
  c.created_at as contract_created,
  c.status as contract_status,
  c.archived,
  cl.name as client_name,
  ic.id as cycle_id,
  ic.due_date as cycle_due_date,
  ic.status as cycle_status,
  ic.paid_amount,
  ic.base_interest_amount,
  ic.created_at as cycle_created,
  ic.payment_date
FROM contracts c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN interest_cycles ic ON ic.contract_id = c.id
WHERE cl.name ILIKE '%Carmendeia%'
ORDER BY ic.due_date DESC;

-- ─── QUERY 2: Histórico de Pagamentos ───────────────────────
-- Mostra todos os pagamentos feitos
SELECT 
  p.id as payment_id,
  p.amount,
  p.payment_type,
  p.payment_method,
  p.created_at as payment_date,
  ic.due_date as cycle_due_date,
  ic.status as cycle_status_after_payment,
  cl.name as client_name,
  u.name as received_by
FROM payments p
JOIN contracts c ON p.contract_id = c.id
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN interest_cycles ic ON p.cycle_id = ic.id
LEFT JOIN profiles u ON p.received_by = u.id
WHERE cl.name ILIKE '%Carmendeia%'
ORDER BY p.created_at DESC;

-- ─── QUERY 3: Resumo Simplificado ───────────────────────────
-- Visão rápida do problema
SELECT 
  cl.name,
  c.next_due_date as "Próximo Vencimento (Contrato)",
  COUNT(ic.id) FILTER (WHERE ic.status = 'PENDING') as "Ciclos Pendentes",
  COUNT(ic.id) FILTER (WHERE ic.status = 'PAID') as "Ciclos Pagos",
  COUNT(p.id) as "Total de Pagamentos",
  SUM(p.amount) as "Total Recebido"
FROM contracts c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN interest_cycles ic ON ic.contract_id = c.id
LEFT JOIN payments p ON p.contract_id = c.id
WHERE cl.name ILIKE '%Carmendeia%'
GROUP BY cl.name, c.next_due_date;

-- ─── QUERY 4: Verificar se tem ciclo duplicado ──────────────
-- Checa se tem mais de um ciclo para a mesma data
SELECT 
  c.id as contract_id,
  ic.due_date,
  COUNT(*) as quantidade_ciclos,
  STRING_AGG(ic.status::text, ', ') as status_dos_ciclos
FROM contracts c
JOIN clients cl ON c.client_id = cl.id
JOIN interest_cycles ic ON ic.contract_id = c.id
WHERE cl.name ILIKE '%Carmendeia%'
GROUP BY c.id, ic.due_date
HAVING COUNT(*) > 1;

-- =====================