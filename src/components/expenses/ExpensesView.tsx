/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Operational Expenses Management View
 * Immediate Drawer Balance Deductions, Category Tagging & Ledger Integration
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { storage, matchIds } from '../../lib/storage';
import { ExpenseCategory } from '../../types';
import {
  Receipt,
  PlusCircle,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  FileText,
  Calendar,
  Save,
  Wallet,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';

export const ExpensesView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    financialViewScope,
    branches,
    employees,
    expenses,
    orders,
    drawerBalance,
    stats,
    refreshData,
    showToast,
    generateIdempotencyKey,
  } = useApp();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('office_supplies');
  const [amount, setAmount] = useState('0');
  const [description, setDescription] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categoriesMap: Record<string, string> = {
    rent: 'إيجار المقر',
    electricity_utilities: 'كهرباء ومرافق',
    hospitality_buffet: 'بوفيه وضيافة',
    office_supplies: 'أدوات مكتبية ومطبوعات',
    maintenance: 'صيانة ونظافة',
    transportation: 'انتقالات ومواصلات',
    government_fees: 'رسوم ومصاريف حكومية',
    other: 'مصروفات أخرى',
  };

  const filteredExpenses = useMemo(() => {
    const localToday = new Date().toLocaleDateString('en-CA');
    return expenses.filter(exp => {
      try {
        const expDate = new Date(exp.created_at).toLocaleDateString('en-CA');
        if (expDate !== localToday) return false;
      } catch {
        if (!(exp.created_at || '').startsWith(localToday)) return false;
      }
      if (filterBranchId !== 'all' && exp.branch_id !== filterBranchId) return false;
      if (filterCategory !== 'all' && exp.category_name !== categoriesMap[filterCategory] && exp.category !== filterCategory) return false;
      return true;
    });
  }, [expenses, filterBranchId, filterCategory]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [filteredExpenses]);

  const numAmount = Math.max(0, Number(amount) || 0);
  const projectedBalance = drawerBalance - numAmount;

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numAmount <= 0) {
      showToast('error', 'مبلغ غير صالح', 'يرجى إدخال مبلغ مصروف صحيح أكبر من الصفر.');
      return;
    }

    if (numAmount > drawerBalance) {
      showToast('error', 'رصيد غير كافٍ', `لا يمكنك سحب مصروف (${numAmount}) أكبر من الرصيد المتوفر (${drawerBalance}).`);
      return;
    }

    if (!description.trim()) {
      showToast('error', 'بيان المصروف', 'يرجى كتابة بيان واضح للمصروف.');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = generateIdempotencyKey('exp-create');

      storage.createExpense({
        categoryName: categoriesMap[selectedCategory] || selectedCategory,
        amount: numAmount,
        notes: `${description.trim()}${receiptNumber.trim() ? ` (إيصال: ${receiptNumber.trim()})` : ''}`,
        idempotencyKey,
        branchId: activeBranch?.id,
        employeeId: activeEmployee?.id,
      });

      refreshData();
      showToast(
        'success',
        'تم تسجيل المصروف وخصم النقدية',
        `تم خصم ${numAmount} من درج فرع ${activeBranch?.name}.`
      );

      setIsRecordModalOpen(false);
      setAmount('0');
      setDescription('');
      setReceiptNumber('');
    } catch (err: any) {
      showToast('error', 'فشل تسجيل المصروف', err.message);
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
    <div id="expenses-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-black text-slate-100">المصروفات</h2>
          </div>
        </div>

        <button
          onClick={() => setIsRecordModalOpen(true)}
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>تسجيل مصروف جديد</span>
        </button>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">إجمالي مصروفات اليوم</div>
          <div className="text-2xl font-black text-rose-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalFilteredAmount)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{filteredExpenses.length} سند صرف مسجل اليوم (تتصفر يومياً)</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">
            {financialViewScope === 'employee' ? 'صافي كاش عهدتي اليوم' : `صافي كاش الخزنة اليوم ${activeBranch ? `(${activeBranch.name})` : ''}`}
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight mt-1 ${
            (stats.todayNetCash ?? (stats.todayCashIn - stats.todayCashOut)) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {formatCurrency(stats.todayNetCash ?? (stats.todayCashIn - stats.todayCashOut))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">صافي حركة نقدية اليوم (تتصفر يومياً)</p>
        </div>
      </div>

      {/* Filter and List Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-100">سجل مصروفات اليوم</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-rose-400 font-bold">
              {filteredExpenses.length} سند صرف اليوم
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <ModalSelect
              modalTitle="تصفية المصروفات حسب الفرع"
              modalSubtitle="اختر الفرع لعرض مصروفاته"
              value={filterBranchId}
              onChange={(val) => setFilterBranchId(val)}
              options={[
                { value: 'all', label: 'جميع الفروع' },
                ...branches.map(b => ({
                  value: b.id,
                  label: b.name,
                  badge: b.code,
                })),
              ]}
              buttonClassName="!py-1.5 !text-xs"
            />

            <ModalSelect
              modalTitle="تصفية حسب بند المصروف"
              modalSubtitle="اختر بند المصروفات المحدد"
              value={filterCategory}
              onChange={(val) => setFilterCategory(val)}
              options={[
                { value: 'all', label: 'جميع البنود' },
                ...Object.entries(categoriesMap).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
              buttonClassName="!py-1.5 !text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">التاريخ</th>
                <th className="py-3 px-4 font-semibold">الفرع</th>
                <th className="py-3 px-4 font-semibold">بند المصروف</th>
                <th className="py-3 px-4 font-semibold">البيان والوصف</th>
                <th className="py-3 px-4 font-semibold">رقم الفاتورة / الإيصال</th>
                <th className="py-3 px-4 font-semibold">الموظف القائم بالصرف</th>
                <th className="py-3 px-4 font-semibold text-left">المبلغ المنصرف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    لا توجد مصروفات مسجلة اليوم حتى الآن.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => {
                  const branch = branches.find(b => matchIds(b.id, exp.branch_id));
                  const employee = employees.find(e => matchIds(e.id, exp.employee_id));

                  // Resolve linked order by ID, receipt number, or notes text search
                  let relatedOrder = orders.find(o => matchIds(o.id, exp.related_order_id));
                  if (!relatedOrder && exp.receipt_number) {
                    relatedOrder = orders.find(o => o.order_number === exp.receipt_number || matchIds(o.id, exp.receipt_number));
                  }
                  if (!relatedOrder) {
                    const fullText = `${exp.notes || ''} ${exp.category_name || ''} ${exp.receipt_number || ''}`;
                    if (fullText.trim()) {
                      relatedOrder = orders.find(o => o.order_number && fullText.includes(o.order_number));
                    }
                  }

                  // Fallback: Extract order number digits pattern from text if order object not loaded
                  const textMatch = (!relatedOrder ? `${exp.notes || ''} ${exp.category_name || ''}` : '').match(/#?(\d{3,})/);
                  const fallbackOrderNum = textMatch ? textMatch[1] : null;

                  return (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(exp.created_at).toLocaleDateString('ar-EG-u-nu-latn')}{' '}
                        <span className="text-[10px] text-slate-500">
                          {new Date(exp.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-300">{branch?.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold">
                          {exp.category_name || categoriesMap[exp.category] || exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-medium">{exp.description || exp.notes}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {relatedOrder ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-400 block text-xs font-mono">
                              #{relatedOrder.order_number}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {new Date(relatedOrder.created_at).toLocaleDateString('ar-EG-u-nu-latn')}{' '}
                              <span className="text-slate-500">
                                {new Date(relatedOrder.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                              </span>
                            </span>
                          </div>
                        ) : fallbackOrderNum ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-400 block text-xs font-mono">
                              #{fallbackOrderNum}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {new Date(exp.created_at).toLocaleDateString('ar-EG-u-nu-latn')}{' '}
                              <span className="text-slate-500">
                                {new Date(exp.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                              </span>
                            </span>
                          </div>
                        ) : exp.receipt_number ? (
                          <span className="text-slate-300 font-mono">{exp.receipt_number}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{employee?.name}</td>
                      <td className="py-3.5 px-4 text-left font-mono font-black text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="تسجيل مصروف تشغيلي وخصم من الدرج"
        subtitle={`سيتم الخصم من درج نقدية فرع: ${activeBranch?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <ModalSelect
              label="بند المصروف:"
              modalTitle="اختيار بند المصروف"
              modalSubtitle="اختر التصنيف المحاسبي للمصروف التشغيلي"
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={Object.entries(categoriesMap).map(([key, label]) => ({
                value: key,
                label,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              المبلغ المنصرف <span className="text-rose-400">*</span>:
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
              className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-rose-400 focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Drawer Projection */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>رصيد الدرج قبل الصرف:</span>
              <span className="font-mono text-slate-200">{formatCurrency(drawerBalance)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-slate-800">
              <span>الرصيد بعد الخصم:</span>
              <span
                className={`font-mono ${projectedBalance < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
              >
                {formatCurrency(projectedBalance)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              بيان المصروف والسبب <span className="text-rose-400">*</span>:
            </label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: شراء ورق طباعة A4 وأحبار طابعة الفرع"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              رقم الفاتورة أو الإيصال (إن وجد):
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="رقم الفاتورة الضريبية"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className={`flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md ${isSubmitting || numAmount <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              <Save className="w-4 h-4" />
              <span>تأكيد الصرف وخصم الدرج</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
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
