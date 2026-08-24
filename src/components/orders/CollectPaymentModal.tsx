/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Partial Payment Collection Modal
 * Independent Transactions, Cash vs Electronic Split, Idempotency Protected
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { ServiceOrder } from '../../types';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';
import { Wallet, Smartphone, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface CollectPaymentModalProps {
  order: ServiceOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { activeBranch, activeEmployee, refreshData, showToast, generateIdempotencyKey } = useApp();

  const [cashAmount, setCashAmount] = useState<string>('0');
  const [electronicAmount, setElectronicAmount] = useState<string>('0');
  const [electronicType, setElectronicType] = useState<'instapay' | 'wallet' | 'pos'>('instapay');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (order && isOpen) {
      setCashAmount(order.remaining.toString());
      setElectronicAmount('0');
      setNotes(`سداد متبقي في ${activeBranch?.name}`);
      setIdempotencyKey(generateIdempotencyKey('pmt-collect'));
    }
  }, [order, isOpen, activeBranch, generateIdempotencyKey]);

  if (!order) return null;

  const numCash = Math.max(0, Number(cashAmount) || 0);
  const numElectronic = Math.max(0, Number(electronicAmount) || 0);
  const totalPayment = Number((numCash + numElectronic).toFixed(2));
  const newRemaining = Number((order.remaining - totalPayment).toFixed(2));

  const handleFillAllCash = () => {
    setCashAmount(order.remaining.toString());
    setElectronicAmount('0');
  };

  const handleFillAllElectronic = () => {
    setElectronicAmount(order.remaining.toString());
    setCashAmount('0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (totalPayment <= 0) {
      showToast('error', 'خطأ في القيمة', 'يرجى إدخال مبلغ صحيح للتحصيل.');
      return;
    }

    if (totalPayment > order.remaining) {
      showToast(
        'error',
        'تجاوز المتبقي',
        `المبلغ المدخل (${totalPayment}) أكبر من المبلغ المتبقي (${order.remaining}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      storage.recordAdditionalPayment({
        orderId: order.id,
        cashAmount: numCash,
        electronicAmount: numElectronic,
        electronicType: numElectronic > 0 ? electronicType : null,
        notes: notes.trim(),
        idempotencyKey,
        branchId: activeBranch?.id,
        employeeId: activeEmployee?.id,
      });

      refreshData();
      showToast(
        'success',
        'تم تحصيل الدفعة بنجاح',
        `تم قيد تحصيل ${totalPayment} على طلب ${order.order_number} في فرع ${activeBranch?.name}.`
      );
      onClose();
    } catch (err: any) {
      showToast('error', 'فشل التحصيل', err.message || 'حدث خطأ أثناء قيد الدفعة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحصيل دفعة جديدة من المتبقي"
      subtitle={`المعاملة: ${order.order_number} • العميل: ${order.customer_name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order Summary Pill */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>سعر الخدمة الإجمالي:</span>
            <span className="font-bold font-mono text-slate-200">{formatCurrency(order.price)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>المدفوع سابقاً:</span>
            <span className="font-bold font-mono text-emerald-400">
              {formatCurrency(order.total_paid)}
            </span>
          </div>
          <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-800">
            <span>المتبقي الحالي:</span>
            <span className="font-mono text-sm">{formatCurrency(order.remaining)}</span>
          </div>
        </div>

        {/* Payment Split Inputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              <span>المدفوع كاش (يُضاف لدرج {activeBranch?.name}):</span>
            </label>
            <button
              type="button"
              onClick={handleFillAllCash}
              className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-500/30 font-bold"
            >
              كامل المتبقي
            </button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={cashAmount}
            onChange={(e) => {
              let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
              val = val.replace(/[^0-9.]/g, '');
              const parts = val.split('.');
              if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
              if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                val = val.replace(/^0+/, '');
              }
              if (val === '') val = '0';
              setCashAmount(val);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1">
            <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>المدفوع إلكتروني:</span>
            </label>
            <button
              type="button"
              onClick={handleFillAllElectronic}
              className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded hover:bg-sky-500/30 font-bold"
            >
              كامل المتبقي
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <input
              type="text"
              inputMode="decimal"
              value={electronicAmount}
              onChange={(e) => {
                let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                val = val.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                  val = val.replace(/^0+/, '');
                }
                if (val === '') val = '0';
                setElectronicAmount(val);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-sky-400 focus:border-sky-500 focus:outline-none"
            />
            <ModalSelect
              modalTitle="وسيلة الدفع الإلكتروني"
              modalSubtitle="اختر نوع القناة الإلكترونية المستخدمة"
              value={electronicType}
              onChange={(val) => setElectronicType(val as any)}
              options={[
                { value: 'instapay', label: 'InstaPay' },
                { value: 'wallet', label: 'محفظة إلكترونية' },
                { value: 'pos', label: 'نقطة بيع POS' },
              ]}
              buttonClassName="!py-2.5"
            />
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">المتبقي بعد هذه الدفعة:</span>
          <span
            className={`font-bold font-mono text-sm ${
              newRemaining > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {formatCurrency(newRemaining)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">بيان أو ملاحظات الدفعة:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pt-3">
          <button
            type="submit"
            disabled={isSubmitting || totalPayment <= 0}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${
              isSubmitting || totalPayment <= 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>تأكيد وقيد التحصيل</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
};
