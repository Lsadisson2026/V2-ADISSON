-- Diagnóstico: Verificar se contratos parcelados atrasados têm ciclos

-- 1. Contratos parcelados ativos
SELECT 
  c.id as contract_id,
  cl.name as client_name,
  c.contract_type,
  c.next_due_date,
  c.total_installments,
  c.paid_installments,
  c.status,
  CASE 
    WHEN c.next_due_date < CURRENT_DATE THEN '❌ ATRASADO'
    WHEN c.next_due_date = CURRENT_DATE THEN '⚠️ VENCE HOJE'
    ELSE '✅ EM DIA'
  END as situacao
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE c.contract_type = 'INSTALLMENT' 
  AND c.status = 'ACTIVE'
  AND c.archived = FALSE
ORDER BY c.next_due_date;

-- 2. Ciclos de contratos parcelados
SELECT 
  ic.id as cycle_id,
  ic.contract_id,
  cl.name as client_name,
  c.contract_type,
  ic.due_date,
  ic.status as cycle_status,
  ic.base_interest_amount,
  CASE 
    WHEN ic.due_date < CURRENT_DATE AND ic.status = 'PENDING' THEN '❌ ATRASADO'
    WHEN ic.due_date = CURRENT_DATE AND ic.status = 'PENDING' THEN '⚠️ VENCE HOJE'
    WHEN ic.status = 'PAID' THEN '✅ PAGO'
    ELSE '📅 FUTURO'
  END as situacao
FROM interest_cycles ic
JOIN contracts c ON c.id = ic.contract_id
JOIN clients cl ON cl.id = c.client_id
WHERE c.contract_type = 'INSTALLMENT'
  AND c.archived = FALSE
ORDER BY ic.due_date;

-- 3. Contratos parcelados atrasados SEM ciclos
SELECT 
  c.id as contract_id,
  cl.name as client_name,
  c.next_due_date,
  c.total_installments,
  c.paid_installments,
  '❌ SEM CICLO ATRASADO' as problema
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE c.contract_type = 'INSTALLMENT'
  AND c.status = 'ACTIVE'
  AND c.archived = FALSE
  AND c.next_due_date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM interest_cycles ic 
    WHERE ic.contract_id = c.id 
      AND ic.due_date < CURRENT_DATE 
      AND ic.status = 'PENDING'
  );
