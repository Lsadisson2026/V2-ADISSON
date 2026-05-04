-- Função: Criar próximo ciclo automaticamente para contratos parcelados
-- Chamada após pagamento de parcela ou criação de contrato

CREATE OR REPLACE FUNCTION create_next_installment_cycle(p_contract_id BIGINT) 
RETURNS VOID AS $$
DECLARE
  v_contract RECORD;
  v_next_due_date DATE;
BEGIN
  -- Buscar dados do contrato
  SELECT 
    id, 
    next_due_date, 
    installment_amount,
    total_installments,
    paid_installments,
    status,
    contract_type
  INTO v_contract
  FROM contracts
  WHERE id = p_contract_id;

  -- Verificar se é contrato parcelado e ainda tem parcelas a pagar
  IF v_contract.contract_type = 'INSTALLMENT' 
     AND v_contract.status = 'ACTIVE'
     AND v_contract.paid_installments < v_contract.total_installments THEN
    
    -- Verificar se já existe ciclo para a próxima data
    IF NOT EXISTS (
      SELECT 1 FROM interest_cycles 
      WHERE contract_id = p_contract_id 
        AND due_date = v_contract.next_due_date
    ) THEN
      -- Criar o ciclo
      INSERT INTO interest_cycles (
        contract_id, 
        due_date, 
        base_interest_amount, 
        paid_amount, 
        status
      ) VALUES (
        p_contract_id,
        v_contract.next_due_date,
        v_contract.installment_amount,
        0,
        'PENDING'
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Criar ciclo automaticamente após pagamento de parcela
CREATE OR REPLACE FUNCTION trigger_create_next_cycle() 
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pagamento é de parcela (INSTALLMENT) e o ciclo foi marcado como PAID
  IF NEW.status = 'PAID' AND OLD.status = 'PENDING' THEN
    -- Criar próximo ciclo
    PERFORM create_next_installment_cycle(NEW.contract_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela interest_cycles
DROP TRIGGER IF EXISTS after_cycle_paid ON interest_cycles;
CREATE TRIGGER after_cycle_paid
  AFTER UPDATE ON interest_cycles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_next_cycle();

-- Função auxiliar: Criar ciclo inicial ao criar contrato parcelado
-- (Deve ser chamada pelo frontend após criar contrato)
CREATE OR REPLACE FUNCTION initialize_installment_contract(p_contract_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM create_next_installment_cycle(p_contract_id);
END;
$$ LANGUAGE plpgsql;
