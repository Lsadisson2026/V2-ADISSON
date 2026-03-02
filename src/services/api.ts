// ============================================================
// api.ts — Camada de serviços. Substitui completamente server.ts.
// Todas as chamadas ao Supabase ficam aqui.
// ============================================================

import { supabase } from './supabaseClient';

// ─── TIPOS LOCAIS ────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COLLECTOR';
}

// ─── AUTH ────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw new Error('Erro ao carregar perfil.');

  return {
    id:    data.user.id,
    name:  profile.name,
    email: data.user.email!,
    role:  profile.role,
  };
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', session.user.id)
    .single();

  if (!profile) return null;

  return {
    id:    session.user.id,
    name:  profile.name,
    email: session.user.email!,
    role:  profile.role,
  };
}

export async function signUp(name: string, email: string, password: string, adminCode?: string): Promise<AuthUser> {
  const role = adminCode === 'admin123' ? 'ADMIN' : 'COLLECTOR';
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      }
    }
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Erro ao criar usuário.');

  return {
    id:    data.user.id,
    name,
    email: data.user.email!,
    role,
  };
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message);
}

export async function updateCurrentUserPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ─── USUÁRIOS (via RPC com SECURITY DEFINER — sem Edge Functions) ──

export async function createCollector(name: string, email: string, password: string): Promise<{ id: string; login: string }> {
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_name:     name,
    p_email:    email,
    p_password: password,
    p_role:     'COLLECTOR',
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_password', {
    p_user_id:     userId,
    p_new_password: newPassword,
  });
  if (error) throw new Error(error.message);
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function listUsers(): Promise<any[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, login, role, created_at')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── CLIENTES ────────────────────────────────────────────────

export async function getClients(search?: string): Promise<any[]> {
  let query = supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,cpf.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientDetails(clientId: number): Promise<any> {
  const [clientRes, contractsRes, cyclesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase
      .from('contracts')
      .select('*, overdue_count:interest_cycles(count)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('interest_cycles')
      .select('*, contracts!inner(client_id, capital)')
      .eq('contracts.client_id', clientId)
      .neq('status', 'PAID')
      .order('due_date', { ascending: true }),
  ]);

  if (clientRes.error) throw new Error(clientRes.error.message);

  // Conta overdue por contrato
  const contracts = (contractsRes.data ?? []).map((c: any) => ({
    ...c,
    overdue_count: Array.isArray(c.overdue_count)
      ? c.overdue_count.filter((ic: any) => ic.status === 'OVERDUE').length
      : 0,
  }));

  // Busca ciclos pendentes com join manual
  const { data: rawCycles } = await supabase
    .from('interest_cycles')
    .select(`
      id, contract_id, due_date, base_interest_amount, paid_amount, status,
      contracts!inner ( client_id, capital )
    `)
    .eq('contracts.client_id', clientId)
    .neq('status', 'PAID')
    .order('due_date', { ascending: true });

  const interestCycles = (rawCycles ?? []).map((ic: any) => ({
    ...ic,
    capital: ic.contracts?.capital,
  }));

  return {
    client:         clientRes.data,
    contracts,
    interestCycles,
  };
}

export async function createClient(data: {
  name: string; cpf?: string; address?: string; phone?: string; notes?: string;
}): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data: result, error } = await supabase
    .from('clients')
    .insert({ ...data, created_by: session?.user.id })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return result.id;
}

export async function updateClient(id: number, data: {
  name: string; cpf?: string; address?: string; phone?: string; notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('clients').update(data).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteClient(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_client', { p_client_id: id });
  if (error) throw new Error(error.message);
}

// ─── CONTRATOS ───────────────────────────────────────────────

export async function getContracts(status?: string): Promise<any[]> {
  let query = supabase
    .from('contracts')
    .select('*, clients!inner(name, phone)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((c: any) => ({
    ...c,
    client_name:  c.clients?.name,
    client_phone: c.clients?.phone,
  }));
}

export async function createContract(params: {
  client_id: number;
  capital: number;
  interest_rate_monthly: number; // decimal, ex: 0.10
  next_due_date: string;
  guarantee_notes?: string;
}): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.rpc('create_contract', {
    p_client_id:             params.client_id,
    p_capital:               params.capital,
    p_interest_rate_monthly: params.interest_rate_monthly,
    p_next_due_date:         params.next_due_date,
    p_guarantee_notes:       params.guarantee_notes ?? null,
    p_created_by:            session?.user.id,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContract(id: number, data: {
  capital?: number;
  interest_rate_monthly?: number;
  status?: string;
  guarantee_notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('contracts').update(data).eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── CICLOS DE JUROS ─────────────────────────────────────────

export async function getCycles(filters: {
  date?: string; status?: string; contract_id?: number;
}): Promise<any[]> {
  let query = supabase
    .from('interest_cycles')
    .select(`
      *,
      contracts!inner ( client_id, guarantee_notes,
        clients!inner ( name, phone )
      )
    `)
    .order('due_date', { ascending: true });

  if (filters.date)        query = query.eq('due_date', filters.date);
  if (filters.status)      query = query.eq('status', filters.status);
  if (filters.contract_id) query = query.eq('contract_id', filters.contract_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((ic: any) => ({
    ...ic,
    client_name:    ic.contracts?.clients?.name,
    client_phone:   ic.contracts?.clients?.phone,
    guarantee_notes: ic.contracts?.guarantee_notes,
  }));
}

// ─── PAGAMENTOS ──────────────────────────────────────────────

export async function registerPayment(params: {
  contract_id: number;
  cycle_id?: number | null;
  amount: number;
  payment_type: 'INTEREST' | 'CAPITAL' | 'PARTIAL' | 'ADVANCE_INTEREST';
  payment_method: 'PIX' | 'CASH';
  next_due_date?: string | null;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.rpc('register_payment', {
    p_contract_id:    params.contract_id,
    p_cycle_id:       params.cycle_id ?? null,
    p_amount:         params.amount,
    p_payment_type:   params.payment_type,
    p_payment_method: params.payment_method,
    p_next_due_date:  params.next_due_date ?? null,
    p_received_by:    session?.user.id,
  });
  if (error) throw new Error(error.message);
}

// ─── RENEGOCIAÇÃO ────────────────────────────────────────────

export async function renegotiateClient(params: {
  client_id: number;
  contract_ids: number[];
  new_capital: number;
  new_rate: number;        // em %, ex: 10
  next_due_date: string;
  guarantee_notes?: string;
  interest_only: boolean;
}): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.rpc('renegotiate_client', {
    p_client_id:       params.client_id,
    p_contract_ids:    params.contract_ids,
    p_new_capital:     params.new_capital,
    p_new_rate:        params.new_rate,
    p_next_due_date:   params.next_due_date,
    p_guarantee_notes: params.guarantee_notes ?? null,
    p_interest_only:   params.interest_only,
    p_created_by:      session?.user.id,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ─── DASHBOARD ───────────────────────────────────────────────

export async function getDashboard(): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.rpc('get_dashboard', {
    p_user_id: session?.user.id,
  });
  if (error) throw new Error(error.message);

  // Agrupa pagamentos recentes por cliente
  const raw: any[] = data?.recent_payments ?? [];
  const clientMap = new Map<number, any>();
  const groupedPayments: any[] = [];

  raw.forEach((p: any) => {
    if (!clientMap.has(p.client_id)) {
      const entry = { client_id: p.client_id, client_name: p.client_name, total_amount: 0, payments: [] };
      clientMap.set(p.client_id, entry);
      groupedPayments.push(entry);
    }
    const e = clientMap.get(p.client_id);
    e.payments.push(p);
    e.total_amount += p.amount;
  });

  return { ...data, recent_payments: groupedPayments.slice(0, 10) };
}

// ─── RELATÓRIOS ──────────────────────────────────────────────

export async function getReports(startDate?: string, endDate?: string): Promise<any> {
  const { data, error } = await supabase.rpc('get_reports', {
    p_start_date: startDate ?? null,
    p_end_date:   endDate   ?? null,
  });
  if (error) throw new Error(error.message);

  const payments: any[]         = data?.payments         ?? [];
  const activeContracts: any[]  = data?.activeContracts  ?? [];
  const overdueContracts: any[] = data?.overdueContracts ?? [];

  const totalReceived    = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const interestReceived = payments
    .filter((p: any) => ['INTEREST', 'PARTIAL', 'ADVANCE_INTEREST'].includes(p.payment_type))
    .reduce((s: number, p: any) => s + p.amount, 0);

  // Agrupa pagamentos por cliente
  const clientMap = new Map<number, any>();
  const groupedPayments: any[] = [];
  payments.slice(0, 50).forEach((p: any) => {
    if (!clientMap.has(p.client_id)) {
      const e = { client_id: p.client_id, client_name: p.client_name, total_amount: 0, payments: [] };
      clientMap.set(p.client_id, e);
      groupedPayments.push(e);
    }
    const e = clientMap.get(p.client_id);
    e.payments.push(p);
    e.total_amount += p.amount;
  });

  return {
    totalReceived,
    interestReceived,
    activeContracts:  activeContracts.length,
    overdueContracts: overdueContracts.length,
    recentPayments:   groupedPayments,
    details: {
      payments,
      activeContracts,
      overdueContracts,
    },
  };
}