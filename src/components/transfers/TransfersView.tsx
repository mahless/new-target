/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Inter-Branch Cash Transfers View
 * Sender Immediate Deduction & Receiver Two-Phase Commitment Ledger
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { BranchTransfer } from '../../types';
import {
  ArrowLeftRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Wallet,
  Save,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';

export const TransfersView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    branches,
    employees,
    transfers,
    drawerBalance,
    refreshData,
    showToast,
    generateIdempotencyKey,
  } = useApp();

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [toBranchId, setToBranchId] = useState('');
  const [amount, setAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numAmount = Math.max(0, Number(amount) || 0);

  // Filter transfers for current branch (either sender or receiver)
  const incomingPendingTransfers = useMemo(() => {
    return transfers.filter(
      t => t.to_branch_id === activeBranch?.id && t.status === 'pending'
    );
  }, [transfers, activeBranch]);

  const handleSendTransfer = (e: React.FormEvent) => {
    e.preventDefault();

    if (!toBranchId) {
      showToast('error', 'الفرع المستلم', 'يرجى اختيار الفرع المستلم للنقدية.');
      return;
    }
    if (toBranchId === activeBranch?.id) {
      showToast('error', 'خطأ في التحويل', 'لا يمكن التحويل لنفس الفرع.');
      return;
    }
    if (numAmount <= 0) {
      showToast('error', 'مبلغ غير صالح', 'يرجى إدخال مبلغ تحويل صحيح.');
      return;
    }
    if (numAmount > drawerBalance) {
      showToast(
        'error',
        'رصيد غير كافٍ',
        `رصيد درج الفرع (${drawerBalance}) لا يكفي لإتمام تحويل مبلغ ${numAmount}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = generateIdempotencyKey('trf-send');

      storage.sendBranchTransfer({
        toBranchId,
        amount: numAmount,
        notes: notes.trim() || undefined,
        idempotencyKey,
        fromBranchId: activeBranch?.id,
        senderEmployeeId: activeEmployee?.id,
      });

      refreshData();
      const targetBranch = branches.find(b => b.id === toBranchId);
      showToast(
        'success',
        'تم إرسال التحويل النقدي',
        `تم خصم ${numAmount} من درج فرع ${activeBranch?.name} وإرسالها لفرع ${targetBranch?.name}.`
      );

      setIsSendModalOpen(false);
      setToBranchId('');
      setAmount('0');
      setNotes('');
    } catch (err: any) {
      showToast('error', 'فشل التحويل', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveTransfer = (transfer: BranchTransfer) => {
    const confirmRecv = window.confirm(
      `هل تؤكد استلام مبلغ ${transfer.amount} نقداً من مندوب/تحويل فرع ${
        branches.find(b => b.id === transfer.from_branch_id)?.name
      } وإيداعه بدرج فرعك؟`
    );
    if (!confirmRecv) return;

    try {
      storage.receiveBranchTransfer({
        transferId: transfer.id,
        receiverEmployeeId: activeEmployee?.id,
      });

      refreshData();
      showToast(
        'success',
        'تم استلام التحويل وإيداع النقدية',
        `تم إيداع ${transfer.amount} في درج نقدية فرع ${activeBranch?.name}.`
      );
    } catch (err: any) {
      showToast('error', 'فشل تأكيد الاستلام', err.message);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div id="transfers-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">تحويل الأموال بين الفروع</h2>
          </div>
        </div>

        <button
          onClick={() => setIsSendModalOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إرسال تحويل نقدي لفرع آخر</span>
        </button>
      </div>

      {/* Pending Incoming Transfers Action Box */}
      {incomingPendingTransfers.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertCircle className="w-4 h-4 animate-bounce" />
            <span>تحويلات نقدية واردة بانتظار تأكيد استلامك بالفرع ({incomingPendingTransfers.length}):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingPendingTransfers.map(trf => {
              const fromBranch = branches.find(b => b.id === trf.from_branch_id);
              const senderEmp = employees.find(e => e.id === trf.sender_employee_id);
              return (
                <div
                  key={trf.id}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs text-slate-400">
                      وارد من فرع: <span className="font-bold text-slate-200">{fromBranch?.name}</span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                      {formatCurrency(trf.amount)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      أرسله: {senderEmp?.name} • {new Date(trf.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                    </div>
                  </div>

                  <button
                    onClick={() => handleReceiveTransfer(trf)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all"
                  >
                    تأكيد الاستلام والإيداع
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historical Transfers List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-100 pb-3 border-b border-slate-800">
          سجل التحويلات النقدية بين الفروع
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">تاريخ الإرسال</th>
                <th className="py-3 px-4 font-semibold">من فرع</th>
                <th className="py-3 px-4 font-semibold">إلى فرع</th>
                <th className="py-3 px-4 font-semibold">المبلغ المحول</th>
                <th className="py-3 px-4 font-semibold">الموظف المرسل</th>
                <th className="py-3 px-4 font-semibold">الموظف المستلم</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    لا توجد تحويلات مسجلة بين الفروع.
                  </td>
                </tr>
              ) : (
                transfers.map(trf => {
                  const fromBranch = branches.find(b => b.id === trf.from_branch_id);
                  const toBranch = branches.find(b => b.id === trf.to_branch_id);
                  const senderEmp = employees.find(e => e.id === trf.sender_employee_id);
                  const recvEmp = employees.find(e => e.id === trf.receiver_employee_id);

                  return (
                    <tr key={trf.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(trf.created_at).toLocaleDateString('ar-EG-u-nu-latn')}{' '}
                        <span className="text-[10px] text-slate-500">
                          {new Date(trf.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-rose-400">{fromBranch?.name}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{toBranch?.name}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-slate-100 text-sm">
                        {formatCurrency(trf.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{senderEmp?.name}</td>
                      <td className="py-3.5 px-4 text-slate-300">{recvEmp?.name || '-'}</td>
                      <td className="py-3.5 px-4">
                        {trf.status === 'completed' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                            تم الاستلام والإيداع
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold animate-pulse">
                            معلق (قيد النقل)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Cash Transfer Modal */}
      <Modal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title="إرسال تحويل نقدي لفرع آخر"
        subtitle={`سيتم الخصم الفوري من درج نقدية فرع: ${activeBranch?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSendTransfer} className="space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-400">كاش الخزنة:</span>
            <span className="font-bold font-mono text-emerald-400">
              {formatCurrency(drawerBalance)}
            </span>
          </div>

          <div>
            <ModalSelect
              label="اختر الفرع المستلم:"
              required
              modalTitle="تحديد الفرع المستلم"
              modalSubtitle="اختر الفرع المحول إليه المبلغ المالي"
              value={toBranchId}
              onChange={(val) => setToBranchId(val)}
              options={branches
                .filter(b => b.is_active && b.id !== activeBranch?.id)
                .map(b => ({
                  value: b.id,
                  label: b.name,
                  badge: b.code,
                  icon: Building2,
                }))}
              placeholder="-- انقر لاختيار الفرع المحول إليه --"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              مبلغ التحويل <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                val = val.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                  val = val.replace(/^0+/, '');
                }
                if (val === '') val = '0';
                setAmount(val);
              }}
              placeholder="0.00"
              className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-amber-400 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              ملاحظات أو اسم المندوب الناقل:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: تحويل عهدة مع مندوب الفرع"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>تأكيد الإرسال وخصم الدرج</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSendModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
