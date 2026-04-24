-- ============================================================
-- SETUP COMPLETO V2-ADISSON
-- Execute este arquivo no Supabase SQL Editor para configurar
-- o banco de dados 100% funcional
-- ============================================================

-- ============================================================
-- 1. CRIAR TABELAS BASE
-- ============================================================

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS contracts (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  capital NUMERIC(12,2) NOT NULL,
  interest_rate_monthly NUMERIC(5,4) NOT NULL,
  monthly_interest_amount NUMERIC(12,2),
  next_due_date DATE NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  guarantee_notes TEXT,
  contract_type TEXT DEFAULT 'REVOLVING',
  total_installments INT,
  paid_installments INT DEFAULT 0,
  installment_amount NUMERIC(12,2),
  archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Ciclos de Juros
CREATE TABLE IF NOT EXISTS interest_cycles (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  base_interest_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  cycle_id BIGINT REFERENCES interest_cycles(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL,
  payment_method TEXT DEFAULT 'PIX',
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Perfis
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  login TEXT UNIQUE,
  role TEXT DEFAULT 'COLLECTOR',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. ADICIONAR COLUNAS FALTANTES (se não existirem)
-- ============================================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cycle_id BIGINT REFERENCES interest_cycles(id);

-- ============================================================
-- 3. CRIAR ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_archived ON contracts(archived);
CREATE INDEX IF NOT EXISTS idx_interest_cycles_contract_id ON interest_cycles(contract_id);
CREATE INDEX IF NOT EXISTS idx_interest_cycles_status ON interest_cycles(status);
CREATE INDEX IF NOT EXISTS idx_interest_cycles_due_date ON interest_cycles(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_cycle_id ON payments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- 4. CRIAR FUNÇÕES RPC
-- ============================================================

-- Função: Criar Contrato
CREATE OR REPLACE FUNCTION create_contract(
  p_client_id BIGINT,
  p_capital NUMERIC,
  p_interest_rate_monthly NUMERIC,
  p_next_due_date DATE,
  p_guarantee_notes TEXT DEFAULT NULL,
  p_initial_status TEXT DEFAULT 'ACTIVE',
  p_created_by UUID DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_contract_id BIGINT;
  v_monthly_interest NUMERIC;
BEGIN
  v_monthly_interest := p_capital * p_interest_rate_monthly;
  
  INSERT INTO contracts (
    client_id, capital, interest_rate_monthly, monthly_interest_amount,
    next_due_date, status, guarantee_notes, created_by
  ) VALUES (
    p_client_id, p_capital, p_interest_rate_monthly, v_monthly_interest,
    p_next_due_date, p_initial_status, p_guarantee_notes, p_created_by
  ) RETURNING id INTO v_contract_id;
  
  INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount, status)
  VALUES (v_contract_id, p_next_due_date, v_monthly_interest, 'PENDING');
  
  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar Pagamento
CREATE OR REPLACE FUNCTION register_payment(
  p_contract_id BIGINT,
  p_cycle_id BIGINT DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_payment_type TEXT DEFAULT 'INTEREST',
  p_payment_method TEXT DEFAULT 'PIX',
  p_next_due_date DATE DEFAULT NULL,
  p_received_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_contract contracts%ROWTYPE;
  v_cycle interest_cycles%ROWTYPE;
  v_new_capital NUMERIC;
  v_new_interest NUMERIC;
BEGIN
  SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id;
  
  INSERT INTO payments (contract_id, cycle_id, amount, payment_type, payment_method, received_by)
  VALUES (p_contract_id, p_cycle_id, p_amount, p_payment_type, p_payment_method, p_received_by);
  
  IF p_cycle_id IS NOT NULL THEN
    SELECT * INTO v_cycle FROM interest_cycles WHERE id = p_cycle_id;
    
    UPDATE interest_cycles
    SET paid_amount = paid_amount + p_amount,
        status = CASE WHEN (paid_amount + p_amount) >= base_interest_amount THEN 'PAID' ELSE 'PENDING' END
    WHERE id = p_cycle_id;
  END IF;
  
  IF p_payment_type = 'CAPITAL' AND p_amount > 0 THEN
    v_new_capital := v_contract.capital - p_amount;
    v_new_interest := v_new_capital * v_contract.interest_rate_monthly;
    
    UPDATE contracts
    SET capital = v_new_capital,
        monthly_interest_amount = v_new_interest,
        next_due_date = COALESCE(p_next_due_date, next_due_date)
    WHERE id = p_contract_id;
    
    IF v_new_capital > 0 THEN
      INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount, status)
      VALUES (p_contract_id, COALESCE(p_next_due_date, next_due_date), v_new_interest, 'PENDING');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Arquivar Contrato
CREATE OR REPLACE FUNCTION archive_contract(p_contract_id BIGINT) RETURNS VOID AS $$
BEGIN
  UPDATE contracts SET archived = TRUE WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Desarquivar Contrato
CREATE OR REPLACE FUNCTION unarchive_contract(p_contract_id BIGINT) RETURNS VOID AS $$
BEGIN
  UPDATE contracts SET archived = FALSE WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Deletar Contrato
CREATE OR REPLACE FUNCTION delete_contract(p_contract_id BIGINT) RETURNS VOID AS $$
BEGIN
  DELETE FROM payments WHERE contract_id = p_contract_id;
  DELETE FROM interest_cycles WHERE contract_id = p_contract_id;
  DELETE FROM contracts WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Deletar Pagamento
CREATE OR REPLACE FUNCTION delete_payment(p_payment_id BIGINT) RETURNS VOID AS $$
BEGIN
  DELETE FROM payments WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Editar Pagamento
CREATE OR REPLACE FUNCTION edit_payment(p_payment_id BIGINT, p_new_amount NUMERIC) RETURNS VOID AS $$
BEGIN
  UPDATE payments SET amount = p_new_amount WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Atualizar Data de Vencimento
CREATE OR REPLACE FUNCTION update_due_date(p_contract_id BIGINT, p_new_date DATE) RETURNS VOID AS $$
BEGIN
  UPDATE contracts SET next_due_date = p_new_date WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Deletar Cliente
CREATE OR REPLACE FUNCTION delete_client(p_client_id BIGINT) RETURNS VOID AS $$
BEGIN
  DELETE FROM payments WHERE contract_id IN (SELECT id FROM contracts WHERE client_id = p_client_id);
  DELETE FROM interest_cycles WHERE contract_id IN (SELECT id FROM contracts WHERE client_id = p_client_id);
  DELETE FROM contracts WHERE client_id = p_client_id;
  DELETE FROM clients WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Obter Todos os Clientes
CREATE OR REPLACE FUNCTION get_all_clients() RETURNS TABLE (
  id BIGINT, name TEXT, cpf TEXT, phone TEXT, address TEXT, notes TEXT, status TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT c.id, c.name, c.cpf, c.phone, c.address, c.notes, c.status FROM clients c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Dashboard
CREATE OR REPLACE FUNCTION get_dashboard(p_user_id UUID DEFAULT NULL) RETURNS JSONB AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_result JSONB;
BEGIN
  v_result := jsonb_build_object(
    'overdue', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ic.id, 'contract_id', ic.contract_id, 'due_date', ic.due_date,
        'base_interest_amount', ic.base_interest_amount, 'paid_amount', ic.paid_amount,
        'status', ic.status, 'client_name', cl.name, 'client_phone', cl.phone
      ))
      FROM interest_cycles ic
      JOIN contracts c ON c.id = ic.contract_id
      JOIN clients cl ON cl.id = c.client_id
      WHERE ic.due_date < v_today AND ic.status = 'PENDING' AND c.archived = FALSE
    ),
    'today', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ic.id, 'contract_id', ic.contract_id, 'due_date', ic.due_date,
        'base_interest_amount', ic.base_interest_amount, 'paid_amount', ic.paid_amount,
        'status', ic.status, 'client_name', cl.name, 'client_phone', cl.phone
      ))
      FROM interest_cycles ic
      JOIN contracts c ON c.id = ic.contract_id
      JOIN clients cl ON cl.id = c.client_id
      WHERE ic.due_date = v_today AND ic.status = 'PENDING' AND c.archived = FALSE
    ),
    'scheduled', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ic.id, 'contract_id', ic.contract_id, 'due_date', ic.due_date,
        'base_interest_amount', ic.base_interest_amount, 'paid_amount', ic.paid_amount,
        'status', ic.status, 'client_name', cl.name, 'client_phone', cl.phone
      ))
      FROM interest_cycles ic
      JOIN contracts c ON c.id = ic.contract_id
      JOIN clients cl ON cl.id = c.client_id
      WHERE ic.due_date > v_today AND ic.status = 'PENDING' AND c.archived = FALSE
    ),
    'all', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'client_id', c.client_id, 'capital', c.capital,
        'interest_rate_monthly', c.interest_rate_monthly, 'monthly_interest_amount', c.monthly_interest_amount,
        'next_due_date', c.next_due_date, 'status', c.status, 'archived', c.archived,
        'client_name', cl.name, 'client_phone', cl.phone
      ))
      FROM contracts c
      JOIN clients cl ON cl.id = c.client_id
      WHERE c.status = 'ACTIVE' AND c.archived = FALSE
    ),
    'metrics', jsonb_build_object(
      'total_on_street', COALESCE((SELECT SUM(capital) FROM contracts WHERE status = 'ACTIVE' AND archived = FALSE), 0),
      'total_interest_received', COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type IN ('INTEREST', 'PARTIAL')), 0),
      'total_capital_received', COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type = 'CAPITAL'), 0)
    )
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Relatórios
CREATE OR REPLACE FUNCTION get_reports(p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := jsonb_build_object(
    'totalReceived', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
    ), 0),
    'interestReceived', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE payment_type IN ('INTEREST', 'PARTIAL')
        AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
    ), 0),
    'capitalReceived', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE payment_type = 'CAPITAL'
        AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
    ), 0),
    'activeContracts', (SELECT COUNT(*) FROM contracts WHERE status = 'ACTIVE' AND archived = FALSE),
    'overdueContracts', (SELECT COUNT(DISTINCT c.id) FROM contracts c JOIN interest_cycles ic ON ic.contract_id = c.id WHERE ic.status = 'PENDING' AND ic.due_date < CURRENT_DATE AND c.archived = FALSE)
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Criar Notificação
CREATE OR REPLACE FUNCTION create_notification(p_type TEXT, p_title TEXT, p_body TEXT, p_data TEXT DEFAULT NULL) RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT id, p_type, p_title, p_body, p_data::JSONB FROM auth.users LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Obter Notificações
CREATE OR REPLACE FUNCTION get_notifications(p_limit INT DEFAULT 50) RETURNS TABLE (
  id BIGINT, type TEXT, title TEXT, body TEXT, data JSONB, read BOOLEAN, created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY SELECT n.id, n.type, n.title, n.body, n.data, n.read, n.created_at
  FROM notifications n ORDER BY n.created_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Marcar Notificações como Lidas
CREATE OR REPLACE FUNCTION mark_notifications_read(p_ids BIGINT[] DEFAULT NULL) RETURNS VOID AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    UPDATE notifications SET read = TRUE;
  ELSE
    UPDATE notifications SET read = TRUE WHERE id = ANY(p_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para Clientes
CREATE POLICY "Clientes visíveis para todos" ON clients FOR SELECT USING (TRUE);
CREATE POLICY "Clientes criáveis por autenticados" ON clients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Clientes editáveis por criador" ON clients FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%'));

-- Políticas para Contratos
CREATE POLICY "Contratos visíveis para todos" ON contracts FOR SELECT USING (TRUE);
CREATE POLICY "Contratos criáveis por autenticados" ON contracts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Contratos editáveis por criador" ON contracts FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%'));

-- Políticas para Ciclos de Juros
CREATE POLICY "Ciclos visíveis para todos" ON interest_cycles FOR SELECT USING (TRUE);
CREATE POLICY "Ciclos criáveis por autenticados" ON interest_cycles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para Pagamentos
CREATE POLICY "Pagamentos visíveis para todos" ON payments FOR SELECT USING (TRUE);
CREATE POLICY "Pagamentos criáveis por autenticados" ON payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para Notificações
CREATE POLICY "Notificações visíveis para o usuário" ON notifications FOR SELECT USING (user_id = auth.uid() OR auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%'));

-- Políticas para Perfis
CREATE POLICY "Perfis visíveis para todos" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Perfil editável pelo próprio usuário" ON profiles FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 6. CRIAR TRIGGERS
-- ============================================================

-- Trigger para atualizar updated_at em contracts
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_updated_at_trigger
BEFORE UPDATE ON contracts
FOR EACH ROW
EXECUTE FUNCTION update_contracts_updated_at();

-- Trigger para atualizar updated_at em payments
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at_trigger
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_payments_updated_at();

-- ============================================================
-- 7. DADOS INICIAIS (OPCIONAL)
-- ============================================================

-- Descomente para adicionar dados de teste
-- INSERT INTO clients (name, cpf, phone, status) VALUES
-- ('Cliente Teste 1', '12345678901', '27988960875', 'ACTIVE'),
-- ('Cliente Teste 2', '98765432101', '27987654321', 'ACTIVE');

-- ============================================================
-- SETUP COMPLETO FINALIZADO
-- ============================================================
-- O banco de dados está 100% funcional!
-- Próximos passos:
-- 1. Trocar as credenciais do Supabase no .env
-- 2. Executar: npm install
-- 3. Executar: npm run dev
-- ============================================================
