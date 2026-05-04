-- Fix: Criar ciclos faltantes para contratos parcelados atrasados

-- Criar ciclos PENDING para contratos parcelados que não têm ciclo para a próxima parcela
INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount, paid_amount, status)
SELECT 
  c.id as contract_id,
  c.next_due_date,
  c.installment_amount,
  0,
  'PENDING'
FROM contracts c
WHERE c.contract_type = 'INSTALLMENT'
  AND c.status = 'ACTIVE'
  AND c.archived = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM interest_cycles ic 
    WHERE ic.contract_id = c.id 
      AND ic.due_date = c.next_due_date
  )
  AND c.paid_installments < c.total_installments;

-- Verificar quantos ciclos foram criados
SELECT 
  COUNT(*) as ciclos_criados,
  'Ciclos criados com sucesso!' as mensagem
FROM interest_cycles ic
JOIN contracts c ON c.id = ic.contract_id
WHERE c.contract_type = 'INSTALLMENT'
  AND ic.created_at > NOW() - INTERVAL '1 minute';
