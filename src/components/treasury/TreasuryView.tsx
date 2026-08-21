/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Branch Treasury & Financial Cash Ledger View
 * Double-Entry Style Append-Only Transaction Stream & Multi-Branch Balances
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
  Lock,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ShieldCheck,
} from 'lucide-react';
import { ModalSelect } from '../common/ModalSelect';

export const TreasuryView: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    branches,
    employees,
    ledger,
    drawerBalance,
    employeeDrawerBalance,
    branchDrawerBalance,
    financialViewScope,
    setFinancialViewScope,
    setActiveTab,
  } = useApp();

  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || 'all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    financialViewScope === 'employee' ? (activeEmployee?.id || 'all') : 'all'
  );
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Employee Drawers Breakdown for all registered active employees
  const employeeDrawers = useMemo(() => {
    const targetBranchId = selectedBranchId === 'all' ? undefined : selectedBranchId;
    const allActiveEmps = employees.filter(e => e.is_active);

    return allActiveEmps.map(emp => {
      const empLedger = storage.getLedger(targetBranchId, emp.id);
      const balance = storage.getEmployeeDrawerBalance(emp.id, targetBranchId);
      const today = new Date().toISOString().split('T')[0];
      const todayLedger = empLedger.filter(l => l.created_at.startsWith(today));

      const cashIn = todayLedger
        .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

      const cashOut = todayLedger
        .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

      return {
        employee: emp,
        balance,
        todayCashIn: cashIn,
        todayCashOut: cashOut,
        transactionsCount: empLedger.length,
      };
    });
  }, [employees, selectedBranchId, ledger]);

  // Multi-branch stats
  const branchSummaries = useMemo(() => {
    return branches.map(b => {
      const bLedger = storage.getLedger(b.id);
      const balance = storage.getBranchDrawerBalance(b.id);
      const cashIn = bLedger
        .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);
      const cashOut = bLedger
        .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

      return {
        branch: b,
        balance,
        cashIn,
        cashOut,
        transactionsCount: bLedger.length,
      };
    });
  }, [branches, ledger]);

  // Filtered Ledger Entries
  const filteredEntries = useMemo(() => {
    let list = storage.getLedger(
      selectedBranchId === 'all' ? undefined : selectedBranchId,
      selectedEmployeeId === 'all' ? undefined : selectedEmployeeId
    );

    if (typeFilter !== 'all') {
      list = list.filter(l => l.transaction_type === typeFilter);
    }

    return list;
  }, [selectedBranchId, selectedEmployeeId, typeFilter, ledger]);

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
          label: 'تحصيل كاش من عميل',
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
          label: 'صرف مصروف تشغيلي',
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
          label: 'ترحيل إغلاق يومي',
          icon: Lock,
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

  return (
    <div id="treasury-ledger-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner & Scope Toggle */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-black text-slate-100">
              خزنة الفرع والعهد المالية للموظفين
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            متابعة خزنة الفرع الإجمالية والعهد المستقلة لكل موظف على حدة
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Total All Branches / Single Branch Drawer Card */}
          {activeEmployee?.role === 'manager' ? (
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-emerald-500/40 text-right shadow-sm">
              <div className="flex items-center gap-1.5 justify-end">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-slate-400 font-bold">
                  إجمالي كاش الفروع
                </span>
              </div>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(
                  branches.reduce((sum, b) => sum + storage.getBranchDrawerBalance(b.id), 0)
                )}
              </span>
            </div>
          ) : (
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <Building2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-slate-400 font-bold">
                  إجمالي خزينة {activeBranch?.name || 'الفرع'}
                </span>
              </div>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(branchDrawerBalance)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Employee Drawers Breakdown Section (خزن وعهد موظفي الفرع المستقلة) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-slate-100">
              خزن وعهد جميع الموظفين المستقلة
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400">
              {employeeDrawers.length} موظف
            </span>
          </div>
          <span className="text-xs text-slate-400">
            انقر على كارت أي موظف لتصفية سجل الحركات لحسابه فقط
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeDrawers.map(({ employee: emp, balance, todayCashIn, todayCashOut, transactionsCount }) => {
            const isSelected = selectedEmployeeId === emp.id;
            const isCurrentActive = emp.id === activeEmployee?.id;

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployeeId(isSelected ? 'all' : emp.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
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

                <div className="mt-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-semibold">رصيد العهدة الحاضر:</div>
                  <div className="text-lg font-black text-amber-400 font-mono tracking-tight mt-0.5">
                    {formatCurrency(balance)} <span className="text-xs text-slate-500">ج.م</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400">+ تحصيل اليوم: {formatCurrency(todayCashIn)}</span>
                  <span className="text-rose-400">- صرف اليوم: {formatCurrency(todayCashOut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Branch Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branchSummaries.map(({ branch, balance, cashIn, cashOut, transactionsCount }) => {
          const isSelected = selectedBranchId === branch.id;
          return (
            <div
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
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
                <div className="text-xs text-slate-400 font-semibold">إجمالي خزينة الفرع:</div>
                <div className="text-xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                  {formatCurrency(balance)}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-100">سجل قيود دفتر الخزينة</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400">
              {filteredEntries.length} قيد مالي
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
                { value: 'customer_cash_payment', label: 'تحصيل كاش من عميل' },
                { value: 'distributor_payment', label: 'توريد كاش من موزع' },
                { value: 'expense', label: 'مصروف تشغيلي' },
                { value: 'external_office_cost', label: 'تكلفة مكتب خارجي' },
                { value: 'branch_transfer_in', label: 'تحويل وارد من فرع' },
                { value: 'branch_transfer_out', label: 'تحويل صادر لفرع' },
                { value: 'daily_closing_payout', label: 'إغلاق وتسوية يومية' },
                { value: 'opening_balance', label: 'رصيد افتتاحي' },
              ]}
              buttonClassName="!py-1.5 !text-xs !bg-slate-950"
            />
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
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    لا توجد قيود مالية مسجلة مطابقة للفلتر.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
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

