-- 1. Relax the constraint to allow slight rounding errors
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_capital_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_capital_check CHECK (capital >= -0.01);

-- 2. Improve functions to be more robust
CREATE OR REPLACE FUNCTION register_payment(
  p_contract_id BIGINT,
  p_cycle_id BIGINT,
  p_amount NUMERIC,
  p_payment_type TEXT,
  p_payment_method TEXT,
  p_next_due_date DATE,
  p_received_by UUID,
  p_is_full_quitacao BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
  v_cycle_amount NUMERIC;
  v_paid_amount NUMERIC;
BEGIN
  -- Insert the payment record
  INSERT INTO payments (
    contract_id,
    cycle_id,
    amount,
    payment_type,
    payment_method,
    received_by,
    created_at
  ) VALUES (
    p_contract_id,
    p_cycle_id,
    p_amount,
    p_payment_type,
    p_payment_method,
    p_received_by,
    NOW()
  );

  -- If it's a full quitacao, mark contract as finished and zero capital
  IF p_is_full_quitacao THEN
    UPDATE contracts
    SET status = 'FINISHED',
        capital = 0,
        updated_at = NOW()
    WHERE id = p_contract_id;
    
    -- Also mark the cycle as paid if provided
    IF p_cycle_id IS NOT NULL THEN
      UPDATE interest_cycles
      SET status = 'PAID',
          paid_amount = COALESCE(paid_amount, 0) + p_amount,
          payment_date = CURRENT_DATE
      WHERE id = p_cycle_id;
    END IF;
    
    RETURN;
  END IF;

  -- If a cycle is provided, update its status
  IF p_cycle_id IS NOT NULL THEN
    SELECT base_interest_amount, COALESCE(paid_amount, 0)
    INTO v_cycle_amount, v_paid_amount
    FROM interest_cycles
    WHERE id = p_cycle_id;

    UPDATE interest_cycles
    SET paid_amount = COALESCE(paid_amount, 0) + p_amount,
        status = CASE 
          WHEN (COALESCE(paid_amount, 0) + p_amount) >= (base_interest_amount - 0.01) THEN 'PAID'
          ELSE 'PARTIAL'
        END,
        payment_date = CURRENT_DATE
    WHERE id = p_cycle_id;
  END IF;

  -- If next due date is provided, update contract
  IF p_next_due_date IS NOT NULL THEN
    UPDATE contracts
    SET next_due_date = p_next_due_date,
        updated_at = NOW()
    WHERE id = p_contract_id;
  END IF;

  -- If it's a CAPITAL payment (amortization), reduce the capital
  IF p_payment_type = 'CAPITAL' THEN
    UPDATE contracts
    SET capital = ROUND(GREATEST(0, capital - p_amount), 2),
        status = CASE WHEN (capital - p_amount) <= 0.01 THEN 'FINISHED' ELSE status END,
        updated_at = NOW()
    WHERE id = p_contract_id;
  END IF;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION edit_payment(
  p_payment_id BIGINT,
  p_new_amount NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_old_amount NUMERIC;
  v_contract_id BIGINT;
  v_cycle_id BIGINT;
  v_payment_type TEXT;
BEGIN
  -- Get payment details
  SELECT amount, contract_id, cycle_id, payment_type
  INTO v_old_amount, v_contract_id, v_cycle_id, v_payment_type
  FROM payments
  WHERE id = p_payment_id;

  -- Update payment
  UPDATE payments
  SET amount = p_new_amount,
      updated_at = NOW()
  WHERE id = p_payment_id;

  -- Revert impact of old amount and apply new amount
  
  -- If cycle exists, update paid_amount
  IF v_cycle_id IS NOT NULL THEN
    UPDATE interest_cycles
    SET paid_amount = paid_amount - v_old_amount + p_new_amount,
        status = CASE 
          WHEN (paid_amount - v_old_amount + p_new_amount) >= (base_interest_amount - 0.01) THEN 'PAID'
          ELSE 'PARTIAL'
        END
    WHERE id = v_cycle_id;
  END IF;

  -- If CAPITAL, update contract capital
  IF v_payment_type = 'CAPITAL' THEN
    UPDATE contracts
    SET capital = ROUND(GREATEST(0, capital + v_old_amount - p_new_amount), 2),
        status = CASE WHEN (capital + v_old_amount - p_new_amount) <= 0.01 THEN 'FINISHED' ELSE 'ACTIVE' END
    WHERE id = v_contract_id;
  END IF;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_payment(
  p_payment_id BIGINT
) RETURNS VOID AS $$
DECLARE
  v_amount NUMERIC;
  v_contract_id BIGINT;
  v_cycle_id BIGINT;
  v_payment_type TEXT;
BEGIN
  -- Get payment details
  SELECT amount, contract_id, cycle_id, payment_type
  INTO v_amount, v_contract_id, v_cycle_id, v_payment_type
  FROM payments
  WHERE id = p_payment_id;

  -- Delete payment
  DELETE FROM payments WHERE id = p_payment_id;

  -- Revert impact
  
  -- If cycle exists, reduce paid_amount
  IF v_cycle_id IS NOT NULL THEN
    UPDATE interest_cycles
    SET paid_amount = paid_amount - v_amount,
        status = CASE 
          WHEN (paid_amount - v_amount) >= (base_interest_amount - 0.01) THEN 'PAID'
          WHEN (paid_amount - v_amount) > 0.01 THEN 'PARTIAL'
          ELSE 'PENDING'
        END
    WHERE id = v_cycle_id;
  END IF;

  -- If CAPITAL, increase contract capital back
  IF v_payment_type = 'CAPITAL' THEN
    UPDATE contracts
    SET capital = ROUND(GREATEST(0, capital + v_amount), 2),
        status = 'ACTIVE' -- Reopening if it was finished
    WHERE id = v_contract_id;
  END IF;

END;
$$ LANGUAGE plpgsql;
