-- ============================================================
-- DIAGNÓSTICO: Ciclos de Elizabete
-- ============================================================

-- Listar todos os ciclos de Elizabete com detalhes
SELECT 
  ic.id as cycle_id,
  ic.due_date,
  ic.base_interest_amount,
  ic.paid_amount,
  ic.status,
  COUNT(p.id) as payment_count,
  COALESCE(SUM(p.amount), 0) as total_paid_via_cycle
FROM interest_cycles ic
LEFT JOIN payments p ON p.cycle_id = ic.id
WHERE ic.contract_id = 367
GROUP BY ic.id, ic.due_date, ic.base_interest_amount, ic.paid_amount, ic.status
ORDER BY ic.due_date DESC;

-- Verificar qual ciclo deveria receber cada pagamento órfão
-- Pagamentos: 384 (210 INTEREST em 2026-04-20), 385 (400 CAPITAL em 2026-04-20), 387 (1000 CAPITAL em 2026-04-21)
SELECT 
  ic.id as cycle_id,
  ic.due_date,
  ic.status,
  ic.base_interest_amount,
  ic.paid_amount,
  '384 (210 INTEREST 2026-04-20)' as payment_info
FROM interest_cycles ic
WHERE ic.contract_id = 367
  AND ic.due_date >= '2026-04-20'::date - INTERVAL '7 days'
  AND ic.due_date <= '2026-04-20'::date + INTERVAL '7 days'
ORDER BY ic.due_date;
