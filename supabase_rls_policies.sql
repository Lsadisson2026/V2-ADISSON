-- ============================================================
-- RLS (Row Level Security) Policies para Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ─── HABILITAR RLS EM TODAS AS TABELAS ──────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES (Usuários) ─────────────────────────────────────

-- Usuários podem ver apenas seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Apenas admins podem criar/atualizar/deletar perfis
CREATE POLICY "Only admins can manage profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ─── CLIENTS (Clientes) ──────────────────────────────────────

-- Usuários autenticados podem ver todos os clientes
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  USING (auth.role() = 'authenticated');

-- Apenas usuários autenticados podem criar clientes
CREATE POLICY "Authenticated users can create clients"
  ON clients FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Apenas admins podem atualizar clientes
CREATE POLICY "Only admins can update clients"
  ON clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Apenas admins podem deletar clientes
CREATE POLICY "Only admins can delete clients"
  ON clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ─── CONTRACTS (Contratos) ───────────────────────────────────

-- Usuários autenticados podem ver todos os contratos
CREATE POLICY "Authenticated users can view contracts"
  ON contracts FOR SELECT
  USING (auth.role() = 'authenticated');

-- Apenas usuários autenticados podem criar contratos
CREATE POLICY "Authenticated users can create contracts"
  ON contracts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Apenas admins podem atualizar contratos
CREATE POLICY "Only admins can update contracts"
  ON contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Apenas admins podem deletar contratos
CREATE POLICY "Only admins can delete contracts"
  ON contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ─── INTEREST_CYCLES (Ciclos de Juros) ──────────────────────

-- Usuários autenticados podem ver todos os ciclos
CREATE POLICY "Authenticated users can view cycles"
  ON interest_cycles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Sistema pode criar ciclos (via RPC functions)
CREATE POLICY "System can create cycles"
  ON interest_cycles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Sistema pode atualizar ciclos (via RPC functions)
CREATE POLICY "System can update cycles"
  ON interest_cycles FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Apenas admins podem deletar ciclos
CREATE POLICY "Only admins can delete cycles"
  ON interest_cycles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ─── PAYMENTS (Pagamentos) ───────────────────────────────────

-- Usuários autenticados podem ver todos os pagamentos
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Usuários autenticados podem criar pagamentos
CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Apenas admins podem atualizar pagamentos
CREATE POLICY "Only admins can update payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Apenas admins podem deletar pagamentos
CREATE POLICY "Only admins can delete payments"
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ─── NOTIFICATIONS (Notificações) ────────────────────────────

-- Usuários podem ver apenas suas próprias notificações
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Sistema pode criar notificações
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Usuários podem atualizar suas próprias notificações (marcar como lida)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Apenas admins podem deletar notificações
CREATE POLICY "Only admins can delete notifications"
  ON notifications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================================
-- VERIFICAÇÃO: Execute para ver todas as políticas criadas
-- ============================================================

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
