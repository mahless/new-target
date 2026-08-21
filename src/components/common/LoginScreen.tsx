/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Daily Login / Employee Authentication Screen
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Target, User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { employees, setActiveEmployeeId, setActiveBranchId, setFinancialViewScope, showToast } = useApp();
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isPinVisible, setIsPinVisible] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeEmps = employees.filter((e) => e.is_active);
  const currentEmp = activeEmps.find((e) => e.id === selectedEmpId) || activeEmps[0];

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmp) {
      showToast('error', 'اختر موظف', 'يرجى اختيار الموظف أولاً.');
      return;
    }

    if (!enteredPin.trim()) {
      showToast('error', 'رمز الدخول مطلوب', 'يرجى إدخال رمز PIN / كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    const validPass = currentEmp.password || currentEmp.pin_code || '1234';

    if (validPass === enteredPin.trim() || currentEmp.pin_code === enteredPin.trim()) {
      setActiveEmployeeId(currentEmp.id);
      if (currentEmp.role !== 'manager') {
        const empBranch = currentEmp.default_branch_id || currentEmp.branch_id;
        if (empBranch) {
          setActiveBranchId(empBranch);
        }
        setFinancialViewScope('employee');
      }

      // Save daily session flag in sessionStorage
      sessionStorage.setItem('target_daily_session_active', 'true');
      sessionStorage.setItem('target_session_user_id', currentEmp.id);
      sessionStorage.setItem('target_session_date', new Date().toDateString());

      showToast(
        'success',
        'مرحباً بك',
        `تم تسجيل الدخول بنجاح بحساب ${currentEmp.name} (${currentEmp.role === 'manager' ? 'مدير عام' : currentEmp.role === 'viewer' ? 'مشاهد' : 'موظف'}).`
      );

      // Force reload or re-render session state
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      showToast('error', 'رمز الدخول غير صحيح', 'تأكد من إدخال رمز PIN أو كلمة المرور الصحيحة لهذا الموظف.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="absolute inset-0 bg-radial from-amber-500/10 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 backdrop-blur-xl">
        {/* Branding Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 flex items-center justify-center shadow-xl shadow-amber-500/20 text-slate-950 mx-auto transform hover:scale-105 transition-transform">
            <Target className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight">
            تارجت للخدمات الحكومية
          </h1>
          <p className="text-xs text-slate-400">
            منظومة إدارة الخدمات والمعاملات والعهد المالية
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          {/* Employee Selection List */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-400" />
              <span>اختر اسم الموظف:</span>
            </label>

            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {activeEmps.map((emp) => {
                const isSelected = emp.id === (currentEmp?.id || selectedEmpId);
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 text-slate-100 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100">{emp.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          كود: {emp.code} •{' '}
                          {emp.role === 'manager'
                            ? 'مدير عام'
                            : emp.role === 'viewer'
                            ? 'مشاهد'
                            : 'موظف'}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                        محدد
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PIN / Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>رمز الدخول (PIN):</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPinVisible(!isPinVisible)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-medium"
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

            <div className="relative">
              <input
                type={isPinVisible ? 'text' : 'password'}
                value={enteredPin}
                onChange={(e) =>
                  setEnteredPin(
                    e.target.value.replace(/[٠-٩]/g, (d) =>
                      '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()
                    )
                  )
                }
                placeholder="أدخل رمز PIN الخاص بك..."
                autoFocus
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-center text-lg tracking-widest font-mono text-amber-400 focus:border-amber-500 focus:outline-none shadow-inner"
              />
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              رمز PIN الافتراضي للحسابات التجريبية: 1234 أو حسب ما تم تعيينه
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !enteredPin.trim()}
            className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3.5 rounded-2xl text-sm shadow-xl shadow-amber-500/20 transition-all ${
              isSubmitting || !enteredPin.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>دخول النظام</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </form>
      </div>
    </div>
  );
};
