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
    COALESCE(SUM(CASE WHEN payment_type IN ('INTEREST', 'PARTIAL', 'ADVANCE_INTEREST') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'CAPITAL' THEN amount ELSE 0 END), 0)
  INTO v_total_received, v_interest_received, v_capital_received
  FROM payments
  WHERE (p_start_date IS NULL OR created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR created_at::DATE <= p_end_date);

  -- Count contracts
  SELECT COUNT(*) INTO v_active_contracts FROM contracts WHERE status IN ('ACTIVE', 'OVERDUE');
  SELECT COUNT(*) INTO v_overdue_contracts FROM contracts WHERE status = 'OVERDUE';

  -- Get recent payments
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_recent_payments
  FROM (
    SELECT 
      p.client_id,
      c.name as client_name,
      SUM(p.amount) as total_amount,
      jsonb_agg(jsonb_build_object(
        'id', p.id,
        'amount', p.amount,
        'payment_type', p.payment_type,
        'created_at', p.created_at,
        'contract_id', p.contract_id
      ) ORDER BY p.created_at DESC) as payments
    FROM payments p
    JOIN contracts ctr ON p.contract_id = ctr.id
    JOIN clients c ON ctr.client_id = c.id
    WHERE (p_start_date IS NULL OR p.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR p.created_at::DATE <= p_end_date)
    GROUP BY p.client_id, c.name
    ORDER BY MAX(p.created_at) DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'totalReceived', v_total_received,
    'interestReceived', v_interest_received,
    'capitalReceived', v_capital_received,
    'activeContracts', v_active_contracts,
    'overdueContracts', v_overdue_contracts,
    'recentPayments', v_recent_payments
  );
END;
$$ LANGUAGE plpgsql;
