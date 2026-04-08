import React, { useState, useEffect } from 'react';
// @ts-ignore
const _fontLink = (() => { const l = document.createElement('link'); l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap'; document.head.appendChild(l); })();
import {
  TrendingUp, DollarSign, FileText, AlertCircle, PlusCircle,
  CheckCircle2, Phone, LogOut, Menu, X, Calculator as CalcIcon,
  ArrowRight, Search, RefreshCw, Trash2, Edit, ChevronDown,
  Settings, Home, BookOpen, Users, Bell, Clock, CreditCard,
  MessageCircle, RotateCcw, Banknote, Eye, EyeOff,
  XCircle, ThumbsUp, ThumbsDown, BellRing,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import * as api from './services/api';
import { supabase } from './services/supabaseClient';

interface AppUser   { id: string; name: string; email: string; role: 'ADMIN' | 'COLLECTOR'; }
interface Client    { id: number; name: string; cpf?: string; address?: string; phone?: string; notes?: string; status: string; }
interface Contract  { id: number; client_id: number; capital: number; interest_rate_monthly: number; monthly_interest_amount: number; next_due_date: string; status: string; guarantee_notes?: string; client_name?: string; client_phone?: string; contract_type?: 'REVOLVING'|'INSTALLMENT'; total_installments?: number; paid_installments?: number; installment_amount?: number; }
interface InterestCycle { id: number; contract_id: number; due_date: string; base_interest_amount: number; paid_amount: number; status: string; client_name?: string; client_phone?: string; capital?: number; }

const inp  = 'w-full bg-white/[0.04] border border-white/[0.07] text-white placeholder-white/20 px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-sm';
const lbl  = 'block text-[10px] font-bold text-white/40 uppercase tracking-[0.18em] mb-1.5';
const card = 'bg-white/[0.04] border border-white/[0.07] rounded-2xl';

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const parseDate = (d: string) => parseISO(d.includes('T') ? d : d + 'T12:00:00');

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default'|'success'|'warning'|'danger'|'info' }) => {
  const v = { default:'bg-white/[0.08] text-white/50', success:'bg-blue-500/15 text-blue-500', warning:'bg-amber-500/20 text-amber-400', danger:'bg-red-500/20 text-red-400', info:'bg-slate-800/60 text-blue-500/70' };
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${v[variant]}`}>{children}</span>;
};

const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:60, opacity:0 }} transition={{ type:'spring', damping:28, stiffness:320 }}
      className="relative w-full max-w-lg bg-[#02393900] border border-[#1e3a8a] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-black text-white">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1e3a8a]/40"><X size={15} className="text-white/50" /></button>
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
        <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/60/20 rounded-xl p-5 space-y-3">
          {[['Cliente',receipt.client_name],['Tipo',receipt.type_label],['Valor Pago',fmtBRL(receipt.amount)],['Data',format(new Date(),'dd/MM/yyyy')],['Saldo Restante',fmtBRL(receipt.remaining)]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-sm"><span className="text-white/40">{k}:</span><span className="font-black text-white">{v}</span></div>
          ))}
        </div>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-center">Enviar comprovante</p>
        <button onClick={()=>sendWA(false)} className="w-full bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><MessageCircle size={14}/> Para Mim (copiar)</button>
        <button onClick={()=>sendWA(true)}  className="w-full bg-blue-600/20 border border-[#1e3a8a]/60 text-[#0CABA8]/80 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><Phone size={14}/> Para o Cliente (WhatsApp)</button>
        <button onClick={downloadPDF}       className="w-full bg-[#2563eb]/20 border border-[#3b82f6]/60/30 text-blue-300 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><FileText size={14}/> Baixar PDF</button>
        <button onClick={onClose} className="w-full bg-[#1e3a8a]/20 text-white/40 font-bold py-3 rounded-xl text-sm">Fechar</button>
      </div>
    </Modal>
  );
};

// ── CONFIRM PAYMENT MODAL ────────────────────────────────────
const ConfirmPaymentModal = ({ title, lines, onConfirm, onCancel }: {
  title: string;
  lines: { label: string; value: string; accent?: string }[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-4 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-white/40">{l.label}</span>
              <span className={`font-black ${l.accent ?? 'text-white'}`}>{l.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-amber-400/70 text-center font-bold">
          ⚠ Confirme antes de registrar. Erros podem ser corrigidos em Relatórios.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCancel}
            className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-black py-3.5 rounded-xl text-sm">
            Revisar
          </button>
          <button onClick={async()=>{ setLoading(true); try{ await onConfirm(); }finally{ setLoading(false); }}} disabled={loading}
            className="bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-3.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>REGISTRANDO...</> : '✓ CONFIRMAR'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── INSTALLMENT CARD ─────────────────────────────────────────
const InstallmentCard = ({ contract, client, cycles, user, onPayInstallment, onQuitacao, onEdit, onDelete, onWhatsApp, onChangeDue }: {
  contract: Contract; client?: Client; cycles: InterestCycle[]; user: AppUser | null;
  onPayInstallment:(cycle:InterestCycle, mode:'parcela'|'capital'|'juros')=>void;
  onQuitacao:()=>void;
  onEdit:()=>void; onDelete:()=>void; onWhatsApp:()=>void; onChangeDue:()=>void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const today     = format(new Date(),'yyyy-MM-dd');
  const total     = contract.total_installments ?? 0;
  const paid      = contract.paid_installments  ?? 0;
  const remaining = total - paid;
  const pct       = total > 0 ? Math.round((paid / total) * 100) : 0;
  const installAmt = Math.round((contract.installment_amount ?? contract.monthly_interest_amount) * 100) / 100;

  const totalCapital  = contract.capital;
  const totalJuros    = Math.round((installAmt * total - totalCapital) * 100) / 100;
  const totalGeral    = Math.round(installAmt * total * 100) / 100;
  const totalReceber  = Math.round(installAmt * remaining * 100) / 100;

  // Próxima parcela em aberto
  const nextCycle = cycles
    .filter(c => c.status !== 'PAID')
    .sort((a,b) => a.due_date.localeCompare(b.due_date))[0];

  const isOverdue = nextCycle && nextCycle.due_date < today;
  const isToday   = nextCycle && nextCycle.due_date === today;

  return (
    <motion.div layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
      className={`bg-[#012e2e] border rounded-xl overflow-hidden mb-3 ${
        isOverdue ? 'border-red-500/30' : isToday ? 'border-amber-500/30' : 'border-[#2563eb]/80'
      }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center font-black text-sm border ${
              isOverdue ? 'bg-red-500/15 text-red-300 border-red-500/20'
              : isToday  ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
              : 'bg-purple-500/15 text-purple-300 border-purple-500/20'
            }`}>{(contract.client_name||client?.name||'?')[0].toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-black text-white truncate">{contract.client_name||client?.name}</p>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 flex-shrink-0">PARCELADO</span>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">
                {paid}/{total} parcelas · {(contract.interest_rate_monthly*100).toFixed(0)}% a.m.
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] text-white/30 uppercase">Parcela</p>
            <p className="font-black text-purple-400">{fmtBRL(installAmt)}</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-white/30 mb-1">
            <span>{paid} pagas</span>
            <span>{remaining} restantes · {pct}%</span>
          </div>
          <div className="w-full bg-[#1e3a8a]/40 rounded-full h-2">
            <div className="bg-gradient-to-r from-purple-600 to-blue-500 h-2 rounded-full transition-all duration-500"
              style={{width:`${pct}%`}}/>
          </div>
        </div>

        {/* Próxima parcela */}
        {nextCycle && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${
            isOverdue ? 'bg-red-500/10 border border-red-500/20'
            : isToday ? 'bg-amber-500/10 border border-amber-500/20'
            : 'bg-[#1e3a8a]/20 border border-[#1e3a8a80]'
          }`}>
            <div>
              <p className={`text-[10px] font-black ${isOverdue?'text-red-400':isToday?'text-amber-400':'text-white/40'}`}>
                {isOverdue ? '⚠ ATRASADA' : isToday ? '📅 VENCE HOJE' : 'Próxima parcela'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">{format(parseDate(nextCycle.due_date),'dd/MM/yyyy')}</p>
            </div>
            <p className="font-black text-white">{fmtBRL(installAmt)}</p>
          </div>
        )}

        {/* Resumo financeiro — expandível */}
        <button onClick={()=>setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-[10px] text-white/30 mb-3">
          <span>Ver resumo financeiro</span>
          <ChevronDown size={12} className={`transition-transform ${expanded?'rotate-180':''}`}/>
        </button>
        {expanded && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#1e3a8a]/20 rounded-xl p-2 text-center">
              <p className="text-[9px] text-white/25 mb-1">Capital</p>
              <p className="text-xs font-black text-white">{fmtBRL(totalCapital)}</p>
            </div>
            <div className="bg-[#3b82f6]/10 rounded-xl p-2 text-center">
              <p className="text-[9px] text-white/25 mb-1">Lucro</p>
              <p className="text-xs font-black text-[#3b82f6]">{fmtBRL(totalJuros)}</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-2 text-center">
              <p className="text-[9px] text-white/25 mb-1">A receber</p>
              <p className="text-xs font-black text-[#3b82f6]/70">{fmtBRL(totalReceber)}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {nextCycle ? (
            <div className="flex-1 flex gap-1.5">
              <button onClick={()=>onPayInstallment(nextCycle,'parcela')}
                className="flex-1 bg-purple-600/20 border border-purple-500/30 text-purple-300 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1">
                <DollarSign size={11}/> Parcela
              </button>
              <button onClick={()=>onQuitacao()}
                className="flex-1 bg-[#2563eb]/20 border border-[#3b82f6]/60/30 text-blue-300 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1">
                <CheckCircle2 size={11}/> Quitar
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#3b82f6]/10 border border-[#3b82f6]/60/20 text-[#3b82f6] font-black font-['Space_Mono'] py-2.5 rounded-xl text-xs flex items-center justify-center gap-1">
              <CheckCircle2 size={12}/> Quitado
            </div>
          )}
          {user?.role==='ADMIN' && <>
            <button onClick={onChangeDue} title="Alterar vencimento" className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#1e3a8a]/30 border border-[#1e3a8a80] text-white/40"><Clock size={14}/></button>
            <button onClick={onWhatsApp}  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/60/20 text-[#3b82f6]"><Phone size={13}/></button>
            <button onClick={onEdit}      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#1e3a8a]/30 border border-[#1e3a8a80] text-white/30"><Edit size={13}/></button>
            <button onClick={onDelete}    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"><Trash2 size={14}/></button>
          </>}
        </div>
      </div>
    </motion.div>
  );
};

// ── INSTALLMENT PAYMENT FORM ──────────────────────────────────
const InstallmentPaymentForm = ({ contract, cycle, onSubmit }: {
  contract: Contract; cycle: InterestCycle; onSubmit:(d:any)=>void;
}) => {
  const installAmt = Math.round((contract.installment_amount ?? cycle.base_interest_amount) * 100) / 100;
  const [amount,  setAmount]  = useState(installAmt);
  const [loading, setLoading] = useState(false);
  const total     = contract.total_installments ?? 1;
  const paid      = contract.paid_installments  ?? 0;
  const parcNum   = paid + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setLoading(true);
    try { await onSubmit({ contract_id: contract.id, cycle_id: cycle.id, amount }); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info */}
      <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-black text-white">{contract.client_name}</p>
            <p className="text-xs text-white/30 mt-0.5">Parcela {parcNum} de {total}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/30 uppercase">Parcela</p>
            <p className="font-black text-purple-400">{fmtBRL(installAmt)}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#1e3a8a80]">
          <div className="w-full bg-[#1e3a8a]/40 rounded-full h-1.5">
            <div className="bg-gradient-to-r from-purple-600 to-blue-500 h-1.5 rounded-full"
              style={{width:`${Math.round((paid/total)*100)}%`}}/>
          </div>
          <p className="text-[10px] text-white/25 mt-1">{paid}/{total} pagas · vence {format(parseDate(cycle.due_date),'dd/MM/yyyy')}</p>
        </div>
      </div>

      <div>
        <label className={lbl}>Valor Recebido (R$)</label>
        <input type="number" step="0.01" min="0.01" value={amount}
          inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
          onChange={e=>setAmount(Math.max(0,+e.target.value||0))}
          className={inp} required/>
        {amount < installAmt - 0.01 && amount > 0 && (
          <p className="text-[10px] text-amber-400 mt-1.5 font-bold">⚠ Valor abaixo da parcela — registrado como pagamento parcial</p>
        )}
        {amount >= installAmt - 0.01 && (
          <p className="text-[10px] text-[#3b82f6] mt-1.5 font-bold">✓ Parcela {parcNum}/{total} quitada</p>
        )}
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-700 text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>REGISTRANDO...</> : `✓ CONFIRMAR PARCELA ${parcNum}/${total}`}
      </button>
    </form>
  );
};

// ── LOAN CARD ─────────────────────────────────────────────────
const LoanCard = ({ contract, client, cycle, user, onPayInterest, onPayCapital, onQuitacao, onRenegotiate, onEdit, onDelete, onWhatsApp, onChangeDue }: {
  contract: Contract; client?: Client; cycle?: InterestCycle; user: AppUser | null;
  onPayInterest:()=>void; onPayCapital:()=>void; onQuitacao:()=>void; onRenegotiate:()=>void;
  onEdit:()=>void; onDelete:()=>void; onWhatsApp:()=>void; onChangeDue:()=>void;
}) => {
  const today     = format(new Date(),'yyyy-MM-dd');
  const isOverdue = contract.next_due_date < today;
  const isToday   = contract.next_due_date === today;
  // total_interest_paid vem do get_dashboard (soma histórica de todos os pagamentos de juros)
  // fallback para cycle.paid_amount se ainda não vier do backend
  const lucroReal = contract.total_interest_paid ?? cycle?.paid_amount ?? 0;
  const lucroTotal= contract.monthly_interest_amount;
  const lucroPercent = lucroTotal > 0 ? Math.round((lucroReal/lucroTotal)*100) : 0;
  const juros     = cycle?.base_interest_amount ?? contract.monthly_interest_amount;
  const dias      = isOverdue ? Math.floor((Date.now() - parseDate(contract.next_due_date).getTime())/86400000) : 0;
  const border    = isOverdue ? 'border-red-500/25' : isToday ? 'border-[#3b82f6]/25' : 'border-[#2563eb]/80';
  const glow      = isOverdue ? 'bg-red-500/[0.03]' : isToday ? 'bg-amber-500/[0.03]' : '';
  const clientName = contract.client_name || client?.name || '?';

  return (
    <motion.div layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`${glow} border ${border} rounded-xl overflow-hidden mb-3`}>
      {/* Header */}
      <div className="bg-[#1e3a8a]/20 px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-[#0CABA8]/80 text-sm border border-[#1e3a8a]/50">{clientName[0].toUpperCase()}</div>
          <div>
            <p className="font-black text-white text-sm">{clientName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant={isOverdue?'danger':isToday?'warning':'info'}>{isOverdue?'ATRASADO':isToday?'VENCE HOJE':'PENDENTE'}</Badge>
              <Badge variant="default">MENSAL</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}   className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1e3a8a]/30 text-white/30"><Edit size={13}/></button>
          <button onClick={onWhatsApp} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]"><Phone size={13}/></button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Valor principal */}
        <div className="text-center py-1">
          <p className="text-2xl font-black text-[#3b82f6]">{fmtBRL(contract.capital + juros - lucroReal)}</p>
          <p className="text-[10px] text-white/25 mt-0.5">restante a receber</p>
        </div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {label:'Emprestado',       value: fmtBRL(contract.capital),                            color:'text-white'},
            {label:'Total a Receber',  value: fmtBRL(contract.capital + juros),                    color:'text-white'},
            {label:'Lucro Previsto',   value: fmtBRL(lucroTotal),                                  color:'text-[#3b82f6]'},
            {label:'Lucro Realizado',  value: fmtBRL(lucroReal),                                   color:'text-white', badge: `${lucroPercent}%`},
          ].map(item=>(
            <div key={item.label} className="bg-[#1e3a8a]/20 rounded-xl p-3">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">{item.label}</p>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
                {item.badge && <span className="text-[9px] bg-white/[0.08] text-white/40 px-1.5 py-0.5 rounded-full font-black">{item.badge}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Vencimento / Pago */}
        <div className="flex justify-between text-xs py-2 border-t border-[#1e3a8a60]">
          <span className={`flex items-center gap-1.5 font-bold ${isOverdue?'text-red-400':isToday?'text-amber-400':'text-white/40'}`}>
            <Clock size={11}/> Venc: {format(parseDate(contract.next_due_date),'dd/MM/yyyy')}
          </span>
          <span className="text-[#3b82f6] font-black font-['Space_Mono']">$ Pago: {fmtBRL(lucroReal)}</span>
        </div>

        {/* Só juros */}
        <div className="flex justify-between px-3 py-2.5 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl">
          <span className="text-[11px] text-white/40 font-bold">Só Juros (por parcela):</span>
          <span className="text-sm font-black text-[#0CABA8]/80">{fmtBRL(juros)}</span>
        </div>

        {/* Banner hoje */}
        {isToday && (
          <div className="bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-amber-400 font-black text-xs flex items-center gap-1.5"><Bell size={12}/> Vence Hoje!</span>
              <span className="text-amber-400 font-black text-sm">{fmtBRL(contract.capital + juros)}</span>
            </div>
            <p className="text-[10px] text-amber-300/40 mb-2">Parcela 1/1 · Vencimento: {format(parseDate(contract.next_due_date),'dd/MM/yyyy')}</p>
            <button onClick={onWhatsApp} className="w-full bg-[#1e3a8a]/30 border border-[#3b82f6]/20 text-[#3b82f6] font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
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
          <button onClick={onPayCapital}  className="flex-1 bg-blue-900/40 border border-blue-700 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"><CreditCard size={12}/> Pagar</button>
          <button onClick={onPayInterest} className="flex-1 bg-blue-900/40 border border-blue-700 text-blue-300 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"><DollarSign size={12}/> Juros</button>
          <button onClick={onQuitacao}    className="flex-1 bg-blue-900/40 border border-blue-700 text-blue-300 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"><CheckCircle2 size={12}/> Quitar</button>
          {user?.role==='ADMIN' && <button onClick={onChangeDue} title="Alterar vencimento" className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-900/40 border border-blue-700 text-white/40 hover:text-blue-300 transition-all"><Clock size={14}/></button>}
          <button onClick={onRenegotiate} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-900/40 border border-blue-700 text-amber-400"><RotateCcw size={14}/></button>
          {user?.role==='ADMIN' && <button onClick={onDelete} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-900/40 border border-blue-700 text-red-400"><Trash2 size={14}/></button>}
        </div>
      </div>
    </motion.div>
  );
};

// ── PAYMENT FORM ──────────────────────────────────────────────
const PaymentForm = ({ contract, cycle, mode, onSubmit }: { contract: Contract; cycle?: InterestCycle|null; mode:'interest'|'capital'; onSubmit:(d:any)=>void; }) => {
  const jurosAbertos = cycle?.base_interest_amount ?? contract.monthly_interest_amount;
  const jurosDevidos = Math.max(0, jurosAbertos - (cycle?.paid_amount ?? 0));

  type CapMode = 'full' | 'capital-only' | null;
  const [capMode, setCapMode] = useState<CapMode>(mode === 'capital' ? null : 'full');

  // Próximo vencimento: +1 mês a partir da data de vencimento atual do contrato
  const autoNextDate = format(addMonths(parseDate(contract.next_due_date), 1), 'yyyy-MM-dd');
  const [nextDate,    setNextDate]    = useState(autoNextDate);
  const [loading,     setLoading]     = useState(false);
  const [confirming,  setConfirming]  = useState(false);

  // Juros: pré-preenche com valor devido. Capital: começa vazio (usuário preenche)
  const [amount, setAmount] = useState(mode === 'interest' ? jurosDevidos : 0);

  useEffect(() => {
    // Só zera se for modo capital (não interfere no modo juros)
    if (mode === 'capital') setAmount(0);
  }, [capMode]);

  const pagoEmJuros   = capMode === 'full' ? Math.min(amount, jurosDevidos) : 0;
  const pagoEmCapital = capMode === 'full' ? Math.max(0, amount - jurosDevidos) : amount;
  const newCapital    = Math.max(0, contract.capital - pagoEmCapital);
  const newJuros      = newCapital * contract.interest_rate_monthly;
  const newTotal      = newCapital + newJuros;
  const isFullQuitacao = newCapital <= 0.01;
  const isPartial      = mode === 'interest' && amount < jurosDevidos - 0.01;
  // Mostra campo de data em todos os modos exceto quitação total e juros parcial
  const showDateField  = !isFullQuitacao && !isPartial;

  const buildData = () => {
    if (mode === 'interest') {
      return { contract_id: contract.id, cycle_id: cycle?.id ?? null, amount,
        payment_type: isPartial ? 'PARTIAL' : 'INTEREST', payment_method: 'PIX',
        next_due_date: isPartial ? null : nextDate };
    } else if (capMode === 'full') {
      return {
        contract_id: contract.id, cycle_id: cycle?.id ?? null,
        amount: pagoEmJuros > 0.01 ? pagoEmJuros : amount,
        payment_type: pagoEmJuros > 0.01 ? (pagoEmJuros >= jurosDevidos - 0.01 ? 'INTEREST' : 'PARTIAL') : 'CAPITAL',
        payment_method: 'PIX',
        next_due_date: isFullQuitacao ? null : nextDate,
        _split_capital: pagoEmJuros > 0.01 && pagoEmCapital > 0.01 ? pagoEmCapital : null,
      };
    } else {
      return { contract_id: contract.id, cycle_id: null, amount,
        payment_type: 'CAPITAL', payment_method: 'PIX',
        next_due_date: isFullQuitacao ? null : nextDate };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { alert('Informe um valor maior que zero.'); return; }
    setConfirming(true); // show confirmation modal
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Info contrato */}
      <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-4">
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
          <div className="mt-3 pt-3 border-t border-[#1e3a8a80] flex justify-between text-xs">
            <span className="text-white/30">Juros pendentes: <span className="text-[#0CABA8]/80 font-black">{fmtBRL(jurosDevidos)}</span></span>
            <span className="text-white/30">Total: <span className="text-white font-black">{fmtBRL(contract.capital + jurosDevidos)}</span></span>
          </div>
        )}
      </div>

      {/* Seleção modo capital */}
      {mode === 'capital' && (
        <div className="space-y-2">
          <p className={lbl}>Como vai amortizar?</p>
          <button type="button" onClick={() => setCapMode('full')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${capMode==='full' ? 'bg-[#3b82f6]/10 border-[#3b82f6]/60/40' : 'bg-[#1e3a8a]/20 border-[#1e3a8a80]'}`}>
            <CheckCircle2 size={17} className={`flex-shrink-0 ${capMode==='full' ? 'text-[#3b82f6]' : 'text-white/20'}`} />
            <div className="text-left flex-1">
              <p className={`font-black text-sm ${capMode==='full' ? 'text-blue-300' : 'text-white/50'}`}>Capital + Juros</p>
              <p className="text-[10px] text-white/25 mt-0.5">Quita os juros pendentes e amortiza o capital</p>
            </div>
            <span className={`font-black text-sm flex-shrink-0 ${capMode==='full' ? 'text-blue-300' : 'text-white/30'}`}>{fmtBRL(contract.capital + jurosDevidos)}</span>
          </button>
          <button type="button" onClick={() => setCapMode('capital-only')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${capMode==='capital-only' ? 'bg-blue-500/10 border-blue-500/40' : 'bg-[#1e3a8a]/20 border-[#1e3a8a80]'}`}>
            <CreditCard size={17} className={`flex-shrink-0 ${capMode==='capital-only' ? 'text-[#3b82f6]/70' : 'text-white/20'}`} />
            <div className="text-left flex-1">
              <p className={`font-black text-sm ${capMode==='capital-only' ? 'text-[#0CABA8]/80' : 'text-white/50'}`}>Só Capital</p>
              <p className="text-[10px] text-white/25 mt-0.5">Juros desta parcela continuam em aberto</p>
            </div>
            <span className={`font-black text-sm flex-shrink-0 ${capMode==='capital-only' ? 'text-[#0CABA8]/80' : 'text-white/30'}`}>{fmtBRL(contract.capital)}</span>
          </button>
        </div>
      )}

      {/* Campos — aparecem após escolha do modo */}
      {capMode !== null && (
        <>
          {/* Valor */}
          <div>
            <label className={lbl}>Valor Recebido (R$)</label>
            <input type="number" step="0.01" min="0.01"
              value={amount === 0 ? '' : amount}
              placeholder={mode === 'capital' ? 'Digite o valor recebido...' : ''}
              onChange={e => setAmount(Math.max(0, +e.target.value || 0))}
              className={inp} required />
            {isFullQuitacao && amount > 0 && <p className="text-[10px] text-[#3b82f6] mt-1.5 font-bold">✓ Quitação total do contrato</p>}
            {isPartial                      && <p className="text-[10px] text-amber-400 mt-1.5 font-bold">⚠ Pagamento parcial — próximo vencimento mantido</p>}
          </div>

          {/* Preview amortização parcial */}
          {mode === 'capital' && !isFullQuitacao && newCapital > 0 && amount > 0 && (
            <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Após este pagamento</p>
              {capMode === 'full' && pagoEmJuros > 0.01 && (
                <div className="flex justify-between text-xs"><span className="text-white/40">→ Quita juros:</span><span className="font-black text-[#0CABA8]/80">{fmtBRL(pagoEmJuros)}</span></div>
              )}
              {pagoEmCapital > 0.01 && (
                <div className="flex justify-between text-xs"><span className="text-white/40">→ Amortiza capital:</span><span className="font-black text-white">{fmtBRL(pagoEmCapital)}</span></div>
              )}
              <div className="border-t border-[#2563eb]/80 pt-2 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-white/40">Novo capital:</span><span className="font-black text-white">{fmtBRL(newCapital)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Próximos juros:</span><span className="font-black text-[#0CABA8]/80">{fmtBRL(newJuros)}</span></div>
                <div className="flex justify-between text-xs border-t border-[#2563eb]/80 pt-1.5"><span className="text-white/40">Novo saldo devedor:</span><span className="font-black text-amber-300">{fmtBRL(newTotal)}</span></div>
              </div>
            </div>
          )}

          {/* ✅ PRÓXIMO VENCIMENTO — editável em TODOS os modos */}
          {showDateField && (
            <div>
              <label className={lbl}>Próximo Vencimento</label>
              <input type="date" value={nextDate}
                onChange={e => setNextDate(e.target.value)}
                className={inp} required />
              <p className="text-[10px] text-white/25 mt-1">Calculado automaticamente · pode alterar se necessário</p>
            </div>
          )}

          <button type="submit" disabled={loading || amount <= 0}
            className="w-full bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            Revisar e Confirmar →
          </button>
        </>
      )}
      {/* Confirmation step */}
      {confirming && (
        <ConfirmPaymentModal
          title={`Registrar recebimento de ${contract.client_name}`}
          lines={[
            { label: 'Tipo', value: mode==='interest' ? 'Juros' : capMode==='full' ? 'Capital + Juros' : 'Só Capital' },
            { label: 'Valor', value: fmtBRL(amount), accent: 'text-[#3b82f6]' },
            ...(isFullQuitacao ? [{ label: 'Contrato', value: 'QUITADO', accent: 'text-[#3b82f6]' }] : []),
            ...(mode==='interest' && nextDate ? [{ label: 'Próximo venc.', value: format(parseDate(nextDate),'dd/MM/yyyy') }] : []),
          ]}
          onConfirm={async()=>{ setLoading(true); try{ await onSubmit(buildData()); setConfirming(false); }catch(e:any){alert(e.message);}finally{setLoading(false);} }}
          onCancel={()=>setConfirming(false)}
          loading={loading}
        />
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
      <div className="bg-[#1e3a8a]/20 rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-[#0CABA8]/80">{client.name[0]}</div>
        <div><p className="font-black text-white">{client.name}</p><p className="text-xs text-white/30">Capital: {fmtBRL(totalCapital)} · Juros pendentes: {fmtBRL(totalInterest)}</p></div>
      </div>
      <div className="space-y-2">
        <label className={lbl}>Tipo de Renegociação</label>
        {[
          { key:'interest-only', icon:<DollarSign size={16}/>, title:'Cliente pagou só os juros', desc:'Registrar pagamento e criar nova parcela' },
          { key:'full',          icon:<RefreshCw size={16}/>,  title:'Renegociar contrato completo', desc:'Fechar contratos antigos e criar novo' },
        ].map(opt=>(
          <button key={opt.key} type="button" onClick={()=>setMode(opt.key as any)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${mode===opt.key?'bg-blue-500/10 border-blue-500/40':'bg-[#1e3a8a]/20 border-[#1e3a8a80]'}`}>
            <span className={mode===opt.key?'text-[#3b82f6]/70':'text-white/30'}>{opt.icon}</span>
            <div className="text-left"><p className={`font-black text-sm ${mode===opt.key?'text-[#0CABA8]/80':'text-white/50'}`}>{opt.title}</p><p className="text-[10px] text-white/25 mt-0.5">{opt.desc}</p></div>
          </button>
        ))}
      </div>
      {mode && <>
        {mode==='interest-only' && <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 text-xs text-white/40">Resumo: Cliente paga <span className="text-[#0CABA8]/80 font-black">{fmtBRL(totalInterest)}</span> agora. Próximo mês: <span className="text-white font-black">{fmtBRL(totalCapital)}</span></div>}
        <div><label className={lbl}>Valor (R$)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(+e.target.value||0)} className={inp} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Taxa (%)</label><input type="number" step="0.1" value={rate} onChange={e=>setRate(+e.target.value||0)} className={inp} required /></div>
          <div><label className={lbl}>Vencimento</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className={inp} required /></div>
        </div>
        <div className="bg-[#1e3a8a]/20 rounded-xl p-3 flex justify-between"><span className="text-xs text-white/40 font-bold">Juros Mensal:</span><span className="text-sm font-black text-[#3b82f6]/70">{fmtBRL(monthly)}</span></div>
        <div><label className={lbl}>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} className={`${inp} h-16 resize-none`} placeholder="Motivo..." /></div>
        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-4 rounded-xl text-sm disabled:opacity-50">{loading?'PROCESSANDO...':'CONFIRMAR RENEGOCIAÇÃO'}</button>
      </>}
    </form>
  );
};

// ── REPORTS ───────────────────────────────────────────────────
const ReportsView = ({ dashData, onOpenReport }: { dashData: any; onOpenReport:(t:'lucro'|'capital'|'a-receber')=>void }) => {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Relatórios</h1>

      {/* Capital na Rua — não clicável, só dado */}
      <div className="bg-[#012e2e]/60 border border-[#1e3a8a]/40 rounded-xl p-5">
        <p className="text-[9px] font-black text-[#3b82f6]/70 uppercase tracking-widest mb-1">Capital na Rua</p>
        <p className="text-3xl font-black text-white font-['Space_Mono']">{fmtBRL(dashData?.metrics?.total_on_street||0)}</p>
        <p className="text-xs text-white/25 mt-1">Total emprestado em contratos ativos</p>
      </div>

      {/* Lucro Recebido — clicável */}
      <button onClick={()=>onOpenReport('lucro')}
        className="w-full bg-[#3b82f6]/10 border border-[#3b82f6]/60/30 rounded-xl p-5 text-left active:scale-95 transition-transform">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest mb-1">Lucro Recebido</p>
            <p className="text-3xl font-black text-white font-['Space_Mono']">{fmtBRL(dashData?.metrics?.total_interest_received||0)}</p>
            <p className="text-xs text-white/25 mt-1">Hoje · toque para ver por cliente</p>
          </div>
          <div className="bg-[#3b82f6]/15 rounded-xl px-3 py-1.5 text-xs font-black text-[#3b82f6] flex-shrink-0">Ver →</div>
        </div>
      </button>

      {/* Lucro a Receber — clicável */}
      <button onClick={()=>onOpenReport('a-receber')}
        className="w-full bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-5 text-left active:scale-95 transition-transform">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Lucro a Receber</p>
            <p className="text-3xl font-black text-white font-['Space_Mono']">{fmtBRL((dashData?.metrics?.total_interest_to_receive || [...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat().reduce((s:number,ic:any)=>s+(ic.base_interest_amount-(ic.paid_amount||0)),0) || 0))}</p>
            <p className="text-xs text-white/25 mt-1">Todos os contratos ativos · toque para ver</p>
          </div>
          <div className="bg-amber-500/20 rounded-xl px-3 py-1.5 text-xs font-black text-amber-400 flex-shrink-0">Ver →</div>
        </div>
      </button>

      {/* Capital Recebido — clicável */}
      <button onClick={()=>onOpenReport('capital')}
        className="w-full bg-purple-500/10 border border-purple-500/30 rounded-xl p-5 text-left active:scale-95 transition-transform">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Capital Recebido</p>
            <p className="text-3xl font-black text-white font-['Space_Mono']">{fmtBRL(dashData?.metrics?.total_capital_received||0)}</p>
            <p className="text-xs text-white/25 mt-1">Amortizações de hoje · toque para ver</p>
          </div>
          <div className="bg-purple-500/20 rounded-xl px-3 py-1.5 text-xs font-black text-purple-400 flex-shrink-0">Ver →</div>
        </div>
      </button>
    </div>
  );
};

// ── CALCULADORA ───────────────────────────────────────────────
// ── CLIENTS VIEW ─────────────────────────────────────────────
const ClientsView = ({ clients, contracts, onEdit, onNewContract, onDelete, onReload }: {
  clients: Client[]; contracts: Contract[];
  onEdit:(c:Client)=>void; onNewContract:(clientId?:number)=>void; onDelete:(c:Client)=>void; onReload:()=>void;
}) => {
  const [search, setSearch] = useState('');
  const filtered = search
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cpf||'').includes(search)
      )
    : clients;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Clientes</h1>
        <span className="text-xs text-white/30 font-bold">{clients.length} cadastrado{clients.length!==1?'s':''}</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"/>
        <input type="text" placeholder="Buscar por nome ou CPF..." value={search}
          onChange={e=>setSearch(e.target.value)}
          className={`${inp} pl-10 py-2.5`}/>
      </div>

      {filtered.length === 0
        ? <div className={`${card} p-8 text-center text-white/20 text-sm`}>Nenhum cliente encontrado</div>
        : <div className="space-y-2">
            {filtered.map(client => {
              const clientContracts = contracts.filter(c=>c.client_id===client.id && c.status==='ACTIVE');
              const totalCapital    = clientContracts.reduce((s,c)=>s+c.capital, 0);
              return (
                <div key={client.id} className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 flex-shrink-0 bg-blue-500/15 border border-[#1e3a8a]/50 rounded-xl flex items-center justify-center font-black text-[#0CABA8]/80 text-sm">
                        {client.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{client.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {client.cpf && <span className="text-[10px] text-white/30">{client.cpf}</span>}
                          {client.phone && <span className="text-[10px] text-white/30">{client.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={()=>onEdit(client)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1e3a8a]/30 text-white/30 border border-[#1e3a8a80]">
                        <Edit size={12}/>
                      </button>
                      <button onClick={()=>onNewContract(client.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/15 text-[#3b82f6]/70 border border-[#1e3a8a]/50">
                        <PlusCircle size={12}/>
                      </button>
                      <button onClick={()=>onDelete(client)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#1e3a8a60] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        client.status==='ACTIVE'  ? 'bg-blue-500/15 text-[#3b82f6]' :
                        client.status==='BLOCKED' ? 'bg-red-500/15 text-red-400' :
                        'bg-white/[0.08] text-white/30'
                      }`}>{client.status}</span>
                      {clientContracts.length > 0 && (
                        <span className="text-[10px] text-white/30">
                          {clientContracts.length} contrato{clientContracts.length!==1?'s':''} ativos
                        </span>
                      )}
                    </div>
                    {totalCapital > 0 && (
                      <span className="text-sm font-black text-[#3b82f6]/70">{fmtBRL(totalCapital)}</span>
                    )}
                    {totalCapital === 0 && (
                      <span className="text-xs text-white/20">Sem contratos ativos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
};

const CalculatorView = () => {
  const [tipo,     setTipo]     = useState<'REVOLVING'|'INSTALLMENT'>('REVOLVING');
  const [capital,  setCapital]  = useState(1000);
  const [rate,     setRate]     = useState(15);
  const [parcelas, setParcelas] = useState(12);

  const QUICK = [2,3,4,6,9,12,18,24];
  const jurosMensal  = capital * (rate / 100);
  const totalJuros   = tipo === 'INSTALLMENT' ? jurosMensal * parcelas : jurosMensal;
  const totalGeral   = capital + totalJuros;
  const valorParcela = tipo === 'INSTALLMENT' && parcelas > 0
    ? Math.round((totalGeral / parcelas) * 100) / 100 : 0;
  const payback = jurosMensal > 0 ? Math.ceil(capital / jurosMensal) : 0;
  const lucroSobre = capital > 0 ? ((totalJuros / capital) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">Calculadora</h1>

      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        {(['REVOLVING','INSTALLMENT'] as const).map(t => (
          <button key={t} onClick={()=>setTipo(t)}
            className={`py-3 rounded-xl font-black text-sm transition-all ${tipo===t?t==='REVOLVING'?'bg-blue-600 text-white':'bg-purple-600 text-white':'bg-[#1e3a8a]/40 text-white/40'}`}>
            {t==='REVOLVING'?'Rotativo (Mensal)':'Parcelado'}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className={`${card} p-5 space-y-4`}>
        <div><label className={lbl}>Capital (R$)</label>
          <input type="number" value={capital} inputMode="decimal"
            onChange={e=>setCapital(+e.target.value||0)} className={inp}/>
        </div>
        <div className={tipo==='INSTALLMENT'?'grid grid-cols-2 gap-3':''}>
          <div><label className={lbl}>Juros Mensal (%)</label>
            <input type="number" step="0.1" value={rate} inputMode="decimal"
              onChange={e=>setRate(+e.target.value||0)} className={inp}/>
          </div>
          {tipo==='INSTALLMENT' && (
            <div>
              <label className={lbl}>Parcelas</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {QUICK.map(n=>(
                  <button key={n} type="button" onClick={()=>setParcelas(n)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-black transition-all ${parcelas===n?'bg-purple-600 text-white':'bg-[#1e3a8a]/40 text-white/40'}`}>
                    {n}x
                  </button>
                ))}
              </div>
              <input type="number" value={parcelas} min={1} max={60} inputMode="numeric"
                onChange={e=>setParcelas(Math.max(1,+e.target.value||1))} className={`${inp} mt-2`}/>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className={`${card} p-5 space-y-3`}>
        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">
          {tipo==='INSTALLMENT'?`Resumo — ${parcelas}x`:'Resumo Mensal'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#1e3a8a]/20 rounded-xl p-3 text-center">
            <p className="text-[9px] text-white/30 uppercase mb-1">Capital</p>
            <p className="font-black text-white text-sm">{fmtBRL(capital)}</p>
          </div>
          <div className="bg-[#3b82f6]/10 rounded-xl p-3 text-center">
            <p className="text-[9px] text-[#3b82f6]/60 uppercase mb-1">{tipo==='INSTALLMENT'?'Juros Total':'Juros/Mês'}</p>
            <p className="font-black text-[#3b82f6] text-sm">{fmtBRL(totalJuros)}</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 text-center">
            <p className="text-[9px] text-[#3b82f6]/70/60 uppercase mb-1">Total</p>
            <p className="font-black text-[#3b82f6]/70 text-sm">{fmtBRL(totalGeral)}</p>
          </div>
        </div>
        {tipo==='INSTALLMENT' && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center mt-1">
            <p className="text-[9px] text-purple-400/60 uppercase mb-1">{parcelas}x de</p>
            <p className="text-2xl font-black text-purple-400">{fmtBRL(valorParcela)}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-[#1e3a8a80]">
          <span className="text-xs text-white/30">Retorno sobre capital</span>
          <span className="font-black text-[#3b82f6]">{lucroSobre}%</span>
        </div>
      </div>

      {/* Parcela a parcela (só parcelado) */}
      {tipo==='INSTALLMENT' && (
        <div className={`${card} p-5 space-y-2`}>
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">Parcela a Parcela</p>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {Array.from({length: parcelas}, (_, i) => {
              const acum = valorParcela * (i + 1);
              const pct  = totalGeral > 0 ? Math.min(100, Math.round((acum / totalGeral) * 100)) : 0;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white/25 w-8 flex-shrink-0">#{i+1}</span>
                  <div className="flex-1 bg-[#1e3a8a]/30 rounded-full h-1.5">
                    <div className="bg-purple-500/60 h-1.5 rounded-full" style={{width:`${pct}%`}}/>
                  </div>
                  <span className="text-white/40 font-black w-20 text-right flex-shrink-0">{fmtBRL(acum)}</span>
                  <span className="text-white/20 w-9 text-right flex-shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payback (só rotativo) */}
      {tipo==='REVOLVING' && (
        <div className={`${card} p-5`}>
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-4">Ponto de Equilíbrio (Payback)</p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-black text-[#3b82f6]">{payback > 0 ? `${payback} meses` : '—'}</p>
              <p className="text-[10px] text-white/25 mt-0.5">
                {payback > 0 ? `Em ${payback} meses você recupera ${fmtBRL(capital)} só com juros` : 'Informe capital e taxa'}
              </p>
            </div>
          </div>
        </div>
      )}
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
        <p className="text-sm font-black text-white mb-4 flex items-center gap-2"><PlusCircle size={14} className="text-[#3b82f6]/70"/> Novo Cobrador</p>
        {msg&&<div className="bg-[#3b82f6]/10 text-[#3b82f6] p-3 rounded-xl text-xs font-bold mb-3">{msg}</div>}
        {err&&<div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-xs font-bold mb-3">{err}</div>}
        <form onSubmit={async e=>{ e.preventDefault(); setLoading(true); setErr(''); try{ await api.createCollector(form.name,form.email,form.password); setMsg('Cobrador criado!'); setForm({name:'',email:'',password:''}); load(); }catch(e:any){setErr(e.message);}finally{setLoading(false);} }} className="space-y-3">
          <div><label className={lbl}>Nome</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={inp} required/></div>
          <div><label className={lbl}>E-mail</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={inp} required/></div>
          <div><label className={lbl}>Senha</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={inp} required/></div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-3.5 rounded-xl text-sm disabled:opacity-50">{loading?'CRIANDO...':'CADASTRAR'}</button>
        </form>
      </div>
      <div className={`${card} p-5`}>
        <p className="text-sm font-black text-white mb-4">Usuários</p>
        <div className="space-y-2">
          {users.filter(u=>u.id!==user.id).map(u=>(
            <div key={u.id} className="flex items-center justify-between p-3 bg-[#1e3a8a]/20 rounded-xl border border-[#1e3a8a60]">
              <div><p className="font-bold text-white text-sm">{u.name}</p><p className="text-[10px] text-white/30">{u.login}</p></div>
              <div className="flex gap-2">
                <Badge variant={u.role==='ADMIN'?'success':'default'}>{u.role}</Badge>
                <button onClick={()=>{ if(confirm('Redefinir senha para 123456?')) api.resetPassword(u.id,'123456').then(()=>alert('Feito!')).catch((e:any)=>alert(e.message)); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-[#3b82f6]/70"><RefreshCw size={12}/></button>
                <button onClick={()=>{ if(confirm('Excluir usuário?')) api.deleteUser(u.id).then(load).catch((e:any)=>alert(e.message)); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── NEW CONTRACT MODAL ───────────────────────────────────────
const NewContractModal = ({ clients: initialClients, user, onClose, onSuccess, refreshKey }: {
  clients: Client[]; user: any; onClose: ()=>void; onSuccess: ()=>void; refreshKey?: number;
}) => {
  const [ncSearchCpf,  setNcSearchCpf]  = useState('');
  const [ncSearchName, setNcSearchName] = useState('');
  const [ncClientId,   setNcClientId]   = useState(0);
  const [clientList,   setClientList]   = useState<Client[]>(initialClients);

  // Busca lista completa do banco ao montar o modal
  useEffect(() => {
    api.getClients().then(setClientList).catch(() => setClientList(initialClients));
  }, []);
  const [loading,     setLoading]     = useState(false);
  const [tipo,        setTipo]        = useState<'REVOLVING'|'INSTALLMENT'>('REVOLVING');
  const [capital,     setCapital]     = useState(0);
  const [rate,        setRate]        = useState(15);
  const [parcelas,    setParcelas]    = useState(12);
  const [saleParc,    setSaleParc]    = useState(1);  // parcelas da venda (1 = à vista)

  const qCpf  = ncSearchCpf.trim().replace(/\D/g,'');
  const qName = ncSearchName.trim().toLowerCase();
  const ncFiltered = (qCpf.length >= 1 || qName.length >= 1)
    ? clientList.filter(c =>
        (qCpf.length  >= 1 ? (c.cpf||'').replace(/\D/g,'').includes(qCpf)           : true) &&
        (qName.length >= 1 ? c.name.toLowerCase().includes(qName)                    : true)
      )
    : [];
  const ncSelected = clientList.find(c => c.id === ncClientId);

  // Cálculos em tempo real
  const jurosMensal   = capital * (rate / 100);
  const totalJuros    = tipo === 'INSTALLMENT' ? jurosMensal * parcelas : jurosMensal;
  const totalGeral    = capital + totalJuros;
  const valorParcela  = tipo === 'INSTALLMENT' && parcelas > 0 ? Math.round((totalGeral / parcelas) * 100) / 100 : 0;
  const saleValParc   = tipo === 'SALE' && saleParc > 1 ? Math.round((capital / saleParc) * 100) / 100 : capital;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncClientId) { alert('Selecione um cliente'); return; }
    const fd = new FormData(e.target as HTMLFormElement);
    const dueDate = fd.get('due_date') as string;
    setLoading(true);
    try {
      const needsApproval = user?.role !== 'ADMIN';
      if (tipo === 'INSTALLMENT') {
        await api.createInstallmentContract({
          client_id:             ncClientId,
          capital,
          interest_rate_monthly: rate, // RPC divide por 100 internamente
          total_installments:    parcelas,
          first_due_date:        dueDate,
          guarantee_notes:       fd.get('guarantee') as string,
          initial_status:        needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
        });
      } else {
        await api.createContract({
          client_id:             ncClientId,
          capital,
          interest_rate_monthly: rate, // RPC divide por 100 internamente
          next_due_date:         dueDate,
          guarantee_notes:       fd.get('guarantee') as string,
          initial_status:        needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
        });
      }
      const isCollector = user?.role !== 'ADMIN';
      const clientObj = clientList.find(c=>c.id===ncClientId);
      const tipoLabel = tipo==='INSTALLMENT'?'Parcelado':'Rotativo';
      if(isCollector){
        api.createNotification(
          'NEW_CONTRACT',
          'Novo empréstimo criado',
          `${user?.name||'Cobrador'} criou empréstimo ${tipoLabel} de R$ ${capital.toFixed(2).replace('.',',')} para ${clientObj?.name||'cliente'}.`,
          {capital, tipo, client_name:clientObj?.name}
        );
        alert('Empréstimo criado! Aguardando aprovação do administrador.');
      } else {
        api.createNotification(
          'NEW_CONTRACT',
          'Novo empréstimo criado',
          `Empréstimo ${tipoLabel} de R$ ${capital.toFixed(2).replace('.',',')} criado para ${clientObj?.name||'cliente'}.`,
          {capital, tipo, client_name:clientObj?.name}
        );
      }
      onSuccess();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Novo Empréstimo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tipo de empréstimo */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={()=>setTipo('REVOLVING')}
            className={`py-3 px-3 rounded-xl border text-left transition-all ${tipo==='REVOLVING'
              ?'bg-blue-600/20 border-blue-500/50 text-white'
              :'bg-[#1e3a8a]/20 border-[#2563eb]/80 text-white/40'}`}>
            <p className="text-xs font-black">Rotativo</p>
            <p className="text-[10px] mt-0.5 opacity-60">Juros mensais recorrentes</p>
          </button>
          <button type="button" onClick={()=>setTipo('INSTALLMENT')}
            className={`py-3 px-3 rounded-xl border text-left transition-all ${tipo==='INSTALLMENT'
              ?'bg-purple-600/20 border-purple-500/50 text-white'
              :'bg-[#1e3a8a]/20 border-[#2563eb]/80 text-white/40'}`}>
            <p className="text-xs font-black">Parcelado</p>
            <p className="text-[10px] mt-0.5 opacity-60">Parcelas fixas mensais</p>
          </button>
        </div>

        {/* Busca cliente */}
        <div>
          <label className={lbl}>Buscar por CPF</label>
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"/>
            <input type="text" inputMode="numeric" placeholder="Digite o CPF..." value={ncSearchCpf}
              onChange={e => { setNcSearchCpf(e.target.value); setNcClientId(0); }}
              className={`${inp} pl-10`} autoComplete="off"/>
          </div>
        </div>
        <div>
          <label className={lbl}>Buscar por Nome</label>
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"/>
            <input type="text" placeholder="Digite o nome..." value={ncSearchName}
              onChange={e => { setNcSearchName(e.target.value); setNcClientId(0); }}
              className={`${inp} pl-10`} autoComplete="off" autoFocus/>
          </div>
          {(ncSearchCpf.trim().length > 0 || ncSearchName.trim().length > 0) && ncFiltered.length === 0 && (
            <div className="mt-1 px-3 py-2.5 text-xs text-white/30 bg-[#1e3a8a]/80 border border-[#1e3a8a] rounded-xl">
              Nenhum cliente encontrado
            </div>
          )}
          {ncFiltered.length > 0 && (
            <div className="mt-1 bg-[#1e3a8a]/80 border border-[#1e3a8a] rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {ncFiltered.map((c: any) => (
                <button key={c.id} type="button"
                  onClick={() => { setNcClientId(c.id); setNcSearchName(c.name); setNcSearchCpf(c.cpf||''); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1e3a8a]/30 border-b border-[#1e3a8a60] last:border-0 text-left">
                  <div>
                    <p className="text-sm font-black text-white">{c.name}</p>
                    {c.cpf && <p className="text-[10px] text-white/30">{c.cpf}</p>}
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${c.status==='ACTIVE'?'bg-[#3b82f6]/15 text-[#3b82f6]':'bg-[#1e3a8a]/40 text-white/30'}`}>{c.status}</span>
              {c.contract_type==='SALE' && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">VENDA</span>}
                </button>
              ))}
            </div>
          )}
          {ncSelected && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#012e2e]/60 border border-[#1e3a8a]/40 rounded-xl">
              <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center text-xs font-black text-[#0CABA8]/80">{ncSelected.name[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{ncSelected.name}</p>
                {ncSelected.cpf && <p className="text-[10px] text-white/30">{ncSelected.cpf}</p>}
              </div>
              <button type="button" onClick={() => { setNcClientId(0); setNcSearchCpf(''); setNcSearchName(''); }} className="text-white/30"><X size={13}/></button>
            </div>
          )}
        </div>

        {/* Capital + Taxa */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Capital (R$)</label>
            <input name="capital" type="number" step="0.01" placeholder="0,00"
              onChange={e => setCapital(+e.target.value||0)}
              className={inp} required inputMode="decimal"/></div>
          <div><label className={lbl}>Juros ao mês (%)</label>
            <input name="rate" type="number" step="0.1" defaultValue={15}
              onChange={e => setRate(+e.target.value||0)}
              className={inp} required inputMode="decimal"/></div>
        </div>

        {/* Parcelas — só no modo parcelado */}
        {tipo === 'INSTALLMENT' && (
          <div>
            <label className={lbl}>Número de parcelas</label>
            <div className="grid grid-cols-6 gap-1.5">
              {[2,3,4,6,9,12,18,24].map(n=>(
                <button key={n} type="button" onClick={()=>setParcelas(n)}
                  className={`py-2 rounded-lg text-xs font-black border transition-all ${parcelas===n
                    ?'bg-purple-600 border-purple-500 text-white'
                    :'bg-[#1e3a8a]/20 border-[#2563eb]/80 text-white/40'}`}>
                  {n}x
                </button>
              ))}
            </div>
            <div className="relative mt-2">
              <input type="number" min="1" max="24" value={parcelas}
                onChange={e=>setParcelas(Math.min(24,Math.max(1,+e.target.value||1)))}
                className={`${inp} text-center`} placeholder="Ou digite 1-24"/>
            </div>
          </div>
        )}

        {/* Preview de cálculo — aparece assim que tem capital */}
        {capital > 0 && (
          <div className={`border rounded-xl p-4 space-y-2 ${tipo==='INSTALLMENT'?'bg-purple-500/10 border-purple-500/20':'bg-blue-500/10 border-[#1e3a8a]/50'}`}>
            {tipo === 'REVOLVING' ? (
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/40 font-bold">Juros por mês:</span>
                <span className="text-lg font-black text-[#3b82f6]/70">{fmtBRL(jurosMensal)}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-white/30 uppercase mb-0.5">Capital</p>
                    <p className="font-black text-white text-sm">{fmtBRL(capital)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 uppercase mb-0.5">Juros total</p>
                    <p className="font-black text-[#3b82f6] text-sm">{fmtBRL(totalJuros)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 uppercase mb-0.5">Total</p>
                    <p className="font-black text-purple-400 text-sm">{fmtBRL(totalGeral)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#1e3a8a]">
                  <span className="text-sm text-white/50 font-bold">{parcelas}× de</span>
                  <span className="text-2xl font-black text-white font-['Space_Mono']">{fmtBRL(valorParcela)}</span>
                </div>
              </>
            )}
          </div>
        )}



        <div><label className={lbl}>Primeiro vencimento</label>
          <input name="due_date" type="date" defaultValue={format(addMonths(new Date(),1),'yyyy-MM-dd')} className={inp} required/></div>
        <div><label className={lbl}>Garantia</label>
          <textarea name="guarantee" className={`${inp} h-16 resize-none`}></textarea></div>

        <button type="submit" disabled={loading}
          className={`w-full text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${tipo==='INSTALLMENT'
            ?'bg-gradient-to-r from-purple-600 to-blue-700'
            :'bg-gradient-to-r from-blue-800 to-[#0d1f17]'}`}>
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>CRIANDO...</>
            : tipo==='INSTALLMENT'
              ? `CRIAR ${parcelas}× DE ${capital>0?fmtBRL(valorParcela):'—'}`
              : tipo==='SALE'
              ? `REGISTRAR VENDA${capital>0?' — '+fmtBRL(capital):''}`
              : 'CRIAR EMPRÉSTIMO'}
        </button>
      </form>
    </Modal>
  );
};

// ── EDIT PAYMENT MODAL ───────────────────────────────────────
const EditPaymentModal = ({ payment, onClose, onSaved }: {
  payment: any; onClose: ()=>void; onSaved: ()=>Promise<void>;
}) => {
  const [newAmt, setNewAmt] = useState<number>(payment.amount);
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Editar Pagamento" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-3">
          <p className="text-xs text-white/40">Tipo: <span className="text-white font-bold">{payment.payment_type}</span></p>
          <p className="text-xs text-white/40 mt-1">Data: <span className="text-white/60">{format(new Date(payment.created_at),'dd/MM/yyyy · HH:mm')}</span></p>
          <p className="text-xs text-white/40 mt-1">Valor atual: <span className="text-[#3b82f6] font-black font-['Space_Mono']">{fmtBRL(payment.amount)}</span></p>
        </div>
        <div><label className={lbl}>Novo Valor (R$)</label>
          <input type="number" step="0.01" value={newAmt}
            onChange={e=>setNewAmt(+e.target.value||0)} className={inp}/>
        </div>
        <p className="text-[10px] text-amber-400/70 text-center">⚠ O saldo do contrato será recalculado automaticamente.</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-black py-3 rounded-xl text-sm">Cancelar</button>
          <button disabled={saving} onClick={async()=>{
            setSaving(true);
            try { await api.editPayment(payment.id, newAmt); await onSaved(); }
            catch(e:any){alert(e.message);}
            finally{setSaving(false);}
          }} className="bg-blue-600 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50">
            {saving?'SALVANDO...':'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
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
    <div className="min-h-screen bg-[#0a0918] flex flex-col items-center justify-center p-5 relative overflow-hidden" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}>
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(#2563eb 1px, transparent 1px),linear-gradient(90deg, #2563eb 1px, transparent 1px)', backgroundSize:'40px 40px'}}/>
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-64 bg-[#2563eb]/25 rounded-full blur-[100px] pointer-events-none"/>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5}} className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 border border-blue-400/30 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-blue-500/40">
            <DollarSign className="text-[#3b82f6]" size={28}/>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Capital Rotativo</h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px w-8 bg-[#1e3a8a]/60"/>
            <p className="text-[10px] text-[#0CABA8]/70 uppercase tracking-[0.25em] font-bold">Loan Management</p>
            <div className="h-px w-8 bg-[#1e3a8a]/60"/>
          </div>
        </div>
        {/* Card */}
        <div className="bg-[#1e3a8a]/30 backdrop-blur-xl border border-[#3b82f6]/15 rounded-3xl p-6 shadow-2xl shadow-black/50">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-6 text-center">Acesso ao Sistema</p>
          <form onSubmit={async e=>{ e.preventDefault(); setError(''); setLoading(true); try{ onLogin(await api.login(email,pass)); }catch(e:any){setError(e.message||'Credenciais inválidas');}finally{setLoading(false);} }} className="space-y-4">
            <div><label className={lbl}>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inp} required autoFocus/></div>
            <div><label className={lbl}>Senha</label>
              <div className="relative">
                <input type={show?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} className={`${inp} pr-12`} required/>
                <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">{show?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
            </div>
            {error&&<p className="bg-red-500/10 text-red-400 text-xs font-bold p-3 rounded-lg text-center border border-red-500/20">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white font-black py-4 rounded-lg text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors mt-2 tracking-wider">
              {loading?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>AUTENTICANDO...</>:<><ArrowRight size={15}/>ACESSAR</>}
            </button>
          </form>
        </div>
        <p className="text-center text-white/15 text-[10px] mt-6 tracking-widest">PRIVATE SYSTEM • AUTHORIZED USE ONLY</p>
      </motion.div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [user,setUser]         = useState<AppUser|null>(null);
  const [notifications,setNotifications] = useState<any[]>([]);
  const [notifOpen,setNotifOpen]         = useState(false);
  const [pendingContracts,setPendingContracts] = useState<any[]>([]);
  const [pendingDetail,setPendingDetail]       = useState<any|null>(null);
  const [rejectTarget,setRejectTarget]   = useState<any|null>(null);
  const [rejectReason,setRejectReason]   = useState('');
  const [activeTab,setActiveTab] = useState('loans');
  const [dashData,setDashData] = useState<any>(null);
  const [loading,setLoading]   = useState(true);
  const [menuOpen,setMenuOpen] = useState(false);
  const [clients,setClients]   = useState<Client[]>([]);
  const [contracts,setContracts] = useState<Contract[]>([]);
  const [loanFilter,setLoanFilter] = useState<'all'|'today'|'overdue'|'scheduled'>('all');
  const [search,setSearch]            = useState('');
  const [searchCpf,setSearchCpf]       = useState('');
  const [newContractCalc,setNewContractCalc] = useState({capital:0,rate:15});

  // Modals
  const [payModal,setPayModal]         = useState<{contract:Contract;cycle?:InterestCycle|null;mode:'interest'|'capital'}|null>(null);
  const [installPayModal,setInstallPayModal] = useState<{contract:Contract;cycle:InterestCycle}|null>(null);
  const [quitacaoModal,setQuitacaoModal]   = useState<Contract|null>(null);
  const [confirmModal,setConfirmModal]     = useState<{title:string;lines:{label:string;value:string;accent?:string}[];onConfirm:()=>Promise<void>}|null>(null);
  const [editPayModal,setEditPayModal]     = useState<any|null>(null);
  const [deletePayConfirm,setDeletePayConfirm] = useState<any|null>(null);
  const [editPaymentTarget,setEditPaymentTarget]   = useState<any>(null);
  const [deletePaymentTarget,setDeletePaymentTarget] = useState<any>(null);
  const [receipt,setReceipt]           = useState<any>(null);
  const [renegoModal,setRenegoModal]   = useState<{client:Client;contracts:Contract[];cycles?:InterestCycle[]}|null>(null);
  const [changeDueModal,setChangeDueModal] = useState<Contract|null>(null);
  const [newContractModal,setNewContractModal] = useState(false);
  const [newClientModal,setNewClientModal]     = useState(false);
  const [editClientModal,setEditClientModal]   = useState<Client|null>(null);
  const [deleteModal,setDeleteModal]   = useState<number|null>(null);
  const [deleteClientModal,setDeleteClientModal] = useState<any|null>(null);
  const [dueListModal,setDueListModal] = useState<'today'|'overdue'|null>(null);
  const [reportModal,setReportModal]   = useState<'lucro'|'capital'|'a-receber'|null>(null);
  const [reportFilter,setReportFilter] = useState<'dia'|'semana'|'mes'|'6meses'|'todos'>('mes');
  const [reportClientFilter,setReportClientFilter] = useState('');
  const [fullReport,setFullReport]     = useState<any>(null);

  useEffect(()=>{
    api.registerServiceWorker();
    (async()=>{ const u=await api.getSession(); if(u) setUser(u); setLoading(false); })();
    const {data:{subscription}} = supabase.auth.onAuthStateChange(ev=>{ if(ev==='SIGNED_OUT'){setUser(null);setDashData(null);setClients([]);setContracts([]);} });
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(user) { loadAll(); loadNotifications(); } },[user]);

  // Real-time: listen for new notifications via Supabase realtime
  useEffect(()=>{
    if(!user) return;
    const channel = supabase.channel('notifications')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},(payload:any)=>{
        const n = payload.new;
        // Show local push to admin
        if(user.role==='ADMIN'){
          api.showLocalNotification(n.title, n.body);
          setNotifications(prev=>[n,...prev]);
        }
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[user]);

  const loadNotifications = async () => {
    if(!user) return;
    try {
      const notifs = await api.getNotifications(50);
      setNotifications(notifs);
      // Load pending contracts for admin
      if(user.role==='ADMIN'){
        const pending = await api.getContracts('PENDING_APPROVAL');
        setPendingContracts(pending);
      }
    } catch{}
  };

  const loadAll = async () => {
    try {
      const [dash,cls,conts,pending] = await Promise.all([
        api.getDashboard(),
        api.getClients(),
        api.getContracts('ACTIVE'),
        api.getContracts('PENDING_APPROVAL'),
      ]);
      setDashData(dash); setClients(cls); setContracts(conts);
      // Admin vê todos os pendentes; collector vê só os seus
      if (user?.role === 'ADMIN') {
        setPendingContracts(pending);
      } else {
        setPendingContracts(pending.filter((c:any) => c.created_by === user?.id));
      }
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
    if(loanFilter==='today'     && contract.next_due_date!==today) return false;
    if(loanFilter==='overdue'   && contract.next_due_date>=today)  return false;
    if(loanFilter==='scheduled' && contract.next_due_date<=today)  return false;
    if(search.trim()){
      const name = (contract.client_name||client?.name||'').toLowerCase();
      if(!name.includes(search.trim().toLowerCase())) return false;
    }
    if(searchCpf.trim()){
      const cpf = (client?.cpf||'').replace(/\D/g,'');
      if(!cpf.includes(searchCpf.replace(/\D/g,'').trim())) return false;
    }
    return true;
  }).sort((a, b) => {
    // Ordena por data de vencimento (next_due_date) - do mais antigo para o mais recente
    const dateA = a.contract.next_due_date;
    const dateB = b.contract.next_due_date;
    return dateA.localeCompare(dateB);
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
      const nextDue      = data.next_due_date ?? null;
      const { _split_capital, ...payData } = data;

      // Registra pagamento de juros/parcial primeiro
      await api.registerPayment(payData);

      // Se tem split (capital+juros), registra capital passando a data
      if (splitCapital && splitCapital > 0) {
        await api.registerPayment({
          contract_id:    data.contract_id,
          cycle_id:       null,
          amount:         splitCapital,
          payment_type:   'CAPITAL',
          payment_method: 'PIX',
          next_due_date:  nextDue, // ✅ propaga a data escolhida
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

      // Notification
      const payType = splitCapital ? 'Capital + Juros' : data.payment_type==='CAPITAL'?'Capital':data.payment_type==='PARTIAL'?'Juros Parcial':'Juros';
      api.createNotification('PAYMENT','Pagamento registrado',`${ct?.client_name||'Cliente'} — ${payType}: R$ ${totalPago.toFixed(2).replace('.',',')}`,{contract_id:data.contract_id,amount:totalPago});
      setPayModal(null);
      await loadAll();
      // Refresh relatório se estiver aberto
      if(reportModal) {
        const {s,e} = (() => {
          const d=new Date();
          if(reportFilter==='dia') return {s:format(d,'yyyy-MM-dd'),e:format(d,'yyyy-MM-dd')};
          if(reportFilter==='semana') return {s:format(new Date(d.getTime()-6*86400000),'yyyy-MM-dd'),e:format(d,'yyyy-MM-dd')};
          if(reportFilter==='mes') return {s:format(new Date(d.getFullYear(),d.getMonth(),1),'yyyy-MM-dd'),e:format(d,'yyyy-MM-dd')};
          if(reportFilter==='6meses') { const sixMonthsAgo=new Date(d); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6); return {s:format(sixMonthsAgo,'yyyy-MM-dd'),e:format(d,'yyyy-MM-dd')}; }
          return {s:undefined as any,e:undefined as any};
        })();
        api.getReports(s,e).then(setFullReport).catch(()=>{});
      }
    } catch (e: any) { alert(e.message); }
  };

  const sendWA = (contract:Contract, client?:Client) => {
    const phone = (contract.client_phone||client?.phone||'').replace(/\D/g,'');
    const msg   = `Olá ${contract.client_name||client?.name}, passando para lembrar do seu pagamento de ${fmtBRL(contract.monthly_interest_amount)} com vencimento em ${format(parseDate(contract.next_due_date),'dd/MM/yyyy')}. 🙏`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  };

  if(loading) return <div className="min-h-screen bg-[#0a0918] flex items-center justify-center" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}><div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1e3a8a] border border-[#3b82f6]/30 flex items-center justify-center animate-pulse shadow-xl shadow-[#3b82f6]/20"><DollarSign className="text-[#3b82f6]" size={22}/></div></div>;
  if(!user)   return <Login onLogin={u=>setUser(u)}/>;

  const isAdmin  = user.role === 'ADMIN';
  const tabs     = isAdmin
    ? [{id:'dashboard',label:'Home',icon:Home},{id:'loans',label:'Empréstimos',icon:DollarSign},{id:'reports',label:'Relatórios',icon:BookOpen}]
    : [{id:'dashboard',label:'Home',icon:Home},{id:'loans',label:'Empréstimos',icon:DollarSign}];
  const menuItems = [...tabs,...(isAdmin?[{id:'clients',label:'Clientes',icon:Users},{id:'calculator',label:'Calculadora',icon:CalcIcon},{id:'management',label:'Gerenciamento',icon:Settings}]:[])];

  return (
    <div className="min-h-screen bg-[#0a0918] text-white flex flex-col" style={{fontFamily:"'Plus Jakarta Sans', sans-serif", backgroundImage:"radial-gradient(ellipse at 20% 0%, #3b82f620 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, #1e293b20 0%, transparent 50%)"}}>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none z-0"/>

      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0a0918]/90 backdrop-blur-xl border-b border-blue-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/20"><DollarSign size={14} className="text-blue-400"/></div>
          <span className="font-black text-white text-sm">Capital Rotativo</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button onClick={async()=>{
            setNotifOpen(true);
            await api.requestNotificationPermission();
            await loadNotifications();
          }} className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[#1e3a8a]/40 border border-[#2563eb]/80">
            <Bell size={16} className="text-white/60"/>
            {notifications.filter(n=>!n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                {notifications.filter(n=>!n.read).length > 9 ? '9+' : notifications.filter(n=>!n.read).length}
              </span>
            )}
          </button>
          <button onClick={()=>setMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1e3a8a]/40 border border-[#2563eb]/80"><Menu size={17} className="text-white/60"/></button>
        </div>
      </header>

      {/* MENU */}
      <AnimatePresence>
        {menuOpen&&(<>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMenuOpen(false)} className="fixed inset-0 bg-black/60 z-50"/>
          <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:300}}
            className="fixed right-0 top-0 bottom-0 w-72 bg-[#0a0918] border-l border-blue-900/80 z-50 flex flex-col p-5">
            <div className="flex justify-between items-center mb-8"><span className="font-black text-white text-sm">Capital Rotativo</span><button onClick={()=>setMenuOpen(false)}><X size={18} className="text-white/40"/></button></div>
            <div className={`${card} p-4 mb-6 flex items-center gap-3`}>
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-black text-[#0CABA8]/80 border border-[#1e3a8a]/50">{user.name[0]}</div>
              <div><p className="font-black text-white text-sm">{user.name}</p><p className="text-[9px] text-white/30 uppercase tracking-widest">{user.role}</p></div>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
              {menuItems.map(item=>(
                <button key={item.id} onClick={()=>{setActiveTab(item.id);setMenuOpen(false);}}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${activeTab===item.id?'bg-blue-600/20 text-white border border-[#1e3a8a]/60':'text-white/40 hover:bg-[#1e3a8a]/20'}`}>
                  <item.icon size={16} className={activeTab===item.id?'text-[#3b82f6]/70':''}/> {item.label}
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
            <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setNewContractModal(true)}
                  className="bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-blue-900/20 col-span-2">
                  <PlusCircle size={17}/> Novo Empréstimo
                </button>
                <button onClick={()=>setNewClientModal(true)}
                  className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white/70 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                  <Users size={15}/> Cadastrar Cliente
                </button>
                {isAdmin
                  ? <button onClick={()=>setActiveTab('clients')}
                      className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white/70 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                      <Search size={14}/> Ver Clientes
                    </button>
                  : <button onClick={()=>setActiveTab('loans')}
                      className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white/70 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                      <DollarSign size={14}/> Ver Empréstimos
                    </button>
                }
              </div>

            {/* ── VENCENDO HOJE + ATRASADOS ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Vencendo Hoje */}
              <button onClick={()=>setDueListModal('today')}
                className="bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-4 text-left active:scale-95 transition-transform">
                <p className="text-[9px] text-amber-400/70 uppercase tracking-wider font-black mb-1">Vencendo Hoje</p>
                <p className="text-3xl font-black text-amber-400 font-['Space_Mono']">{dashData?.today?.length||0}</p>
                <p className="text-[10px] text-white/25 mt-1">cliente{(dashData?.today?.length||0)!==1?'s':''} · toque para ver</p>
              </button>
              {/* Atrasados */}
              <button onClick={()=>setDueListModal('overdue')}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-left active:scale-95 transition-transform">
                <p className="text-[9px] text-red-400/70 uppercase tracking-wider font-black mb-1">Atrasados</p>
                <p className="text-3xl font-black text-red-400 font-['Space_Mono']">{dashData?.overdue?.length||0}</p>
                <p className="text-[10px] text-white/25 mt-1">cliente{(dashData?.overdue?.length||0)!==1?'s':''} · toque para ver</p>
              </button>
            </div>



            {/* Agendados */}
            <button onClick={()=>{setActiveTab('loans');setLoanFilter('scheduled');}} className={`${card} p-4 w-full flex justify-between items-center active:scale-95 transition-transform`}>
              <div className="text-left">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Agendados</p>
                <p className="text-sm text-white/40 mt-0.5">Próximos vencimentos</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#3b82f6]/70">{dashData?.scheduled?.length||0}</span>
                <ArrowRight size={14} className="text-white/20"/>
              </div>
            </button>
          </div>
        )}

        {/* EMPRÉSTIMOS */}
        {activeTab==='loans'&&(
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-black text-white">Empréstimos</h1>
              <div className="flex gap-2">
                {isAdmin&&<button onClick={()=>setNewClientModal(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1e3a8a]/40 border border-[#2563eb]/80 text-white/50"><Users size={14}/></button>}
                <button onClick={()=>setNewContractModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black rounded-xl text-xs shadow-lg shadow-blue-900/20"><PlusCircle size={13}/> Empréstimo</button>
              </div>
            </div>

            {/* ── PENDING APPROVAL SECTION ── */}
            {pendingContracts.length > 0 && (
              <div className="mb-4 bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-3 space-y-2">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">
                  ⏳ Aguardando Confirmação do Admin ({pendingContracts.length})
                </p>
                {pendingContracts.map((c:any)=>(
                  <div key={c.id} className="bg-[#1e3a8a]/20 border border-[#1e3a8a80] rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-black text-white">{c.client_name}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {c.contract_type==='INSTALLMENT'?`Parcelado ${c.total_installments}x`:'Rotativo'}
                          {' · '}R$ {Number(c.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                          {c.interest_rate_monthly>0?` · ${(c.interest_rate_monthly*100).toFixed(1)}% a.m.`:''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={()=>setPendingDetail(c)}
                          className="text-[9px] font-black text-[#3b82f6]/70 bg-[#012e2e]/60 border border-[#1e3a8a]/40 px-2 py-1 rounded-lg flex items-center gap-1">
                          <Eye size={10}/> Ver Ficha
                        </button>
                        {!isAdmin && (
                          <span className="text-[9px] font-black text-amber-400 bg-amber-500/20 px-2 py-1 rounded-lg">
                            PENDENTE
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={async()=>{try{await api.approveContract(c.id);await loadAll();await loadNotifications();}catch(e:any){alert(e.message);}}}
                          className="flex items-center justify-center gap-1.5 py-2 bg-[#2563eb] border border-[#3b82f6]/30 text-white font-black rounded-2xl text-xs">
                          <ThumbsUp size={11}/> Aprovar
                        </button>
                        <button onClick={()=>setRejectTarget(c)}
                          className="flex items-center justify-center gap-1.5 py-2 bg-red-600/80 text-white font-black rounded-xl text-xs">
                          <ThumbsDown size={11}/> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"/>
                <input type="text" placeholder="Nome..." value={search}
                  onChange={e=>setSearch(e.target.value)}
                  className={`${inp} pl-9 py-2.5`}/>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"/>
                <input type="text" placeholder="CPF..." value={searchCpf}
                  onChange={e=>setSearchCpf(e.target.value)}
                  inputMode="numeric"
                  className={`${inp} pl-9 py-2.5`}/>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {([{k:'all',l:`Todos (${counts.all})`},{k:'today',l:`Hoje (${counts.today})`},{k:'overdue',l:`Atraso (${counts.overdue})`},{k:'scheduled',l:`Agendado (${counts.scheduled})`}] as const).map(f=>(
                <button key={f.k} onClick={()=>setLoanFilter(f.k as any)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${loanFilter===f.k?'bg-[#2563eb] border-[#3b82f6]/50 text-white':'bg-[#1e3a8a]/30 border-[#2563eb]/80 text-white/40'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            {filtered.length===0
              ? <div className={`${card} p-8 text-center text-white/20 text-sm`}>{(search||searchCpf)?'Nenhum resultado':'Nenhum empréstimo aqui'}</div>
              : <AnimatePresence>{filtered.map(({contract,cycle,client})=>{
                  const isInstallment = contract.contract_type === 'INSTALLMENT';
                  // Para parcelados: pega todos os ciclos do contrato
                  const contractCycles = [...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat()
                    .filter((ic:any)=>ic.contract_id===contract.id);
                  if (isInstallment) return (
                    <InstallmentCard key={contract.id} contract={contract} client={client} cycles={contractCycles} user={user}
                      onPayInstallment={(cyc,_mode)=>setInstallPayModal({contract,cycle:cyc})}
                      onQuitacao={(c)=>setQuitacaoModal(c)}
                      onQuitacao={()=>setQuitacaoModal(contract)}
                      onEdit={()=>{ const cl=clients.find(c=>c.id===contract.client_id); if(cl) setEditClientModal(cl); }}
                      onDelete={()=>setDeleteModal(contract.id)}
                      onWhatsApp={()=>sendWA(contract,client)}
                      onChangeDue={()=>setChangeDueModal(contract)}
                    />
                  );
                  return (
                    <LoanCard key={contract.id} contract={contract} client={client} cycle={cycle} user={user}
                      onPayInterest={()=>setPayModal({contract,cycle:cycle??null,mode:'interest'})}
                      onPayCapital={()=>setPayModal({contract,cycle:null,mode:'capital'})}
                      onQuitacao={()=>setQuitacaoModal(contract)}
                      onRenegotiate={()=>{ const cl=clients.find(c=>c.id===contract.client_id); if(cl) setRenegoModal({client:cl,contracts:contracts.filter(c=>c.client_id===cl.id),cycles:[...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat().filter((ic:any)=>ic.client_id===cl.id)}); }}
                      onEdit={()=>{ const cl=clients.find(c=>c.id===contract.client_id); if(cl) setEditClientModal(cl); }}
                      onDelete={()=>setDeleteModal(contract.id)}
                      onWhatsApp={()=>sendWA(contract,client)}
                      onChangeDue={()=>setChangeDueModal(contract)}
                    />
                  );
                })}</AnimatePresence>
            }
          </div>
        )}

        {activeTab==='reports' && isAdmin && <ReportsView dashData={dashData} onOpenReport={(t)=>{ 
          setReportModal(t as any);
          if (t !== 'a-receber') {
            setReportFilter('mes');
            const d = new Date();
            const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
            const s = firstDay.toISOString().split('T')[0];
            const e = d.toISOString().split('T')[0];
            api.getReports(s, e).then(setFullReport).catch(()=>{});
          }
        }}/>}
        {activeTab==='clients' && user.role==='ADMIN' && <ClientsView
          clients={clients} contracts={contracts}
          onEdit={c=>setEditClientModal(c)}
          onNewContract={()=>setNewContractModal(true)}
          onDelete={c=>setDeleteClientModal(c)}
          onReload={loadAll}
        />}
        {activeTab==='calculator' && user.role==='ADMIN' && <CalculatorView/>}
        {activeTab==='management' && user.role==='ADMIN' && <ManagementView user={user}/>}
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0918]/95 backdrop-blur-xl border-t border-blue-900/60 flex items-center justify-around px-2 py-2">
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className="flex flex-col items-center gap-1 px-4 py-1">
            <div className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${activeTab===tab.id?'bg-blue-600/25 border border-blue-500/40':''}`}>
              <tab.icon size={19} className={activeTab===tab.id?'text-[#3b82f6]/70':'text-white/25'}/>
            </div>
            <span className={`text-[9px] font-black tracking-wide ${activeTab===tab.id?'text-[#3b82f6]/70':'text-white/20'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      <AnimatePresence>
        {payModal&&<Modal title={payModal.mode==='interest'?'Receber Juros':'Amortizar Capital'} onClose={()=>setPayModal(null)}>
          <PaymentForm contract={payModal.contract} cycle={payModal.cycle} mode={payModal.mode}
            onSubmit={(data)=>{
              const ct = payModal.contract;
              const splitCap = data._split_capital ?? 0;
              const lines = [
                {label:'Cliente', value: ct.client_name||''},
                {label:'Tipo', value: data.payment_type==='CAPITAL'?'Amortização':data.payment_type==='PARTIAL'?'Juros Parcial':'Juros', accent:'text-[#3b82f6]/70'},
                splitCap>0 && {label:'Capital amortizado', value: fmtBRL(splitCap), accent:'text-purple-400'},
                {label:'Valor a receber', value: fmtBRL(data.amount+(splitCap||0)), accent:'text-[#3b82f6]'},
              ].filter(Boolean) as any[];
              setPayModal(null);
              setConfirmModal({
                title:'Confirmar Pagamento',
                lines,
                onConfirm: async()=>{ await handlePayment(data); setConfirmModal(null); }
              });
            }}
          />
        </Modal>}
        {installPayModal&&(
          <Modal title={`Parcela ${(installPayModal.contract.paid_installments??0)+1}/${installPayModal.contract.total_installments??'?'}`} onClose={()=>setInstallPayModal(null)}>
            <InstallmentPaymentForm
              contract={installPayModal.contract}
              cycle={installPayModal.cycle}
              onSubmit={(d)=>{
                const ct = installPayModal.contract;
                const parc = (ct.paid_installments??0)+1;
                const total = ct.total_installments??'?';
                setInstallPayModal(null);
                setConfirmModal({
                  title: `Confirmar Parcela ${parc}/${total}`,
                  lines: [
                    {label:'Cliente', value: ct.client_name||''},
                    {label:'Parcela', value:`${parc} de ${total}`, accent:'text-purple-400'},
                    {label:'Valor', value: fmtBRL(d.amount), accent:'text-[#3b82f6]'},
                  ],
                  onConfirm: async()=>{
                    await api.payInstallment(d.contract_id, d.cycle_id, d.amount);
                    setConfirmModal(null);
                    await loadAll();
                  }
                });
              }}
            />
          </Modal>
        )}
        {receipt&&<ReceiptModal receipt={receipt} onClose={()=>setReceipt(null)}/>}
        {renegoModal&&<Modal title="Renegociar Dívida" onClose={()=>setRenegoModal(null)}><RenegotiateForm client={renegoModal.client} contracts={renegoModal.contracts} cycles={renegoModal.cycles} onClose={()=>setRenegoModal(null)} onSuccess={()=>{setRenegoModal(null);loadAll();}}/></Modal>}

        {newContractModal && <NewContractModal
          clients={clients}
          user={user}
          onClose={()=>setNewContractModal(false)}
          onSuccess={()=>{ setNewContractModal(false); loadAll(); loadNotifications(); }}
          refreshKey={clients.length + (newContractModal ? 1 : 0)}
        />}

        {newClientModal&&<Modal title="Novo Cliente" onClose={()=>setNewClientModal(false)}>
          <form onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.target as HTMLFormElement);try{const clientName=fd.get('name') as string;await api.createClient({name:clientName,cpf:fd.get('cpf') as string,phone:fd.get('phone') as string,address:fd.get('address') as string,notes:fd.get('notes') as string});api.createNotification('NEW_CLIENT','Novo cliente cadastrado',`${user?.name||'Cobrador'} cadastrou o cliente ${clientName}.`,{client_name:clientName,created_by_name:user?.name});setNewClientModal(false);loadAll();}catch(e:any){alert(e.message);}}} className="space-y-4">
            <div><label className={lbl}>Nome</label><input name="name" type="text" className={inp} required/></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>CPF</label><input name="cpf" type="text" className={inp}/></div><div><label className={lbl}>Telefone</label><input name="phone" type="text" className={inp} required/></div></div>
            <div><label className={lbl}>Endereço</label><input name="address" type="text" className={inp}/></div>
            <div><label className={lbl}>Observações</label><textarea name="notes" className={`${inp} h-16 resize-none`}></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-4 rounded-xl text-sm">CADASTRAR</button>
          </form>
        </Modal>}

        {editClientModal&&<Modal title="Editar Cliente" onClose={()=>setEditClientModal(null)}>
          <form onSubmit={async e=>{e.preventDefault();const fd=new FormData(e.target as HTMLFormElement);try{await api.updateClient(editClientModal.id,{name:fd.get('name') as string,cpf:fd.get('cpf') as string,phone:fd.get('phone') as string,address:fd.get('address') as string,notes:fd.get('notes') as string});setEditClientModal(null);loadAll();}catch(e:any){alert(e.message);}}} className="space-y-4">
            <div><label className={lbl}>Nome</label><input name="name" defaultValue={editClientModal.name} type="text" className={inp} required/></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>CPF</label><input name="cpf" defaultValue={editClientModal.cpf} type="text" className={inp}/></div><div><label className={lbl}>Telefone</label><input name="phone" defaultValue={editClientModal.phone} type="text" className={inp}/></div></div>
            <div><label className={lbl}>Endereço</label><input name="address" defaultValue={editClientModal.address} type="text" className={inp}/></div>
            <div><label className={lbl}>Observações</label><textarea name="notes" defaultValue={editClientModal.notes} className={`${inp} h-16 resize-none`}></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-4 rounded-xl text-sm">SALVAR</button>
          </form>
        </Modal>}

        {/* ── LISTA VENCENDO HOJE / ATRASADOS ─────────────────── */}
        {dueListModal && (() => {
          const isToday  = dueListModal === 'today';
          const items    = isToday ? (dashData?.today||[]) : (dashData?.overdue||[]);
          const title    = isToday ? 'Vencendo Hoje' : 'Clientes Atrasados';
          const accentCls = isToday ? 'text-amber-400' : 'text-red-400';
          const bgCls     = isToday ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
          return (
            <Modal title={title} onClose={()=>setDueListModal(null)}>
              <div className="space-y-2">
                {items.length === 0
                  ? <p className="text-center text-white/30 py-8 text-sm">Nenhum cliente {isToday?'vence hoje':'em atraso'}</p>
                  : items.map((ic:any) => {
                      const diasAtraso = !isToday ? Math.floor((Date.now()-new Date(ic.due_date).getTime())/86400000) : 0;
                      return (
                        <div key={ic.id} className={`${bgCls} border rounded-xl p-3`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-white text-sm">{ic.client_name}</p>
                              {!isToday && <p className="text-[10px] text-red-400/70 mt-0.5">{diasAtraso} dia{diasAtraso!==1?'s':''} em atraso</p>}
                              {isToday  && <p className="text-[10px] text-white/30 mt-0.5">Vence: {format(parseDate(ic.due_date),'dd/MM/yyyy')}</p>}
                            </div>
                            <p className={`font-black text-sm ${accentCls}`}>{fmtBRL(ic.base_interest_amount)}</p>
                          </div>
                          
                          {/* 3 botões de pagamento */}
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            <button onClick={()=>{
                              const contract = dashData?.all?.find((c:any) => c.id === ic.contract_id);
                              if (contract) {
                                setPayModal({ contract, cycle: ic, mode: 'interest' });
                                setDueListModal(null);
                              }
                            }} className="flex flex-col items-center justify-center py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-black">
                              <DollarSign size={12}/>
                              <span className="mt-0.5">Juros</span>
                            </button>
                            
                            <button onClick={()=>{
                              const contract = dashData?.all?.find((c:any) => c.id === ic.contract_id);
                              if (contract) {
                                setPayModal({ contract, cycle: ic, mode: 'capital' });
                                setDueListModal(null);
                              }
                            }} className="flex flex-col items-center justify-center py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 text-[10px] font-black">
                              <CreditCard size={12}/>
                              <span className="mt-0.5">Capital</span>
                            </button>
                            
                            <button onClick={()=>{
                              const contract = dashData?.all?.find((c:any) => c.id === ic.contract_id);
                              if (contract) {
                                setQuitacaoModal(contract);
                                setDueListModal(null);
                              }
                            }} className="flex flex-col items-center justify-center py-2 rounded-lg bg-green-600/20 border border-green-500/30 text-green-300 text-[10px] font-black">
                              <CheckCircle2 size={12}/>
                              <span className="mt-0.5">Quitar</span>
                            </button>
                          </div>

                          {/* Botão WhatsApp */}
                          {ic.client_phone && (
                            <button onClick={()=>{
                              const msg = `Olá ${ic.client_name}, passando para lembrar do pagamento de ${fmtBRL(ic.base_interest_amount)} vencido em ${format(parseDate(ic.due_date),'dd/MM/yyyy')}. 🙏`;
                              window.open(`https://wa.me/55${ic.client_phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank');
                            }} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1e3a8a]/30 text-white/40 text-xs font-black">
                              <Phone size={11}/> Cobrar via WhatsApp
                            </button>
                          )}
                        </div>
                      );
                    })
                }
              </div>
            </Modal>
          );
        })()}

        {/* ── RELATÓRIO DE LUCRO ───────────────────────────────── */}
        {reportModal && (() => {
          const isLucro   = reportModal === 'lucro';
          const isCapital = reportModal === 'capital';
          const isAReceber = reportModal === 'a-receber';

          const filters = [{k:'dia',l:'Hoje'},{k:'semana',l:'Semana'},{k:'mes',l:'Mês'},{k:'6meses',l:'6 Meses'},{k:'todos',l:'Todos'}] as const;
          const today   = new Date();
          const getRange = (f: string) => {
            if(f==='dia')    return {s:format(today,'yyyy-MM-dd'),e:format(today,'yyyy-MM-dd')};
            if(f==='semana') { const d=new Date(today); d.setDate(d.getDate()-7); return {s:format(d,'yyyy-MM-dd'),e:format(today,'yyyy-MM-dd')}; }
            if(f==='mes')    { const d=new Date(today.getFullYear(),today.getMonth(),1); return {s:format(d,'yyyy-MM-dd'),e:format(today,'yyyy-MM-dd')}; }
            if(f==='6meses') { const d=new Date(today); d.setMonth(d.getMonth()-6); return {s:format(d,'yyyy-MM-dd'),e:format(today,'yyyy-MM-dd')}; }
            return {s:undefined as any,e:undefined as any};
          };
          const loadReport = async (f: string) => {
            const {s,e} = getRange(f);
            try { setFullReport(await api.getReports(s,e)); } catch {}
          };

          // All payments from report — recentPayments is already grouped by client
          // Each group: { client_id, client_name, total_amount, payments: [{id, amount, payment_type, created_at}] }
          const allGroups    = fullReport?.recentPayments || [];
          const clientSearch = reportClientFilter.toLowerCase();

          // Filter payments within each group by type
          const typeFiltered = allGroups.map((g:any) => {
            const pFiltered = (g.payments||[]).filter((p:any) =>
              isLucro   ? ['INTEREST','PARTIAL','ADVANCE_INTEREST','INSTALLMENT'].includes(p.payment_type) :
              isCapital ? p.payment_type === 'CAPITAL' :
              true
            );
            const total = pFiltered.reduce((s:number,p:any)=>s+(p.amount||0), 0);
            return {...g, payments: pFiltered, total_filtered: total};
          }).filter((g:any)=>g.payments.length>0);

          const filtered = clientSearch
            ? typeFiltered.filter((g:any)=>g.client_name?.toLowerCase().includes(clientSearch))
            : typeFiltered;

          const grandTotal = filtered.reduce((s:number,g:any)=>s+(g.total_filtered||0), 0);

          // For a-receber: all unpaid cycles from dashData (overdue + today + scheduled)
          const aReceberItems = [
            ...(dashData?.overdue||[]),
            ...(dashData?.today||[]),
            ...(dashData?.scheduled||[]),
          ].filter((ic:any) => ic && ic.due_date && ic.status !== 'PAID');
          const aReceberFiltered = clientSearch
            ? aReceberItems.filter((ic:any)=>
                ic.client_name?.toLowerCase().includes(clientSearch) ||
                (ic.client_phone||'').replace(/\D/g,'').includes(clientSearch.replace(/\D/g,'')) ||
                (ic.client_cpf||'').replace(/\D/g,'').includes(clientSearch.replace(/\D/g,''))
              )
            : aReceberItems;

          const titles: Record<string,string> = {
            lucro: 'Lucro Recebido',
            capital: 'Capital Recebido',
            'a-receber': 'Lucro a Receber',
          };
          const accentCls: Record<string,string> = {
            lucro: 'text-[#3b82f6]',
            capital: 'text-purple-400',
            'a-receber': 'text-amber-400',
          };
          const bgCls: Record<string,string> = {
            lucro: 'bg-[#3b82f6]/10 border-[#3b82f6]/60/20',
            capital: 'bg-purple-500/10 border-purple-500/20',
            'a-receber': 'bg-amber-500/10 border-amber-500/20',
          };

          const ptLabel = (t:string) =>
            t==='INTEREST'?'Juros':t==='CAPITAL'?'Capital':t==='PARTIAL'?'Juros parcial':t==='INSTALLMENT'?'Parcela':'Adiantado';
          const exportPDF = () => {
            const doc = new jsPDF();
            const titleStr = titles[reportModal as string];
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Capital Rotativo — ' + titleStr, 14, 20);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120);
            doc.text('Gerado em ' + format(new Date(), 'dd/MM/yyyy HH:mm'), 14, 27);
            doc.setTextColor(0);

            if (isAReceber) {
              const rows = aReceberFiltered.map((ic: any) => [
                ic.client_name || '—',
                ic.contract_type === 'INSTALLMENT' ? 'Parcela' : 'Juros',
                ic.due_date ? format(parseDate(ic.due_date), 'dd/MM/yyyy') : '—',
                'R$ ' + (ic.base_interest_amount - (ic.paid_amount || 0)).toFixed(2).replace('.', ','),
              ]);
              autoTable(doc, { startY: 33, head: [['Cliente', 'Tipo', 'Vencimento', 'Valor']], body: rows, theme: 'striped', headStyles: { fillColor: [30, 30, 60] } });
            } else {
              const rows = filtered.flatMap((g: any) =>
                g.payments.map((p: any) => [
                  g.client_name,
                  ptLabel(p.payment_type),
                  format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
                  'R$ ' + p.amount.toFixed(2).replace('.', ','),
                ])
              );
              autoTable(doc, { startY: 33, head: [['Cliente', 'Tipo', 'Data', 'Valor']], body: rows, theme: 'striped', headStyles: { fillColor: [30, 30, 60] } });
              const finalY = (doc as any).lastAutoTable?.finalY || 50;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.text('Total: R$ ' + grandTotal.toFixed(2).replace('.', ','), 14, finalY + 10);
            }
            doc.save('cobrafacil_' + titleStr.toLowerCase().replace(/ /g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf');
          };


          return (
            <Modal title={`Relatório — ${titles[reportModal]}`} onClose={()=>{setReportModal(null);setReportClientFilter('');}}>
              <div className="space-y-4">

                {/* Filtros de período + exportar PDF */}
                <div className="flex gap-2 items-center flex-wrap">
                  {!isAReceber && filters.map(f=>(
                    <button key={f.k} onClick={()=>{ setReportFilter(f.k); loadReport(f.k); }}
                      className={`flex-1 min-w-[60px] py-2 rounded-xl text-[10px] font-black border transition-all ${reportFilter===f.k?'bg-[#2563eb] border-[#3b82f6]/50 text-white':'bg-[#1e3a8a]/20 border-[#1e3a8a80] text-white/40'}`}>
                      {f.l}
                    </button>
                  ))}
                  <button onClick={exportPDF}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1e3a8a]/40 border border-[#1e3a8a] rounded-xl text-xs font-black text-white/60 flex-shrink-0">
                    <FileText size={11}/> PDF
                  </button>
                </div>

                {/* Total do período */}
                {!isAReceber && (
                  <div className={`${bgCls[reportModal]} border rounded-xl p-4`}>
                    <p className="text-[9px] uppercase font-black tracking-widest mb-1 opacity-60">{titles[reportModal]} no período</p>
                    <p className={`text-2xl font-black ${accentCls[reportModal]}`}>{fmtBRL(grandTotal)}</p>
                    <p className="text-[10px] text-white/25 mt-1">{filtered.length} cliente{filtered.length!==1?'s':''}</p>
                    {isCapital && fullReport?.saleReceived > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#1e3a8a] flex justify-between items-center">
                        <span className="text-[10px] text-orange-400 font-bold">Vendas no período</span>
                        <span className="text-sm font-black text-orange-400">{fmtBRL(fullReport.saleReceived)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total a receber */}
                {isAReceber && (
                  <div className="bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-4">
                    <p className="text-[9px] text-amber-400/60 uppercase font-black tracking-widest mb-1">Total a Receber</p>
                    <p className="text-2xl font-black text-amber-400">{fmtBRL((dashData?.metrics?.total_interest_to_receive || [...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat().reduce((s:number,ic:any)=>s+(ic.base_interest_amount-(ic.paid_amount||0)),0) || 0))}</p>
                    <p className="text-[10px] text-white/25 mt-1">{aReceberItems.length} contrato{aReceberItems.length!==1?'s':''} em aberto</p>
                  </div>
                )}

                {/* Busca por cliente */}
                <div className="relative">
                  <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25"/>
                  <input type="text" placeholder="Filtrar por nome, telefone ou CPF..." value={reportClientFilter}
                    onChange={e=>setReportClientFilter(e.target.value)}
                    className={`${inp} pl-10 py-2.5`}/>
                </div>

                {/* LISTA — Lucro / Capital */}
                {!isAReceber && (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
                    {filtered.length === 0
                      ? <p className="text-center text-white/30 text-sm py-6">Nenhum pagamento no período</p>
                      : filtered.map((g:any)=>(
                        <div key={g.client_id} className={`${card} overflow-hidden`}>
                          <details>
                            <summary className="flex justify-between items-center p-3 cursor-pointer list-none">
                              <div>
                                <p className="font-black text-white text-sm">{g.client_name}</p>
                                <p className="text-[10px] text-white/25 mt-0.5">{g.payments.length} pagamento{g.payments.length!==1?'s':''}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-sm ${accentCls[reportModal]}`}>{fmtBRL(g.total_filtered)}</span>
                                <ChevronDown size={13} className="text-white/30"/>
                              </div>
                            </summary>
                            <div className="border-t border-[#1e3a8a60]">
                              {g.payments.map((p:any)=>(
                                <div key={p.id} className="px-3 py-2 border-b border-white/[0.04] last:border-0">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="text-xs text-white/60 font-bold">{ptLabel(p.payment_type)}</p>
                                      <p className="text-[10px] text-white/25">{format(new Date(p.created_at),'dd/MM/yyyy · HH:mm')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-black text-sm ${accentCls[reportModal as string]}`}>{fmtBRL(p.amount)}</span>
                                      {user?.role==='ADMIN' && (
                                        <div className="flex gap-1">
                                          <button onClick={()=>setEditPayModal(p)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md bg-[#1e3a8a]/60 text-[#3b82f6]/70">
                                            <Edit size={10}/>
                                          </button>
                                          <button onClick={()=>setDeletePayConfirm(p)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md bg-red-500/20 text-red-400">
                                            <Trash2 size={10}/>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* LISTA — A Receber (agrupado por cliente) */}
                {isAReceber && (() => {
                  // Group cycles by client
                  const byClient: Record<string, {name:string; items:any[]; total:number}> = {};
                  aReceberFiltered.forEach((ic:any) => {
                    const key = ic.client_name || 'Desconhecido';
                    if (!byClient[key]) byClient[key] = { name: key, items: [], total: 0 };
                    byClient[key].items.push(ic);
                    byClient[key].total += ic.base_interest_amount - (ic.paid_amount||0);
                  });
                  const groups = Object.values(byClient);
                  return (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
                      {groups.length === 0
                        ? <p className="text-center text-white/30 text-sm py-6">Nenhum juros pendente</p>
                        : groups.map((g:any) => (
                          <div key={g.name} className={`${card} overflow-hidden`}>
                            <details>
                              <summary className="flex justify-between items-center p-3 cursor-pointer list-none">
                                <div>
                                  <p className="font-black text-white text-sm">{g.name}</p>
                                  <p className="text-[10px] text-white/25 mt-0.5">{g.items.length} parcela{g.items.length!==1?'s':''} em aberto</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-amber-400">{fmtBRL(g.total)}</span>
                                  <ChevronDown size={13} className="text-white/30"/>
                                </div>
                              </summary>
                              <div className="border-t border-[#1e3a8a60]">
                                {g.items.map((ic:any, idx:number) => (
                                  <div key={`${ic.id}-${idx}`} className="px-3 py-2.5 border-b border-white/[0.04] last:border-0 flex justify-between items-center">
                                    <div>
                                      <p className="text-xs font-bold text-white/60">
                                        {ic.contract_type==='INSTALLMENT' ? `Parcela` : 'Juros'}
                                      </p>
                                      <p className="text-[10px] text-white/30 mt-0.5">
                                        Vence: {format(parseDate(ic.due_date),'dd/MM/yyyy')}
                                        {ic.due_date < format(today,'yyyy-MM-dd') && <span className="text-red-400 ml-1">· ATRASADO</span>}
                                      </p>
                                    </div>
                                    <p className="font-black text-amber-400 text-sm">{fmtBRL(ic.base_interest_amount - (ic.paid_amount||0))}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ))
                      }
                    </div>
                  );
                })()}
              </div>
            </Modal>
          );
        })()}

        {/* ── QUITAR CONTRATO TOTAL ───────────────────────────── */}
        {quitacaoModal && (() => {
          const contract = quitacaoModal;
          const cycle    = [...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat().find((ic:any)=>ic.contract_id===contract.id);
          const juros    = cycle ? (cycle.base_interest_amount - (cycle.paid_amount||0)) : 0;
          const total    = contract.capital + juros;
          return (
            <Modal title="Quitar Contrato" onClose={()=>setQuitacaoModal(null)}>
              <div className="space-y-4">
                <div className="bg-[#1e3a8a] border border-[#3b82f6]/20 rounded-xl p-4 border-l-2 border-l-blue-600">
                  <p className="font-black text-white">{contract.client_name}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Capital devedor</span>
                      <span className="font-black text-white">{fmtBRL(contract.capital)}</span>
                    </div>
                    {juros > 0 && <div className="flex justify-between text-xs">
                      <span className="text-white/40">Juros pendentes</span>
                      <span className="font-black text-amber-400">{fmtBRL(juros)}</span>
                    </div>}
                    <div className="flex justify-between pt-2 border-t border-[#1e3a8a]">
                      <span className="text-sm font-black text-white">Total a quitar</span>
                      <span className="text-lg font-black text-[#3b82f6]">{fmtBRL(total)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/30 text-center">Isso marca o contrato como quitado e registra o recebimento completo.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={()=>setQuitacaoModal(null)}
                    className="bg-[#1e3a8a]/40 text-white font-black py-3 rounded-xl text-sm border border-[#1e3a8a]">Cancelar</button>
                  <button onClick={async()=>{
                    try {
                      await api.registerPayment({
                        contract_id: contract.id,
                        amount: total,
                        payment_type: 'CAPITAL',
                        next_due_date: null,
                        cycle_id: cycle?.id ?? null,
                      });
                      setQuitacaoModal(null);
                      setActiveTab('reports');
                      await loadAll();
                    } catch(e:any){ alert(e.message); }
                  }} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-3 rounded-xl text-sm">
                    ✓ Quitar Agora
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}

        {/* ── QUITAR CONTRATO TOTAL ───────────────────────────── */}
        {quitacaoModal && (() => {
          const contract = quitacaoModal;
          const cycle    = [...(dashData?.overdue||[]),(dashData?.today||[]),(dashData?.scheduled||[])].flat().find((ic:any)=>ic.contract_id===contract.id);
          const juros    = cycle ? (cycle.base_interest_amount - (cycle.paid_amount||0)) : 0;
          const total    = contract.capital + juros;
          return (
            <Modal title="Quitar Contrato" onClose={()=>setQuitacaoModal(null)}>
              <div className="space-y-4">
                <div className="bg-[#1e3a8a] border border-[#3b82f6]/20 rounded-xl p-4 border-l-2 border-l-blue-600">
                  <p className="font-black text-white">{contract.client_name}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-white/40">Capital devedor</span><span className="font-black text-white">{fmtBRL(contract.capital)}</span></div>
                    {juros > 0 && <div className="flex justify-between text-xs"><span className="text-white/40">Juros pendentes</span><span className="font-black text-amber-400">{fmtBRL(juros)}</span></div>}
                    <div className="flex justify-between pt-2 border-t border-[#1e3a8a]"><span className="text-sm font-black text-white">Total a quitar</span><span className="text-lg font-black text-[#3b82f6]">{fmtBRL(total)}</span></div>
                  </div>
                </div>
                <p className="text-xs text-white/30 text-center">Contrato encerrado e recebimento registrado automaticamente.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={()=>setQuitacaoModal(null)} className="bg-[#1e3a8a]/40 text-white font-black py-3 rounded-xl text-sm border border-[#1e3a8a]">Cancelar</button>
                  <button onClick={async()=>{
                    try{
                      // If juros pending, pay them first
                      if (juros > 0 && cycle) {
                        await api.registerPayment({
                          contract_id: contract.id,
                          cycle_id: cycle.id,
                          amount: juros,
                          payment_type: 'INTEREST',
                          next_due_date: null,
                        });
                      }
                      // Pay full capital to trigger contract closure
                      await api.registerPayment({
                        contract_id: contract.id,
                        cycle_id: null,
                        amount: contract.capital,
                        payment_type: 'CAPITAL',
                        next_due_date: null,
                      });
                      setQuitacaoModal(null);
                      setActiveTab('reports');
                      await loadAll();
                    }catch(e:any){alert(e.message);}
                  }} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-3 rounded-xl text-sm">✓ Quitar Agora</button>
                </div>
              </div>
            </Modal>
          );
        })()}



        {/* ── ALTERAR VENCIMENTO ─────────────────────────────── */}
        {changeDueModal && (
          <Modal title="Alterar Vencimento" onClose={() => setChangeDueModal(null)}>
            <form onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              const newDate = fd.get('new_date') as string;
              try {
                await api.updateDueDate(changeDueModal.id, newDate);
                setChangeDueModal(null);
                loadAll();
              } catch(err: any) { alert(err.message); }
            }} className="space-y-4">
              <div className="bg-[#1e3a8a]/20 border border-[#2563eb]/80 rounded-xl p-4">
                <p className="font-black text-white">{changeDueModal.client_name}</p>
                <p className="text-xs text-white/30 mt-1">
                  Vencimento atual: <span className="text-amber-400 font-black">{format(parseDate(changeDueModal.next_due_date), 'dd/MM/yyyy')}</span>
                </p>
              </div>
              <div>
                <label className={lbl}>Nova Data de Vencimento</label>
                <input name="new_date" type="date" defaultValue={changeDueModal.next_due_date} className={inp} required />
              </div>
              <p className="text-xs text-white/30 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                Altera o vencimento do contrato e do ciclo de juros atual em aberto.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setChangeDueModal(null)} className="bg-[#1e3a8a]/40 text-white font-black py-3 rounded-xl text-sm border border-[#1e3a8a]">Cancelar</button>
                <button type="submit" className="bg-gradient-to-r from-blue-800 to-[#0d1f17] text-white font-black py-3 rounded-xl text-sm">Salvar</button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── CONFIRMAR PAGAMENTO ─────────────────────────── */}
        {confirmModal && <ConfirmPaymentModal title={confirmModal.title} lines={confirmModal.lines} onConfirm={confirmModal.onConfirm} onCancel={()=>setConfirmModal(null)}/>}

        {/* ── CONFIRMAR PAGAMENTO ─────────────────────────── */}

        {/* ── EDITAR PAGAMENTO ────────────────────────────── */}
        {editPayModal && <EditPaymentModal
          payment={editPayModal}
          onClose={()=>setEditPayModal(null)}
          onSaved={async()=>{
            // First reload report (while modal still open), then close
            const d=new Date();
            let s='',e='';
            if(reportFilter==='dia'){s=e=format(d,'yyyy-MM-dd');}
            else if(reportFilter==='semana'){e=format(d,'yyyy-MM-dd');s=format(new Date(d.getTime()-6*86400000),'yyyy-MM-dd');}
            else if(reportFilter==='mes'){s=format(new Date(d.getFullYear(),d.getMonth(),1),'yyyy-MM-dd');e=format(d,'yyyy-MM-dd');}
            else if(reportFilter==='6meses'){const sixMonthsAgo=new Date(d);sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);s=format(sixMonthsAgo,'yyyy-MM-dd');e=format(d,'yyyy-MM-dd');}
            const [newReport] = await Promise.all([
              api.getReports(s||undefined, e||undefined),
              loadAll(),
            ]);
            setFullReport(newReport);
            setEditPayModal(null);
          }}
        />}

        {/* ── EXCLUIR PAGAMENTO ────────────────────────────── */}
        {deletePayConfirm && (
          <Modal title="Excluir Pagamento" onClose={()=>setDeletePayConfirm(null)}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
                <p className="text-xs text-white/40 font-bold">{deletePayConfirm.payment_type==='CAPITAL'?'Capital':deletePayConfirm.payment_type==='PARTIAL'?'Juros Parcial':'Juros'}</p>
                <p className="text-xl font-black text-red-400">{fmtBRL(deletePayConfirm.amount)}</p>
                <p className="text-[10px] text-white/25">{format(new Date(deletePayConfirm.created_at),'dd/MM/yyyy · HH:mm')}</p>
              </div>
              <p className="text-xs text-white/40 text-center">O saldo do contrato será revertido automaticamente.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setDeletePayConfirm(null)} className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-black py-3 rounded-xl text-sm">Cancelar</button>
                <button onClick={async()=>{
                  const pay=deletePayConfirm;
                  try{
                    await api.deletePayment(pay.id);
                    const d=new Date(); let s='',e='';
                    if(reportFilter==='dia'){s=e=format(d,'yyyy-MM-dd');}
                    else if(reportFilter==='semana'){e=format(d,'yyyy-MM-dd');s=format(new Date(d.getTime()-6*86400000),'yyyy-MM-dd');}
                    else if(reportFilter==='mes'){s=format(new Date(d.getFullYear(),d.getMonth(),1),'yyyy-MM-dd');e=format(d,'yyyy-MM-dd');}
                    else if(reportFilter==='6meses'){const sixMonthsAgo=new Date(d);sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);s=format(sixMonthsAgo,'yyyy-MM-dd');e=format(d,'yyyy-MM-dd');}
                    const [newReport] = await Promise.all([
                      api.getReports(s||undefined, e||undefined),
                      loadAll(),
                    ]);
                    setFullReport(newReport);
                    setDeletePayConfirm(null);
                  }catch(ex:any){alert(ex.message);}
                }} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">Excluir</button>
              </div>
            </div>
          </Modal>
        )}


        {/* ── NOTIFICATION PANEL ───────────────────────────── */}
        {notifOpen && (
          <Modal title="Notificações" onClose={()=>setNotifOpen(false)}>
            <div className="space-y-3">

              {/* Pending Approval Queue — admin only */}
              {user?.role==='ADMIN' && pendingContracts.length > 0 && (
                <div className="bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-3 space-y-2">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                    ⏳ Aguardando Aprovação ({pendingContracts.length})
                  </p>
                  {pendingContracts.map((c:any)=>(
                    <div key={c.id} className="bg-[#1e3a8a]/20 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-black text-white">{c.client_name}</p>
                          <p className="text-[10px] text-white/40">
                            {c.contract_type==='INSTALLMENT'?`Parcelado ${c.total_installments}x`:c.contract_type==='SALE'?'Venda':'Rotativo'}
                            {' · '}R$ {Number(c.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                          </p>
                          {c.contract_type!=='SALE' && c.interest_rate_monthly > 0 && (
                            <p className="text-[10px] text-white/30">{(c.interest_rate_monthly*100).toFixed(1)}% ao mês</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={async()=>{
                          try{
                            await api.approveContract(c.id);
                            await loadAll(); await loadNotifications();
                          }catch(e:any){alert(e.message);}
                        }} className="flex items-center justify-center gap-1.5 py-2 bg-[#2563eb] border border-[#3b82f6]/30 text-white font-black rounded-2xl text-xs">
                          <ThumbsUp size={11}/> Aprovar
                        </button>
                        <button onClick={()=>setRejectTarget(c)}
                          className="flex items-center justify-center gap-1.5 py-2 bg-red-600/80 text-white font-black rounded-xl text-xs">
                          <ThumbsDown size={11}/> Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mark all read */}
              {notifications.filter((n:any)=>!n.read).length > 0 && (
                <button onClick={async()=>{
                  await api.markNotificationsRead([]);
                  setNotifications(prev=>prev.map(n=>({...n,read:true})));
                }} className="w-full py-2 text-xs text-white/40 font-bold border border-[#2563eb]/80 rounded-xl">
                  Marcar todas como lidas
                </button>
              )}

              {/* Notification list */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="text-center text-white/30 text-sm py-8">Nenhuma notificação</p>
                )}
                {notifications.map((n:any)=>(
                  <div key={n.id} className={`rounded-xl p-3 border transition-all ${n.read?'bg-white/[0.02] border-[#1e3a8a60] opacity-60':'bg-[#1e3a8a]/40 border-white/[0.10]'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        n.type==='PAYMENT'?'bg-[#3b82f6]/15 text-[#3b82f6]':
                        n.type==='NEW_CONTRACT'?'bg-[#1e3a8a]/60 text-[#3b82f6]/70':
                        n.type==='NEW_CLIENT'?'bg-purple-500/20 text-purple-400':
                        n.type==='CONTRACT_APPROVED'?'bg-[#3b82f6]/15 text-[#3b82f6]':
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {n.type==='PAYMENT'?<DollarSign size={11}/>:
                         n.type==='NEW_CONTRACT'?<FileText size={11}/>:
                         n.type==='NEW_CLIENT'?<Users size={11}/>:
                         n.type==='CONTRACT_APPROVED'?<CheckCircle2 size={11}/>:
                         <XCircle size={11}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white">{n.title}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">{n.body}</p>
                        <p className="text-[9px] text-white/20 mt-1">
                          {n.creator_name && `${n.creator_name} · `}
                          {format(new Date(n.created_at),'dd/MM HH:mm')}
                        </p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1 flex-shrink-0"/>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {/* ── PENDING DETAIL MODAL ─────────────────────────── */}
        {pendingDetail && (
          <Modal title="Ficha do Empréstimo" onClose={()=>setPendingDetail(null)}>
            <div className="space-y-4">
              <div className="bg-[#1e3a8a]/20 border border-[#1e3a8a80] rounded-xl p-4 space-y-2">
                <p className="text-[9px] font-black text-[#3b82f6]/70 uppercase tracking-widest mb-2">👤 Dados do Cliente</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-lg font-black text-[#0CABA8]/80">
                    {pendingDetail.client_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-white text-sm">{pendingDetail.client_name}</p>
                    <p className="text-[10px] text-white/30">{pendingDetail.client_cpf || 'CPF não informado'}</p>
                  </div>
                </div>
                {pendingDetail.client_phone && (
                  <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                    <span className="text-white/40">Telefone</span>
                    <span className="font-bold text-white">{pendingDetail.client_phone}</span>
                  </div>
                )}
                {pendingDetail.client_address && (
                  <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                    <span className="text-white/40">Endereço</span>
                    <span className="font-bold text-white text-right max-w-[60%]">{pendingDetail.client_address}</span>
                  </div>
                )}
                {pendingDetail.client_notes && (
                  <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                    <span className="text-white/40">Observações</span>
                    <span className="font-bold text-white text-right max-w-[60%]">{pendingDetail.client_notes}</span>
                  </div>
                )}
              </div>
              <div className="bg-[#1e3a8a]/20 border border-[#1e3a8a80] rounded-xl p-4 space-y-2">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2">📋 Dados do Empréstimo</p>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Tipo</span>
                  <span className="font-black text-white">{pendingDetail.contract_type==='INSTALLMENT'?'Parcelado':'Rotativo'}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                  <span className="text-white/40">Capital</span>
                  <span className="font-black text-[#3b82f6]">R$ {Number(pendingDetail.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                  <span className="text-white/40">Taxa</span>
                  <span className="font-black text-white">{(pendingDetail.interest_rate_monthly*100).toFixed(1)}% ao mês</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                  <span className="text-white/40">{pendingDetail.contract_type==='INSTALLMENT'?'Parcela':'Juros/mês'}</span>
                  <span className="font-black text-[#3b82f6]/70">R$ {Number(pendingDetail.installment_amount||pendingDetail.monthly_interest_amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
                {pendingDetail.contract_type==='INSTALLMENT' && (
                  <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                    <span className="text-white/40">Parcelas</span>
                    <span className="font-black text-white">{pendingDetail.total_installments}x</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                  <span className="text-white/40">Vencimento</span>
                  <span className="font-black text-white">{pendingDetail.next_due_date ? new Date(pendingDetail.next_due_date+'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                </div>
                {pendingDetail.guarantee_notes && (
                  <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                    <span className="text-white/40">Garantia</span>
                    <span className="font-bold text-white text-right max-w-[60%]">{pendingDetail.guarantee_notes}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-[#1e3a8a80] pt-2">
                  <span className="text-white/40">Solicitado em</span>
                  <span className="font-bold text-white">{new Date(pendingDetail.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              {isAdmin && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={async()=>{try{await api.approveContract(pendingDetail.id);setPendingDetail(null);await loadAll();await loadNotifications();}catch(e:any){alert(e.message);}}}
                    className="flex items-center justify-center gap-2 py-3 bg-[#2563eb] border border-[#3b82f6]/30 text-white font-black rounded-2xl text-sm">
                    <ThumbsUp size={14}/> Aprovar
                  </button>
                  <button onClick={()=>{setRejectTarget(pendingDetail);setPendingDetail(null);}}
                    className="flex items-center justify-center gap-2 py-3 bg-red-600/80 text-white font-black rounded-xl text-sm">
                    <ThumbsDown size={14}/> Recusar
                  </button>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* ── REJECT CONTRACT MODAL ─────────────────────────── */}
        {rejectTarget && (
          <Modal title="Recusar Empréstimo" onClose={()=>{setRejectTarget(null);setRejectReason('');}}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm font-black text-white">{rejectTarget.client_name}</p>
                <p className="text-xs text-white/40">R$ {Number(rejectTarget.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
              </div>
              <div>
                <label className={lbl}>Motivo (opcional)</label>
                <input type="text" value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
                  placeholder="Ex: documentação incompleta..."
                  className={inp}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{setRejectTarget(null);setRejectReason('');}}
                  className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-black py-3 rounded-xl text-sm">
                  Cancelar
                </button>
                <button onClick={async()=>{
                  try{
                    await api.rejectContract(rejectTarget.id, rejectReason);
                    setRejectTarget(null); setRejectReason('');
                    await loadAll(); await loadNotifications();
                  }catch(e:any){alert(e.message);}
                }} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">
                  Confirmar Recusa
                </button>
              </div>
            </div>
          </Modal>
        )}


        {/* ── NOTIFICATION PANEL ───────────────────────────── */}
        {notifOpen && (
          <Modal title="Notificações" onClose={()=>setNotifOpen(false)}>
            <div className="space-y-3">
              {user?.role==='ADMIN' && pendingContracts.length > 0 && (
                <div className="bg-[#012e2e]/80 border border-amber-600/20 rounded-2xl p-3 space-y-2">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">⏳ Aguardando Aprovação ({pendingContracts.length})</p>
                  {pendingContracts.map((c:any)=>(
                    <div key={c.id} className="bg-[#1e3a8a]/20 rounded-xl p-3 space-y-2">
                      <div>
                        <p className="text-sm font-black text-white">{c.client_name}</p>
                        <p className="text-[10px] text-white/40">
                          {c.contract_type==='INSTALLMENT'?`Parcelado ${c.total_installments}x`:c.contract_type==='SALE'?'Venda':'Rotativo'}
                          {' · '}R$ {Number(c.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                          {c.contract_type!=='SALE' && c.interest_rate_monthly > 0 ? ` · ${(c.interest_rate_monthly*100).toFixed(1)}% a.m.` : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={async()=>{try{await api.approveContract(c.id);await loadAll();await loadNotifications();}catch(e:any){alert(e.message);}}}
                          className="flex items-center justify-center gap-1.5 py-2 bg-[#2563eb] border border-[#3b82f6]/30 text-white font-black rounded-2xl text-xs">
                          <ThumbsUp size={11}/> Aprovar
                        </button>
                        <button onClick={()=>setRejectTarget(c)}
                          className="flex items-center justify-center gap-1.5 py-2 bg-red-600/80 text-white font-black rounded-xl text-xs">
                          <ThumbsDown size={11}/> Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {notifications.filter((n:any)=>!n.read).length > 0 && (
                <button onClick={async()=>{await api.markNotificationsRead();setNotifications(prev=>prev.map(n=>({...n,read:true})));}}
                  className="w-full py-2 text-xs text-white/40 font-bold border border-[#2563eb]/80 rounded-xl">
                  Marcar todas como lidas
                </button>
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.length === 0 && <p className="text-center text-white/30 text-sm py-8">Nenhuma notificação</p>}
                {notifications.map((n:any)=>(
                  <div key={n.id} className={`rounded-xl p-3 border transition-all ${n.read?'bg-white/[0.02] border-[#1e3a8a60] opacity-60':'bg-[#1e3a8a]/40 border-white/[0.10]'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type==='PAYMENT'?'bg-[#3b82f6]/15 text-[#3b82f6]':n.type==='NEW_CONTRACT'?'bg-[#1e3a8a]/60 text-[#3b82f6]/70':n.type==='NEW_CLIENT'?'bg-purple-500/20 text-purple-400':n.type==='CONTRACT_APPROVED'?'bg-[#3b82f6]/15 text-[#3b82f6]':'bg-red-500/20 text-red-400'}`}>
                        {n.type==='PAYMENT'?<DollarSign size={11}/>:n.type==='NEW_CONTRACT'?<FileText size={11}/>:n.type==='NEW_CLIENT'?<Users size={11}/>:n.type==='CONTRACT_APPROVED'?<CheckCircle2 size={11}/>:<XCircle size={11}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white">{n.title}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">{n.body}</p>
                        <p className="text-[9px] text-white/20 mt-1">{n.creator_name && `${n.creator_name} · `}{format(new Date(n.created_at),'dd/MM HH:mm')}</p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1 flex-shrink-0"/>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {/* ── REJECT CONTRACT ───────────────────────────────── */}
        {rejectTarget && (
          <Modal title="Recusar Empréstimo" onClose={()=>{setRejectTarget(null);setRejectReason('');}}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm font-black text-white">{rejectTarget.client_name}</p>
                <p className="text-xs text-white/40">R$ {Number(rejectTarget.capital).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
              </div>
              <div><label className={lbl}>Motivo (opcional)</label>
                <input type="text" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Ex: documentação incompleta..." className={inp}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>{setRejectTarget(null);setRejectReason('');}} className="bg-[#1e3a8a]/40 border border-[#1e3a8a] text-white font-black py-3 rounded-xl text-sm">Cancelar</button>
                <button onClick={async()=>{try{await api.rejectContract(rejectTarget.id,rejectReason);setRejectTarget(null);setRejectReason('');await loadAll();await loadNotifications();}catch(e:any){alert(e.message);}}} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">Confirmar Recusa</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ── DELETE CLIENT MODAL ─────────────────── */}
        {deleteClientModal && (
          <Modal title="Excluir Cliente" onClose={()=>setDeleteClientModal(null)}>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-black text-white mb-1">{deleteClientModal.name}</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Isso remove o cliente permanentemente. Contratos e pagamentos vinculados também serão excluídos.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setDeleteClientModal(null)}
                  className="bg-[#1e3a8a]/40 text-white font-black py-3 rounded-xl text-sm border border-[#1e3a8a]">
                  Cancelar
                </button>
                <button onClick={async()=>{
                  try {
                    await api.deleteClient(deleteClientModal.id);
                    setDeleteClientModal(null);
                    loadAll();
                  } catch(e:any) { alert(e.message); }
                }} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">
                  Excluir
                </button>
              </div>
            </div>
          </Modal>
        )}

        {deleteModal&&<Modal title="Confirmar Exclusão" onClose={()=>setDeleteModal(null)}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3"><AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/><p className="text-xs text-white/50 leading-relaxed">Isso apaga permanentemente o empréstimo, ciclos e pagamentos. O cliente permanece cadastrado no sistema.</p></div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setDeleteModal(null)} className="bg-[#1e3a8a]/40 text-white font-black py-3 rounded-xl text-sm border border-[#1e3a8a]">Cancelar</button>
              <button onClick={async()=>{ try{await api.deleteContract(deleteModal);setDeleteModal(null);loadAll();}catch(e:any){alert(e.message);} }} className="bg-red-600 text-white font-black py-3 rounded-xl text-sm">Excluir</button>
            </div>
          </div>
        </Modal>}
      </AnimatePresence>
    </div>
  );
}