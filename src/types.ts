export interface User {
  id: number;
  name: string;
  role: 'ADMIN' | 'COLLECTOR';
}

export interface Client {
  id: number;
  name: string;
  cpf: string;
  address: string;
  phone: string;
  notes: string;
  status: 'ACTIVE' | 'BLOCKED' | 'PENDING';
}

export interface Contract {
  id: number;
  client_id: number;
  client_name?: string;
  client_phone?: string;
  capital?: number;
  interest_rate_monthly: number;
  monthly_interest_amount: number;
  next_due_date: string;
  status: 'ACTIVE' | 'CLOSED';
  guarantee_notes: string;
  created_at: string;
}

export interface InterestCycle {
  id: number;
  contract_id: number;
  client_name?: string;
  client_phone?: string;
  due_date: string;
  base_interest_amount: number;
  paid_amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  guarantee_notes?: string;
}

export interface Payment {
  id: number;
  contract_id: number;
  interest_cycle_id?: number;
  amount: number;
  payment_type: 'INTEREST' | 'CAPITAL' | 'PARTIAL' | 'ADVANCE_INTEREST';
  payment_method: 'PIX' | 'CASH';
  created_at: string;
  client_name?: string;
}
