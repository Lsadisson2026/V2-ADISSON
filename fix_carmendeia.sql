-- ============================================================
-- CORREÇÃO: Carmendeia Rodrigues Matos
-- Vincula pagamentos ao ciclo e marca como pago
-- ============================================================

-- Vincular os pagamentos ao ciclo 181
UPDATE payments 
SET cycle_id = 181 
WHERE id IN (205, 206);

-- Marcar o ciclo como PAGO
UPDATE interest_cycles 
SET status = 'PAID', 
    paid_amount = 82.73,
    payment_date = '2026-04-07'
WHERE id = 181;

-- Verificar se corrigiu (execute depois)
SELECT 
  ic.id,
  ic.due_date,
  ic.status,
  ic.paid_amount,
  ic.payment_date,
  COUNT(p.id) as pagamentos_vinculados
FROM interest_cycles ic
LEFT JOIN payments p ON p.cycle_id = ic.id
WHERE ic.id = 181
GROUP BY ic.id, ic.due_date, ic.status, ic.paid_amount, ic.payment_date;
