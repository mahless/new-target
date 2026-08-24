/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Branch Treasury, Vault & Financial Cash Ledger View
 * Automated Midnight Reset & Flexible Multi-Period Auditing (Single Day / Date Range / Cumulative)
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { CashLedgerEntry, LedgerTransactionType } from '../../types';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Receipt,
  Users2,
  Building,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Clock,
  Printer,
  Search,
  RotateCcw,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ModalSelect } from '../common/ModalSelect';

type PeriodMode = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'custom_day' | 'custom_range' | 'all_time';

export const TreasuryView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    branches,
    employees,
    ledger,
    payments,
    financialViewScope,
  } = useApp();

  const isManager = activeEmployee?.role === 'manager';

  // Branch & Employee filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || 'all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    financialViewScope === 'employee' ? (activeEmployee?.id || 'all') : 'all'
  );
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Filter State
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('today');
  const [customDay, setCustomDay] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Calculate Date Boundaries [startInclusive, endInclusive]
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (periodMode === 'today') {
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        label: 'اليوم (نشط - منذ 12:00 ص)',
        badge: 'تصفير تلقائي لليوم الجديد',
        start: today,
        end: endToday,
        isAllTime: false,
      };
    }

    if (periodMode === 'yesterday') {
      const yestStart = new Date(today);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(yestStart.getFullYear(), yestStart.getMonth(), yestStart.getDate(), 23, 59, 59, 999);
      return {
        label: `أمس (${yestStart.toLocaleDateString('ar-EG-u-nu-latn')})`,
        badge: 'يوم كامل',
        start: yestStart,
        end: yestEnd,
        isAllTime: false,
      };
    }

    if (periodMode === 'last7days') {
      const start7 = new Date(today);
      start7.setDate(start7.getDate() - 6);
      const end7 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        label: 'آخر 7 أيام',
        badge: `${start7.toLocaleDateString('ar-EG-u-nu-latn')} - ${today.toLocaleDateString('ar-EG-u-nu-latn')}`,
        start: start7,
        end: end7,
        isAllTime: false,
      };
    }

    if (periodMode === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        label: 'هذا الشهر الحالي',
        badge: now.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' }),
        start: monthStart,
        end: monthEnd,
        isAllTime: false,
      };
    }

    if (periodMode === 'custom_day') {
      const [year, month, day] = customDay.split('-').map(Number);
      const sDay = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
      const eDay = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
      return {
        label: `يوم محدد: ${sDay.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
        badge: customDay,
        start: sDay,
        end: eDay,
        isAllTime: false,
      };
    }

    if (periodMode === 'custom_range') {
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      const sRange = new Date(sY, (sM || 1) - 1, sD || 1, 0, 0, 0, 0);
      const eRange = new Date(eY, (eM || 1) - 1, eD || 1, 23, 59, 59, 999);
      return {
        label: `فترة مخصصة: من ${sRange.toLocaleDateString('ar-EG-u-nu-latn')} إلى ${eRange.toLocaleDateString('ar-EG-u-nu-latn')}`,
        badge: `${startDate} ⬅ ${endDate}`,
        start: sRange,
        end: eRange,
        isAllTime: false,
      };
    }

    // All time
    return {
      label: 'الرصيد التراكمي الشامل (جميع الفترات والتواريخ)',
      badge: 'الرصيد الكلي التاريخي',
      start: new Date(0),
      end: new Date(8640000000000000),
      isAllTime: true,
    };
  }, [periodMode, customDay, startDate, endDate]);

  // Helper to check if an ISO timestamp is within current selected range
  const isDateInRange = (isoStr: string) => {
    if (dateRange.isAllTime) return true;
    try {
      const d = new Date(isoStr);
      return d >= dateRange.start && d <= dateRange.end;
    } catch {
      return true;
    }
  };

  // Base raw ledger entries for selected branch & employee
  const rawLedgerEntries = useMemo(() => {
    return storage.getLedger(
      selectedBranchId === 'all' ? undefined : selectedBranchId,
      selectedEmployeeId === 'all' ? undefined : selectedEmployeeId
    );
  }, [selectedBranchId, selectedEmployeeId, ledger]);

  // Period-filtered ledger entries
  const periodLedgerEntries = useMemo(() => {
    return rawLedgerEntries.filter(entry => isDateInRange(entry.created_at));
  }, [rawLedgerEntries, dateRange]);

  // Search & Type Filtered Entries for the Table
  const filteredTableEntries = useMemo(() => {
    let list = periodLedgerEntries;
    if (typeFilter !== 'all') {
      list = list.filter(l => l.transaction_type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(l =>
        (l.notes && l.notes.toLowerCase().includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q)) ||
        (l.reference_id && l.reference_id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [periodLedgerEntries, typeFilter, searchQuery]);

  // Period KPI Metrics
  const periodKPIs = useMemo(() => {
    const cashIn = periodLedgerEntries
      .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const cashOut = periodLedgerEntries
      .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

    const netFlow = Number((cashIn - cashOut).toFixed(2));

    // Electronic payments in period
    const bId = selectedBranchId === 'all' ? undefined : selectedBranchId;
    const empId = selectedEmployeeId === 'all' ? undefined : selectedEmployeeId;
    const matchedPayments = payments.filter(p => {
      const matchB = !bId || p.branch_id === bId;
      const matchE = !empId || p.employee_id === empId;
      const matchD = isDateInRange(p.created_at);
      return matchB && matchE && matchD;
    });

    const electronicTotal = matchedPayments.reduce((sum, p) => sum + Number(p.electronic_amount || 0), 0);

    return {
      cashIn: Number(cashIn.toFixed(2)),
      cashOut: Number(cashOut.toFixed(2)),
      netFlow,
      electronicTotal: Number(electronicTotal.toFixed(2)),
      transactionsCount: periodLedgerEntries.length,
    };
  }, [periodLedgerEntries, payments, selectedBranchId, selectedEmployeeId, dateRange]);

  // Employee Drawers Breakdown for current selected branch & active date range
  const employeeDrawers = useMemo(() => {
    const targetBranchId = selectedBranchId === 'all' ? (activeBranch?.id || '') : selectedBranchId;
    const branchEmps = employees.filter(e => e.is_active && (!e.branch_id || e.branch_id === targetBranchId || selectedBranchId === 'all'));

    return branchEmps.map(emp => {
      const empAllLedger = storage.getLedger(targetBranchId || undefined, emp.id);
      const empPeriodLedger = empAllLedger.filter(l => isDateInRange(l.created_at));

      const periodCashIn = empPeriodLedger
        .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

      const periodCashOut = empPeriodLedger
        .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

      // Period net balance for this employee (starts from 0 at midnight for 'today')
      const periodBalance = Number((periodCashIn - periodCashOut).toFixed(2));
      const cumulativeBalance = storage.getEmployeeDrawerBalance(emp.id, targetBranchId || undefined);

      return {
        employee: emp,
        periodBalance,
        cumulativeBalance,
        periodCashIn: Number(periodCashIn.toFixed(2)),
        periodCashOut: Number(periodCashOut.toFixed(2)),
        transactionsCount: empPeriodLedger.length,
      };
    });
  }, [employees, selectedBranchId, activeBranch, ledger, dateRange]);

  // Multi-branch summaries for active date range
  const branchSummaries = useMemo(() => {
    return branches.map(b => {
      const bAllLedger = storage.getLedger(b.id);
      const bPeriodLedger = bAllLedger.filter(l => isDateInRange(l.created_at));

      const cashIn = bPeriodLedger
        .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

      const cashOut = bPeriodLedger
        .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

      const periodNet = Number((cashIn - cashOut).toFixed(2));
      const cumulativeBalance = storage.getBranchDrawerBalance(b.id);

      return {
        branch: b,
        periodNet,
        cumulativeBalance,
        cashIn: Number(cashIn.toFixed(2)),
        cashOut: Number(cashOut.toFixed(2)),
        transactionsCount: bPeriodLedger.length,
      };
    });
  }, [branches, ledger, dateRange]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const getLedgerTypeDetails = (type: LedgerTransactionType) => {
    switch (type) {
      case 'customer_cash_payment':
        return {
          label: 'كاش',
          icon: ArrowDownLeft,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          isIncome: true,
        };
      case 'distributor_payment':
        return {
          label: 'توريد كاش من موزع',
          icon: Users2,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
          isIncome: true,
        };
      case 'branch_transfer_in':
        return {
          label: 'تحويل وارد من فرع',
          icon: ArrowDownLeft,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          isIncome: true,
        };
      case 'opening_balance':
        return {
          label: 'رصيد افتتاحي للفرع',
          icon: Wallet,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          isIncome: true,
        };
      case 'expense':
        return {
          label: 'مصروف',
          icon: ArrowUpRight,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          isIncome: false,
        };
      case 'external_office_cost':
        return {
          label: 'تكلفة مكتب خارجي',
          icon: Building,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          isIncome: false,
        };
      case 'branch_transfer_out':
        return {
          label: 'تحويل صادر لفرع آخر',
          icon: ArrowUpRight,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          isIncome: false,
        };
      case 'daily_closing_payout':
        return {
          label: 'ترحيل حركة إغلاق',
          icon: ShieldCheck,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          isIncome: false,
        };
      case 'correction':
        return {
          label: 'تسوية تصحيحية',
          icon: AlertCircle,
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          isIncome: true,
        };
      default:
        return {
          label: 'حركة مالية',
          icon: Wallet,
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          isIncome: true,
        };
    }
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div id="treasury-ledger-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 w-full">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
              <span>خزنة الفرع والعهد المالية للموظفين</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold font-mono">
                تصفير تلقائي 12:00 ص
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة الخزينة الإجمالية والعهد المستقلة مع إمكانية استعراض وتدقيق أي يوم محدد أو فترة زمنية مخصصة
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Date Range & Single Day Picker Toolbar (لوحة تحديد الفترة واليوم المخصص للمدير) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-black text-slate-100">
                تحديد نطاق العرض الزمني والتاريخ
              </h3>
              <p className="text-[11px] text-slate-400">
                اختر اليوم الحالي النشط أو حدد يوماً / فترة زمنية لعرض خزن الموظفين وحركات الخزينة الخاصة بها
              </p>
            </div>
          </div>

          {/* Active Period Status Tag */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{dateRange.label}</span>
            </span>
          </div>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPeriodMode('today')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'today'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>اليوم (الحالي)</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('yesterday')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'yesterday'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>أمس</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('last7days')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'last7days'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>آخر 7 أيام</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('thisMonth')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'thisMonth'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>هذا الشهر</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('custom_day')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'custom_day'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>تحديد يوم معين</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('custom_range')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'custom_range'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>تحديد فترة مخصصة (من - إلى)</span>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('all_time')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              periodMode === 'all_time'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>جميع الفترات (تراكمي)</span>
          </button>
        </div>

        {/* Dynamic Input Controls for Custom Day or Custom Range */}
        {periodMode === 'custom_day' && (
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Calendar className="w-4 h-4" />
              <span>اختر تاريخ اليوم المطلوب عرضه:</span>
            </div>
            <input
              type="date"
              value={customDay}
              onChange={(e) => setCustomDay(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-mono"
            />
            <span className="text-xs text-slate-400">
              سيتم احتساب خزن الموظفين والخزينة الإجمالية من بداية هذا اليوم (12:00 ص) حتى نهايته (11:59 م).
            </span>
          </div>
        )}

        {periodMode === 'custom_range' && (
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <span className="text-xs text-slate-400">
              يتم تجميع كافة الحركات والمدفوعات والمصروفات بين هذين التاريخين فوراً.
            </span>
          </div>
        )}
      </div>

      {/* Employee Drawers Breakdown Section (خزن وعهد الموظفين المستقلة بالفترة المحددة) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-slate-100">
              خزن وعهد الموظفين المستقلة ({dateRange.label})
            </h3>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
              {employeeDrawers.length} موظف
            </span>
          </div>
          <span className="text-xs text-slate-400">
            انقر على كارت أي موظف لتصفية سجل قيود الخزينة لحركاته بالفترة فقط
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeDrawers.map(({ employee: emp, periodBalance, cumulativeBalance, periodCashIn, periodCashOut, transactionsCount }) => {
            const isSelected = selectedEmployeeId === emp.id;
            const isCurrentActive = emp.id === activeEmployee?.id;

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployeeId(isSelected ? 'all' : emp.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : isCurrentActive
                    ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500/70'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isCurrentActive ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100">{emp.name}</span>
                        {isCurrentActive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                            أنت
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        كود: {emp.code} • {emp.role === 'manager' ? 'مدير عام' : emp.role === 'viewer' ? 'مشاهد' : 'موظف'}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                      محدد
                    </span>
                  )}
                </div>

                {/* Period Balance Box */}
                <div className="mt-3 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>صافي عهدة / حركة الفترة:</span>
                    <span className="text-slate-500 font-mono">{transactionsCount} حركة</span>
                  </div>
                  <div className="text-lg font-black text-amber-400 font-mono tracking-tight mt-0.5">
                    {formatCurrency(periodBalance)} <span className="text-xs font-sans text-slate-500">ج.م</span>
                  </div>
                </div>

                {/* Period Cash In vs Out */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400">+ تحصيل: {formatCurrency(periodCashIn)}</span>
                  <span className="text-rose-400">- صرف: {formatCurrency(periodCashOut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Branch Financial Cards (خزائن الفروع بالفترة المحددة) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branchSummaries.map(({ branch, periodNet, cumulativeBalance, cashIn, cashOut, transactionsCount }) => {
          const isSelected = selectedBranchId === branch.id;
          return (
            <div
              key={branch.id}
              onClick={() => setSelectedBranchId(isSelected && branches.length > 1 ? 'all' : branch.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200">{branch.name}</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {branch.code}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>صافي حركة خزينة الفرع بالفترة:</span>
                  <span className="text-[10px] font-mono text-slate-500">{transactionsCount} حركة</span>
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                  {formatCurrency(periodNet)} <span className="text-xs font-sans text-slate-500">ج.م</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-emerald-400">+ وارد: {formatCurrency(cashIn)}</span>
                <span className="text-rose-400">- منصرف: {formatCurrency(cashOut)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ledger Filter & Audit Stream Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-100">
              السجل المالي ({dateRange.label})
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
              {filteredTableEntries.length} قيد مالي
            </span>
          </div>

          {/* Action & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في البيان أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pr-8 pl-3 py-1.5 focus:outline-none focus:border-amber-500 w-44"
              />
            </div>

            {/* Employee Filter */}
            <ModalSelect
              modalTitle="تصفية حركة الخزينة حسب الموظف"
              modalSubtitle="اختر الموظف لعرض حركاته المالية وعهدته الشخصية"
              value={selectedEmployeeId}
              onChange={(val) => setSelectedEmployeeId(val)}
              options={[
                { value: 'all', label: 'جميع الموظفين' },
                ...employees
                  .filter(e => e.is_active)
                  .map(e => ({
                    value: e.id,
                    label: e.name,
                    badge: e.code,
                    sublabel: e.role === 'manager' ? 'مدير عام' : e.role === 'viewer' ? 'مشاهد' : 'موظف',
                  })),
              ]}
              buttonClassName="!py-1.5 !text-xs !bg-slate-950"
            />

            {/* Branch Filter */}
            <ModalSelect
              modalTitle="تصفية حركة الخزينة حسب الفرع"
              modalSubtitle="اختر الفرع لعرض حركات الخزينة الخاصة به"
              value={selectedBranchId}
              onChange={(val) => setSelectedBranchId(val)}
              options={[
                { value: 'all', label: 'جميع الفروع' },
                ...branches.map(b => ({
                  value: b.id,
                  label: b.name,
                  badge: b.code,
                })),
              ]}
              buttonClassName="!py-1.5 !text-xs !bg-slate-950"
            />

            {/* Transaction Type Filter */}
            <ModalSelect
              modalTitle="تصفية حسب نوع القيد المالي"
              modalSubtitle="اختر نوع المعاملة المالية في دفتر الأستاذ"
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: 'all', label: 'جميع أنواع القيود' },
                { value: 'customer_cash_payment', label: 'كاش' },
                { value: 'distributor_payment', label: 'توريد كاش من موزع' },
                { value: 'expense', label: 'مصروف' },
                { value: 'external_office_cost', label: 'تكلفة مكتب خارجي' },
                { value: 'branch_transfer_in', label: 'تحويل وارد من فرع' },
                { value: 'branch_transfer_out', label: 'تحويل صادر لفرع' },
                { value: 'opening_balance', label: 'رصيد افتتاحي' },
              ]}
              buttonClassName="!py-1.5 !text-xs !bg-slate-950"
            />

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrintLedger}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* Ledger Stream Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">التاريخ والوقت</th>
                <th className="py-3 px-4 font-semibold">الفرع</th>
                <th className="py-3 px-4 font-semibold">نوع القيد المالي</th>
                <th className="py-3 px-4 font-semibold">البيان والتفاصيل</th>
                <th className="py-3 px-4 font-semibold">الموظف المسؤول</th>
                <th className="py-3 px-4 font-semibold text-center">المبلغ</th>
                <th className="py-3 px-4 font-semibold text-left">الرصيد بعد الحركة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTableEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 space-y-2">
                    <Wallet className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                    <div>لا توجد قيود مالية مسجلة مطابقة للفترة أو المعايير المحددة.</div>
                  </td>
                </tr>
              ) : (
                filteredTableEntries.map(entry => {
                  const typeInfo = getLedgerTypeDetails(entry.transaction_type);
                  const Icon = typeInfo.icon;
                  const b = branches.find(item => item.id === entry.branch_id);
                  const emp = employees.find(e => e.id === entry.employee_id);
                  const isCurrentActive = emp?.id === activeEmployee?.id;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <div>{new Date(entry.created_at).toLocaleDateString('ar-EG-u-nu-latn')}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(entry.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-300">{b?.name}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${typeInfo.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{typeInfo.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                        {entry.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isCurrentActive ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                            {emp?.name || 'الموظف المسؤول'}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 font-bold">
                              أنت
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {entry.amount > 0 ? (
                          <span className="text-emerald-400">+{formatCurrency(entry.amount)}</span>
                        ) : (
                          <span className="text-rose-400">
                            -{formatCurrency(Math.abs(entry.amount))}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-left font-mono font-bold text-slate-200">
                        {formatCurrency(entry.balance_after)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
