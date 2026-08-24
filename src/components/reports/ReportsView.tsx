/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Analytical Reports & Executive Financial Intelligence
 * Real Profits Calculation, Branch Comparative Matrix & Liquidity Breakdown
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import {
  BarChart3,
  TrendingUp,
  Wallet,
  Receipt,
  Users2,
  Building,
  DollarSign,
  PieChart,
  Calendar,
  Download,
  Printer,
  Sparkles,
  Layers,
  ArrowUpRight,
  CreditCard,
  Building2,
  Smartphone,
} from 'lucide-react';
import { ModalSelect } from '../common/ModalSelect';

export const ReportsView: React.FC = () => {
  const {
    branches,
    orders,
    payments,
    expenses,
    distributors,
    externalOffices,
    employees,
    ledger,
  } = useApp();

  const [dateRange, setDateRange] = useState<'all' | 'today' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Filter orders by date & branch
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (selectedBranchId !== 'all' && o.creation_branch_id !== selectedBranchId) return false;
      const orderTime = new Date(o.created_at).getTime();

      if (dateRange === 'today') {
        const orderDate = new Date(o.created_at).toDateString();
        const today = new Date().toDateString();
        if (orderDate !== today) return false;
      } else if (dateRange === 'custom') {
        if (startDate) {
          const start = new Date(startDate).setHours(0, 0, 0, 0);
          if (orderTime < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (orderTime > end) return false;
        }
      }
      return true;
    });
  }, [orders, selectedBranchId, dateRange, startDate, endDate]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (selectedBranchId !== 'all' && e.branch_id !== selectedBranchId) return false;
      const expTime = new Date(e.created_at).getTime();

      if (dateRange === 'today') {
        const expDate = new Date(e.created_at).toDateString();
        const today = new Date().toDateString();
        if (expDate !== today) return false;
      } else if (dateRange === 'custom') {
        if (startDate) {
          const start = new Date(startDate).setHours(0, 0, 0, 0);
          if (expTime < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (expTime > end) return false;
        }
      }
      return true;
    });
  }, [expenses, selectedBranchId, dateRange, startDate, endDate]);

  // Filter payments for accurate electronic breakdown
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (selectedBranchId !== 'all' && p.branch_id !== selectedBranchId) return false;
      const pmtTime = new Date(p.created_at).getTime();

      if (dateRange === 'today') {
        const pmtDate = new Date(p.created_at).toDateString();
        const today = new Date().toDateString();
        if (pmtDate !== today) return false;
      } else if (dateRange === 'custom') {
        if (startDate) {
          const start = new Date(startDate).setHours(0, 0, 0, 0);
          if (pmtTime < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (pmtTime > end) return false;
        }
      }
      return true;
    });
  }, [payments, selectedBranchId, dateRange, startDate, endDate]);

  // Total collected from recorded services (Cash + Electronic)
  const totalCollectedActual = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_paid || 0), 0);
  }, [filteredOrders]);

  // Total gross service agreed prices (original contract price)
  const totalOriginalContractPrice = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.price || 0), 0);
  }, [filteredOrders]);

  const totalExternalOfficesCost = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.external_office_cost || 0), 0);
  }, [filteredOrders]);

  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // Uncollected Remaining Revenue
  const totalUnpaidRemaining = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.remaining || 0), 0);
  }, [filteredOrders]);

  // Liquidity breakdown: Cash vs Electronic
  const cashCollectedGross = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.cash_amount || 0), 0);
  }, [filteredOrders]);

  // Actual Drawer Cash = Gross Cash Collected - Operating Expenses
  const actualDrawerCashNet = cashCollectedGross - totalOperatingExpenses;

  const electronicCollectedTotal = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.electronic_amount || 0), 0);
  }, [filteredOrders]);

  // Electronic sub-breakdown: InstaPay vs Wallets
  const electronicBreakdown = useMemo(() => {
    let instapaySum = 0;
    let walletSum = 0;

    // First check payments table if present
    if (filteredPayments.length > 0) {
      filteredPayments.forEach(p => {
        const amt = Number(p.electronic_amount || 0);
        if (amt <= 0) return;
        if (p.electronic_type === 'wallet') {
          walletSum += amt;
        } else {
          // Defaults to instapay (including pos/instapay)
          instapaySum += amt;
        }
      });
    } else {
      // Fallback from filteredOrders
      filteredOrders.forEach(o => {
        if (o.status === 'cancelled') return;
        const amt = Number(o.electronic_amount || 0);
        if (amt <= 0) return;
        instapaySum += amt;
      });
    }

    return {
      instapay: instapaySum,
      wallet: walletSum,
    };
  }, [filteredPayments, filteredOrders]);

  // Real Net Profit = Actual Drawer Cash + Electronic Collected - External Offices Cost
  // which is also equal to: (Cash In + Elec In) - Operating Expenses - External Offices Cost
  const netOperatingProfit = totalCollectedActual - totalOperatingExpenses - totalExternalOfficesCost;

  // Service Performance breakdown
  const serviceStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; margin: number }> = {};
    filteredOrders.forEach(o => {
      if (o.status === 'cancelled') return;
      if (!map[o.service_name]) {
        map[o.service_name] = { name: o.service_name, count: 0, revenue: 0, margin: 0 };
      }
      map[o.service_name].count += 1;
      map[o.service_name].revenue += Number(o.price || 0);
      map[o.service_name].margin += Number(o.office_margin || o.price || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Branch Performance matrix
  const branchPerformance = useMemo(() => {
    return branches.map(b => {
      const bOrders = orders.filter(
        o => o.creation_branch_id === b.id && o.status !== 'cancelled'
      );
      const bRevenue = bOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
      const bExpenses = expenses
        .filter(e => e.branch_id === b.id)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const bDrawer = storage.getBranchDrawerBalance(b.id);

      return {
        branch: b,
        ordersCount: bOrders.length,
        revenue: bRevenue,
        expenses: bExpenses,
        drawer: bDrawer,
      };
    });
  }, [branches, orders, expenses, ledger]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div id="analytical-reports-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">
              التقارير المالية
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <ModalSelect
            modalTitle="تصفية التقارير حسب الفرع"
            modalSubtitle="اختر الفرع لعرض مؤشراته وتحليلاته"
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
            buttonClassName="!py-2 !text-xs"
          />

          <ModalSelect
            modalTitle="تحديد الفترة الزمنية للتقرير"
            modalSubtitle="اختر نطاق التاريخ لحساب الإيرادات والأرباح"
            value={dateRange}
            onChange={(val) => setDateRange(val as any)}
            options={[
              { value: 'all', label: 'كل الفترات السابقة' },
              { value: 'today', label: 'حركات اليوم فقط' },
              { value: 'custom', label: 'فترة مخصصة (من - إلى)' },
            ]}
            buttonClassName="!py-2 !text-xs"
          />

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 animate-in fade-in duration-200">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-bold">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
        </div>
      </div>

      {/* Core P&L Financial Cards (Real Net Profit Formula) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">إجمالي الخدمات (الوارد الفعلي)</div>
          <div className="text-2xl font-black text-slate-100 font-mono tracking-tight mt-1">
            {formatCurrency(totalCollectedActual)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
            <span>كاش + إلكتروني محصل</span>
            <span className="text-slate-500 text-[10px]">العقود: {formatCurrency(totalOriginalContractPrice)}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">تكاليف المكاتب الخارجية</div>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalExternalOfficesCost)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">تكلفة للتنفيذ الخارجي</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold">المصروفات</div>
          <div className="text-2xl font-black text-rose-400 font-mono tracking-tight mt-1">
            {formatCurrency(totalOperatingExpenses)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{filteredExpenses.length} سند صرف مسجل</p>
        </div>

        {/* Real Net Profit Card */}
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-500/5">
          <div className="text-xs text-emerald-300 font-bold flex items-center justify-between">
            <span>صافي الربح</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight mt-1 ${
            netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {formatCurrency(netOperatingProfit)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            صافي السيولة النقدية المحققة
          </div>
        </div>
      </div>

      {/* Liquidity Breakdown & Customer Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Actual Drawer Cash Card: Gross Cash - Expenses */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>كاش الخزنة الفعلي (بالدرج)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">بعد المصروفات</span>
          </div>
          <div className={`text-xl font-black font-mono ${
            actualDrawerCashNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {formatCurrency(actualDrawerCashNet)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800 font-mono">
            <span>محصل كاش: <strong className="text-emerald-300">{formatCurrency(cashCollectedGross)}</strong></span>
            <span>-</span>
            <span>مصروف: <strong className="text-rose-400">{formatCurrency(totalOperatingExpenses)}</strong></span>
          </div>
        </div>

        {/* Split Electronic Card: InstaPay vs Wallets */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-sky-400" />
              <span>المدفوعات الإلكترونية</span>
            </div>
            <span className="text-xs font-black font-mono text-sky-400">
              {formatCurrency(electronicCollectedTotal)}
            </span>
          </div>

          {/* Internal 2-Column Split: InstaPay vs Wallets */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>InstaPay</span>
              </div>
              <div className="text-sm font-black text-indigo-400 font-mono mt-1">
                {formatCurrency(electronicBreakdown.instapay)}
              </div>
            </div>

            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>المحافظ الإلكترونية</span>
              </div>
              <div className="text-sm font-black text-sky-400 font-mono mt-1">
                {formatCurrency(electronicBreakdown.wallet)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-rose-400" />
            <span>متبقيات على العملاء</span>
          </div>
          <div className="text-xl font-black text-rose-400 font-mono">
            {formatCurrency(totalUnpaidRemaining)}
          </div>
          <p className="text-[11px] text-slate-500">دفعات مؤجلة للاستلام عند تسليم المعاملة</p>
        </div>
      </div>

      {/* Two Comparative Tables: Branch Performance & Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Multi-Branch Performance Comparison */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>مقارنة أداء الفروع</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">الفرع</th>
                  <th className="py-2.5 px-3 text-center">العمليات</th>
                  <th className="py-2.5 px-3 text-center">الإيرادات</th>
                  <th className="py-2.5 px-3 text-center">المصروفات</th>
                  <th className="py-2.5 px-3 text-left">رصيد الخزينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {branchPerformance.map(bp => (
                  <tr key={bp.branch.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-bold text-slate-200">{bp.branch.name}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{bp.ordersCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-100">
                      {formatCurrency(bp.revenue)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-rose-400">
                      {formatCurrency(bp.expenses)}
                    </td>
                    <td className="py-3 px-3 text-left font-mono font-black text-emerald-400">
                      {formatCurrency(bp.drawer)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Services by Popularity & Margin */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>الخدمات الأكثر طلباً وإيراداً</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">اسم الخدمة</th>
                  <th className="py-2.5 px-3 text-center">العدد</th>
                  <th className="py-2.5 px-3 text-center">إجمالي الإيراد</th>
                  <th className="py-2.5 px-3 text-left">الهامش المحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {serviceStats.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-500">
                      لا توجد بيانات خدمات مسجلة.
                    </td>
                  </tr>
                ) : (
                  serviceStats.slice(0, 6).map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-bold text-slate-200">{s.name}</td>
                      <td className="py-3 px-3 text-center font-mono text-amber-400 font-bold">
                        {s.count}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-100">
                        {formatCurrency(s.revenue)}
                      </td>
                      <td className="py-3 px-3 text-left font-mono font-black text-emerald-400">
                        {formatCurrency(s.margin)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
