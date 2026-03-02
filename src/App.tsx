import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, TrendingUp, DollarSign, FileText,
  AlertCircle, PlusCircle, CheckCircle2, Phone, LogOut, Menu, X,
  Calculator as CalcIcon, ArrowRight, Search, MapPin, CreditCard,
  RefreshCw, Trash2, Edit, ChevronDown, Settings, Home, BookOpen,
  Eye, EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, addDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import * as api from './services/api';
import { supabase } from './services/supabaseClient';

// ─── TIPOS ───────────────────────────────────────────────────
interface AppUser { id: string; name: string; email: string; role: 'ADMIN' | 'COLLECTOR'; }
interface Client  { id: number; name: string; cpf?: string; address?: string; phone?: string; notes?: string; status: string; }
interface Contract { id: number; client_id: number; capital: number; interest_rate_monthly: number; monthly_interest_amount: number; next_due_date: string; status: string; guarantee_notes?: string; overdue_count?: number; }
interface InterestCycle { id: number; contract_id: number; due_date: string; base_interest_amount: number; paid_amount: number; status: string; client_name?: string; client_phone?: string; capital?: number; }

// ─── TOKENS ──────────────────────────────────────────────────
const card = 'bg-[#0f172a] border border-blue-900/30 rounded-2xl shadow-sm';
const inp  = 'w-full bg-[#1e293b] border border-blue-900/30 text-white placeholder-slate-500 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-xs';
const lbl  = 'block text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5';
const primaryBtn = 'w-full bg-gradient-to-r from-blue-700 to-slate-900 hover:from-blue-600 hover:to-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.97] text-xs tracking-wide';

// ─── HELPERS ─────────────────────────────────────────────────
const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default'|'success'|'warning'|'danger' }) => {
  const v = { default: 'bg-slate-800 text-slate-400', success: 'bg-emerald-900/30 text-emerald-400', warning: 'bg-amber-900/30 text-amber-400', danger: 'bg-red-900/30 text-red-400' };
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${v[variant]}`}>{children}</span>;
};

const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"><X size={16} className="text-slate-400" /></button>
      </div>
      {children}
    </motion.div>
  </div>
);

const MetricCard = ({ label, value, icon: Icon, iconBg, iconColor, labelColor, onClick }: any) => (
  <div className={`${card} p-4 cursor-pointer active:scale-[0.97] transition-transform`} onClick={onClick}>
    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-2`}><Icon size={15} className={iconColor} /></div>
    <p className={`text-[9px] font-bold uppercase tracking-[0.1em] mb-1 leading-tight ${labelColor || 'text-slate-500'}`}>{label}</p>
    <p className="text-lg font-bold text-white leading-tight whitespace-pre-line">{value}</p>
  </div>
);

const CycleItem = ({ cycle, onPay, onMessage, user }: { cycle: InterestCycle; onPay: (c: InterestCycle) => void; onMessage: (c: InterestCycle) => void; user: any; key?: any }) => {
  const isOverdue = new Date(cycle.due_date) < new Date(format(new Date(), 'yyyy-MM-dd')) && cycle.status !== 'PAID';
  return (
    <div className={`${card} p-4 mb-3`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-3">
          <h3 className="text-sm font-bold text-white leading-tight">{cycle.client_name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={cycle.status === 'PAID' ? 'success' : isOverdue ? 'danger' : 'warning'}>
              {cycle.status === 'PAID' ? 'PAGO' : isOverdue ? 'VENCIDO' : 'PENDENTE'}
            </Badge>
            <span className="text-[9px] text-slate-500 font-semibold">{format(new Date(cycle.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
          </div>
        </div>
        <button onClick={() => onMessage(cycle)} className="w-8 h-8 bg-blue-900/20 text-blue-400 rounded-lg flex items-center justify-center border border-blue-900/30">
          <Phone size={14} />
        </button>
      </div>
      <div className="flex items-center justify-center py-3 bg-blue-950/30 rounded-xl border border-blue-900/20 mb-3">
        <div className="text-center">
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.15em] mb-0.5">Valor dos Juros</p>
          <p className="text-xl font-bold text-white">R$ {cycle.base_interest_amount.toFixed(2)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cycle.status !== 'PAID' && (
          <button onClick={() => onPay(cycle)} className="col-span-2 bg-gradient-to-r from-blue-700 to-slate-900 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-blue-900/20">
            <CheckCircle2 size={14} /> PAGAR JUROS
          </button>
        )}
        <button onClick={() => onPay({ ...cycle, status: 'PENDING' } as any)} className="bg-slate-800/50 text-slate-400 font-bold py-2 rounded-xl text-[10px] border border-slate-700/50">CAPITAL</button>
        <button onClick={() => onMessage(cycle)} className="bg-slate-800/50 text-slate-400 font-bold py-2 rounded-xl text-[10px] border border-slate-700/50">MENSAGEM</button>
      </div>
    </div>
  );
};

const ClientSearch = ({ onSearch, searchResults, showSearchResults, onSelectClient }: { onSearch: (q: string) => void; searchResults: Client[]; showSearchResults: boolean; onSelectClient: (id: number) => void }) => {
  const [query, setQuery] = useState('');
  return (
    <div className="relative mb-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input type="text" placeholder="Buscar por nome ou CPF..." value={query}
          onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }} className={`${inp} pl-10`} />
      </div>
      <AnimatePresence>
        {showSearchResults && searchResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            {searchResults.map(c => (
              <button key={c.id} onClick={() => { onSelectClient(c.id); setQuery(''); }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 border-b border-slate-700/50 last:border-0 text-left">
                <div><p className="font-bold text-white text-xs">{c.name}</p><p className="text-[9px] text-slate-400">CPF: {c.cpf || 'Não informado'}</p></div>
                <ArrowRight size={12} className="text-slate-500" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── LOGIN ────────────────────────────────────────────────────
const Login = ({ onLogin }: { onLogin: (u: AppUser) => void }) => {
  const [mode, setMode]         = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await api.login(email, password);
        onLogin(user);
      } else if (mode === 'signup') {
        const user = await api.signUp(name, email, password, adminCode);
        onLogin(user);
      } else if (mode === 'forgot') {
        await api.sendPasswordResetEmail(email);
        setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[340px] bg-blue-900/20 rounded-full blur-[100px]" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-700 to-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-900/30">
            <TrendingUp className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Capital Rotativo</h1>
          <p className="text-slate-500 text-xs mt-1">Gestão financeira simplificada</p>
        </div>
        <div className={`${card} p-6`}>
          <h2 className="text-white font-bold text-center mb-6 uppercase tracking-widest text-[10px]">
            {mode === 'login' ? 'Entrar na Conta' : mode === 'signup' ? 'Criar Nova Conta' : 'Recuperar Senha'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div><label className={lbl}>Nome Completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="Seu nome" required />
              </div>
            )}
            <div><label className={lbl}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} placeholder="seu@email.com" required autoComplete="email" />
            </div>
            {mode !== 'forgot' && (
              <div><label className={lbl}>Senha</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={inp} placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
            {mode === 'signup' && (
              <div><label className={lbl}>Código de Admin (Opcional)</label>
                <input type="text" value={adminCode} onChange={e => setAdminCode(e.target.value)} className={inp} placeholder="Código para admin" />
              </div>
            )}
            {error && <p className="text-red-400 text-[10px] font-bold text-center bg-red-900/20 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-emerald-400 text-[10px] font-bold text-center bg-emerald-900/20 py-2 rounded-lg">{success}</p>}
            
            <button type="submit" disabled={loading} className={`${primaryBtn} mt-2 flex items-center justify-center gap-2`}>
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> PROCESSANDO...</> : 
                mode === 'login' ? 'ENTRAR NO SISTEMA' : mode === 'signup' ? 'CRIAR CONTA' : 'ENVIAR E-MAIL'}
            </button>
          </form>

          <div className="mt-6 space-y-3 pt-6 border-t border-blue-900/20">
            {mode === 'login' ? (
              <>
                <button onClick={() => setMode('signup')} className="w-full text-slate-400 hover:text-white text-[10px] font-bold transition-colors">NÃO TEM CONTA? CRIE UMA</button>
                <button onClick={() => setMode('forgot')} className="w-full text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors">ESQUECEU SUA SENHA?</button>
              </>
            ) : (
              <button onClick={() => setMode('login')} className="w-full text-slate-400 hover:text-white text-[10px] font-bold transition-colors">VOLTAR PARA O LOGIN</button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── PAYMENT FORM ────────────────────────────────────────────
const PaymentForm = ({ selectedCycle, onSubmit }: { selectedCycle: InterestCycle | null; onSubmit: (data: any) => void }) => {
  const [paymentType, setPaymentType] = useState('INTEREST');
  const [amount, setAmount]           = useState<number>(selectedCycle?.base_interest_amount || 0);
  const [loading, setLoading]         = useState(false);
  const inp2 = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all text-sm';
  const lbl2 = 'block text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] mb-1.5';

  useEffect(() => {
    if (paymentType === 'CAPITAL') setAmount(selectedCycle?.capital || 0);
    else setAmount(selectedCycle?.base_interest_amount || 0);
  }, [paymentType, selectedCycle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target as HTMLFormElement);
    await onSubmit({
      contract_id:    selectedCycle?.contract_id,
      cycle_id:       selectedCycle?.id,
      amount:         parseFloat(fd.get('amount') as string),
      payment_type:   fd.get('payment_type') as string,
      payment_method: fd.get('payment_method') as string,
      next_due_date:  fd.get('next_due_date') as string,
    });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-5 bg-blue-600/10 border border-blue-500/25 rounded-2xl text-center">
        <p className="text-[9px] text-blue-400 uppercase font-black tracking-[0.2em] mb-1">
          {paymentType === 'CAPITAL' ? 'Saldo Devedor' : 'Valor dos Juros'}
        </p>
        <p className="text-xl font-black text-white">R$ {amount.toFixed(2)}</p>
        <p className="text-sm font-bold text-white/60 mt-2">{selectedCycle?.client_name}</p>
        <p className="text-xs text-white/30">Venc: {selectedCycle && format(new Date(selectedCycle.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
      </div>
      <div><label className={lbl2}>Valor (R$)</label>
        <input name="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className={inp2} required />
      </div>
      <div><label className={lbl2}>Próximo Vencimento</label>
        <input name="next_due_date" type="date" defaultValue={selectedCycle ? format(addDays(new Date(selectedCycle.due_date + 'T12:00:00'), 30), 'yyyy-MM-dd') : ''} className={inp2} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl2}>Tipo</label>
          <select name="payment_type" value={paymentType} onChange={e => setPaymentType(e.target.value)} className={inp2}>
            <option value="INTEREST">Juros</option>
            <option value="CAPITAL">Capital</option>
            <option value="PARTIAL">Parcial</option>
          </select>
        </div>
        <div><label className={lbl2}>Método</label>
          <select name="payment_method" className={inp2}>
            <option value="PIX">PIX</option>
            <option value="CASH">Dinheiro</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> PROCESSANDO...</> : 'CONFIRMAR RECEBIMENTO'}
      </button>
    </form>
  );
};

// ─── RENEGOTIATE FORM ────────────────────────────────────────
const RenegotiateForm = ({ client, activeContracts, interestCycles, onClose, onSuccess }: { client: Client; activeContracts: Contract[]; interestCycles?: InterestCycle[]; onClose: () => void; onSuccess: () => void }) => {
  const [selectedContracts, setSelectedContracts] = useState<number[]>(activeContracts.map(c => c.id));
  const [newCapital, setNewCapital]   = useState(activeContracts.reduce((a, c) => a + c.capital, 0));
  const [interestOnly, setInterestOnly] = useState(false);
  const [loading, setLoading]         = useState(false);
  const inp2 = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all text-sm';
  const lbl2 = 'block text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] mb-1.5';

  useEffect(() => {
    if (interestOnly) {
      const pending = interestCycles?.filter(ic => selectedContracts.includes(ic.contract_id) && ic.status !== 'PAID')
        .reduce((s, ic) => s + (ic.base_interest_amount - (ic.paid_amount || 0)), 0) || 0;
      setNewCapital(pending);
    } else {
      setNewCapital(activeContracts.filter(c => selectedContracts.includes(c.id)).reduce((a, c) => a + c.capital, 0));
    }
  }, [selectedContracts, interestOnly, activeContracts, interestCycles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContracts.length) { alert('Selecione ao menos um contrato.'); return; }
    const fd = new FormData(e.target as HTMLFormElement);
    setLoading(true);
    try {
      await api.renegotiateClient({
        client_id:       client.id,
        contract_ids:    selectedContracts,
        new_capital:     parseFloat(fd.get('new_capital') as string),
        new_rate:        parseFloat(fd.get('new_rate') as string),
        next_due_date:   fd.get('next_due_date') as string,
        guarantee_notes: fd.get('guarantee_notes') as string,
        interest_only:   interestOnly,
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 max-h-36 overflow-y-auto">
        <p className={lbl2}>Contratos</p>
        {activeContracts.map(contract => (
          <div key={contract.id} onClick={() => setSelectedContracts(prev => prev.includes(contract.id) ? prev.filter(c => c !== contract.id) : [...prev, contract.id])}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${selectedContracts.includes(contract.id) ? 'bg-blue-500/10 border-blue-500/40' : 'bg-white/[0.04] border-white/[0.07]'}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selectedContracts.includes(contract.id)} onChange={() => {}} className="accent-blue-500" />
              <span className="text-sm text-white font-bold">R$ {contract.capital.toFixed(2)}</span>
            </div>
            <span className="text-[10px] text-white/35">Juros: R$ {contract.monthly_interest_amount?.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
        <input type="checkbox" id="interestOnly" checked={interestOnly} onChange={e => setInterestOnly(e.target.checked)} className="accent-blue-500 w-4 h-4" />
        <label htmlFor="interestOnly" className="text-xs font-bold text-blue-400 cursor-pointer select-none">Renegociar apenas juros pendentes</label>
      </div>
      {interestOnly && <p className="text-[10px] text-white/40 leading-tight">Contratos originais permanecem. Novo contrato cobre os juros pendentes.</p>}
      <div><label className={lbl2}>Novo Capital</label><input name="new_capital" type="number" step="0.01" value={newCapital} onChange={e => setNewCapital(parseFloat(e.target.value) || 0)} className={inp2} required /></div>
      <div><label className={lbl2}>Nova Taxa (%)</label><input name="new_rate" type="number" step="0.1" defaultValue="10" className={inp2} required /></div>
      <div><label className={lbl2}>Próx. Vencimento</label><input name="next_due_date" type="date" defaultValue={format(addDays(new Date(), 30), 'yyyy-MM-dd')} className={inp2} required /></div>
      <div><label className={lbl2}>Garantia</label><textarea name="guarantee_notes" className={`${inp2} h-20 resize-none`}></textarea></div>
      <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50">
        {loading ? 'PROCESSANDO...' : 'CONFIRMAR RENEGOCIAÇÃO'}
      </button>
    </form>
  );
};

// ─── CALCULATOR ──────────────────────────────────────────────
const CalculatorView = () => {
  const [capital, setCapital] = useState(1000);
  const [rate, setRate]       = useState(10);
  const monthly = capital * (rate / 100);
  const inp2 = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all text-sm';
  const lbl2 = 'block text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] mb-1.5';
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white leading-tight">Calculadora<br />de Juros</h1>
      <div className="bg-[#12111a] border border-white/[0.07] rounded-2xl p-4 space-y-4">
        <div><label className={lbl2}>Capital (R$)</label><input type="number" value={capital} onChange={e => setCapital(parseFloat(e.target.value)||0)} className={inp2} /></div>
        <div><label className={lbl2}>Juros Mensal (%)</label><input type="number" value={rate} onChange={e => setRate(parseFloat(e.target.value)||0)} className={inp2} /></div>
        <div className="p-6 bg-gradient-to-br from-blue-600/20 to-slate-700/10 rounded-2xl border border-blue-500/25 text-center">
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Juros Mensal</p>
          <p className="text-3xl font-black text-white">R$ {monthly.toFixed(2)}</p>
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-blue-500/15 text-xs text-white/30">
            <span>Anual: R$ {(monthly * 12).toFixed(2)}</span>
            <span>Taxa: {rate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── REPORTS ─────────────────────────────────────────────────
const ReportsView = () => {
  const [report, setReport]         = useState<any>(null);
  const [dates, setDates]           = useState({ start: '', end: '' });
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const inp2  = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all text-sm';
  const card2 = 'bg-[#12111a] border border-white/[0.07] rounded-2xl';

  const fetchReport = async () => {
    try {
      const data = await api.getReports(dates.start || undefined, dates.end || undefined);
      setReport(data);
    } catch (err: any) { alert(err.message); }
  };

  useEffect(() => { fetchReport(); }, []);

  const groupByClient = (items: any[]) => {
    const g: any = {};
    items.forEach(i => { if (!g[i.client_id]) g[i.client_id] = { name: i.client_name, items: [] }; g[i.client_id].items.push(i); });
    return Object.values(g);
  };

  const renderList = (items: any[], renderItem: (i: any) => React.ReactNode, title: string) => (
    <div>
      <p className="text-sm font-black text-white mb-3">{title}</p>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {groupByClient(items).map((g: any) => (
          <div key={g.name} className={`${card2} overflow-hidden`}>
            <details className="group">
              <summary className="flex items-center justify-between p-3 cursor-pointer list-none hover:bg-white/[0.02]">
                <span className="font-bold text-white text-sm">{g.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-white/[0.07] text-white/40 px-2 py-0.5 rounded-full">{g.items.length}</span>
                  <ChevronDown size={13} className="text-white/30 group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              <div className="px-3 pb-3 border-t border-white/[0.05]">{g.items.map(renderItem)}</div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );

  const getModalContent = () => {
    if (!report?.details) return null;
    switch (selectedMetric) {
      case 'totalReceived':    return renderList(report.details.payments, (p: any) => <div key={p.id} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0 text-xs"><p className="text-white/35">{format(new Date(p.created_at), 'dd/MM/yy')}</p><p className="font-black text-emerald-400">R$ {p.amount.toFixed(2)}</p></div>, 'Total Recebido');
      case 'interestReceived': return renderList(report.details.payments.filter((p: any) => ['INTEREST','PARTIAL','ADVANCE_INTEREST'].includes(p.payment_type)), (p: any) => <div key={p.id} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0 text-xs"><p className="text-white/35">{format(new Date(p.created_at), 'dd/MM/yy')}</p><p className="font-black text-emerald-400">R$ {p.amount.toFixed(2)}</p></div>, 'Juros Recebidos');
      case 'activeContracts':  return renderList(report.details.activeContracts, (c: any) => <div key={c.id} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0 text-xs"><p className="text-white/35">Venc: {format(new Date(c.next_due_date + 'T12:00:00'), 'dd/MM/yy')}</p><p className="font-black text-white">R$ {c.capital.toFixed(2)}</p></div>, 'Contratos Ativos');
      case 'overdueContracts': return renderList(report.details.overdueContracts, (c: any) => <div key={c.id} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0 text-xs"><p className="text-red-400 font-bold">Vencido {format(new Date(c.overdue_since + 'T12:00:00'), 'dd/MM/yy')}</p><p className="font-black text-white">R$ {c.capital.toFixed(2)}</p></div>, 'Contratos Vencidos');
      default: return null;
    }
  };

  const metrics = [
    { key: 'totalReceived',    label: 'Total Recebido',    value: `R$ ${report?.totalReceived?.toFixed(2) ?? '0.00'}`,    icon: DollarSign,  iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
    { key: 'interestReceived', label: 'Juros Recebidos',   value: `R$ ${report?.interestReceived?.toFixed(2) ?? '0.00'}`, icon: TrendingUp,  iconBg: 'bg-blue-500/20',    iconColor: 'text-blue-400'    },
    { key: 'activeContracts',  label: 'Contratos Ativos',  value: report?.activeContracts?.toString()  ?? '0',            icon: FileText,    iconBg: 'bg-amber-500/20',   iconColor: 'text-amber-400'   },
    { key: 'overdueContracts', label: 'Contratos Vencidos',value: report?.overdueContracts?.toString() ?? '0',            icon: AlertCircle, iconBg: 'bg-red-500/20',     iconColor: 'text-red-400'     },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Relatórios</h1>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })} className="w-full bg-[#1a1825] border border-white/[0.08] text-white px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60" />
          <input type="date" value={dates.end}   onChange={e => setDates({ ...dates, end:   e.target.value })} className="w-full bg-[#1a1825] border border-white/[0.08] text-white px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={fetchReport} className="bg-gradient-to-r from-blue-600 to-slate-800 px-3 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg shadow-blue-900/25">Filtrar</button>
          <button onClick={() => generateReportsPDF(report)} className="bg-white/[0.05] text-white/50 font-bold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/[0.08]">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {metrics.map(m => (
          <div key={m.key} className={`${card2} p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform`} onClick={() => setSelectedMetric(m.key)}>
            <div className={`w-11 h-11 rounded-xl ${m.iconBg} flex items-center justify-center flex-shrink-0`}><m.icon size={20} className={m.iconColor} /></div>
            <div><p className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em] mb-0.5">{m.label}</p><p className="text-xl font-black text-white">{m.value}</p></div>
            <ArrowRight size={16} className="text-white/20 ml-auto" />
          </div>
        ))}
      </div>
      {report?.recentPayments?.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-white/35 uppercase tracking-widest mb-3">Pagamentos Recentes</p>
          <div className="space-y-2">
            {report.recentPayments.map((group: any) => (
              <div key={group.client_id} className={`${card2} overflow-hidden`}>
                <details className="group">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center"><DollarSign size={15} className="text-emerald-400" /></div>
                      <div><p className="font-black text-white text-sm">{group.client_name}</p><p className="text-[9px] text-white/30">{group.payments.length} pagamento(s)</p></div>
                    </div>
                    <div className="flex items-center gap-2"><p className="font-black text-emerald-400 text-sm">R$ {group.total_amount.toFixed(2)}</p><ChevronDown size={13} className="text-white/30 group-open:rotate-180 transition-transform" /></div>
                  </summary>
                  <div className="px-4 pb-4 border-t border-white/[0.05] space-y-2 pt-2">
                    {group.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.04] last:border-0">
                        <div><p className="text-white/50 font-bold">{p.payment_type}</p><p className="text-[9px] text-white/25">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}</p></div>
                        <div className="text-right"><p className="text-white font-black">R$ {p.amount.toFixed(2)}</p><p className="text-[9px] text-white/25">{p.payment_method}</p></div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
      <AnimatePresence>
        {selectedMetric && <Modal title="Detalhes" onClose={() => setSelectedMetric(null)}>{getModalContent()}</Modal>}
      </AnimatePresence>
    </div>
  );
};

// ─── MANAGEMENT ──────────────────────────────────────────────
const ManagementView = ({ user, setShowChangePasswordModal }: { user: AppUser; setShowChangePasswordModal: (v: boolean) => void }) => {
  const [form, setForm]             = useState({ name: '', email: '', password: '' });
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [users, setUsers]           = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const inp2 = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all text-sm';
  const lbl2 = 'block text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] mb-1.5';

  const fetchUsers = async () => {
    try { setUsers(await api.listUsers()); } catch {}
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const result = await api.createCollector(form.name.trim(), form.email.trim(), form.password);
      setCreatedUser({ ...result, password: form.password });
      setMsg('Cobrador registrado com sucesso!');
      setForm({ name: '', email: '', password: '' });
      fetchUsers();
    } catch (e: any) {
      setErr(e.message || 'Erro ao registrar');
      setTimeout(() => setErr(''), 4000);
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm('A senha será redefinida para "123456". Continuar?')) return;
    try {
      await api.resetPassword(id, '123456');
      alert('Senha redefinida para: 123456');
    } catch (e: any) { alert(e.message); }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.deleteUser(userToDelete);
      setShowDeleteModal(false);
      setSelectedUser(null);
      setUserToDelete(null);
      fetchUsers();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Gerenciamento</h1>
      {/* Admin card */}
      <div className="bg-[#12111a] border border-white/[0.07] rounded-2xl p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/20"><Users size={24} className="text-blue-400" /></div>
          <div><h3 className="text-lg font-black text-white">{user.name}</h3><p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Administrador</p></div>
        </div>
        <div className="space-y-2 pt-3 border-t border-white/[0.06]">
          <div className="flex justify-between text-sm py-1.5"><span className="text-white/35">E-mail</span><span className="text-white font-mono text-xs">{user.email}</span></div>
          <div className="flex justify-between text-sm py-1.5"><span className="text-white/35">Permissão</span><span className="text-blue-400 font-bold">Total</span></div>
        </div>
        <button onClick={() => setShowChangePasswordModal(true)} className="w-full mt-4 bg-blue-500/10 text-blue-400 font-bold py-3 rounded-xl text-xs border border-blue-500/20 flex items-center justify-center gap-2">
          <Settings size={14} /> ALTERAR MINHA SENHA
        </button>
      </div>

      {/* Criar cobrador */}
      <div className="bg-[#12111a] border border-white/[0.07] rounded-2xl p-4">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-blue-400" /> Registrar Novo Cobrador</h3>
        {msg && <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl mb-3 text-xs font-bold border border-emerald-500/20">{msg}</div>}
        {err && <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-3 text-xs font-bold border border-red-500/20">{err}</div>}
        {createdUser ? (
          <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
            <p className="text-sm font-bold text-blue-400 mb-2">Credenciais Criadas:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-white/50">E-mail:</span> <span className="text-white font-mono">{createdUser.login}</span>
              <span className="text-white/50">Senha:</span>  <span className="text-white font-mono">{createdUser.password}</span>
              <span className="text-white/50">Cargo:</span>  <span className="text-white font-mono">COBRADOR</span>
            </div>
            <button onClick={() => { setCreatedUser(null); setMsg(''); }} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-xs mt-2">Registrar Outro</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><label className={lbl2}>Nome Completo</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp2} required /></div>
            <div><label className={lbl2}>E-mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inp2} required /></div>
            <div><label className={lbl2}>Senha Inicial</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inp2} required /></div>
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> REGISTRANDO...</> : 'CADASTRAR COBRADOR'}
            </button>
          </form>
        )}
      </div>

      {/* Lista de usuários */}
      <div className="bg-[#12111a] border border-white/[0.07] rounded-2xl p-4">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Users size={16} className="text-blue-400" /> Usuários Cadastrados</h3>
        <div className="space-y-2">
          {users.filter(u => u.id !== user.id).map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] cursor-pointer hover:bg-white/[0.05]">
              <div><p className="text-sm font-bold text-white">{u.name}</p><p className="text-[10px] text-white/30 font-mono">{u.login}</p></div>
              <div className="flex items-center gap-3">
                <Badge variant={u.role === 'ADMIN' ? 'success' : 'default'}>{u.role}</Badge>
                <button onClick={e => { e.stopPropagation(); setUserToDelete(u.id); setShowDeleteModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {users.filter(u => u.id !== user.id).length === 0 && <p className="text-xs text-white/30 text-center py-4">Nenhum outro usuário cadastrado.</p>}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <Modal title="Detalhes do Usuário" onClose={() => setSelectedUser(null)}>
            <div className="space-y-5">
              <div className="bg-[#12111a] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/20">{selectedUser.name[0]}</div>
                  <div><h3 className="text-lg font-black text-white">{selectedUser.name}</h3><p className="text-[9px] text-white/30 uppercase tracking-widest">{selectedUser.role}</p></div>
                </div>
                <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between text-sm py-1.5"><span className="text-white/35">Login</span><span className="text-white font-mono text-xs">{selectedUser.login}</span></div>
                  {selectedUser.created_at && <div className="flex justify-between text-sm py-1.5"><span className="text-white/35">Cadastrado</span><span className="text-white font-mono text-xs">{format(new Date(selectedUser.created_at), 'dd/MM/yyyy')}</span></div>}
                </div>
              </div>
              <button onClick={() => handleResetPassword(selectedUser.id)} className="w-full bg-blue-500/10 text-blue-400 font-bold py-3 rounded-xl text-xs border border-blue-500/20 flex items-center justify-center gap-2">
                <RefreshCw size={16} /> REDEFINIR SENHA PARA "123456"
              </button>
              <button onClick={() => { setUserToDelete(selectedUser.id); setShowDeleteModal(true); }} className="w-full bg-red-500/10 text-red-400 font-bold py-3 rounded-xl text-xs border border-red-500/20 flex items-center justify-center gap-2">
                <Trash2 size={16} /> EXCLUIR USUÁRIO
              </button>
            </div>
          </Modal>
        )}
        {showDeleteModal && (
          <Modal title="Confirmar Exclusão" onClose={() => setShowDeleteModal(false)}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                <p className="text-xs text-white/60 leading-relaxed">Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="bg-slate-800 text-white font-bold py-3 rounded-xl text-xs border border-slate-700">CANCELAR</button>
                <button onClick={confirmDeleteUser} className="bg-red-600 text-white font-bold py-3 rounded-xl text-xs">SIM, EXCLUIR</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── PDF HELPERS ─────────────────────────────────────────────
const generateClientsPDF = (clients: Client[]) => {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text('Lista de Clientes', 14, 22);
  doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
  autoTable(doc, { startY: 35, head: [['Nome','CPF','Telefone','Status']], body: clients.map(c => [c.name, c.cpf||'-', c.phone||'-', c.status]), theme: 'grid', headStyles: { fillColor: [22,163,74] } });
  doc.save('clientes.pdf');
};

const generateReportsPDF = (report: any) => {
  if (!report) return;
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text('Relatório Financeiro', 14, 22);
  doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
  autoTable(doc, { startY: 35, head: [['Métrica','Valor']], body: [['Total Recebido',`R$ ${report.totalReceived.toFixed(2)}`],['Juros Recebidos',`R$ ${report.interestReceived.toFixed(2)}`],['Contratos Ativos',String(report.activeContracts)],['Contratos Vencidos',String(report.overdueContracts)]], theme: 'striped', headStyles: { fillColor: [37,99,235] } });
  doc.save('relatorio.pdf');
};

const generatePaymentsPDF = (data: any) => {
  if (!data) return;
  const doc = new jsPDF(); let finalY = 35;
  doc.setFontSize(18); doc.text('Relatório de Pagamentos', 14, 22);
  doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
  if (data.overdue?.length) { doc.text('Atrasados', 14, finalY); autoTable(doc, { startY: finalY+5, head:[['Cliente','Vencimento','Valor']], body: data.overdue.map((c: any) => [c.client_name, format(new Date(c.due_date+'T12:00:00'),'dd/MM/yyyy'), `R$ ${c.base_interest_amount.toFixed(2)}`]), theme:'grid', headStyles:{fillColor:[220,38,38]} }); finalY = (doc as any).lastAutoTable.finalY + 15; }
  if (data.today?.length)   { doc.text('Hoje', 14, finalY); autoTable(doc, { startY: finalY+5, head:[['Cliente','Valor']], body: data.today.map((c: any) => [c.client_name, `R$ ${c.base_interest_amount.toFixed(2)}`]), theme:'grid', headStyles:{fillColor:[16,185,129]} }); finalY = (doc as any).lastAutoTable.finalY + 15; }
  if (data.scheduled?.length){ doc.text('Programados', 14, finalY); autoTable(doc, { startY: finalY+5, head:[['Cliente','Vencimento','Valor']], body: data.scheduled.map((c: any) => [c.client_name, format(new Date(c.due_date+'T12:00:00'),'dd/MM/yyyy'), `R$ ${c.base_interest_amount.toFixed(2)}`]), theme:'grid', headStyles:{fillColor:[245,158,11]} }); }
  doc.save('pagamentos.pdf');
};

// ─── CHANGE PASSWORD MODAL ──────────────────────────────────
const ChangePasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api.updateCurrentUserPassword(password);
      setSuccess('Senha alterada com sucesso!');
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={lbl}>Nova Senha</label>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={inp} placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className={lbl}>Confirmar Nova Senha</label>
        <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inp} placeholder="••••••••" required />
      </div>
      {error && <p className="text-red-400 text-[10px] font-bold text-center bg-red-900/20 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-emerald-400 text-[10px] font-bold text-center bg-emerald-900/20 py-2 rounded-lg">{success}</p>}
      <button type="submit" disabled={loading} className={`${primaryBtn} flex items-center justify-center gap-2`}>
        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> ALTERANDO...</> : 'ALTERAR SENHA'}
      </button>
    </form>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser]           = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [menuOpen, setMenuOpen]   = useState(false);

  // Filters
  const [overdueFilter, setOverdueFilter]     = useState('');
  const [scheduledFilter, setScheduledFilter] = useState('');

  // Search
  const [searchResults, setSearchResults]         = useState<Client[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Clients
  const [clients, setClients]             = useState<Client[]>([]);
  const [clientListExpanded, setClientListExpanded] = useState(false);

  // Modals
  const [showPaymentModal, setShowPaymentModal]       = useState(false);
  const [selectedCycle, setSelectedCycle]             = useState<InterestCycle | null>(null);
  const [showNewContractModal, setShowNewContractModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal]   = useState(false);
  const [showClientModal, setShowClientModal]         = useState(false);
  const [clientDetails, setClientDetails]             = useState<any>(null);
  const [showRenegotiateModal, setShowRenegotiateModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient]             = useState<Client | null>(null);
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [clientToDelete, setClientToDelete]           = useState<number | null>(null);
  const [selectedDashMetric, setSelectedDashMetric]   = useState<string | null>(null);
  const [newContractData, setNewContractData]         = useState({ capital: 0, rate: 10 });

  // ── Bootstrap: restore session ──────────────────────────────
  useEffect(() => {
    (async () => {
      const u = await api.getSession();
      if (u) setUser(u);
      setLoading(false);
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') { setUser(null); setDashboardData(null); setClients([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch data when user is set ─────────────────────────────
  useEffect(() => {
    if (user) { fetchDashboard(); fetchClients(); }
  }, [user]);

  const fetchDashboard = async () => {
    try { setDashboardData(await api.getDashboard()); } catch {}
  };
  const fetchClients = async () => {
    try { setClients(await api.getClients()); } catch {}
  };

  const handleLogin = (u: AppUser) => { setUser(u); };
  const handleLogout = async () => { await api.logout(); };

  // ── Handlers ────────────────────────────────────────────────
  const handlePayment = async (data: any) => {
    try {
      await api.registerPayment({
        contract_id:    data.contract_id,
        cycle_id:       data.cycle_id,
        amount:         data.amount,
        payment_type:   data.payment_type,
        payment_method: data.payment_method,
        next_due_date:  data.next_due_date || null,
      });
      setShowPaymentModal(false);
      fetchDashboard();
      if (clientDetails) {
        const updated = await api.getClientDetails(clientDetails.client.id);
        setClientDetails(updated);
      }
    } catch (err: any) { alert(err.message); }
  };

  const handleNewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.createContract({
        client_id:             parseInt(fd.get('client_id') as string),
        capital:               parseFloat(fd.get('capital') as string),
        interest_rate_monthly: parseFloat(fd.get('interest_rate') as string) / 100,
        next_due_date:         fd.get('next_due_date') as string,
        guarantee_notes:       fd.get('guarantee_notes') as string,
      });
      setShowNewContractModal(false);
      fetchDashboard();
    } catch (err: any) { alert(err.message); }
  };

  const handleNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.createClient({ name: fd.get('name') as string, cpf: fd.get('cpf') as string, address: fd.get('address') as string, phone: fd.get('phone') as string, notes: fd.get('notes') as string });
      setShowNewClientModal(false);
      fetchClients();
    } catch (err: any) { alert(err.message); }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.updateClient(editingClient.id, { name: fd.get('name') as string, cpf: fd.get('cpf') as string, address: fd.get('address') as string, phone: fd.get('phone') as string, notes: fd.get('notes') as string });
      setShowEditClientModal(false);
      fetchClients();
      if (clientDetails?.client.id === editingClient.id) {
        const updated = await api.getClientDetails(editingClient.id);
        setClientDetails(updated);
      }
    } catch (err: any) { alert(err.message); }
  };

  const handleSearch = async (q: string) => {
    if (q.length > 1) { setSearchResults(await api.getClients(q)); setShowSearchResults(true); }
    else { setSearchResults([]); setShowSearchResults(false); }
  };

  const fetchClientDetails = async (id: number) => {
    try {
      const details = await api.getClientDetails(id);
      setClientDetails(details);
      setShowClientModal(true);
      setShowSearchResults(false);
    } catch (err: any) { alert(err.message); }
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await api.deleteClient(clientToDelete);
      setShowDeleteClientModal(false);
      setShowClientModal(false);
      setClientToDelete(null);
      fetchDashboard();
      fetchClients();
    } catch (err: any) { alert(err.message); }
  };

  const sendWhatsApp = (cycle: InterestCycle) => {
    const msg = encodeURIComponent('Olá, passando para lembrar do seu pagamento previsto.');
    const ph = cycle.client_phone?.replace(/\D/g, '');
    window.open(`https://wa.me/55${ph}?text=${msg}`, '_blank');
  };

  const getDashboardModalContent = () => {
    if (!dashboardData?.details) return null;
    const groupByClient = (items: any[]) => { const g: any = {}; items.forEach(i => { if (!g[i.client_id]) g[i.client_id] = { name: i.client_name, items: [] }; g[i.client_id].items.push(i); }); return Object.values(g); };
    const renderList = (items: any[], renderItem: (i: any) => React.ReactNode, title: string) => (
      <div>
        <p className="text-sm font-black text-white mb-3">{title}</p>
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {groupByClient(items).map((g: any) => (
            <div key={g.name} className={`${card} overflow-hidden`}>
              <details className="group">
                <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                  <span className="font-bold text-white text-sm">{g.name}</span>
                  <div className="flex items-center gap-2"><Badge>{g.items.length}</Badge><ChevronDown size={14} className="text-white/30 group-open:rotate-180 transition-transform" /></div>
                </summary>
                <div className="px-3 pb-3 border-t border-white/[0.05]">{g.items.map(renderItem)}</div>
              </details>
            </div>
          ))}
        </div>
      </div>
    );
    switch (selectedDashMetric) {
      case 'total_on_street':           return renderList(dashboardData.all, (c: any) => <div key={c.id} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0 text-xs"><p className="text-white/40">Venc: {format(new Date(c.next_due_date+'T12:00:00'),'dd/MM/yy')}</p><p className="font-black text-white">R$ {c.capital?.toFixed(2)}</p></div>, 'Capital na Rua');
      case 'total_interest_received':   return renderList(dashboardData.details.interestReceived, (p: any) => <div key={p.id} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0 text-xs"><p className="text-white/40">{format(new Date(p.created_at),'dd/MM/yy')}</p><p className="font-black text-emerald-400">R$ {p.amount.toFixed(2)}</p></div>, 'Juros Recebidos');
      case 'total_interest_to_receive': return renderList(dashboardData.details.interestToReceive, (ic: any) => <div key={ic.id} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0 text-xs"><p className="text-white/40">Venc: {format(new Date(ic.due_date+'T12:00:00'),'dd/MM/yy')}</p><p className="font-black text-amber-400">R$ {(ic.base_interest_amount-(ic.paid_amount||0)).toFixed(2)}</p></div>, 'Juros a Receber');
      case 'total_active_contracts':    return renderList(dashboardData.all, (c: any) => <div key={c.id} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0 text-xs"><p className="text-white/40">Venc: {format(new Date(c.next_due_date+'T12:00:00'),'dd/MM/yy')}</p><p className="font-black text-white">R$ {c.capital?.toFixed(2)}</p></div>, 'Contratos Ativos');
      default: return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0d0c14] flex items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-slate-900 flex items-center justify-center animate-pulse shadow-xl shadow-blue-900/30">
        <TrendingUp className="text-white" size={24} />
      </div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  const tabs = [
    { id: 'dashboard', label: 'Home',       icon: Home     },
    { id: 'payments',  label: 'Pagamentos', icon: CreditCard },
    { id: 'clients',   label: 'Clientes',   icon: Users    },
    { id: 'reports',   label: 'Relatórios', icon: BookOpen  },
  ];

  const menuItems = [
    ...tabs,
    ...(user.role === 'ADMIN' ? [
      { id: 'calculator',  label: 'Calculadora',  icon: CalcIcon  },
      { id: 'management',  label: 'Gerenciamento',icon: Settings  },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0d0c14] text-white flex flex-col relative overflow-x-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0d0c14]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-700 to-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30">
            <TrendingUp size={15} className="text-white" />
          </div>
          <span className="font-black text-white text-sm tracking-tight">Capital Rotativo</span>
        </div>
        <button onClick={() => setMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
          <Menu size={18} className="text-white/70" />
        </button>
      </header>

      {/* SLIDE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="fixed inset-0 bg-black/60 z-50" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-[#111019] border-l border-white/[0.08] z-50 flex flex-col p-5">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-700 to-slate-900 rounded-xl flex items-center justify-center"><TrendingUp size={15} className="text-white" /></div>
                  <span className="font-black text-sm">Capital Rotativo</span>
                </div>
                <button onClick={() => setMenuOpen(false)}><X size={20} className="text-white/40" /></button>
              </div>
              <div className={`${card} p-4 mb-6 flex items-center gap-3`}>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600/40 to-slate-600/20 rounded-xl flex items-center justify-center font-black text-blue-300 border border-blue-500/20">{user.name[0]}</div>
                <div className="flex-1">
                  <p className="font-black text-white text-sm">{user.name}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest">{user.role}</p>
                </div>
                <button onClick={() => { setShowChangePasswordModal(true); setMenuOpen(false); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/40 hover:text-white">
                  <Settings size={14} />
                </button>
              </div>
              <nav className="flex flex-col gap-1 flex-1">
                {menuItems.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setMenuOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${activeTab === item.id ? 'bg-blue-600/20 text-white border border-blue-500/30' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'}`}>
                    <item.icon size={17} className={activeTab === item.id ? 'text-blue-400' : ''} />
                    {item.label}
                    {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                ))}
              </nav>
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 bg-red-500/10 text-red-400 rounded-xl font-bold text-sm border border-red-500/20 mt-4">
                <LogOut size={16} /> Sair da Conta
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CONTENT */}
      <main className="flex-1 px-4 pt-5 pb-28 relative z-10 max-w-lg mx-auto w-full">

        {/* ══ DASHBOARD ══ */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="mb-6">
              <h1 className="text-xl font-black text-white leading-[1.05] mb-1">Olá,<br />{user.name.split(' ')[0]} 👋</h1>
              <p className="text-white/40 text-sm">Aqui está o resumo do seu portfólio</p>
            </div>

            {user.role === 'ADMIN' && (
              <button onClick={() => setShowNewContractModal(true)} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-bold py-4 rounded-2xl mb-5 flex items-center justify-center gap-2 text-sm shadow-xl shadow-blue-900/30 active:scale-[0.98] transition-transform">
                <PlusCircle size={18} /> Novo Contrato
              </button>
            )}

            <ClientSearch onSearch={handleSearch} searchResults={searchResults} showSearchResults={showSearchResults} onSelectClient={fetchClientDetails} />

            <div className="grid grid-cols-2 gap-3 mb-6">
              {user.role === 'ADMIN' && (
                <MetricCard label="Total na Rua" value={`R$\n${dashboardData?.metrics?.total_on_street?.toFixed(2) || '0.00'}`} icon={DollarSign} iconBg="bg-blue-500/20" iconColor="text-blue-400" onClick={() => setSelectedDashMetric('total_on_street')} />
              )}
              <MetricCard label="Juros Recebidos"  value={`R$\n${dashboardData?.metrics?.total_interest_received?.toFixed(2) || '0.00'}`}  icon={CheckCircle2} iconBg="bg-emerald-500/20" iconColor="text-emerald-400" labelColor="text-emerald-400/80" onClick={() => setSelectedDashMetric('total_interest_received')} />
              <MetricCard label="Juros a Receber"  value={`R$\n${dashboardData?.metrics?.total_interest_to_receive?.toFixed(2) || '0.00'}`} icon={TrendingUp}  iconBg="bg-amber-500/20"  iconColor="text-amber-400"   labelColor="text-amber-400/80"  onClick={() => setSelectedDashMetric('total_interest_to_receive')} />
              <MetricCard label="Total Ativos"     value={`${dashboardData?.metrics?.total_active_contracts || 0}`}                          icon={FileText}    iconBg="bg-blue-500/20"   iconColor="text-blue-400"    labelColor="text-blue-400/80"   onClick={() => setSelectedDashMetric('total_active_contracts')} />
            </div>

            {/* Client list toggle */}
            <button onClick={() => setClientListExpanded(!clientListExpanded)} className={`w-full flex items-center justify-between px-4 py-3.5 ${card} mb-3`}>
              <div className="flex items-center gap-2.5">
                <Users size={15} className="text-blue-400" />
                <span className="text-xs font-black text-white/50 uppercase tracking-widest">Clientes Ativos</span>
                <span className="bg-white/[0.08] text-white/40 text-[9px] font-black px-2 py-0.5 rounded-full">{clients.length}</span>
              </div>
              <motion.div animate={{ rotate: clientListExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={15} className="text-white/30" />
              </motion.div>
            </button>
            <AnimatePresence>
              {clientListExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3 pb-2">
                    {clients.map(c => (
                      <div key={c.id} className={`${card} p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-300 font-black border border-blue-500/20">{c.name[0]}</div>
                            <div><p className="font-black text-white text-sm">{c.name}</p><p className="text-[9px] text-white/30 uppercase">{c.cpf || 'Sem CPF'}</p></div>
                          </div>
                          {user.role === 'ADMIN' && (
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingClient(c); setShowEditClientModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/30"><Edit size={13} /></button>
                              <button onClick={() => { setClientToDelete(c.id); setShowDeleteClientModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/30 hover:text-red-400"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => fetchClientDetails(c.id)} className="w-full bg-blue-600/15 text-blue-400 font-bold py-2.5 rounded-xl text-xs border border-blue-500/20 flex items-center justify-center gap-1.5">
                          <FileText size={12} /> Ver Contratos Ativos
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ══ PAYMENTS ══ */}
        {activeTab === 'payments' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-black text-white">Pagamentos</h1>
              <button onClick={() => generatePaymentsPDF(dashboardData)} className="bg-white/[0.05] text-white/50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-white/[0.08]">
                <FileText size={15} /> PDF
              </button>
            </div>
            <ClientSearch onSearch={handleSearch} searchResults={searchResults} showSearchResults={showSearchResults} onSelectClient={fetchClientDetails} />

            {/* Atrasados */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-xs font-black text-red-400 uppercase tracking-widest">Atrasados</span></div>
                <span className="bg-red-500/20 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full">{overdueFilter ? dashboardData?.overdue?.filter((c: any) => c.due_date === overdueFilter).length : dashboardData?.overdue?.length || 0}</span>
              </div>
              {(dashboardData?.overdue?.length > 0) && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                  {Array.from(new Set(dashboardData.overdue.map((c: any) => c.due_date))).sort().map((date: any) => (
                    <button key={date} onClick={() => setOverdueFilter(date === overdueFilter ? '' : date)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${overdueFilter === date ? 'bg-red-500 border-red-500 text-white' : 'bg-white/[0.05] border-white/[0.08] text-white/40'}`}>
                      {format(new Date(date+'T12:00:00'),'dd/MM')} ({dashboardData.overdue.filter((c: any) => c.due_date === date).length})
                    </button>
                  ))}
                </div>
              )}
              <input type="date" value={overdueFilter} onChange={e => setOverdueFilter(e.target.value)} className={`${inp} mb-3`} />
              {!overdueFilter
                ? <div className={`${card} p-6 text-center text-white/25 text-sm`}>{dashboardData?.overdue?.length > 0 ? 'Selecione uma data' : 'Nenhum atraso'}</div>
                : (() => { const f = dashboardData?.overdue?.filter((c: any) => c.due_date === overdueFilter); if (!f?.length) return <div className={`${card} p-6 text-center text-white/25 text-sm`}>Nenhum atraso nesta data</div>; return f.map((cycle: InterestCycle) => <CycleItem key={cycle.id} cycle={cycle} user={user} onPay={c => { setSelectedCycle(c); setShowPaymentModal(true); }} onMessage={sendWhatsApp} />); })()
              }
            </div>

            {/* Programados */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/30" /><span className="text-xs font-black text-white/50 uppercase tracking-widest">Programados</span></div>
                <span className="bg-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full">{scheduledFilter ? dashboardData?.scheduled?.filter((c: any) => c.due_date === scheduledFilter).length : 0}</span>
              </div>
              {(dashboardData?.scheduled?.length > 0) && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                  {Array.from(new Set(dashboardData.scheduled.map((c: any) => c.due_date))).sort().slice(0, 7).map((date: any) => (
                    <button key={date} onClick={() => setScheduledFilter(date === scheduledFilter ? '' : date)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${scheduledFilter === date ? 'bg-white border-white text-zinc-900' : 'bg-white/[0.05] border-white/[0.08] text-white/40'}`}>
                      {format(new Date(date+'T12:00:00'),'dd/MM')} ({dashboardData.scheduled.filter((c: any) => c.due_date === date).length})
                    </button>
                  ))}
                </div>
              )}
              <input type="date" value={scheduledFilter} onChange={e => setScheduledFilter(e.target.value)} className={`${inp} mb-3`} />
              {!scheduledFilter
                ? <div className={`${card} p-6 text-center text-white/25 text-sm`}>Selecione uma data</div>
                : (() => { const f = dashboardData?.scheduled?.filter((c: any) => c.due_date === scheduledFilter); if (!f?.length) return <div className={`${card} p-6 text-center text-white/25 text-sm`}>Nenhuma cobrança nesta data</div>; return f.map((cycle: InterestCycle) => <CycleItem key={cycle.id} cycle={cycle} user={user} onPay={c => { setSelectedCycle(c); setShowPaymentModal(true); }} onMessage={sendWhatsApp} />); })()
              }
            </div>

            {/* Hoje */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Hoje</span></div>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full">{dashboardData?.today?.length || 0}</span>
              </div>
              {!dashboardData?.today?.length
                ? <div className={`${card} p-6 text-center text-white/25 text-sm`}>Nada para hoje</div>
                : dashboardData.today.map((cycle: InterestCycle) => <CycleItem key={cycle.id} cycle={cycle} user={user} onPay={c => { setSelectedCycle(c); setShowPaymentModal(true); }} onMessage={sendWhatsApp} />)
              }
            </div>
          </div>
        )}

        {/* ══ CLIENTS ══ */}
        {activeTab === 'clients' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-black text-white">Clientes</h1>
              <div className="flex gap-2">
                <button onClick={() => generateClientsPDF(clients)} className="bg-white/[0.05] text-white/50 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-white/[0.08]"><FileText size={15} /> PDF</button>
                <button onClick={() => setShowNewClientModal(true)} className="bg-gradient-to-r from-blue-600 to-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/25"><PlusCircle size={15} /> Novo Cliente</button>
              </div>
            </div>
            <ClientSearch onSearch={handleSearch} searchResults={searchResults} showSearchResults={showSearchResults} onSelectClient={fetchClientDetails} />
            <div className="space-y-3">
              {clients.map(c => (
                <div key={c.id} className={`${card} p-4`}>
                  <div className="flex justify-between items-start mb-3">
                    <div><h3 className="text-lg font-black text-white">{c.name}</h3><p className="text-sm text-white/35 flex items-center gap-1 mt-0.5"><Phone size={11} /> {c.phone}</p></div>
                    <Badge variant="success">{c.status}</Badge>
                  </div>
                  {c.notes && <p className="text-xs text-white/25 mb-3 line-clamp-2">{c.notes}</p>}
                  <button onClick={() => fetchClientDetails(c.id)} className="w-full bg-blue-600/15 text-blue-400 font-bold py-2.5 rounded-xl text-xs border border-blue-500/20">Ver Contratos</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports'    && <ReportsView />}
        {activeTab === 'calculator' && user.role === 'ADMIN' && <CalculatorView />}
        {activeTab === 'management' && user.role === 'ADMIN' && <ManagementView user={user} setShowChangePasswordModal={setShowChangePasswordModal} />}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0c14]/95 backdrop-blur-xl border-t border-white/[0.06] flex items-center justify-around px-2 py-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex flex-col items-center gap-1 px-3 py-1 min-w-[60px]">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-600/25 border border-blue-500/40' : ''}`}>
              <tab.icon size={19} className={activeTab === tab.id ? 'text-blue-400' : 'text-white/30'} />
            </div>
            <span className={`text-[9px] font-bold tracking-wide ${activeTab === tab.id ? 'text-blue-400' : 'text-white/25'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      <AnimatePresence>
        {selectedDashMetric && <Modal title="Detalhes" onClose={() => setSelectedDashMetric(null)}>{getDashboardModalContent()}</Modal>}

        {showNewContractModal && (
          <Modal title="Novo Contrato" onClose={() => setShowNewContractModal(false)}>
            <form onSubmit={handleNewContract} className="space-y-4">
              <div><label className={lbl}>Cliente</label><select name="client_id" className={inp} required><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Capital (R$)</label><input name="capital" type="number" step="0.01" onChange={e => setNewContractData({ ...newContractData, capital: parseFloat(e.target.value)||0 })} className={inp} required /></div>
                <div><label className={lbl}>Juros (%)</label><input name="interest_rate" type="number" step="0.1" defaultValue="10" onChange={e => setNewContractData({ ...newContractData, rate: parseFloat(e.target.value)||0 })} className={inp} required /></div>
              </div>
              <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-500/20 flex justify-between items-center">
                <span className="text-[10px] font-bold text-white/40 uppercase">Juros Mensal:</span>
                <span className="text-lg font-black text-blue-400">R$ {(newContractData.capital * (newContractData.rate / 100)).toFixed(2)}</span>
              </div>
              <div><label className={lbl}>Primeiro Vencimento</label><input name="next_due_date" type="date" defaultValue={format(addMonths(new Date(), 1), 'yyyy-MM-dd')} className={inp} required /></div>
              <div><label className={lbl}>Garantia</label><textarea name="guarantee_notes" className={`${inp} h-20 resize-none`}></textarea></div>
              <button type="submit" className={primaryBtn}>CRIAR CONTRATO</button>
            </form>
          </Modal>
        )}

        {showNewClientModal && (
          <Modal title="Novo Cliente" onClose={() => setShowNewClientModal(false)}>
            <form onSubmit={handleNewClient} className="space-y-4">
              <div><label className={lbl}>Nome Completo</label><input name="name" type="text" className={inp} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>CPF</label><input name="cpf" type="text" className={inp} /></div>
                <div><label className={lbl}>Telefone</label><input name="phone" type="text" className={inp} required /></div>
              </div>
              <div><label className={lbl}>Endereço</label><input name="address" type="text" className={inp} /></div>
              <div><label className={lbl}>Observações</label><textarea name="notes" className={`${inp} h-20 resize-none`}></textarea></div>
              <button type="submit" className={primaryBtn}>CADASTRAR CLIENTE</button>
            </form>
          </Modal>
        )}

        {showChangePasswordModal && (
          <Modal title="Alterar Minha Senha" onClose={() => setShowChangePasswordModal(false)}>
            <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
          </Modal>
        )}

        {showClientModal && clientDetails && (
          <Modal title="Perfil do Cliente" onClose={() => setShowClientModal(false)}>
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-white">{clientDetails.client.name}</h2>
                  <p className="text-xs text-white/35 mt-0.5">CPF: {clientDetails.client.cpf || 'N/A'}</p>
                  <p className="text-xs text-white/35 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {clientDetails.client.address || 'Sem endereço'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="success">{clientDetails.client.status}</Badge>
                  {user.role === 'ADMIN' && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingClient(clientDetails.client); setShowEditClientModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05]"><Edit size={13} className="text-white/40" /></button>
                      <button onClick={() => { setClientToDelete(clientDetails.client.id); setShowDeleteClientModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05]"><Trash2 size={13} className="text-white/40" /></button>
                    </div>
                  )}
                </div>
              </div>

              {clientDetails.interestCycles?.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Juros a Receber</p>
                  <p className="text-xl font-black text-white">R$ {clientDetails.interestCycles.reduce((a: number, c: any) => a + c.base_interest_amount, 0).toFixed(2)}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{clientDetails.interestCycles.length} parcelas pendentes</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Empréstimos Ativos</p>
                  {user.role === 'ADMIN' && clientDetails.contracts.filter((c: any) => c.status === 'ACTIVE').length > 0 && (
                    <button onClick={() => setShowRenegotiateModal(true)} className="text-[9px] font-black text-blue-400 flex items-center gap-1"><RefreshCw size={9} /> Renegociar</button>
                  )}
                </div>
                <div className="space-y-2 mb-5">
                  {clientDetails.contracts.filter((c: any) => c.status === 'ACTIVE').map((contract: any) => (
                    <div key={contract.id} className={`${card} p-3`}>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-base font-black text-white">R$ {contract.monthly_interest_amount?.toFixed(2)}/mês</p>
                        {contract.overdue_count > 0 && <Badge variant="danger">{contract.overdue_count} Atr.</Badge>}
                      </div>
                      <p className="text-[10px] text-white/30">
                        {user.role === 'ADMIN' && `Capital: R$ ${contract.capital?.toFixed(2)} · `}
                        Venc: {format(new Date(contract.next_due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  ))}
                </div>

                {clientDetails.interestCycles?.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Pagamentos Pendentes</p>
                    <div className="space-y-2">
                      {clientDetails.interestCycles.map((cycle: any) => (
                        <CycleItem key={cycle.id}
                          cycle={{ ...cycle, client_name: clientDetails.client.name, client_phone: clientDetails.client.phone }}
                          user={user}
                          onPay={c => { setSelectedCycle(c); setShowPaymentModal(true); }}
                          onMessage={sendWhatsApp}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {showRenegotiateModal && clientDetails && (
          <Modal title="Renegociar Dívida" onClose={() => setShowRenegotiateModal(false)}>
            <RenegotiateForm
              client={clientDetails.client}
              activeContracts={clientDetails.contracts.filter((c: any) => c.status === 'ACTIVE')}
              interestCycles={clientDetails.interestCycles}
              onClose={() => setShowRenegotiateModal(false)}
              onSuccess={() => { setShowRenegotiateModal(false); setShowClientModal(false); fetchDashboard(); fetchClients(); }}
            />
          </Modal>
        )}

        {showEditClientModal && editingClient && (
          <Modal title="Editar Cliente" onClose={() => setShowEditClientModal(false)}>
            <form onSubmit={handleEditClient} className="space-y-4">
              <div><label className={lbl}>Nome</label><input name="name" type="text" defaultValue={editingClient.name} className={inp} required /></div>
              <div><label className={lbl}>CPF</label><input name="cpf" type="text" defaultValue={editingClient.cpf} className={inp} /></div>
              <div><label className={lbl}>Telefone</label><input name="phone" type="text" defaultValue={editingClient.phone} className={inp} /></div>
              <div><label className={lbl}>Endereço</label><input name="address" type="text" defaultValue={editingClient.address} className={inp} /></div>
              <div><label className={lbl}>Obs.</label><textarea name="notes" defaultValue={editingClient.notes} className={`${inp} h-20 resize-none`}></textarea></div>
              <button type="submit" className={primaryBtn}>SALVAR</button>
            </form>
          </Modal>
        )}

        {showPaymentModal && (
          <Modal title="Receber Pagamento" onClose={() => setShowPaymentModal(false)}>
            <PaymentForm selectedCycle={selectedCycle} onSubmit={handlePayment} />
          </Modal>
        )}

        {showDeleteClientModal && (
          <Modal title="Confirmar Exclusão" onClose={() => setShowDeleteClientModal(false)}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                <p className="text-xs text-white/60 leading-relaxed">Esta ação apagará permanentemente o cliente, contratos, pagamentos e histórico. Não pode ser desfeita.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowDeleteClientModal(false)} className="bg-slate-800 text-white font-bold py-3 rounded-xl text-xs border border-slate-700">CANCELAR</button>
                <button onClick={confirmDeleteClient} className="bg-red-600 text-white font-bold py-3 rounded-xl text-xs">SIM, EXCLUIR</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}