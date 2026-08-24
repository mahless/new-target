/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * External Processing Offices Management View
 * Office Balances, Payment Settlements & Ledger Integration
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebounce } from '../../hooks/useDebounce';
import { storage } from '../../lib/storage';
import { ExternalOffice, ExternalOfficeTransaction } from '../../types';
import {
  Building,
  PlusCircle,
  ArrowUpRight,
  Phone,
  Wallet,
  DollarSign,
  Calendar,
  Save,
  Printer,
  Sparkles,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const ExternalOfficesView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    financialViewScope,
    externalOffices,
    drawerBalance,
    stats,
    refreshData,
    showToast,
    generateIdempotencyKey,
  } = useApp();

  const [isNewOfficeModalOpen, setIsNewOfficeModalOpen] = useState(false);
  const [isEditOfficeModalOpen, setIsEditOfficeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  
  const [selectedOfficeForStatement, setSelectedOfficeForStatement] = useState<ExternalOffice | null>(null);
  const [targetOfficeForPayout, setTargetOfficeForPayout] = useState<ExternalOffice | null>(null);
  const [targetOfficeForAction, setTargetOfficeForAction] = useState<ExternalOffice | null>(null);

  // New Office Form
  const [officeName, setOfficeName] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [officeSpecialty, setOfficeSpecialty] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');

  // Payout Form
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredOffices = useMemo(() => {
    return externalOffices.filter(
      o =>
        o.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        o.phone.includes(debouncedSearchQuery) ||
        (o.specialty && o.specialty.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
    );
  }, [externalOffices, debouncedSearchQuery]);

  const totalOfficesPayable = useMemo(() => {
    return externalOffices.reduce((sum, o) => sum + Number(o.balance || 0), 0);
  }, [externalOffices]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // 1. Create New External Office
  const handleCreateOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName.trim() || !officePhone.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إدخال اسم ورقم هاتف المكتب الخارجي.');
      return;
    }

    try {
      setIsSubmitting(true);
      storage.createExternalOffice({
        name: officeName.trim(),
        phone: officePhone.trim(),
        specialty: officeSpecialty.trim() || undefined,
        address: officeAddress.trim() || undefined,
        openingBalance: Number(openingBalance) || 0,
      });

      refreshData();
      showToast('success', 'تم تسجيل المكتب الخارجي', `تم إضافة ${officeName} بنجاح.`);
      setIsNewOfficeModalOpen(false);
      setOfficeName('');
      setOfficePhone('');
      setOfficeSpecialty('');
      setOfficeAddress('');
      setOpeningBalance('0');
    } catch (err: any) {
      showToast('error', 'فشل إضافة المكتب', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOfficeForAction || !officeName.trim() || !officePhone.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إكمال البيانات الأساسية.');
      return;
    }

    try {
      setIsSubmitting(true);
      storage.saveExternalOffice({
        id: targetOfficeForAction.id,
        name: officeName.trim(),
        phone: officePhone.trim(),
        specialty: officeSpecialty.trim() || undefined,
        address: officeAddress.trim() || undefined,
        is_active: targetOfficeForAction.is_active,
      });

      refreshData();
      showToast('success', 'تم تعديل المكتب', `تم تحديث بيانات المكتب بنجاح.`);
      setIsEditOfficeModalOpen(false);
      setTargetOfficeForAction(null);
    } catch (err: any) {
      showToast('error', 'فشل تعديل المكتب', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffice = () => {
    if (!targetOfficeForAction) return;
    try {
      setIsSubmitting(true);
      const res = storage.deleteExternalOffice(targetOfficeForAction.id);
      if (res.success) {
        showToast('success', 'تم الحذف', `تم حذف/إيقاف المكتب بنجاح.`);
        refreshData();
        setIsDeleteModalOpen(false);
        setTargetOfficeForAction(null);
      } else {
        showToast('error', 'خطأ في الحذف', res.error || 'حدث خطأ غير متوقع');
      }
    } catch (err: any) {
      showToast('error', 'فشل الحذف', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Pay External Office Settlement
  const handleRecordPayout = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.max(0, Number(payoutAmount) || 0);

    if (!targetOfficeForPayout || numAmount <= 0) {
      showToast('error', 'مبلغ غير صالح', 'يرجى إدخال مبلغ سداد صحيح.');
      return;
    }

    if (numAmount > drawerBalance) {
      showToast('error', 'رصيد غير كافٍ', `لا يمكنك سداد مبلغ (${numAmount}) أكبر من الرصيد المتوفر بالخزينة (${drawerBalance}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = generateIdempotencyKey('off-payout');

      const officeTxns = storage.getExternalOfficeTransactions(targetOfficeForPayout.id);
      const pendingOrderTxn = officeTxns.find(t => t.type === 'service_order_cost' && t.reference_id);

      storage.recordExternalOfficePayment({
        officeId: targetOfficeForPayout.id,
        amount: numAmount,
        relatedOrderId: pendingOrderTxn?.reference_id,
        notes: payoutNotes.trim() || undefined,
        idempotencyKey,
        branchId: activeBranch?.id,
        employeeId: activeEmployee?.id,
      });

      refreshData();
      showToast(
        'success',
        'تم سداد مستحقات المكتب',
        `تم خصم ${numAmount} من درج فرع ${activeBranch?.name} وسدادها للمكتب الخارجي ${targetOfficeForPayout.name}.`
      );

      setIsPayoutModalOpen(false);
      setPayoutAmount('');
      setPayoutNotes('');
      setTargetOfficeForPayout(null);
    } catch (err: any) {
      showToast('error', 'فشل السداد', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Statement
  const officeStatement = useMemo(() => {
    if (!selectedOfficeForStatement) return [];
    return storage.getExternalOfficeTransactions(selectedOfficeForStatement.id);
  }, [selectedOfficeForStatement, externalOffices]);

  return (
    <div id="external-offices-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">المكاتب الخارجية</h2>
          </div>
        </div>

        {activeEmployee?.role === 'manager' && (
          <button
            onClick={() => setIsNewOfficeModalOpen(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة مكتب خارجي</span>
          </button>
        )}
      </div>

      {/* Ribbon Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">إجمالي مستحقات المكاتب الخارجية</div>
          <div className="text-2xl font-black text-rose-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalOfficesPayable)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">مبالغ مستحقة على مكتبنا للمكاتب المنفذة</p>
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

      {/* Grid of Offices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOffices.map(office => (
          <div
            key={office.id}
            className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all"
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  {office.name}
                  {!office.is_active && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">موقوف</span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {office.specialty && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                      {office.specialty}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetOfficeForAction(office);
                      setOfficeName(office.name);
                      setOfficePhone(office.phone);
                      setOfficeSpecialty(office.specialty || '');
                      setOfficeAddress(office.address || '');
                      setIsEditOfficeModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-colors"
                    title="تعديل المكتب"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetOfficeForAction(office);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                    title="حذف المكتب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-400 mt-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono">{office.phone}</span>
                </div>
                {office.address && (
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span>{office.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">مستحقات المكتب (دائن):</span>
                <span className="text-base font-black font-mono text-rose-400">
                  {formatCurrency(office.balance || 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setTargetOfficeForPayout(office);
                  setIsPayoutModalOpen(true);
                }}
                className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>سداد مستحقات</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOfficeForStatement(office)}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl text-xs transition-colors"
              >
                كشف حساب
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Payout Modal */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title="سداد مستحقات مكتب خارجي وخصم من الخزينة"
        subtitle={`المكتب: ${targetOfficeForPayout?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayout} className="space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-400">إجمالي مستحقات المكتب الحالية:</span>
            <span className="font-bold font-mono text-rose-400">
              {formatCurrency(targetOfficeForPayout?.balance || 0)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              مبلغ السداد المنصرف <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={payoutAmount}
              onChange={(e) => {
                let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                val = val.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                  val = val.replace(/^0+/, '');
                }
                if (val === '') val = '0';
                setPayoutAmount(val);
              }}
              placeholder="0.00"
              className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-rose-400 focus:border-rose-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              * سيتم الخصم مباشرة من درج نقدية فرع:{' '}
              <span className="text-emerald-400 font-bold">{activeBranch?.name}</span>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              ملاحظات أو رقم إيصال الاستلام:
            </label>
            <input
              type="text"
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: سداد نقدي لأتعاب استخراج 3 شهادات ميلاد"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting || Number(payoutAmount) <= 0}
              className={`flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md ${
                isSubmitting || Number(payoutAmount) <= 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save className="w-4 h-4" />
              <span>تأكيد صرف وسداد المبلغ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPayoutModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Office Account Statement Modal */}
      <Modal
        isOpen={Boolean(selectedOfficeForStatement)}
        onClose={() => setSelectedOfficeForStatement(null)}
        title={`كشف حساب تفصيلي: ${selectedOfficeForStatement?.name}`}
        subtitle={`المستحقات الحالية: ${formatCurrency(selectedOfficeForStatement?.balance || 0)}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3">التاريخ</th>
                  <th className="py-2 px-3">نوع الحركة</th>
                  <th className="py-2 px-3">البيان</th>
                  <th className="py-2 px-3 text-center">استحقاق للمكتب (+)</th>
                  <th className="py-2 px-3 text-center">سداد مدفوع (-)</th>
                  <th className="py-2 px-3 text-left">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {officeStatement.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      لا توجد حركات مسجلة لهذا المكتب.
                    </td>
                  </tr>
                ) : (
                  officeStatement.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {new Date(tx.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                      </td>
                      <td className="py-2.5 px-3">
                        {tx.type === 'service_order_cost' ? (
                          <span className="text-rose-400 font-bold">تنفيذ معاملة</span>
                        ) : tx.type === 'office_payout' ? (
                          <span className="text-emerald-400 font-bold">سداد نقدية</span>
                        ) : (
                          <span className="text-slate-300">رصيد افتتاحي</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{tx.notes || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-400">
                        {tx.amount > 0 ? formatCurrency(tx.amount) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                        {tx.amount < 0 ? formatCurrency(Math.abs(tx.amount)) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-200">
                        {formatCurrency(tx.balance_after || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف الحساب</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOfficeForStatement(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>

      {/* Add New Office Modal */}
      <Modal
        isOpen={isNewOfficeModalOpen}
        onClose={() => setIsNewOfficeModalOpen(false)}
        title="إضافة مكتب خارجي جديد"
        subtitle="تسجيل منفذ تنفيذ خارجي"
        maxWidth="md"
      >
        <form onSubmit={handleCreateOffice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم المكتب الخارجي <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: مكتب النصر للاستخراج والتصديقات"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف <span className="text-rose-400">*</span>:
              </label>
              <input
                type="tel"
                required
                value={officePhone}
                onChange={(e) => setOfficePhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="01xxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">التخصص:</label>
              <input
                type="text"
                value={officeSpecialty}
                onChange={(e) => setOfficeSpecialty(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="مثال: سجل مدني، تصديقات خارجية"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان:</label>
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="العنوان التفصيلي"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md"
            >
              حفظ المكتب الخارجي
            </button>
            <button
              type="button"
              onClick={() => setIsNewOfficeModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Office Modal */}
      <Modal
        isOpen={isEditOfficeModalOpen}
        onClose={() => {
          setIsEditOfficeModalOpen(false);
          setTargetOfficeForAction(null);
        }}
        title="تعديل بيانات المكتب"
        subtitle="تحديث المعلومات الأساسية للمكتب"
        maxWidth="md"
      >
        <form onSubmit={handleEditOffice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم المكتب الخارجي <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف <span className="text-rose-400">*</span>:
              </label>
              <input
                type="tel"
                required
                value={officePhone}
                onChange={(e) => setOfficePhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">التخصص:</label>
              <input
                type="text"
                value={officeSpecialty}
                onChange={(e) => setOfficeSpecialty(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان:</label>
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {targetOfficeForAction && (
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="officeActive"
                checked={targetOfficeForAction.is_active}
                onChange={(e) => setTargetOfficeForAction({...targetOfficeForAction, is_active: e.target.checked})}
                className="w-4 h-4 text-amber-500 bg-slate-950 border-slate-700 rounded focus:ring-amber-500"
              />
              <label htmlFor="officeActive" className="text-xs text-slate-300 font-bold">
                تنشيط حساب المكتب (يظهر في القوائم)
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md"
            >
              حفظ التعديلات
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditOfficeModalOpen(false);
                setTargetOfficeForAction(null);
              }}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTargetOfficeForAction(null);
        }}
        title="تأكيد الحذف"
        subtitle="هل أنت متأكد من رغبتك في حذف هذا المكتب؟"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-bold leading-relaxed">
            تنبيه: سيتم حذف المكتب نهائياً إذا لم تكن هناك طلبات أو حركات مرتبطة به. وإذا كانت هناك حركات، سيتم إيقاف حسابه بدلاً من الحذف لضمان سلامة السجلات المالية.
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleDeleteOffice}
              disabled={isSubmitting}
              className="flex-1 flex justify-center items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-bold py-2 rounded-xl text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>تأكيد الحذف</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setTargetOfficeForAction(null);
              }}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
