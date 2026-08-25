/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Distributors & Cash Supplies Management View
 * Account Balances, Cash Inflow to Branch Drawer & Detailed Account Statements
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebounce } from '../../hooks/useDebounce';
import { storage } from '../../lib/storage';
import { Distributor, DistributorTransaction } from '../../types';
import {
  Users2,
  PlusCircle,
  ArrowDownLeft,
  FileSpreadsheet,
  Phone,
  Building,
  DollarSign,
  Wallet,
  CheckCircle2,
  Calendar,
  Save,
  Printer,
  ChevronLeft,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const DistributorsView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    distributors,
    branches,
    refreshData,
    showToast,
    generateIdempotencyKey,
  } = useApp();

  // Modals state
  const [isNewDistributorModalOpen, setIsNewDistributorModalOpen] = useState(false);
  const [isEditDistributorModalOpen, setIsEditDistributorModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  
  const [selectedDistributorForStatement, setSelectedDistributorForStatement] = useState<Distributor | null>(null);
  const [targetDistributorForSupply, setTargetDistributorForSupply] = useState<Distributor | null>(null);
  const [targetDistributorForAction, setTargetDistributorForAction] = useState<Distributor | null>(null);

  // New Distributor form state
  const [distributorName, setDistributorName] = useState('');
  const [distributorCode, setDistributorCode] = useState('');
  const [distributorPhone, setDistributorPhone] = useState('');
  const [distributorAddress, setDistributorAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');

  // Supply form state
  const [supplyAmount, setSupplyAmount] = useState('0');
  const [supplyNotes, setSupplyNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredDistributors = useMemo(() => {
    return distributors.filter(
      d =>
        d.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        d.phone.includes(debouncedSearchQuery)
    );
  }, [distributors, debouncedSearchQuery]);

  const totalDistributorsBalance = useMemo(() => {
    return distributors.reduce((sum, d) => sum + Math.max(0, Number(d.balance_due ?? d.balance ?? 0)), 0);
  }, [distributors]);

  const totalSuppliedAll = useMemo(() => {
    return distributors.reduce((sum, d) => sum + Number(d.total_supplied || 0), 0);
  }, [distributors]);

  const totalOrdersAndOpeningAll = useMemo(() => {
    return distributors.reduce((sum, d) => sum + Number(d.total_orders_value || 0), 0);
  }, [distributors]);

  const activeDistributors = useMemo(() => {
    return distributors.filter(d => d.is_active);
  }, [distributors]);

  const settledDistributorsCount = useMemo(() => {
    return activeDistributors.filter(d => Number(d.balance_due ?? d.balance ?? 0) <= 0).length;
  }, [activeDistributors]);

  const indebtedDistributorsCount = useMemo(() => {
    return activeDistributors.filter(d => Number(d.balance_due ?? d.balance ?? 0) > 0).length;
  }, [activeDistributors]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // 1. Create New Distributor
  const handleCreateDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributorName.trim() || !distributorCode.trim() || !distributorPhone.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إكمال البيانات الأساسية للموزع.');
      return;
    }

    try {
      setIsSubmitting(true);
      storage.createDistributor({
        name: distributorName.trim(),
        code: distributorCode.trim().toUpperCase(),
        phone: distributorPhone.trim(),
        address: distributorAddress.trim() || undefined,
        openingBalance: Number(openingBalance) || 0,
      });

      refreshData();
      showToast('success', 'تم تسجيل الموزع', `تم إضافة الموزع ${distributorName} بنجاح.`);
      setIsNewDistributorModalOpen(false);
      setDistributorName('');
      setDistributorCode('');
      setDistributorPhone('');
      setDistributorAddress('');
      setOpeningBalance('0');
    } catch (err: any) {
      showToast('error', 'فشل إضافة الموزع', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDistributorForAction || !distributorName.trim() || !distributorCode.trim() || !distributorPhone.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إكمال البيانات الأساسية للموزع.');
      return;
    }

    try {
      setIsSubmitting(true);
      storage.saveDistributor({
        id: targetDistributorForAction.id,
        name: distributorName.trim(),
        code: distributorCode.trim().toUpperCase(),
        phone: distributorPhone.trim(),
        address: distributorAddress.trim() || undefined,
        is_active: targetDistributorForAction.is_active,
      });

      refreshData();
      showToast('success', 'تم تعديل الموزع', `تم تعديل بيانات الموزع ${distributorName} بنجاح.`);
      setIsEditDistributorModalOpen(false);
      setTargetDistributorForAction(null);
    } catch (err: any) {
      showToast('error', 'فشل تعديل الموزع', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDistributor = () => {
    if (!targetDistributorForAction) return;
    try {
      setIsSubmitting(true);
      const res = storage.deleteDistributor(targetDistributorForAction.id);
      if (res.success) {
        showToast('success', 'تم الحذف', `تم حذف/إيقاف الموزع بنجاح.`);
        refreshData();
        setIsDeleteModalOpen(false);
        setTargetDistributorForAction(null);
      } else {
        showToast('error', 'خطأ في الحذف', res.error || 'حدث خطأ غير متوقع');
      }
    } catch (err: any) {
      showToast('error', 'فشل الحذف', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Record Cash Supply from Distributor
  const handleRecordSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numAmount = Math.max(0, Number(supplyAmount) || 0);

    if (!targetDistributorForSupply || numAmount <= 0) {
      showToast('error', 'مبلغ غير صالح', 'يرجى إدخال مبلغ توريد صحيح أكبر من الصفر.');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = generateIdempotencyKey('dist-supply');
      const distBefore = targetDistributorForSupply;
      const initialBal = Number(distBefore.balance_due ?? distBefore.balance ?? 0);
      const remainingBal = Math.max(0, initialBal - numAmount);

      storage.recordDistributorSupply({
        distributorId: targetDistributorForSupply.id,
        amount: numAmount,
        notes: supplyNotes.trim() || undefined,
        idempotencyKey,
        branchId: activeBranch?.id || "",
        employeeId: activeEmployee?.id || "",
      });

      refreshData();

      if (remainingBal === 0) {
        showToast(
          'success',
          'تم سداد كامل المديونية بنجاح',
          `تم استلام ${formatCurrency(numAmount)} ج.م وإيداعها في درج فرع ${activeBranch?.name || ''}. أصبح حساب الموزع ${distBefore.name} خالياً من أي مديونية (0.00 ج.م).`
        );
      } else {
        showToast(
          'success',
          'تم توريد النقدية بنجاح',
          `تم استلام ${formatCurrency(numAmount)} ج.م وإيداعها في درج فرع ${activeBranch?.name || ''}. المديونية المتبقية على الموزع ${distBefore.name} هي ${formatCurrency(remainingBal)} ج.م.`
        );
      }

      // Sync statement modal target if currently open
      if (selectedDistributorForStatement && selectedDistributorForStatement.id === targetDistributorForSupply.id) {
        const updatedList = storage.getDistributors();
        const updatedTarget = updatedList.find(d => d.id === targetDistributorForSupply.id);
        if (updatedTarget) setSelectedDistributorForStatement(updatedTarget);
      }

      setIsSupplyModalOpen(false);
      setSupplyAmount('0');
      setSupplyNotes('');
      setTargetDistributorForSupply(null);
    } catch (err: any) {
      showToast('error', 'فشل التوريد', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Distributor Statement Details
  const distributorStatement = useMemo(() => {
    if (!selectedDistributorForStatement) return [];
    return storage.getDistributorTransactions(selectedDistributorForStatement.id);
  }, [selectedDistributorForStatement, distributors]);

  return (
    <div id="distributors-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-black text-slate-100">الموزعون وتوريدات النقدية</h2>
          </div>
        </div>

        {activeEmployee?.role === 'manager' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNewDistributorModalOpen(true)}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة موزع جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Ribbon Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Debt Due */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-semibold">إجمالي المديونية المستحقة على الموزعين</div>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalDistributorsBalance)} ج.م
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
            <span>إجمالي المسحوبات: <strong className="text-slate-200 font-mono">{formatCurrency(totalOrdersAndOpeningAll)}</strong></span>
          </div>
        </div>

        {/* Card 2: Total Cash Supplied */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-semibold">إجمالي التوريدات النقدية (كاش)</div>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalSuppliedAll)} ج.م
          </div>
          <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
            مبالغ محصلة ومودعة في خزينة ودروج الفروع
          </div>
        </div>

        {/* Card 3: Active & Settled Distributors */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-semibold">حالة حسابات الموزعين النشطين</div>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Users2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono tracking-tight mt-1">
            {activeDistributors.length} موزع نشط
          </div>
          <div className="flex items-center gap-3 text-[11px] mt-2 pt-2 border-t border-slate-800/80">
            <span className="text-amber-400 font-bold">{indebtedDistributorsCount} عليهم مديونية</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">{settledDistributorsCount} خالصين 100%</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
          placeholder="ابحث باسم الموزع، الكود، أو رقم الهاتف..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* Distributors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDistributors.map(dist => {
          const currentBalance = Number(dist.balance_due ?? dist.balance ?? 0);
          const isSettled = currentBalance <= 0;
          const isCredit = currentBalance < 0;

          return (
            <div
              key={dist.id}
              className={`bg-slate-900/80 border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                isSettled
                  ? 'border-slate-800 hover:border-emerald-500/40'
                  : 'border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-slate-800 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      {dist.name}
                      {!dist.is_active && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">موقوف</span>
                      )}
                    </h3>
                    <div className="mt-1">
                      {isCredit ? (
                        <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
                          رصيد دائم (+{formatCurrency(Math.abs(currentBalance))})
                        </span>
                      ) : isSettled ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          خالص المديونية 100%
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                          مطلوب سداد مديونية
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-sky-400 font-bold">
                      {dist.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetDistributorForAction(dist);
                        setDistributorName(dist.name);
                        setDistributorCode(dist.code);
                        setDistributorPhone(dist.phone);
                        setDistributorAddress(dist.address || '');
                        setIsEditDistributorModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-colors"
                      title="تعديل الموزع"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetDistributorForAction(dist);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                      title="حذف الموزع"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-400 mt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono">{dist.phone}</span>
                  </div>
                  {dist.address && (
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-500" />
                      <span>{dist.address}</span>
                    </div>
                  )}
                </div>

                {/* Balance Box */}
                <div className={`mt-4 p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                  isSettled
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-amber-950/20 border-amber-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-bold">الرصيد المستحق (الصافي):</span>
                    <span className={`text-base font-black font-mono tracking-tight ${
                      isSettled ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {formatCurrency(currentBalance)} ج.م
                    </span>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">إجمالي الخدمات:</span>
                      <span className="font-mono font-bold text-slate-300">
                        {formatCurrency(dist.total_orders_value || 0)}
                      </span>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">المورد كاش:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(dist.total_supplied || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setTargetDistributorForSupply(dist);
                    setIsSupplyModalOpen(true);
                  }}
                  className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>توريد نقدية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDistributorForStatement(dist)}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl text-xs transition-colors flex items-center gap-1"
                  title="عرض كشف الحساب التفصيلي"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                  <span>كشف حساب</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Record Supply Modal */}
      <Modal
        isOpen={isSupplyModalOpen}
        onClose={() => setIsSupplyModalOpen(false)}
        title="توريد نقدية كاش من موزع"
        subtitle={`الموزع: ${targetDistributorForSupply?.name} (${targetDistributorForSupply?.code})`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordSupply} className="space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-400">إجمالي مديونية الموزع الحالية:</span>
            <span className="font-bold font-mono text-amber-400 text-sm">
              {formatCurrency(targetDistributorForSupply ? Number(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0) : 0)} ج.م
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                مبلغ التوريد النقدي <span className="text-rose-400">*</span>:
              </label>
              {targetDistributorForSupply && Number(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0) > 0 && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSupplyAmount(String(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0))}
                    className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded transition-colors"
                  >
                    سداد كامل المديونية
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplyAmount(String(Math.floor(Number(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0) / 2)))}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded transition-colors"
                  >
                    سداد النصف
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="decimal"
              required
              value={supplyAmount}
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
                setSupplyAmount(val);
              }}
              placeholder="0.00"
              className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
            />
            
            {/* Live Remaining Balance on Distributor */}
            {Number(supplyAmount) > 0 && targetDistributorForSupply && (
              <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between">
                <span className="text-slate-400">المديونية المتبقية بعد هذا التوريد:</span>
                <span className={`font-mono font-bold ${
                  Number(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0) - Number(supplyAmount) > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {formatCurrency(Math.max(0, Number(targetDistributorForSupply.balance_due ?? targetDistributorForSupply.balance ?? 0) - Number(supplyAmount)))} ج.م
                </span>
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-1.5">
              * سيتم إضافة المبلغ مباشرة إلى درج نقدية فرع:{' '}
              <span className="text-emerald-400 font-bold">{activeBranch?.name}</span>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              ملاحظات أو رقم إيصال التوريد:
            </label>
            <input
              type="text"
              value={supplyNotes}
              onChange={(e) => setSupplyNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: توريد نقدي باليد / سداد دفعة من الحساب"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={isSubmitting || Number(supplyAmount) <= 0}
              className={`flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md ${
                isSubmitting || Number(supplyAmount) <= 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save className="w-4 h-4" />
              <span>تأكيد استلام النقدية وإيداعها بالدرج</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSupplyModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Distributor Account Statement Modal */}
      <Modal
        isOpen={Boolean(selectedDistributorForStatement)}
        onClose={() => setSelectedDistributorForStatement(null)}
        title={`كشف حساب تفصيلي: ${selectedDistributorForStatement?.name}`}
        subtitle={`كود الموزع: ${selectedDistributorForStatement?.code} • الرصيد الحالي: ${formatCurrency(selectedDistributorForStatement?.balance || 0)}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">إجمالي الحركات المسجلة:</span>
            <span className="font-bold text-slate-200">{distributorStatement.length} حركة</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-3">التاريخ</th>
                  <th className="py-2 px-3">نوع الحركة</th>
                  <th className="py-2 px-3">البيان</th>
                  <th className="py-2 px-3 text-center">مدين (+)</th>
                  <th className="py-2 px-3 text-center">دائن (-)</th>
                  <th className="py-2 px-3 text-left">الرصيد بعد الحركة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {distributorStatement.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      لا توجد حركات مسجلة لهذا الموزع.
                    </td>
                  </tr>
                ) : (
                  distributorStatement.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {new Date(tx.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                      </td>
                      <td className="py-2.5 px-3">
                        {tx.type === 'order_charge' ? (
                          <span className="text-amber-400 font-bold">معاملة خدمة</span>
                        ) : tx.type === 'supply_payment' ? (
                          <span className="text-emerald-400 font-bold">توريد كاش</span>
                        ) : (
                          <span className="text-slate-300">رصيد افتتاحي</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{tx.notes || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
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
              onClick={() => setSelectedDistributorForStatement(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Modal>

      {/* Add New Distributor Modal */}
      <Modal
        isOpen={isNewDistributorModalOpen}
        onClose={() => setIsNewDistributorModalOpen(false)}
        title="إضافة موزع جديد"
        subtitle="تسجيل موزع جديد في المنظومة"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDistributor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم الموزع <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={distributorName}
              onChange={(e) => setDistributorName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: مكتب الأمانة للمستندات"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                كود الموزع <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={distributorCode}
                onChange={(e) => setDistributorCode(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="DIST-01"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف <span className="text-rose-400">*</span>:
              </label>
              <input
                type="tel"
                required
                value={distributorPhone}
                onChange={(e) => setDistributorPhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="01xxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">العنوان (اختياري):</label>
            <input
              type="text"
              value={distributorAddress}
              onChange={(e) => setDistributorAddress(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">رصيد افتتاحي (مدين):</label>
            <input
              type="text"
              inputMode="decimal"
              value={openingBalance}
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
                setOpeningBalance(val);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold font-mono text-amber-400 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-colors"
            >
              حفظ الموزع
            </button>
            <button
              type="button"
              onClick={() => setIsNewDistributorModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Distributor Modal */}
      <Modal
        isOpen={isEditDistributorModalOpen}
        onClose={() => {
          setIsEditDistributorModalOpen(false);
          setTargetDistributorForAction(null);
        }}
        title="تعديل بيانات الموزع"
        subtitle="تحديث المعلومات الأساسية للموزع"
        maxWidth="md"
      >
        <form onSubmit={handleEditDistributor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم الموزع <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={distributorName}
              onChange={(e) => setDistributorName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                كود الموزع <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={distributorCode}
                onChange={(e) => setDistributorCode(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف <span className="text-rose-400">*</span>:
              </label>
              <input
                type="tel"
                required
                value={distributorPhone}
                onChange={(e) => setDistributorPhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">العنوان (اختياري):</label>
            <input
              type="text"
              value={distributorAddress}
              onChange={(e) => setDistributorAddress(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>
          
          {targetDistributorForAction && (
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="distActive"
                checked={targetDistributorForAction.is_active}
                onChange={(e) => setTargetDistributorForAction({...targetDistributorForAction, is_active: e.target.checked})}
                className="w-4 h-4 text-sky-500 bg-slate-950 border-slate-700 rounded focus:ring-sky-500"
              />
              <label htmlFor="distActive" className="text-xs text-slate-300 font-bold">
                تنشيط حساب الموزع (يظهر في القوائم)
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-colors"
            >
              حفظ التعديلات
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditDistributorModalOpen(false);
                setTargetDistributorForAction(null);
              }}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs"
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
          setTargetDistributorForAction(null);
        }}
        title="تأكيد الحذف"
        subtitle="هل أنت متأكد من رغبتك في حذف هذا الموزع؟"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-bold leading-relaxed">
            تنبيه: سيتم حذف الموزع نهائياً إذا لم تكن هناك حركات مرتبطة به. وإذا كانت هناك حركات، سيتم إيقاف حسابه بدلاً من الحذف لضمان سلامة السجلات المالية.
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleDeleteDistributor}
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
                setTargetDistributorForAction(null);
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
