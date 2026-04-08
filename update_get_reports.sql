CREATE OR REPLACE FUNCTION get_reports(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_total_received NUMERIC;
  v_interest_received NUMERIC;
  v_capital_received NUMERIC;
  v_active_contracts INT;
  v_overdue_contracts INT;
  v_recent_payments JSONB;
BEGIN
  -- Calculate totals
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN payment_type IN ('INTEREST', 'PARTIAL', 'ADVANCE_INTEREST', 'INSTALLMENT') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'CAPITAL' THEN amount ELSE 0 END), 0)
  INTO v_total_received, v_interest_received, v_capital_received
  FROM payments
  WHERE (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date);

  -- Count contracts
  SELECT COUNT(*) INTO v_active_contracts FROM contracts WHERE status = 'ACTIVE';
  SELECT COUNT(DISTINCT c.id) INTO v_overdue_contracts 
  FROM contracts c
  JOIN interest_cycles ic ON ic.contract_id = c.id
  WHERE ic.due_date < CURRENT_DATE AND ic.status != 'PAID';

  -- Get all payments grouped by client (sem limite)
  SELECT COALESCE(jsonb_agg(client_data ORDER BY last_payment DESC), '[]'::jsonb)
  INTO v_recent_payments
  FROM (
    SELECT 
      cl.id as client_id,
      cl.name as client_name,
      SUM(p.amount) as total_amount,
      MAX(p.created_at) as last_payment,
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'amount', p.amount,
          'payment_type', p.payment_type,
          'created_at', p.created_at,
          'contract_id', p.contract_id
        ) ORDER BY p.created_at DESC
      ) as payments
    FROM payments p
    JOIN contracts ct ON p.contract_id = ct.id
    JOIN clients cl ON ct.client_id = cl.id
    WHERE (p_start_date IS NULL OR DATE(p.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(p.created_at) <= p_end_date)
    GROUP BY cl.id, cl.name
  ) client_data;

  RETURN jsonb_build_object(
    'totalReceived', v_total_received,
    'interestReceived', v_interest_received,
    'capitalReceived', v_capital_received,
    'activeContracts', v_active_contracts,
    'overdueContracts', v_overdue_contracts,
    'recentPayments', v_recent_payments
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
