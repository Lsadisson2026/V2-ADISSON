import React, { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, FileText, AlertCircle, PlusCircle,
  CheckCircle2, Phone, LogOut, Menu, X, Calculator as CalcIcon,
  ArrowRight, Search, RefreshCw, Trash2, Edit, ChevronDown,
  Settings, Home, BookOpen, Users, Bell, Clock, CreditCard,
  MessageCircle, RotateCcw, Banknote, Eye, EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import * as api from './services/api';
import { supabase } from './services/supabaseClient';

interface AppUser   { id: string; name: string; email: string; role: 'ADMIN' | 'COLLECTOR'; }
interface Client    { id: number; name: string; cpf?: string; address?: string; phone?: string; notes?: string; status: string; }
interface Contract  { id: number; client_id: number; capital: number; interest_rate_monthly: number; monthly_interest_amount: number; next_due_date: string; status: string; guarantee_notes?: string; client_name?: string; client_phone?: string; }
interface InterestCycle { id: number; contract_id: number; due_date: string; base_interest_amount: number; paid_amount: number; status: string; client_name?: string; client_phone?: string; capital?: number; }

const inp  = 'w-full bg-[#1a1825] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm';
const lbl  = 'block text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-1.5';
const card = 'bg-[#12111a] border border-white/[0.07] rounded-2xl';

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const parseDate = (d: string) => parseISO(d.includes('T') ? d : d + 'T12:00:00');

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default'|'success'|'warning'|'danger'|'info' }) => {
  const v = { default:'bg-white/[0.08] text-white/50', success:'bg-emerald-500/20 text-emerald-400', warning:'bg-amber-500/20 text-amber-400', danger:'bg-red-500/20 text-red-400', info:'bg-blue-500/20 text-blue-400' };
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${v[variant]}`}>{children}</span>;
};

const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:60, opacity:0 }} transition={{ type:'spring', damping:28, stiffness:320 }}
      className="relative w-full max-w-lg bg-[#0f0e1a] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-black text-white">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06]"><X size={15} className="text-white/50" /></button>
      </div>
      {children}
    </motion.div>
  </div>
);

// ── COMPROVANTE ───────────────────────────────────────────────
const ReceiptModal = ({ receipt, onClose }: { receipt: any; onClose: () => void }) => {
  const sendWA = (toClient: boolean) => {
    const phone = receipt.client_phone?.replace(/\D/g,'');
    const msg = toClient
      ? `✅ *Pagamento Confirmado*\n\nCliente: ${receipt.client_name}\nTipo: ${receipt.type_label}\nValor: ${fmtBRL(receipt.amount)}\nData: ${format(new Date(),'dd/MM/yyyy')}\nSaldo: ${fmtBRL(receipt.remaining)}\n\nObrigado! 🙏`
      : `📋 *Registro*\nCliente: ${receipt.client_name}\nValor: ${fmtBRL(receipt.amount)}\nTipo: ${receipt.type_label}\nData: ${format(new Date(),'dd/MM/yyyy HH:mm')}`;
    if (toClient && phone) window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,'_blank');
    else navigator.clipboard?.writeText(msg).then(()=>alert('Copiado!'));
  };
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Comprovante de Pagamento',14,22);
    autoTable(doc,{ startY:35, body:[['Cliente',receipt.client_name],['Tipo',receipt.type_label],['Valor',fmtBRL(receipt.amount)],['Data',format(new Date(),'dd/MM/yyyy HH:mm')],['Saldo Restante',fmtBRL(receipt.remaining)]], theme:'striped' });
    doc.save(`comprovante_${receipt.client_name?.replace(/\s/g,'_')}.pdf`);
  };
  return (
    <Modal title="Pagamento Registrado! 🎉" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
          {[['Cliente',receipt.client_name],['Tipo',receipt.type_label],['Valor Pago',fmtBRL(receipt.amount)],['Data',format(new Date(),'dd/MM/yyyy')],['Saldo Restante',fmtBRL(receipt.remaining)]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-sm"><span className="text-white/40">{k}:</span><span className="font-black text-white">{v}</span></div>
          ))}
        </div>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-center">Enviar comprovante</p>
        <button onClick={()=>sendWA(false)} className="w-full bg-white/[0.06] border border-white/[0.08] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><MessageCircle size={14}/> Para Mim (copiar)</button>
        <button onClick={()=>sendWA(true)}  className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><Phone size={14}/> Para o Cliente (WhatsApp)</button>
        <button onClick={downloadPDF}       className="w-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><FileText size={14}/> Baixar PDF</button>
        <button onClick={onClose} className="w-full bg-white/[0.04] text-white/40 font-bold py-3 rounded-xl text-sm">Fechar</button>
      </div>
    </Modal>
  );
};

// ── LOAN CARD ─────────────────────────────────────────────────
const LoanCard = ({ contract, client, cycle, user, onPayInterest, onPayCapital, onRenegotiate, onEdit, onDelete, onWhatsApp }: {
  contract: Contract; client?: Client; cycle?: InterestCycle; user: AppUser | null;
  onPayInterest:()=>void; onPayCapital:()=>void; onRenegotiate:()=>void;
  onEdit:()=>void; onDelete:()=>void; onWhatsApp:()=>void;
}) => {
  const today     = format(new Date(),'yyyy-MM-dd');
  const isOverdue = contract.next_due_date < today;
  const isToday   = contract.next_due_date === today;
  const lucroReal = cycle?.paid_amount ?? 0;
  const lucroTotal= contract.monthly_interest_amount;
  const lucroPercent = lucroTotal > 0 ? Math.round((lucroReal/lucroTotal)*100) : 0;
  const juros     = cycle?.base_interest_amount ?? contract.monthly_interest_amount;
  const dias      = isOverdue ? Math.floor((Date.now() - parseDate(contract.next_due_date).getTime())/86400000) : 0;
  const border    = isOverdue ? 'border-red-500/35' : isToday ? 'border-amber-500/35' : 'border-white/[0.07]';
  const glow      = isOverdue ? 'bg-red-500/[0.03]' : isToday ? 'bg-amber-500/[0.03]' : '';
  const clientName = contract.client_name || client?.name || '?';

  return (
    <motion.div layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`${glow} border ${border} rounded-2xl overflow-hidden mb-3`}>
      {/* Header */}
      <div className="bg-white/[0.04] px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-blue-300 text-sm border border-blue-500/20">{clientName[0].toUpperCase()}</div>
          <div>
            <p className="font-black text-white text-sm">{clientName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant={isOverdue?'danger':isToday?'warning':'info'}>{isOverdue?'ATRASADO':isToday?'VENCE HOJE':'PENDENTE'}</Badge>
              <Badge variant="default">MENSAL</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}   className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/30"><Edit size={13}/></button>
          <button onClick={onWhatsApp} className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><Phone size={13}/></button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Valor principal */}
        <div className="text-center py-1">
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(contract.capital + juros - lucroReal)}</p>
          <p className="text-[10px] text-white/25 mt-0.5">restante a receber</p>
        </div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {label:'Emprestado',       value: fmtBRL(contract.capital),                            color:'text-white'},
            {label:'Total a Receber',  value: fmtBRL(contract.capital + juros),                    color:'text-white'},
            {label:'Lucro Previsto',   value: fmtBRL(lucroTotal),                                  color:'text-emerald-400'},
            {label:'Lucro Realizado',  value: fmtBRL(lucroReal),                                   color:'text-white', badge: `${lucroPercent}%`},
          ].map(item=>(
            <div key={item.label} className="bg-white/[0.04] rounded-xl p-3">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">{item.label}</p>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
                {item.badge && <span className="text-[9px] bg-white/[0.08] text-white/40 px-1.5 py-0.5 rounded-full font-black">{item.badge}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Vencimento / Pago */}
        <div className="flex justify-between text-xs py-2 border-t border-white/[0.05]">
          <span className={`flex items-center gap-1.5 font-bold ${isOverdue?'text-red-400':isToday?'text-amber-400':'text-white/40'}`}>
            <Clock size={11}/> Venc: {format(parseDate(contract.next_due_date),'dd/MM/yyyy')}
          </span>
          <span className="text-emerald-400 font-black">$ Pago: {fmtBRL(lucroReal)}</span>
        </div>

        {/* Só juros */}
        <div className="flex justify-between px-3 py-2.5 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl">
          <span className="text-[11px] text-white/40 font-bold">Só Juros (por parcela):</span>
          <span className="text-sm font-black text-blue-300">{fmtBRL(juros)}</span>
        </div>

        {/* Banner hoje */}
        {isToday && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-amber-400 font-black text-xs flex items-center gap-1.5"><Bell size={12}/> Vence Hoje!</span>
              <span className="text-amber-400 font-black text-sm">{fmtBRL(contract.capital + juros)}</span>
            </div>
            <p className="text-[10px] text-amber-300/40 mb-2">Parcela 1/1 · Vencimento: {format(parseDate(contract.next_due_date),'dd/MM/yyyy')}</p>
            <button onClick={onWhatsApp} className="w-full bg-black/30 border border-amber-500/20 text-amber-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
              <MessageCircle size={12}/> Cobrar Hoje (WhatsApp)
            </button>
          </div>
        )}

        {/* Banner atrasado */}
        {isOverdue && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-red-400 font-black text-xs flex items-center gap-1.5"><AlertCircle size={12}/> Pagamento Atrasado</span>
              <span className="text-red-400 text-xs font-bold">{dias} dias</span>
            </div>
            <button onClick={onWhatsApp} className="w-full bg-black/30 border border-red-500/20 text-red-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
              <MessageCircle size={12}/> Cobrar Agora (WhatsApp)
            </button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1.5 pt-1">
          <button onClick={onPayCapital}  className="flex-1 bg-white/[0.06] border border-white/[0.08] text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"><CreditCard size={12}/> Pagar</button>
          <button onClick={onPayInterest} className="flex-1 bg-blue-600/20 border border-blue-500/30 text-blue-300 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"><DollarSign size={12}/> Pagar Juros</button>
          <button onClick={onRenegotiate} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400"><RotateCcw size={14}/></button>
          {user?.role==='ADMIN' && <button onClick={onDelete} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 size={14}/></button>}
        </div>
      </div>
    </motion.div>
  );
};

// ── PAYMENT FORM ──────────────────────────────────────────────
const PaymentForm = ({ contract, cycle, mode, onSubmit }: { contract: Contract; cycle?: InterestCycle|null; mode:'interest'|'capital'; onSubmit:(d:any)=>void; }) => {
  const jurosAbertos = cycle?.base_interest_amount ?? contract.monthly_interest_amount;
  const jurosDevidos = Math.max(0, jurosAbertos - (cycle?.paid_amount ?? 0));

  // Modo capital: capital+juros ou só capital
  type CapMode = 'full' | 'capital-only' | null;
  const [capMode, setCapMode] = useState<CapMode>(mode === 'capital' ? null : 'full');

  const defaultAmount = capMode === 'full'
    ? contract.capital + jurosDevidos
    : capMode === 'capital-only'
    ? contract.capital
    : mode === 'interest' ? jurosDevidos : 0;

  const [amount, setAmount]     = useState(defaultAmount);
  const [nextDate, setNextDate] = useState(format(addMonths(parseDate(contract.next_due_date),1),'yyyy-MM-dd'));
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (capMode === 'full')         setAmount(contract.capital + jurosDevidos);
    else if (capMode === 'capital-only') setAmount(contract.capital);
  }, [capMode]);

  // Preview amortização
  const pagoEmJuros   = capMode === 'full' ? Math.min(amount, jurosDevidos) : 0;
  const pagoEmCapital = capMode === 'full'
    ? Math.max(0, amount - jurosDevidos)
    : amount;
  const newCapital    = Math.max(0, contract.capital - pagoEmCapital);
  const newJuros      = newCapital * contract.interest_rate_monthly;
  const newTotal      = newCapital + newJuros;
  const isFullQuitacao = newCapital <= 0.01;
  const isPartial      = mode === 'interest' && amount < jurosDevidos - 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { alert('Informe um valor maior que zero.'); return; }
    setLoading(true);
    try {
      if (mode === 'interest') {
        await onSubmit({ contract_id: contract.id, cycle_id: cycle?.id ?? null, amount, payment_type: isPartial ? 'PARTIAL' : 'INTEREST', payment_method: 'PIX', next_due_date: nextDate });
      } else if (capMode === 'full') {
        // Split automático: juros primeiro, resto no capital
        await onSubmit({
          contract_id: contract.id, cycle_id: cycle?.id ?? null,
          amount: pagoEmJuros > 0.01 ? pagoEmJuros : amount,
          payment_type: pagoEmJuros > 0.01 ? (pagoEmJuros >= jurosDevidos - 0.01 ? 'INTEREST' : 'PARTIAL') : 'CAPITAL',
          payment_method: 'PIX', next_due_date: null,
          _split_capital: pagoEmJuros > 0.01 && pagoEmCapital > 0.01 ? pagoEmCapital : null,
        });
      } else {
        // Só capital — ciclo de juros permanece aberto
        await onSubmit({ contract_id: contract.id, cycle_id: null, amount, payment_type: 'CAPITAL', payment_method: 'PIX', next_due_date: null });
      }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Info contrato */}
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-black text-white">{contract.client_name}</p>
            <p className="text-xs text-white/30 mt-0.5">Taxa: {(contract.interest_rate_monthly * 100).toFixed(1)}% ao mês</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/30 uppercase">Capital</p>
            <p className="font-black text-white">{fmtBRL(contract.capital)}</p>
          </div>
        </div>
        {jurosDevidos > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-xs">
            <span className="text-white/30">Juros pendentes: <span className="text-blue-300 font-black">{fmtBRL(jurosDevidos)}</span></span>
            <span className="text-white/30">Total: <span className="text-white font-black">{fmtBRL(contract.capital + jurosDevidos)}</span></span>
          </div>
        )}
      </div>

      {/* Seleção — só no modo capital */}
      {mode === 'capital' && (
        <div className="space-y-2">
          <p className={lbl}>Como vai amortizar?</p>

          {/* Opção A: Capital + Juros */}
          <button type="button" onClick={() => setCapMode('full')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${capMode==='full' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <CheckCircle2 size={17} className={`flex-shrink-0 ${capMode==='full' ? 'text-emerald-400' : 'text-white/20'}`} />
            <div className="text-left flex-1">
              <p className={`font-black text-sm ${capMode==='full' ? 'text-emerald-300' : 'text-white/50'}`}>Capital + Juros</p>
              <p className="text-[10px] text-white/25 mt-0.5">Quita os juros pendentes e amortiza o capital</p>
            </div>
            <span className={`font-black text-sm flex-shrink-0 ${capMode==='full' ? 'text-emerald-300' : 'text-white/30'}`}>
              {fmtBRL(contract.capital + jurosDevidos)}
            </span>
          </button>

          {/* Opção B: Só Capital */}
          <button type="button" onClick={() => setCapMode('capital-only')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${capMode==='capital-only' ? 'bg-blue-500/10 border-blue-500/40' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <CreditCard size={17} className={`flex-shrink-0 ${capMode==='capital-only' ? 'text-blue-400' : 'text-white/20'}`} />
            <div className="text-left flex-1">
              <p className={`font-black text-sm ${capMode==='capital-only' ? 'text-blue-300' : 'text-white/50'}`}>Só Capital</p>
              <p className="text-[10px] text-white/25 mt-0.5">Juros desta parcela continuam em aberto</p>
            </div>
            <span className={`font-black text-sm flex-shrink-0 ${capMode==='capital-only' ? 'text-blue-300' : 'text-white/30'}`}>
              {fmtBRL(contract.capital)}
            </span>
          </button>
        </div>
      )}

      {/* Campo de valor — aparece após escolha */}
      {capMode !== null && (
        <>
          <div>
            <label className={lbl}>Valor Recebido (R$)</label>
            <input type="number" step="0.01" min="0.01" value={amount}
              onChange={e => setAmount(Math.max(0, +e.target.value || 0))}
              className={inp} required />
            {isFullQuitacao && <p className="text-[10px] text-emerald-400 mt-1.5 font-bold">✓ Quitação total do contrato</p>}
            {isPartial      && <p className="text-[10px] text-amber-400 mt-1.5 font-bold">⚠ Pagamento parcial de juros</p>}
          </div>

          {/* Preview amortização parcial */}
          {mode === 'capital' && !isFullQuitacao && newCapital > 0 && amount > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Após este pagamento</p>
              {capMode === 'full' && pagoEmJuros > 0.01 && (
                <div className="flex justify-between text-xs"><span className="text-white/40">→ Quita juros:</span><span className="font-black text-blue-300">{fmtBRL(pagoEmJuros)}</span></div>
              )}
              {pagoEmCapital > 0.01 && (
                <div className="flex justify-between text-xs"><span className="text-white/40">→ Amortiza capital:</span><span className="font-black text-white">{fmtBRL(pagoEmCapital)}</span></div>
              )}
              <div className="border-t border-white/[0.07] pt-2 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-white/40">Novo capital:</span><span className="font-black text-white">{fmtBRL(newCapital)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Próximos juros:</span><span className="font-black text-blue-300">{fmtBRL(newJuros)}</span></div>
                <div className="flex justify-between text-xs border-t border-white/[0.07] pt-1.5"><span className="text-white/40">Novo saldo devedor:</span><span className="font-black text-amber-300">{fmtBRL(newTotal)}</span></div>
              </div>
            </div>
          )}

          {/* Próximo vencimento só para juros */}
          {mode === 'interest' && (
            <div><label className={lbl}>Próximo Vencimento</label>
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={inp} required />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>REGISTRANDO...</> : '✓ CONFIRMAR RECEBIMENTO'}
          </button>
        </>
      )}
    </form>
  );
};

// ── RENEGOCIAR FORM ───────────────────────────────────────────
const RenegotiateForm = ({ client, contracts, cycles, onSuccess, onClose }: { client:Client; contracts:Contract[]; cycles?:InterestCycle[]; onSuccess:()=>void; onClose:()=>void; }) => {
  const [mode, setMode]       = useState<'interest-only'|'full'|null>(null);
  const [amount, setAmount]   = useState(0);
  const [rate, setRate]       = useState(10);
  const [dueDate, setDueDate] = useState(format(addMonths(new Date(),1),'yyyy-MM-dd'));
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const totalCapital   = contracts.reduce((s,c)=>s+c.capital,0);
  const totalInterest  = (cycles??[]).filter(c=>c.status!=='PAID').reduce((s,c)=>s+(c.base_interest_amount-(c.paid_amount||0)),0);
  const monthly = amount*(rate/100);

  useEffect(()=>{ if(mode==='interest-only') setAmount(totalInterest); else if(mode==='full') setAmount(totalCapital); },[mode]);

  return (
    <form onSubmit={async e=>{ e.preventDefault(); if(!mode){alert('Selecione o tipo');return;} setLoading(true); try{ await api.renegotiateClient({client_id:client.id,contract_ids:contracts.map(c=>c.id),new_capital:amount,new_rate:rate,next_due_date:dueDate,guarantee_notes:notes,interest_only:mode==='interest-only'}); onSuccess(); }catch(e:any){alert(e.message);}finally{setLoading(false);} }} className="space-y-4">
      <div className="bg-white/[0.04] rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-blue-300">{client.name[0]}</div>
        <div><p className="font-black text-white">{client.name}</p><p className="text-xs text-white/30">Capital: {fmtBRL(totalCapital)} · Juros pendentes: {fmtBRL(totalInterest)}</p></div>
      </div>
      <div className="space-y-2">
        <label className={lbl}>Tipo de Renegociação</label>
        {[
          { key:'interest-only', icon:<DollarSign size={16}/>, title:'Cliente pagou só os juros', desc:'Registrar pagamento e criar nova parcela' },
          { key:'full',          icon:<RefreshCw size={16}/>,  title:'Renegociar contrato completo', desc:'Fechar contratos antigos e criar novo' },
        ].map(opt=>(
          <button key={opt.key} type="button" onClick={()=>setMode(opt.key as any)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${mode===opt.key?'bg-blue-500/10 border-blue-500/40':'bg-white/[0.03] border-white/[0.06]'}`}>
            <span className={mode===opt.key?'text-blue-400':'text-white/30'}>{opt.icon}</span>
            <div className="text-left"><p className={`font-black text-sm ${mode===opt.key?'text-blue-300':'text-white/50'}`}>{opt.title}</p><p className="text-[10px] text-white/25 mt-0.5">{opt.desc}</p></div>
          </button>
        ))}
      </div>
      {mode && <>
        {mode==='interest-only' && <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 text-xs text-white/40">Resumo: Cliente paga <span className="text-blue-300 font-black">{fmtBRL(totalInterest)}</span> agora. Próximo mês: <span className="text-white font-black">{fmtBRL(totalCapital)}</span></div>}
        <div><label className={lbl}>Valor (R$)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(+e.target.value||0)} className={inp} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Taxa (%)</label><input type="number" step="0.1" value={rate} onChange={e=>setRate(+e.target.value||0)} className={inp} required /></div>
          <div><label className={lbl}>Vencimento</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className={inp} required /></div>
        </div>
        <div className="bg-white/[0.04] rounded-xl p-3 flex justify-between"><span className="text-xs text-white/40 font-bold">Juros Mensal:</span><span className="text-sm font-black text-blue-400">{fmtBRL(monthly)}</span></div>
        <div><label className={lbl}>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} className={`${inp} h-16 resize-none`} placeholder="Motivo..." /></div>
        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm disabled:opacity-50">{loading?'PROCESSANDO...':'CONFIRMAR RENEGOCIAÇÃO'}</button>
      </>}
    </form>
  );
};

// ── REPORTS ───────────────────────────────────────────────────
const ReportsView = () => {
  const [report, setReport] = useState<any>(null);
  const [start, setStart]   = useState('');
  const [end, setEnd]       = useState('');
  const load = async () => { try{ setReport(await api.getReports(start||undefined,end||undefined)); }catch(e:any){alert(e.message);} };
  useEffect(()=>{ load(); },[]);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Relatórios</h1>
      <div className="grid grid-cols-2 gap-2"><input type="date" value={start} onChange={e=>setStart(e.target.value)} className={inp}/><input type="date" value={end} onChange={e=>setEnd(e.target.value)} className={inp}/></div>
      <button onClick={load} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-3 rounded-xl text-sm">Filtrar</button>
      {report && <div className="grid grid-cols-2 gap-3">
        {[{l:'Total Recebido',v:fmtBRL(report.totalReceived),c:'text-emerald-400',bg:'bg-emerald-500/10'},{l:'Juros Recebidos',v:fmtBRL(report.interestReceived),c:'text-blue-400',bg:'bg-blue-500/10'},{l:'Contratos Ativos',v:report.activeContracts,c:'text-amber-400',bg:'bg-amber-500/10'},{l:'Vencidos',v:report.overdueContracts,c:'text-red-400',bg:'bg-red-500/10'}].map(m=>(
          <div key={m.l} className={`${m.bg} border border-white/[0.07] rounded-2xl p-4`}><p className="text-[9px] text-white/30 uppercase mb-1">{m.l}</p><p className={`text-lg font-black ${m.c}`}>{m.v}</p></div>
        ))}
      </div>}
      {report?.recentPayments?.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Pagamentos Recentes</p>
          {report.recentPayments.map((g:any)=>(
            <div key={g.client_id} className={`${card} overflow-hidden mb-2`}>
              <details><summary className="flex justify-between p-3 cursor-pointer list-none">
                <span className="font-black text-white text-sm">{g.client_name}</span>
                <div className="flex items-center gap-2"><span className="text-emerald-400 font-black text-sm">{fmtBRL(g.total_amount)}</span><ChevronDown size={13} className="text-white/30"/></div>
              </summary>
              <div className="px-3 pb-3 space-y-1 border-t border-white/[0.05]">
                {g.payments.map((p:any)=>(
                  <div key={p.id} className="flex justify-between text-xs py-1 border-b border-white/[0.04] last:border-0">
                    <span className="text-white/40">{p.payment_type} · {format(new Date(p.created_at),'dd/MM/yy')}</span>
                    <span className="text-white font-black">{fmtBRL(p.amount)}</span>
                  </div>
                ))}
              </div></details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── CALCULADORA ───────────────────────────────────────────────
const CalculatorView = () => {
  const [capital, setCapital] = useState(1000);
  const [rate, setRate]       = useState(10);
  const monthly   = capital * (rate / 100);
  const annual    = monthly * 12;
  // Payback: meses para recuperar o capital só com juros
  const payback   = monthly > 0 ? Math.ceil(capital / monthly) : 0;
  const progress  = Math.min(100, payback > 0 ? Math.round((1 / payback) * 100) : 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Calculadora</h1>

      {/* Inputs */}
      <div className={`${card} p-5 space-y-4`}>
        <div><label className={lbl}>Capital Emprestado (R$)</label>
          <input type="number" value={capital} onChange={e=>setCapital(+e.target.value||0)} className={inp}/>
        </div>
        <div><label className={lbl}>Juros Mensal (%)</label>
          <input type="number" step="0.1" value={rate} onChange={e=>setRate(+e.target.value||0)} className={inp}/>
        </div>
      </div>

      {/* Resultado principal */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-center">
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Juros Mensal</p>
        <p className="text-3xl font-black text-white">{fmtBRL(monthly)}</p>
        <p className="text-xs text-white/30 mt-1">Anual: {fmtBRL(annual)}</p>
      </div>

      {/* Payback — retorno do capital */}
      <div className={`${card} p-5`}>
        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-4">Calculadora de Retorno (Payback)</p>

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-white/40">Ponto de Equilíbrio</p>
            <p className="text-2xl font-black text-emerald-400">{payback > 0 ? `${payback} meses` : '—'}</p>
            <p className="text-[10px] text-white/25 mt-0.5">
              {payback > 0 ? `Em ${payback} meses você recupera ${fmtBRL(capital)} só com juros` : 'Informe capital e taxa'}
            </p>
          </div>
          <div className="w-16 h-16 relative flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3"
                strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round"/>
            </svg>
            <span className="absolute text-[10px] font-black text-emerald-400">{progress}%</span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-full bg-white/[0.06] rounded-full h-2 mb-3">
          <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500" style={{width:`${progress}%`}}/>
        </div>

        {/* Tabela meses */}
        <div className="space-y-1.5 mt-4">
          {[3,6,12].map(m => {
            const acumulado = monthly * m;
            const pct       = capital > 0 ? Math.min(100, Math.round((acumulado / capital) * 100)) : 0;
            return (
              <div key={m} className="flex items-center justify-between text-xs">
                <span className="text-white/30 w-16">{m} meses</span>
                <div className="flex-1 mx-3 bg-white/[0.05] rounded-full h-1.5">
                  <div className="bg-blue-500/60 h-1.5 rounded-full" style={{width:`${pct}%`}}/>
                </div>
                <span className="text-white/50 font-black w-20 text-right">{fmtBRL(acumulado)}</span>
                <span className="text-white/25 w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── GERENCIAMENTO ─────────────────────────────────────────────
const ManagementView = ({ user }: { user: AppUser }) => {
  const [form,setForm]       = useState({name:'',email:'',password:''});
  const [users,setUsers]     = useState<any[]>([]);
  const [msg,setMsg]         = useState('');
  const [err,setErr]         = useState('');
  const [loading,setLoading] = useState(false);
  const load = async () => { try{ setUsers(await api.listUsers()); }catch{} };
  useEffect(()=>{ load(); },[]);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Gerenciamento</h1>
      <div className={`${card} p-5`}>
        <p className="text-sm font-black text-white mb-4 flex items-center gap-2"><PlusCircle size={14} className="text-blue-400"/> Novo Cobrador</p>
        {msg&&<div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl text-xs font-bold mb-3">{msg}</div>}
        {err&&<div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-xs font-bold mb-3">{err}</div>}
        <form onSubmit={async e=>{ e.preventDefault(); setLoading(true); setErr(''); try{ await api.createCollector(form.name,form.email,form.password); setMsg('Cobrador criado!'); setForm({name:'',email:'',password:''}); load(); }catch(e:any){setErr(e.message);}finally{setLoading(false);} }} className="space-y-3">
          <div><label className={lbl}>Nome</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={inp} required/></div>
          <div><label className={lbl}>E-mail</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={inp} required/></div>
          <div><label className={lbl}>Senha</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={inp} required/></div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-3.5 rounded-xl text-sm disabled:opacity-50">{loading?'CRIANDO...':'CADASTRAR'}</button>
        </form>
      </div>
      <div className={`${card} p-5`}>
        <p className="text-sm font-black text-white mb-4">Usuários</p>
        <div className="space-y-2">
          {users.filter(u=>u.id!==user.id).map(u=>(
            <div key={u.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              <div><p className="font-bold text-white text-sm">{u.name}</p><p className="text-[10px] text-white/30">{u.login}</p></div>
              <div className="flex gap-2">
                <Badge variant={u.role==='ADMIN'?'success':'default'}>{u.role}</Badge>
                <button onClick={()=>{ if(confirm('Redefinir senha para 123456?')) api.resetPassword(u.id,'123456').then(()=>alert('Feito!')).catch((e:any)=>alert(e.message)); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><RefreshCw size={12}/></button>
                <button onClick={()=>{ if(confirm('Excluir usuário?')) api.deleteUser(u.id).then(load).catch((e:any)=>alert(e.message)); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── LOGIN ─────────────────────────────────────────────────────
const Login = ({ onLogin }: { onLogin:(u:AppUser)=>void }) => {
  const [email,setEmail]     = useState('');
  const [pass,setPass]       = useState('');
  const [show,setShow]       = useState(false);
  const [error,setError]     = useState('');
  const [loading,setLoading] = useState(false);
  return (
    <div className="min-h-screen bg-[#0a0918] flex flex-col items-center justify-center p-5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-900/15 rounded-full blur-[120px] pointer-events-none"/>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-900/30"><TrendingUp className="text-white" size={24}/></div>
          <h1 className="text-xl font-black text-white">Capital Rotativo</h1>
          <p className="text-white/30 text-xs mt-1">Gestão de empréstimos</p>
        </div>
        <div className={`${card} p-6`}>
          <form onSubmit={async e=>{ e.preventDefault(); setError(''); setLoading(true); try{ onLogin(await api.login(email,pass)); }catch(e:any){setError(e.message||'Credenciais inválidas');}finally{setLoading(false);} }} className="space-y-4">
            <div><label className={lbl}>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inp} required/></div>
            <div><label className={lbl}>Senha</label>
              <div className="relative">
                <input type={show?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} className={`${inp} pr-12`} required/>
                <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">{show?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
            </div>
            {error&&<p className="bg-red-500/10 text-red-400 text-xs font-bold p-3 rounded-xl text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>ENTRANDO...</>:'ENTRAR'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [user,setUser]         = useState<AppUser|null>(null);
  const [activeTab,setActiveTab] = useState('loans');
  const [dashData,setDashData] = useState<any>(null);
  const [loading,setLoading]   = useState(true);
  const [menuOpen,setMenuOpen] = useState(false);
  const [clients,setClients]   = useState<Client[]>([]);
  const [contracts,setContracts] = useState<Contract[]>([]);
  const [loanFilter,setLoanFilter] = useState<'all'|'today'|'overdue'|'scheduled'>('all');
  const [search,setSearch]     = useState('');
  const [newContractCalc,setNewContractCalc] = useState({capital:0,rate:10});

  // Modals
  const [payModal,setPayModal]         = useState<{contract:Contract;cycle?:InterestCycle|null;mode:'interest'|'capital'}|null>(null);
  const [receipt,setReceipt]           = useState<any>(null);
  const [renegoModal,setRenegoModal]   = useState<{client:Client;contracts:Contract[];cycles?:InterestCycle[]}|null>(null);
  const [newContractModal,setNewContractModal] = useState(false);
  const [newClientModal,setNewClientModal]     = useState(false);
  const [editClientModal,setEditClientModal]   = useState<Client|null>(null);
  const [deleteModal,setDeleteModal]   = useState<number|null>(null);

  useEffect(()=>{
    (async()=>{ const u=await api.getSession(); if(u) setUser(u); setLoading(false); })();
    const {data:{subscription}} = supabase.auth.onAuthStateChange(ev=>{ if(ev==='SIGNED_OUT'){setUser(null);setDashData(null);setClients([]);setContracts([]);} });
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(user) loadAll(); },[user]);

  const loadAll = async () => {
    try {
      const [dash,cls,conts] = await Promise.all([api.getDashboard(), api.getClients(), api.getContracts('ACTIVE')]);
      setDashData(dash); setClients(cls); setContracts(conts);
    } catch{}
  };

  const allCycles = dashData ? [...(dashData.overdue||[]),(dashData.today||[]),(dashData.scheduled||[])].flat() : [];

  const enriched = contracts.map(contract=>({
    contract,
    cycle: allCycles.find((ic:any)=>ic.contract_id===contract.id) as InterestCycle|undefined,
    client: clients.find(c=>c.id===contract.client_id),
  }));

  const today = format(new Date(),'yyyy-MM-dd');
  const filtered = enriched.filter(({contract,client})=>{
    const name = (contract.client_name||client?.name||'').toLowerCase();
    if(search && !name.includes(search.toLowerCase())) return false;
    if(loanFilter==='today')     return contract.next_due_date===today;
    if(loanFilter==='overdue')   return contract.next_due_date<today;
    if(loanFilter==='scheduled') return contract.next_due_date>today;
    return true;
  });

  const counts = {
    all:       enriched.length,
    today:     enriched.filter(e=>e.contract.next_due_date===today).length,
    overdue:   enriched.filter(e=>e.contract.next_due_date<today).length,
    scheduled: enriched.filter(e=>e.contract.next_due_date>today).length,
  };

  const handlePayment = async (data: any) => {
    const ct = contracts.find(c => c.id === data.contract_id);
    try {
      const splitCapital = data._split_capital ?? null;
      const { _split_capital, ...payData } = data;

      // Registra pagamento de juros primeiro
      await api.registerPayment(payData);

      // Se tem split, registra capital em seguida
      if (splitCapital && splitCapital > 0) {
        await api.registerPayment({
          contract_id:    data.contract_id,
          cycle_id:       null,
          amount:         splitCapital,
          payment_type:   'CAPITAL',
          payment_method: 'PIX',
          next_due_date:  null,
        });
      }

      const totalPago   = data.amount + (splitCapital ?? 0);
      const juros       = data.amount;
      const capitalPago = splitCapital ?? 0;
      const novoCapital = Math.max(0, (ct?.capital ?? 0) - capitalPago);

      setReceipt({
        client_name:  ct?.client_name  || '',
        client_phone: ct?.client_phone || '',
        amount:       totalPago,
        type_label:   splitCapital
          ? `Juros (${fmtBRL(juros)}) + Capital (${fmtBRL(capitalPago)})`
          : data.payment_type === 'CAPITAL' ? 'Amortização de Capital'
          : data.payment_type === 'PARTIAL' ? 'Juros Parcial' : 'Juros',
        remaining: novoCapital,
      });

      setPayModal(null);
      await loadAll();
    } catch (e: any) { alert(e.message); }
  };

  const sendWA = (contract:Contract, client?:Client) => {
    const phone = (contract.client_phone||client?.phone||'').replace(/\D/g,'');
    const msg   = `Olá ${contract.client_name||client?.name}, passando para lembrar do seu pagamento de ${fmtBRL(contract.monthly_interest_amount)} com vencimento em ${format(parseDate(contract.next_due_date),'dd/MM/yyyy')}. 🙏`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  };

  if(loading) return <div className="min-h-screen bg-[#0a0918] flex items-center justify-center"><div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-slate-800 flex items-center justify-center animate-pulse"><TrendingUp className="text-white" size={22}/></div></div>;
  if(!user)   return <Login onLogin={u=>setUser(u)}/>;

  const tabs     = [{id:'dashboard',label:'Home',icon:Home},{id:'loans',label:'Empréstimos',icon:DollarSign},{id:'reports',label:'Relatórios',icon:BookOpen}];
  const menuItems = [...tabs,...(user.role==='ADMIN'?[{id:'calculator',label:'Calculadora',icon:CalcIcon},{id:'management',label:'Gerenciamento',icon:Settings}]:[])];

  return (
    <div className="min-h-screen bg-[#0a0918] text-white flex flex-col">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none z-0"/>

      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0a0918]/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-slate-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30"><TrendingUp size={14} className="text-white"/></div>
          <span className="font-black text-white text-sm">Capital Rotativo</span>
        </div>
        <button onClick={()=>setMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.07]"><Menu size={17} className="text-white/60"/></button>
      </header>

      {/* MENU */}
      <AnimatePresence>
        {menuOpen&&(<>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMenuOpen(false)} className="fixed inset-0 bg-black/60 z-50"/>
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:300}}
            className="fixed right-0 top-0 bottom-0 w-72 bg-[#0f0e1a] border-l border-white/[0.07] z-50 flex flex-col p-5">
            <div className="flex justify-between items-center mb-8"><span className="font-black text-white text-sm">Capital Rotativo</span><button onClick={()=>setMenuOpen(false)}><X size={18} className="text-white/40"/></button></div>
            <div className={`${card} p-4 mb-6 flex items-center gap-3`}>
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-blue-300 border border-blue-500/20">{user.name[0]}</div>
              <div><p className="font-black text-white text-sm">{user.name}</p><p className="text-[9px] text-white/30 uppercase tracking-widest">{user.role}</p></div>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
              {menuItems.map(item=>(
                <button key={item.id} onClick={()=>{setActiveTab(item.id);setMenuOpen(false);}}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${activeTab===item.id?'bg-blue-600/20 text-white border border-blue-500/30':'text-white/40 hover:bg-white/[0.04]'}`}>
                  <item.icon size={16} className={activeTab===item.id?'text-blue-400':''}/> {item.label}
                </button>
              ))}
            </nav>
            <button onClick={()=>api.logout()} className="flex items-center gap-3 w-full px-4 py-3 bg-red-500/10 text-red-400 rounded-xl font-bold text-sm border border-red-500/20 mt-4"><LogOut size={14}/> Sair</button>
          </motion.div>
        </>)}
      </AnimatePresence>

      {/* CONTENT */}
      <main className="flex-1 px-4 pt-5 pb-24 relative z-10 max-w-lg mx-auto w-full">

        {/* DASHBOARD */}
        {activeTab==='dashboard'&&(
          <div className="space-y-5">
            <div><h1 className="text-xl font-black text-white">Olá, {user.name.split(' ')[0]} 👋</h1><p className="text-white/30 text-sm">Resumo do portfólio</p></div>
            {user.role==='ADMIN'&&<button onClick={()=>setNewContractModal(true)} className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-blue-900/20"><PlusCircle size={17}/> Novo Empréstimo</button>}
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:'Capital na Rua',    v:fmtBRL(dashData?.metrics?.total_on_street||0),           c:'text-blue-400',    bg:'bg-blue-500/10'   },
                {l:'Lucro Recebido',    v:fmtBRL(dashData?.metrics?.total_interest_received||0),    c:'text-emerald-400', bg:'bg-emerald-500/10'},
                {l:'Capital Recebido',  v:fmtBRL(dashData?.metrics?.total_capital_received||0),     c:'text-purple-400',  bg:'bg-purple-500/10' },
                {l:'Lucro a Receber',   v:fmtBRL(dashData?.metrics?.total_interest_to_receive||0),  c:'text-amber-400',   bg:'bg-amber-500/10'  },
              ].map(m=>(
                <div key={m.l} className={`${m.bg} border border-white/[0.07] rounded-2xl p-4 cursor-pointer`} onClick={()=>setActiveTab('loans')}>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">{m.l}</p><p className={`text-lg font-black ${m.c}`}>{m.v}</p>
                </div>
              ))}
            </div>
            <div className={`${card} p-4`}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Vencimentos</p>
              {[{l:'Hoje',n:dashData?.today?.length||0,c:'text-amber-400',f:'today'},{l:'Atrasados',n:dashData?.overdue?.length||0,c:'text-red-400',f:'overdue'},{l:'Programados',n:dashData?.scheduled?.length||0,c:'text-blue-400',f:'scheduled'}].map(r=>(
                <button key={r.l} onClick={()=>{setActiveTab('loans');setLoanFilter(r.f as any);}} className="w-full flex justify-between items-center py-2.5 border-b border-white/[0.05] last:border-0">
                  <span className="text-sm text-white/50">{r.l}</span><div className="flex items-center gap-1.5"><span className={`text-sm font-black ${r.c}`}>{r.n}</span><ArrowRight size={12} className="text-white/20"/></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EMPRÉSTIMOS */}
        {activeTab==='loans'&&(
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-black text-white">Empréstimos</h1>
              <div className="flex gap-2">
                {user.role==='ADMIN'&&<button onClick={()=>setNewClientModal(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.07] text-white/50"><Users size={14}/></button>}
                <button onClick={()=>setNewContractModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-900/20"><PlusCircle size={13}/> Empréstimo</button>
              </div>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"/>
              <input type="text" placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)} className={`${inp} pl-10 py-2.5`}/>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {([{k:'all',l:`Todos (${counts.all})`},{k:'today',l:`Hoje (${counts.today})`},{k:'overdue',l:`Atraso (${counts.overdue})`},{k:'scheduled',l:`Agendado (${counts.scheduled})`}] as const).map(f=>(
                <button key={f.k} onClick={()=>setLoanFilter(f.k as any)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${loanFilter===f.k?'bg-blue-600 border-blue-500 text-white':'bg-white/[0.05] border-white/[0.07] text-white/40'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            {filtered.length===0
              ? <div className={`${card} p-8 text-center text-white/20 text-sm`}>{search?'Nenhum resultado':'Nenhum empréstimo aqui'}</div>
              : <AnimatePresence>{filtered.map(({contract,cycle,client})=>(
                  <LoanCard key={contract.id} contract={contract} client={client} cycle={cycle} user={user}
                    onPayInterest={()=>setPayModal({contract,cycle:cycle??null,mode:'interest'})}
                    onPayCapital={()=>setPayModal({contract,cycle:null,mode:'capital'})}
                    onRenegotiate={()=>{ const cl=clients.find(c=>c.id===contract.client_id); if(cl) setRenegoModal({client:cl,contracts:contracts.filter(c=>c.client_id===cl.id),cycles:dashData?.details?.interestToReceive?.filter((ic:any)=>ic.client_id===cl.id)}); }}
                    onEdit={()=>{ const cl=clients.find(c=>c.id===contract.client_id); if(cl) setEditClientModal(cl); }}
                    onDelete={()=>setDeleteModal(contract.client_id)}
                    onWhatsApp={()=>sendWA(contract,client)}
                  />
                ))}</AnimatePresence>
            }
          </div>
        )}

        {activeTab==='reports'    && <ReportsView/>}
        {activeTab==='calculator' && user.role==='ADMIN' && <CalculatorView/>}
        {activeTab==='management' && user.role==='ADMIN' && <ManagementView user={user}/>}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0918]/95 backdrop-blur-xl border-t border-white/[0.05] flex items-center justify-around px-2 py-2">
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className="flex flex-col items-center gap-1 px-4 py-1">
            <div className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${activeTab===tab.id?'bg-blue-600/25 border border-blue-500/40':''}`}>
              <tab.icon size={19} className={activeTab===tab.id?'text-blue-400':'text-white/25'}/>
            </div>
            <span className={`text-[9px] font-black tracking-wide ${activeTab===tab.id?'text-blue-400':'text-white/20'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      <AnimatePresence>
        {payModal&&<Modal title={payModal.mode==='interest'?'Receber Juros':'Amortizar Capital'} onClose={()=>setPayModal(null)}><PaymentForm contract={payModal.contract} cycle={payModal.cycle} mode={payModal.mode} onSubmit={handlePayment}/></Modal>}
        {receipt&&<ReceiptModal receipt={receipt} onClose={()=>setReceipt(null)}/>}
        {renegoModal&&<Modal title="Renegociar Dívida" onClose={()=>setRenegoModal(null)}><RenegotiateForm client={renegoModal.client} contracts={renegoModal.contracts} cycles={renegoModal.cycles} onClose={()=>setRenegoModal(null)} onSuccess={()=>{setRenegoModal(null);loadAll();}}/></Modal>}

        {newContractModal&&<Modal title="Novo Empréstimo" onClose={()=>setNewContractModal(false)}>
          <form onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.target as HTMLFormElement);try{await api.createContract({client_id:parseInt(fd.get('client_id') as string),capital:parseFloat(fd.get('capital') as string),interest_rate_monthly:parseFloat(fd.get('rate') as string)/100,next_due_date:fd.get('due_date') as string,guarantee_notes:fd.get('guarantee') as string});setNewContractModal(false);loadAll();}catch(e:any){alert(e.message);}}} className="space-y-4">
            <div><label className={lbl}>Cliente</label><select name="client_id" className={inp} required><option value="">Selecione...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Capital (R$)</label><input name="capital" type="number" step="0.01" onChange={e=>setNewContractCalc({...newContractCalc,capital:+e.target.value||0})} className={inp} required/></div>
              <div><label className={lbl}>Juros (%)</label><input name="rate" type="number" step="0.1" defaultValue={10} onChange={e=>setNewContractCalc({...newContractCalc,rate:+e.target.value||0})} className={inp} required/></div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/15 rounded-xl p-3 flex justify-between"><span className="text-xs text-white/40 font-bold">Juros Mensal:</span><span className="text-sm font-black text-blue-400">{fmtBRL(newContractCalc.capital*(newContractCalc.rate/100))}</span></div>
            <div><label className={lbl}>Vencimento</label><input name="due_date" type="date" defaultValue={format(addMonths(new Date(),1),'yyyy-MM-dd')} className={inp} required/></div>
            <div><label className={lbl}>Garantia</label><textarea name="guarantee" className={`${inp} h-20 resize-none`}></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm">CRIAR EMPRÉSTIMO</button>
          </form>
        </Modal>}

        {newClientModal&&<Modal title="Novo Cliente" onClose={()=>setNewClientModal(false)}>
          <form onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.target as HTMLFormElement);try{await api.createClient({name:fd.get('name') as string,cpf:fd.get('cpf') as string,phone:fd.get('phone') as string,address:fd.get('address') as string,notes:fd.get('notes') as string});setNewClientModal(false);loadAll();}catch(e:any){alert(e.message);}}} className="space-y-4">
            <div><label className={lbl}>Nome</label><input name="name" type="text" className={inp} required/></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>CPF</label><input name="cpf" type="text" className={inp}/></div><div><label className={lbl}>Telefone</label><input name="phone" type="text" className={inp} required/></div></div>
            <div><label className={lbl}>Endereço</label><input name="address" type="text" className={inp}/></div>
            <div><label className={lbl}>Observações</label><textarea name="notes" className={`${inp} h-16 resize-none`}></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm">CADASTRAR</button>
          </form>
        </Modal>}

        {editClientModal&&<Modal title="Editar Cliente" onClose={()=>setEditClientModal(null)}>
          <form onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.target as HTMLFormElement);try{await api.updateClient(editClientModal.id,{name:fd.get('name') as string,cpf:fd.get('cpf') as string,phone:fd.get('phone') as string,address:fd.get('address') as string,notes:fd.get('notes') as string});setEditClientModal(null);loadAll();}catch(e:any){alert(e.message);}}} className="space-y-4">
            <div><label className={lbl}>Nome</label><input name="name" defaultValue={editClientModal.name} type="text" className={inp} required/></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>CPF</label><input name="cpf" defaultValue={editClientModal.cpf} type="text" className={inp}/></div><div><label className={lbl}>Telefone</label><input name="phone" defaultValue={editClientModal.phone} type="text" className={inp}/></div></div>
            <div><label className={lbl}>Endereço</label><input name="address" defaultValue={editClientModal.address} type="text" className={inp}/></div>
            <div><label className={lbl}>Observações</label><textarea name="notes" defaultValue={editClientModal.notes} className={`${inp} h-16 resize-none`}></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-slate-800 text-white font-black py-4 rounded-xl text-sm">SALVAR</button>
          </form>
        </Modal>}

        {deleteModal&&<Modal title="Confirmar Exclusão" onClose={()=>setDeleteModal(null)}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3"><AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/><p className="text-xs text-white/50 leading-relaxed">Isso apaga permanentemente o cliente, contratos, ciclos e pagamentos. Não pode ser desfeito.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setDeleteModal(null)} className="bg-white/[0.06] text-white font-black py-3 rounded-xl text-sm border border-white/[0.08]">Cancelar</button>
              <button onClick={async()=>{ try{await api.deleteClient(deleteModal);setDeleteModal(null);loadAll();}catch(e:any){alert(e.message);} }} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">Excluir</button>
            </div>
          </div>
        </Modal>}
      </AnimatePresence>
    </div>
  );
}