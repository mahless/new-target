/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Daily Closing & Cash Reconciliation Module
 * System vs Physical Cash Audit, Variance Analysis & Roll-over / Payout
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { DailyClosing } from '../../types';
import {
  Lock,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Wallet,
  Receipt,
  TrendingUp,
  Printer,
  Save,
  ArrowRightLeft,
  Sparkles,
  User,
  Building2,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const DailyClosingView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    dailyClosings: closings,
    ledger,
    drawerBalance,
    employeeDrawerBalance,
    branchDrawerBalance,
    financialViewScope,
    setFinancialViewScope,
    refreshData,
    showToast,
    generateIdempotencyKey,
    branches,
  } = useApp();

  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [closingType, setClosingType] = useState<'carry_over' | 'payout_to_main'>('carry_over');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClosingForPrint, setSelectedClosingForPrint] = useState<DailyClosing | null>(null);

  // Compute today's operational cash movements based on active scope (employee vs branch)
  const activeLedger = useMemo(() => {
    return storage.getLedger(
      activeBranch?.id,
      financialViewScope === 'employee' ? activeEmployee?.id : undefined
    );
  }, [activeBranch, activeEmployee, financialViewScope, ledger]);

  // System calculated balance for active scope
  const systemCalculatedBalance = financialViewScope === 'employee' ? employeeDrawerBalance : branchDrawerBalance;

  // Actual count
  const actualCash = actualCashInput !== '' ? Number(actualCashInput) : systemCalculatedBalance;
  const difference = Number((actualCash - systemCalculatedBalance).toFixed(2));

  const today = new Date().toISOString().split('T')[0];
  const todayLedger = activeLedger.filter(l => l.created_at.startsWith(today));

  const totalIn = todayLedger
    .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);

  const totalOut = todayLedger
    .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
    .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

  const handlePerformClosing = (e: React.FormEvent) => {
    e.preventDefault();

    if (actualCashInput === '' || isNaN(Number(actualCashInput))) {
      showToast('error', 'الجرد الفعلي', 'يرجى إدخال مبلغ الجرد الفعلي للخزينة.');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = generateIdempotencyKey('closing-run');

      const closing = storage.performDailyClosing({
        actualCash,
        closingType,
        notes: notes.trim() || undefined,
        idempotencyKey,
        branchId: activeBranch?.id,
        employeeId: activeEmployee?.id,
      });

      refreshData();
      showToast(
        'success',
        'تم الإغلاق اليومي بنجاح',
        `تم اعتماد التسوية اليومية لفرع ${activeBranch?.name}.`
      );

      setSelectedClosingForPrint(closing);
      setActualCashInput('0');
      setNotes('');
    } catch (err: any) {
      showToast('error', 'فشل الإغلاق اليومي', err.message);
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
    <div id="daily-closing-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">
              {financialViewScope === 'employee' ? 'تسوية وإغلاق عهدة الموظف اليومية' : 'الإغلاق والتسوية اليومية لخزينة الفرع'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {financialViewScope === 'employee'
              ? `تسوية النقدية المقبوضة بيدك كمسؤول عمليات: ${activeEmployee?.name}`
              : `الجرد والتسوية الشاملة لكافة متحصلات وخزينة فرع: ${activeBranch?.name}`}
          </p>
        </div>

        {/* Scope Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            onClick={() => setFinancialViewScope('employee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              financialViewScope === 'employee'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>تسوية عهدتي ({activeEmployee?.name?.split(' ')[0] || 'الموظف'})</span>
          </button>
          <button
            onClick={() => setFinancialViewScope('branch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              financialViewScope === 'branch'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>تسوية خزينة الفرع</span>
          </button>
        </div>
      </div>

      {/* Live Reconciliation Worksheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Worksheet Computation Box */}
        <div className="lg:col-span-7 bg-slate-900/90 border-2 border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-black text-slate-100">
                ورقة تسوية اليوم
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Shift Reconciliation</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>إجمالي المقبوضات النقدية المسجلة:</span>
              </span>
              <span className="font-bold font-mono text-emerald-400 text-sm">
                +{formatCurrency(totalIn)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-400" />
                <span>إجمالي المنصرفات النقدية المسجلة:</span>
              </span>
              <span className="font-bold font-mono text-rose-400 text-sm">
                -{formatCurrency(totalOut)}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 rounded-xl bg-slate-950 border border-amber-500/30">
              <div>
                <span className="text-slate-300 font-bold block">
                  الرصيد الدفتري المحسوب (System Balance):
                </span>
                <span className="text-[11px] text-slate-500">
                  حاصل كافة قيود دفتر الأستاذ بالدرج
                </span>
              </div>
              <span className="font-black font-mono text-amber-400 text-xl">
                {formatCurrency(systemCalculatedBalance)}
              </span>
            </div>
          </div>

          {/* Variance Warning Indicator */}
          {actualCashInput !== '' && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                difference === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : difference > 0
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {difference === 0
                      ? 'الرصيد الفعلي متطابق تماماً مع الدفتري'
                      : difference > 0
                      ? 'يوجد زيادة نقدية فعلية بالخزينة'
                      : 'يوجد عجز نقدي في الخزينة'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {difference === 0
                      ? 'لا توجد فروقات مالية'
                      : difference > 0
                      ? `فائض نقدي قدره ${formatCurrency(difference)}`
                      : `عجز نقدي قدره ${formatCurrency(Math.abs(difference))}`}
                  </div>
                </div>
              </div>
              <span className="font-mono font-black text-base">{formatCurrency(difference)}</span>
            </div>
          )}
        </div>

        {/* Right Col: Closing Action Form */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-black text-slate-100 pb-2 border-b border-slate-800">
            تأكيد الجرد واعتماد الإغلاق
          </h3>

          <form onSubmit={handlePerformClosing} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                مبلغ الجرد الفعلي للنقدية (عد الكاش الحاضر) <span className="text-rose-400">*</span>:
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={actualCashInput}
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
                    setActualCashInput(val);
                  }}
                  placeholder={systemCalculatedBalance.toString()}
                  className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-3.5 py-3 text-lg font-black font-mono text-amber-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setActualCashInput(systemCalculatedBalance.toString())}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-1 rounded"
                >
                  مطابق للدفتري
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                طريقة معالجة الرصيد بعد الإغلاق:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="closing_type"
                    checked={closingType === 'carry_over'}
                    onChange={() => setClosingType('carry_over')}
                    className="text-amber-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">
                      إبقاء النقدية بالدرج (ترحيل كـ Opening Balance)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يظل المبلغ بالدرج كعهدة تشغيل لليوم التالي
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="closing_type"
                    checked={closingType === 'payout_to_main'}
                    onChange={() => setClosingType('payout_to_main')}
                    className="text-amber-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">
                      توريد وتصفير الدرج (توريد للخزينة الرئيسية)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يتم سحب النقدية بالكامل ويبدأ اليوم التالي بصفر
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                ملاحظات التسوية وأسباب الفروقات:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="أدخل أي ملاحظات على الوردية أو تبرير العجز/الزيادة"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || actualCashInput === ''}
              className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3 rounded-xl text-xs shadow-lg transition-all ${
                isSubmitting || actualCashInput === '' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>اعتماد الإغلاق والتسوية اليومية</span>
            </button>
          </form>
        </div>
      </div>

      {/* Historical Closings Archive */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-100 pb-3 border-b border-slate-800">
          أرشيف سجلات الإغلاق اليومي السابقة
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">تاريخ الإغلاق</th>
                <th className="py-3 px-4 font-semibold">الفرع</th>
                <th className="py-3 px-4 font-semibold">الموظف القائم بالإغلاق</th>
                <th className="py-3 px-4 font-semibold">الرصيد الدفتري</th>
                <th className="py-3 px-4 font-semibold">الجرد الفعلي</th>
                <th className="py-3 px-4 font-semibold">الفارق</th>
                <th className="py-3 px-4 font-semibold">المعالجة</th>
                <th className="py-3 px-4 font-semibold text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    لا توجد إغلاقات يومية مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                closings.map(c => {
                  const b = branches.find(item => item.id === c.branch_id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {new Date(c.closing_date).toLocaleDateString('ar-EG-u-nu-latn')}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-200">{b?.name}</td>
                      <td className="py-3.5 px-4 text-slate-300">{c.employee_name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatCurrency(c.system_calculated_balance)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {formatCurrency(c.actual_cash_count)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {c.difference === 0 ? (
                          <span className="text-slate-400">متطابق</span>
                        ) : c.difference > 0 ? (
                          <span className="text-sky-400">+{formatCurrency(c.difference)}</span>
                        ) : (
                          <span className="text-rose-400">-{formatCurrency(Math.abs(c.difference))}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-400">
                        {c.closing_type === 'carry_over' ? 'ترحيل كرصيد افتتاح' : 'توريد للخزينة'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedClosingForPrint(c)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition-colors"
                        >
                          معاينة وطباعة
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Closing Statement Modal */}
      <Modal
        isOpen={Boolean(selectedClosingForPrint)}
        onClose={() => setSelectedClosingForPrint(null)}
        title="تقرير الإغلاق والتسوية اليومية"
        subtitle={`فرع: ${branches.find(b => b.id === selectedClosingForPrint?.branch_id)?.name}`}
        maxWidth="lg"
      >
        {selectedClosingForPrint && (
          <div className="space-y-4">
            <div
              id="printable-closing-report"
              className="p-5 bg-white text-slate-900 rounded-xl border border-slate-200 text-xs space-y-4"
            >
              <div className="text-center border-b pb-3 border-slate-200">
                <h2 className="text-base font-black">تارجت للخدمات الحكومية</h2>
                <p className="text-slate-600 font-bold">محضر جرد وإغلاق وردية رسمية</p>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  تاريخ التسوية: {new Date(selectedClosingForPrint.closing_date).toLocaleDateString('ar-EG-u-nu-latn')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">الفرع:</span>{' '}
                  <span className="font-bold">
                    {branches.find(b => b.id === selectedClosingForPrint.branch_id)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">المسؤول عن الإغلاق:</span>{' '}
                  <span className="font-bold">{selectedClosingForPrint.employee_name}</span>
                </div>
              </div>

              <div className="border-t border-b py-3 border-slate-200 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span>الرصيد الدفتري المحسوب بالمنظومة:</span>
                  <span className="font-bold">
                    {formatCurrency(selectedClosingForPrint.system_calculated_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>الجرد الفعلي للنقدية الحاضرة:</span>
                  <span className="font-bold">
                    {formatCurrency(selectedClosingForPrint.actual_cash_count)}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>الفارق المالي (عجز / زيادة):</span>
                  <span>{formatCurrency(selectedClosingForPrint.difference)}</span>
                </div>
              </div>

              {selectedClosingForPrint.notes && (
                <div>
                  <span className="text-slate-500">الملاحظات:</span>
                  <p className="font-medium mt-0.5">{selectedClosingForPrint.notes}</p>
                </div>
              )}

              <div className="pt-6 grid grid-cols-2 text-center text-[11px]">
                <div>توقيع الموظف المسؤول: ________________</div>
                <div>اعتماد مدير الفرع: ________________</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة المحضر</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedClosingForPrint(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
