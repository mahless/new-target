/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Executive Top Header Component
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import {
  Building2,
  ShieldCheck,
  ChevronDown,
  Target,
  Menu,
  X,
  Trash2,
  Wallet,
  User,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { Modal } from './Modal';
import { ModalSelect } from './ModalSelect';

export const Header: React.FC = () => {
  const {
    activeBranch,
    branches,
    setActiveBranchId,
    activeEmployee,
    employees,
    setActiveEmployeeId,
    setActiveTab,
    showToast,
    isSidebarOpen,
    toggleSidebar,
    refreshData,
    employeeDrawerBalance,
    branchDrawerBalance,
    financialViewScope,
    setFinancialViewScope,
  } = useApp();

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [targetEmpId, setTargetEmpId] = useState<string | null>(null);
  const [isPinVisible, setIsPinVisible] = useState(false);

  const handleResetData = () => {
    storage.resetDatabase();
    refreshData();
    showToast('success', 'تم تصفير النظام بنجاح', 'تم مسح كافة البيانات المحلية وإعادة تهيئة النظام بنجاح.');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSwitchEmployee = (empId: string) => {
    const target = employees.find(e => e.id === empId);
    if (!target) return;
    setTargetEmpId(empId);
    setEnteredPin('');
    setIsPinVisible(false);
    setIsEmployeeModalOpen(true);
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmpId) return;
    const target = employees.find(e => e.id === targetEmpId);
    const validPass = target?.password || target?.pin_code || '1234';
    if (target && (validPass === enteredPin.trim() || target.pin_code === enteredPin.trim())) {
      setActiveEmployeeId(targetEmpId);
      if (target.role !== 'manager') {
        const empBranch = target.default_branch_id || target.branch_id;
        if (empBranch) {
          setActiveBranchId(empBranch);
        }
        setFinancialViewScope('employee');
      }
      setIsEmployeeModalOpen(false);
      setEnteredPin('');
      showToast('success', 'تم تسجيل الدخول', `مرحباً بك، ${target.name} (${target.role === 'manager' ? 'مدير عام' : target.role === 'viewer' ? 'مشاهد' : 'موظف'})`);
    } else {
      showToast('error', 'كلمة المرور غير صحيحة', 'يرجى إدخال كلمة المرور أو رمز PIN الصحيح الخاص بالموظف.');
    }
  };

  const branchOptions = branches
    .filter((b) => b.is_active)
    .map((b) => ({
      value: b.id,
      label: b.name,
      badge: b.code,
      sublabel: b.phone ? `هاتف: ${b.phone}` : undefined,
      icon: Building2,
    }));

  return (
    <>
      <header
        id="app-top-header"
        className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none"
      >
        {/* Right Side: Branding & Menu Toggle */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Mobile Sidebar Toggle Button */}
          <button
            id="mobile-sidebar-toggle-btn"
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-amber-400 focus:outline-none transition-colors"
            title={isSidebarOpen ? 'إغلاق القائمة الجانبية' : 'فتح القائمة الجانبية'}
            aria-label="القائمة الجانبية"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => setActiveTab('operations')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-wider group-hover:scale-105 transition-transform">
              <Target className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-100 tracking-tight hidden sm:block">
                  تارجت للخدمات الحكومية
                </span>
                <span className="text-base font-black text-slate-100 tracking-tight sm:hidden">
                  تارجت
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Left Side: Branch Switcher & Employee Profile & Drawer Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Drawer Balance Pill */}
          <div
            onClick={() => setActiveTab('treasury')}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition-colors group"
            title="انقر للانتقال لحركات الخزينة والعهدة"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block leading-tight">
                {financialViewScope === 'employee' ? 'عهدة الموظف' : 'خزينة الفرع'}
              </span>
              <span className="text-xs font-mono font-black text-emerald-400">
                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                  financialViewScope === 'employee' ? employeeDrawerBalance : branchDrawerBalance
                )}{' '}
                <span className="text-[10px] text-slate-500">ج.م</span>
              </span>
            </div>
          </div>

          {/* Active Branch Selector Modal */}
          <div className="hidden md:block w-auto min-w-[180px]">
            {activeEmployee?.role === 'manager' ? (
              <ModalSelect
                id="header-branch-select"
                modalTitle="تحديد الفرع الحالي"
                modalSubtitle="اختر الفرع لمتابعة العمليات والخزينة الخاصة به"
                options={branchOptions}
                value={activeBranch?.id || ''}
                onChange={(val) => setActiveBranchId(val)}
                placeholder="اختر الفرع..."
                buttonClassName="!py-1.5 !px-4 !bg-slate-950/80 !border-slate-800 shadow-inner whitespace-nowrap"
              />
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-bold text-slate-300">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{activeBranch?.name || 'فرعك المخصص'}</span>
              </div>
            )}
          </div>

          {/* Active Employee PIN Profile (Desktop/Tablet) */}
          <div className="relative hidden md:block">
            <button
              id="header-employee-switch-btn"
              onClick={() => handleSwitchEmployee(activeEmployee?.id || '')}
              className="flex items-center gap-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-1.5 transition-all text-right max-w-[250px]"
              title="تبديل الموظف المسؤول (رمز PIN)"
            >
              <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                {activeEmployee?.name.charAt(0) || 'م'}
              </div>
              <div className="block text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-200">{activeEmployee?.name}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </div>
                <span className="text-[10px] text-slate-400 block font-mono leading-tight">
                  عهدة: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(employeeDrawerBalance)} ج.م
                </span>
              </div>
            </button>
          </div>

          {/* Mobile Active Employee PIN Profile (Avatar Only) */}
          <div className="relative md:hidden">
            <button
              id="header-employee-switch-btn-mobile"
              onClick={() => handleSwitchEmployee(activeEmployee?.id || '')}
              className="flex items-center gap-2.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-2 py-1.5 transition-all"
              title="تبديل الموظف المسؤول (رمز PIN)"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                {activeEmployee?.name.charAt(0) || 'م'}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Employee Switch PIN Modal */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title="تبديل الموظف المسؤول"
        subtitle="اختر الموظف وأدخل رمز PIN الخاص به لمتابعة العمليات"
        maxWidth="md"
      >
        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">اختر الموظف:</label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {employees
                .filter((e) => e.is_active)
                .map((e) => {
                  const isSelected = e.id === targetEmpId;
                  return (
                    <div
                      key={e.id}
                      onClick={() => setTargetEmpId(e.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-100'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-400">
                          {e.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{e.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            كود: {e.code} • {e.role === 'manager' ? 'مدير عام' : e.role === 'viewer' ? 'مشاهد' : 'موظف'}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                          محدد
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                كلمة المرور / رمز الدخول (PIN):
              </label>
              <button
                type="button"
                onClick={() => setIsPinVisible(!isPinVisible)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                {isPinVisible ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>إخفاء</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>إظهار</span>
                  </>
                )}
              </button>
            </div>
            <input
              type={isPinVisible ? 'text' : 'password'}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="أدخل كلمة المرور (4 أرقام أو أكثر)..."
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center text-base tracking-wider font-mono text-amber-400 focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 text-right">
              (كلمة المرور الافتراضية للحسابات التجريبية: 1234 أو 2233 أو 3344 أو حسب ما حدده المدير)
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              تأكيد الدخول
            </button>
            <button
              type="button"
              onClick={() => setIsEmployeeModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
