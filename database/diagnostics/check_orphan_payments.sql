-- ============================================================
-- VERIFICAR SE EXISTEM PAGAMENTOS ÓRFÃOS NO BANCO DE DADOS
-- Execute este script para diagnosticar o problema
-- ============================================================

-- 1. Contar total de pagamentos órfãos
SELECT 
  COUNT(*) as total_orphan_payments,
  SUM(amount) as total_orphan_amount
FROM payments
WHERE cycle_id IS NULL
  AND payment_type IN ('INTEREST', 'PARTIAL', 'ADVANCE_INTEREST');

-- 2. Listar todos os pagamentos órfãos com detalhes
SELECT 
  p.id as payment_id,
  cl.name as client_name,
  p.amount,
  p.payment_type,
  p.created_at as payment_date,
  c.next_due_date as contract_next_due,
  ic.id as possible_cycle_id,
  ic.due_date as cycle_due_date,
  ic.status as cycle_status,
  ic.base_interest_amount,
  CASE 
    WHEN ic.id IS NOT NULL THEN '✅ Pode ser corrigido'
    ELSE '❌ Sem ciclo correspondente'
  END as fix_status
FROM payments p
JOIN contracts c ON p.contract_id = c.id
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN interest_cycles ic ON ic.contract_id = p.contract_id 
  AND ic.status = 'PENDING'
  AND ic.due_date >= DATE(p.created_at) - INTERVAL '7 days'
WHERE p.cycle_id IS NULL
  AND p.payment_type IN ('INTEREST', 'PARTIAL', 'ADVANCE_INTEREST')
ORDER BY p.created_at DESC;

-- 3. Verificar ciclos que deveriam estar PAID mas estão PENDING
SELECT 
  ic.id as cycle_id,
  cl.name as client_name,
  ic.due_date,
  ic.status,
  ic.paid_amount,
  ic.base_interest_amount,
  COUNT(p.id) as payment_count,
  COALESCE(SUM(p.amount), 0) as total_received,
  CASE 
    WHEN COALESCE(SUM(p.amount), 0) >= ic.base_interest_amount THEN '⚠️ Deveria estar PAID'
    ELSE '✅ Status correto'
  END as status_check
FROM interest_cycles ic
JOIN contracts c ON c.id = ic.contract_id
JOIN clients cl ON cl.id = c.client_id
LEFT JOIN payments p ON p.cycle_id = ic.id AND p.payment_type IN ('INTEREST', 'PARTIAL')
WHERE ic.status = 'PENDING'
  AND ic.due_date <= CURRENT_DATE
GROUP BY ic.id, cl.name, ic.due_date, ic.status, ic.paid_amount, ic.base_interest_amount
HAVING COALESCE(SUM(p.amount), 0) >= ic.base_interest_amount
ORDER BY ic.due_date DESC;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- 
-- Query 1: Se total_orphan_payments > 0, você tem pagamentos órfãos
-- Query 2: Lista detalhada de cada pagamento órfão
-- Query 3: Ciclos que receberam pagamento mas não foram marcados como PAID
--
-- Se encontrar problemas, use o script fix_all_orphan_payments.sql
-- ============================================================
