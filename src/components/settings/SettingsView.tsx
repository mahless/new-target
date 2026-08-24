/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * System Settings & Master Configurations
 * Branches, Services & Dynamic Speeds, Employees & Roles, Data Backups
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { isSupabaseConfigured, supabaseSyncService } from '../../lib/supabase';
import { Service, ServiceSpeed, Branch, Employee } from '../../types';
import {
  Settings,
  Building2,
  Layers,
  Users,
  Database,
  PlusCircle,
  Save,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Edit3,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';

export const SettingsView: React.FC = () => {
  const {
    branches,
    services,
    employees,
    refreshData,
    showToast,
    activeBranch,
  } = useApp();

  const [activeSection, setActiveSection] = useState<'branches' | 'services' | 'employees' | 'backup'>('services');

  // New Branch State
  const [isNewBranchModalOpen, setIsNewBranchModalOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bAddress, setBAddress] = useState('');

  // Service State
  const [isNewServiceModalOpen, setIsNewServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isConfirmingDeleteService, setIsConfirmingDeleteService] = useState(false);
  const [sName, setSName] = useState('');
  const [sCategory, setSCategory] = useState('سجل مدني');
  const [sBasePrice, setSBasePrice] = useState('0');
  const [sSpeeds] = useState<ServiceSpeed[]>([
    { code: 'normal', label: 'عادي', extra_cost: 0 },
    { code: 'urgent', label: 'مستعجل', extra_cost: 0 },
    { code: 'instant', label: 'فوري', extra_cost: 0 },
    { code: 'vip', label: 'VIP / سوبر', extra_cost: 0 },
  ]);

  const handleOpenEditService = (srv: Service) => {
    setEditingServiceId(srv.id);
    setIsConfirmingDeleteService(false);
    setSName(srv.name);
    setSCategory(srv.category || '');
    setSBasePrice(srv.base_price.toString());
    setIsNewServiceModalOpen(true);
  };

  const handleOpenNewService = () => {
    setEditingServiceId(null);
    setIsConfirmingDeleteService(false);
    setSName('');
    setSCategory('سجل مدني');
    setSBasePrice('0');
    setIsNewServiceModalOpen(true);
  };

  // Employee State
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eUsername, setEUsername] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eCode, setECode] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eRole, setERole] = useState<Employee['role']>('employee');
  const [eBranchId, setEBranchId] = useState(activeBranch?.id || '');
  const [eIsActive, setEIsActive] = useState(true);
  const [isPasswordVisibleInModal, setIsPasswordVisibleInModal] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [isConfirmingDeleteEmp, setIsConfirmingDeleteEmp] = useState(false);

  const handleOpenNewEmployee = () => {
    setEditingEmpId(null);
    setIsConfirmingDeleteEmp(false);
    setEName('');
    setEUsername('');
    setEPassword('');
    setECode(`EMP-${String(employees.length + 1).padStart(2, '0')}`);
    setEPhone('');
    setEEmail('');
    setERole('employee');
    setEBranchId(activeBranch?.id || '');
    setEIsActive(true);
    setIsPasswordVisibleInModal(false);
    setIsNewEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setIsConfirmingDeleteEmp(false);
    setEName(emp.name);
    setEUsername(emp.username || emp.email || emp.code || '');
    setEPassword(emp.password || emp.pin_code || '');
    setECode(emp.code || '');
    setEPhone(emp.phone || '');
    setEEmail(emp.email || '');
    setERole(emp.role);
    setEBranchId(emp.branch_id || '');
    setEIsActive(emp.is_active ?? true);
    setIsPasswordVisibleInModal(false);
    setIsNewEmployeeModalOpen(true);
  };

  const togglePasswordReveal = (empId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // 1. Create Branch
  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bCode.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إدخال اسم وكود الفرع.');
      return;
    }

    try {
      storage.createBranch({
        name: bName.trim(),
        code: bCode.trim().toUpperCase(),
        phone: bPhone.trim() || undefined,
        address: bAddress.trim() || undefined,
      });
      refreshData();
      showToast('success', 'تم إنشاء الفرع', `تم إضافة فرع ${bName} بنجاح.`);
      setIsNewBranchModalOpen(false);
      setBName('');
      setBCode('');
      setBPhone('');
      setBAddress('');
    } catch (err: any) {
      showToast('error', 'خطأ', err.message);
    }
  };

  // 2. Save Service
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim()) {
      showToast('error', 'بيانات ناقصة', 'يرجى إدخال اسم الخدمة.');
      return;
    }

    try {
      storage.saveService({
        id: editingServiceId || undefined,
        name: sName.trim(),
        category: sCategory.trim(),
        base_price: Number(sBasePrice) || 0,
        speeds: sSpeeds,
      });
      refreshData();
      showToast('success', 'تم حفظ الخدمة', `تم حفظ خدمة ${sName} بنجاح.`);
      setIsNewServiceModalOpen(false);
      setEditingServiceId(null);
      setSName('');
      setSBasePrice('0');
    } catch (err: any) {
      showToast('error', 'خطأ', err.message);
    }
  };

  const handleDeleteService = () => {
    if (!editingServiceId) return;
    try {
      storage.deleteService(editingServiceId);
      refreshData();
      showToast('success', 'تم الحذف', 'تم حذف الخدمة بنجاح.');
      setIsNewServiceModalOpen(false);
      setEditingServiceId(null);
      setIsConfirmingDeleteService(false);
      setSName('');
      setSBasePrice('0');
    } catch (err: any) {
      showToast('error', 'خطأ', err.message);
    }
  };

  // 3. Save / Create Employee with 4+ characters Password Validation
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = eName.trim();
    const cleanUsername = eUsername.trim();
    const cleanPassword = ePassword.trim();

    if (!cleanName) {
      showToast('error', 'بيانات ناقصة', 'يرجى إدخال اسم الموظف كاملاً.');
      return;
    }

    if (!cleanUsername) {
      showToast('error', 'بيانات ناقصة', 'يرجى تحديد اسم الدخول الخاص بالموظف.');
      return;
    }

    if (!cleanPassword) {
      showToast('error', 'بيانات ناقصة', 'يرجى تعيين كلمة المرور للموظف.');
      return;
    }

    if (cleanPassword.length < 4) {
      showToast('error', 'كلمة المرور قصيرة جداً', 'يجب أن تتكون كلمة المرور من 4 أرقام أو رموز على الأقل.');
      return;
    }

    try {
      storage.saveEmployee({
        id: editingEmpId || undefined,
        name: cleanName,
        username: cleanUsername,
        password: cleanPassword,
        pin_code: cleanPassword,
        code: eCode.trim() || undefined,
        phone: ePhone.trim() || undefined,
        email: eEmail.trim() || undefined,
        role: eRole,
        branch_id: eBranchId || undefined,
        default_branch_id: eBranchId || activeBranch?.id,
        is_active: eIsActive,
      });

      refreshData();
      showToast(
        'success',
        editingEmpId ? 'تم تعديل بيانات الموظف' : 'تم إضافة الموظف الجديد',
        `تم حفظ حساب ${cleanName} واسم الدخول (${cleanUsername}) بنجاح.`
      );

      setIsNewEmployeeModalOpen(false);
      setEditingEmpId(null);
      setEName('');
      setEUsername('');
      setEPassword('');
      setEPhone('');
      setEEmail('');
      setECode('');
    } catch (err: any) {
      showToast('error', 'خطأ في الحفظ', err.message);
    }
  };

  const handleToggleEmployeeStatus = (emp: Employee) => {
    try {
      const updated = storage.toggleEmployeeStatus(emp.id);
      refreshData();
      if (updated) {
        showToast(
          'info',
          updated.is_active ? 'تم تنشيط الحساب' : 'تم تعطيل الحساب',
          `حساب الموظف ${emp.name} أصبح الآن ${updated.is_active ? 'نشطاً' : 'معطلاً'}.`
        );
      }
    } catch (err: any) {
      showToast('error', 'خطأ', err.message);
    }
  };

  const handleDeleteEmployee = () => {
    if (!editingEmpId) return;
    try {
      storage.deleteEmployee(editingEmpId);
      refreshData();
      showToast('success', 'تم حذف الموظف', 'تم إزالة حساب الموظف من النظام بنجاح.');
      setIsNewEmployeeModalOpen(false);
      setEditingEmpId(null);
      setIsConfirmingDeleteEmp(false);
    } catch (err: any) {
      showToast('error', 'خطأ', err.message);
    }
  };

  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [isSyncingPull, setIsSyncingPull] = useState(false);

  const handlePushToSupabase = async () => {
    if (!isSupabaseConfigured) {
      showToast('error', 'الربط غير مهيأ', 'يرجى إدخال المتغيرات VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY أولاً في الإعدادات.');
      return;
    }
    setIsSyncingPush(true);
    try {
      const result = await supabaseSyncService.pushToSupabase();
      if (result.success) {
        showToast('success', 'نجاح المزامنة السحابية', result.message);
      } else {
        showToast('warning', 'مزامنة جزئية', result.message);
      }
    } catch (err: any) {
      showToast('error', 'فشل المزامنة', err.message || err);
    } finally {
      setIsSyncingPush(false);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!isSupabaseConfigured) {
      showToast('error', 'الربط غير مهيأ', 'يرجى إدخال المتغيرات VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY أولاً في الإعدادات.');
      return;
    }
    if (!window.confirm('تحذير: هل أنت متأكد من استيراد البيانات سحابياً؟ هذا سيقوم بدمج أو استبدال البيانات المحلية لديك بالبيانات المخزنة في سوبابيز.')) {
      return;
    }
    setIsSyncingPull(true);
    try {
      const result = await supabaseSyncService.pullFromSupabase();
      if (result.success) {
        showToast('success', 'نجاح الاسترداد السحابي', result.message);
        refreshData();
      } else {
        showToast('error', 'فشل الاسترداد', result.message);
      }
    } catch (err: any) {
      showToast('error', 'فشل الاسترداد السحابي', err.message || err);
    } finally {
      setIsSyncingPull(false);
    }
  };

  // Export Full Database
  const handleExportBackup = () => {
    const backupJson = storage.exportDatabaseJson();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esnad-government-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('success', 'تم تصدير النسخة الاحتياطية', 'تم تنزيل ملف قاعدة البيانات كاملاً.');
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">إعدادات المنظومة والتهيئة العامة</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            إدارة الفروع، شجرة الخدمات والأسعار، الموظفين والصلاحيات، والنسخ الاحتياطي.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSection('services')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'services'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الخدمات والتسعير
          </button>
          <button
            onClick={() => setActiveSection('branches')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'branches'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الفروع والخزائن
          </button>
          <button
            onClick={() => setActiveSection('employees')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'employees'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الموظفون والصلاحيات
          </button>
          <button
            onClick={() => setActiveSection('backup')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSection === 'backup'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            النسخ الاحتياطي
          </button>
        </div>
      </div>

      {/* SECTION 1: SERVICES & SPEEDS */}
      {activeSection === 'services' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>دليل الخدمات ونظام التنفيذ المرن</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                كافة الخدمات بتسعير حر وسرعة تنفيذ مرنة بدون تحديد مدة ملزمة.
              </p>
            </div>

            <button
              onClick={handleOpenNewService}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>إضافة خدمة جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(service => (
              <div
                key={service.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-slate-100 text-xs leading-relaxed">{service.name}</h4>
                  <button
                    onClick={() => handleOpenEditService(service)}
                    className="text-amber-400 hover:text-amber-300 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 shrink-0"
                  >
                    تعديل
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    خيارات السرعة المدعومة:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {service.speeds?.map(spd => (
                      <span
                        key={spd.code}
                        className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800"
                      >
                        {spd.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: BRANCHES */}
      {activeSection === 'branches' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>فروع المنظومة والخزائن المستقلة</span>
            </h3>

            <button
              onClick={() => setIsNewBranchModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>إضافة فرع جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {branches.map(branch => {
              const drawer = storage.getBranchDrawerBalance(branch.id);
              return (
                <div
                  key={branch.id}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-100 text-xs">{branch.name}</h4>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold">
                      {branch.code}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div>هاتف: {branch.phone || '-'}</div>
                    <div>العنوان: {branch.address || '-'}</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">رصيد الخزينة:</span>
                    <span className="font-black font-mono text-emerald-400">{Number(drawer || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: EMPLOYEES */}
      {activeSection === 'employees' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span>الموظفون والحسابات التشغيلية</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة أسماء الدخول، كلمات المرور (4 أرقام فأكثر)، وتحديد صلاحيات وفروع موظفي المنظومة.
              </p>
            </div>

            <button
              onClick={handleOpenNewEmployee}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition-all self-stretch sm:self-auto justify-center"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>إضافة موظف جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">الموظف والكود</th>
                  <th className="py-2.5 px-3">اسم الدخول (Username)</th>
                  <th className="py-2.5 px-3">كلمة المرور / PIN</th>
                  <th className="py-2.5 px-3">الدور والصلاحية</th>
                  <th className="py-2.5 px-3">الفرع التابع</th>
                  <th className="py-2.5 px-3 text-center">الحالة</th>
                  <th className="py-2.5 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map(emp => {
                  const b = branches.find(item => item.id === emp.branch_id);
                  const isRevealed = revealedPasswords[emp.id];
                  const passwordDisplay = emp.password || emp.pin_code || '1234';
                  const isInactive = emp.is_active === false;

                  return (
                    <tr key={emp.id} className={`hover:bg-slate-800/30 transition-colors ${isInactive ? 'opacity-60 bg-slate-950/40' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold text-xs">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100">{emp.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{emp.code || 'بدون كود'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-sky-400">{emp.username || emp.email || '-'}</div>
                        {emp.phone && <div className="text-[10px] text-slate-400">{emp.phone}</div>}
                      </td>

                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="font-mono font-bold tracking-wider text-amber-300 min-w-[3rem] text-center">
                            {isRevealed ? passwordDisplay : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(emp.id)}
                            className="text-slate-400 hover:text-amber-300 p-0.5 transition-colors"
                            title={isRevealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          >
                            {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          emp.role === 'manager'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : emp.role === 'viewer'
                            ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {emp.role === 'manager'
                            ? 'مدير عام (Manager)'
                            : emp.role === 'viewer'
                            ? 'مشاهد (Viewer)'
                            : 'موظف (Employee)'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-300 font-bold">{b?.name || 'كل الفروع (مركزي)'}</td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEmployeeStatus(emp)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                            !isInactive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                          title="انقر لتغيير حالة الحساب"
                        >
                          {!isInactive ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>نشط</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" />
                              <span>معطل</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditEmployee(emp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 border border-slate-700 transition-colors"
                            title="تعديل بيانات وكلمة مرور الموظف"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: DATA & BACKUP */}
      {activeSection === 'backup' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span>إدارة النسخ الاحتياطي وحماية البيانات</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تصدير قاعدة البيانات بالكامل بصيغة JSON أو مزامنتها سحابياً مع جداول Supabase.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 text-xs">تصدير قاعدة البيانات (Dump JSON)</h4>
              <p className="text-xs text-slate-400">
                قم بتحميل نسخة احتياطية فورية تشمل كافة العمليات، القيود المالية، الموزعين، المكاتب، والإغلاقات.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>تحميل نسخة احتياطية كاملة (.json)</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 text-xs">المزامنة السحابية (Supabase Sync)</h4>
              
              {isSupabaseConfigured ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>سوبابيز متصل ونشط سحابياً ({import.meta.env.VITE_SUPABASE_URL?.replace('https://', '').split('.')[0]})</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    يمكنك مزامنة ورفع البيانات المحلية الحالية إلى جداول سوبابيز، أو استرداد وسحب البيانات السحابية إلى جهازك.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSyncingPush}
                      onClick={handlePushToSupabase}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Upload className={`w-3.5 h-3.5 ${isSyncingPush ? 'animate-bounce' : ''}`} />
                      <span>{isSyncingPush ? 'جاري الرفع...' : 'رفع البيانات ⬆'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingPull}
                      onClick={handlePullFromSupabase}
                      className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Download className={`w-3.5 h-3.5 ${isSyncingPull ? 'animate-bounce' : ''}`} />
                      <span>{isSyncingPull ? 'جاري السحب...' : 'سحب البيانات ⬇'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>الربط السحابي غير مفعل</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    يرجى تهيئة المتغيرات <code className="text-amber-400 font-mono">VITE_SUPABASE_URL</code> و <code className="text-amber-400 font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> في إعدادات التطبيق لتفعيل المزامنة السحابية الفورية.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 text-xs">حالة الاتصال والحماية</h4>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>محرك التخزين الصامد (Resilient Local Engine) نشط</span>
                </div>
                <div className="flex items-center gap-2 text-sky-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نظام Idempotency Key مفعل لكافة المعاملات المالية</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Branch Modal */}
      <Modal
        isOpen={isNewBranchModalOpen}
        onClose={() => setIsNewBranchModalOpen(false)}
        title="إضافة فرع جديد"
        subtitle="إنشاء فرع بخزينة نقدية مستقلة"
        maxWidth="md"
      >
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم الفرع <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={bName}
              onChange={(e) => setBName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: فرع الدقي"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                كود الفرع <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={bCode}
                onChange={(e) => setBCode(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="DQ-04"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">هاتف الفرع:</label>
              <input
                type="tel"
                value={bPhone}
                onChange={(e) => setBPhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="02xxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">عنوان الفرع:</label>
            <input
              type="text"
              value={bAddress}
              onChange={(e) => setBAddress(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="شارع مصدق، الدقي"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs"
            >
              حفظ الفرع
            </button>
            <button
              type="button"
              onClick={() => setIsNewBranchModalOpen(false)}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Create/Edit Service Modal */}
      <Modal
        isOpen={isNewServiceModalOpen}
        onClose={() => {
          setIsNewServiceModalOpen(false);
          setEditingServiceId(null);
        }}
        title={editingServiceId ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
        subtitle="قم بتعريف الخدمات المتاحة للتسجيل بنظام التسعير الحر"
        maxWidth="md"
      >
        <form onSubmit={handleSaveService} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              اسم الخدمة <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              required
              value={sName}
              onChange={(e) => setSName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: استخراج قيد عائلي مميكن"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              سعر استرشادي (اختياري):
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={sBasePrice}
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
                setSBasePrice(val);
              }}
              placeholder="0 (تسعير حر بالمعاملة)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              * التسعير في المنظومة تسعير حر ومرن يتم تحديده مباشرة أثناء إنشاء كل معاملة.
            </p>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs"
            >
              حفظ الخدمة
            </button>
            {editingServiceId && (
              !isConfirmingDeleteService ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDeleteService(true)}
                  className="px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteService}
                  className="px-4 bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  تأكيد الحذف؟
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setIsNewServiceModalOpen(false);
                setEditingServiceId(null);
                setIsConfirmingDeleteService(false);
              }}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Employee Modal */}
      <Modal
        isOpen={isNewEmployeeModalOpen}
        onClose={() => {
          setIsNewEmployeeModalOpen(false);
          setEditingEmpId(null);
          setIsConfirmingDeleteEmp(false);
        }}
        title={editingEmpId ? 'تعديل بيانات وحساب الموظف' : 'إضافة موظف / مستخدم جديد'}
        subtitle={
          editingEmpId
            ? 'تحديث الاسم، اسم الدخول، كلمة المرور والصلاحيات التشغيلية'
            : 'تعيين اسم الموظف، اسم الدخول، كلمة المرور (4 أرقام فأكثر) وتحديد الصلاحيات'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم الموظف الثلاثي <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={eName}
                onChange={(e) => setEName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="مثال: أحمد محمود علي"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم الدخول (Username) <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={eUsername}
                onChange={(e) => setEUsername(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="مثال: ahmed.ali أو ahmed123"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password Field with 4+ char validation and toggle view */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200">
                كلمة المرور / رمز الدخول (Password) <span className="text-rose-400">*</span>:
              </label>
              <button
                type="button"
                onClick={() => setIsPasswordVisibleInModal(!isPasswordVisibleInModal)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                {isPasswordVisibleInModal ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>إخفاء كلمة المرور</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>إظهار كلمة المرور</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type={isPasswordVisibleInModal ? 'text' : 'password'}
                required
                value={ePassword}
                onChange={(e) => setEPassword(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="أدخل كلمة المرور (4 أرقام أو رموز على الأقل)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono tracking-wider focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              {ePassword.length >= 4 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>كلمة مرور مقبولة ({ePassword.length} خانة)</span>
                </span>
              ) : ePassword.length > 0 ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>كلمة المرور قصيرة (يتبقى {4 - ePassword.length} خانات على الأقل)</span>
                </span>
              ) : (
                <span className="text-slate-400">
                  * يُشترط أن تتكون كلمة المرور من 4 أرقام أو رموز فأكثر
                </span>
              )}
              <span className="text-slate-500 font-mono">الحد الأدنى: 4</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Employee Code */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                كود الموظف:
              </label>
              <input
                type="text"
                value={eCode}
                onChange={(e) => setECode(e.target.value.toUpperCase())}
                placeholder="EMP-01"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم الهاتف:
              </label>
              <input
                type="tel"
                value={ePhone}
                onChange={(e) => setEPhone(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="010xxxxxxxx"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                البريد الإلكتروني (اختياري):
              </label>
              <input
                type="email"
                value={eEmail}
                onChange={(e) => setEEmail(e.target.value)}
                placeholder="name@esnad.eg"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <ModalSelect
                label="الصلاحية / الدور التشغيلي:"
                modalTitle="تحديد الدور والصلاحية"
                modalSubtitle="اختر مستوى الصلاحيات الممنوحة للموظف"
                value={eRole}
                onChange={(val) => setERole(val as any)}
                options={[
                  { value: 'manager', label: 'مدير عام (Manager) - كامل الصلاحيات والإعدادات' },
                  { value: 'employee', label: 'موظف (Employee) - تسجيل العمليات والتحصيل والمصروفات' },
                  { value: 'viewer', label: 'مشاهد (Viewer) - استعراض ومتابعة التقارير فقط' },
                ]}
              />
            </div>
            <div>
              <ModalSelect
                label="الفرع المعين به:"
                modalTitle="تحديد الفرع التابع"
                modalSubtitle="اختر الفرع الأساسي لعمل الموظف"
                value={eBranchId}
                onChange={(val) => setEBranchId(val)}
                options={[
                  { value: '', label: 'جميع الفروع (مركزي)' },
                  ...branches.map(b => ({
                    value: b.id,
                    label: b.name,
                    badge: b.code,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Active status */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="eIsActiveToggle"
                checked={eIsActive}
                onChange={(e) => setEIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-900 cursor-pointer"
              />
              <label htmlFor="eIsActiveToggle" className="text-xs font-bold text-slate-200 cursor-pointer">
                حساب الموظف نشط ومتاح لتسجيل الدخول وإجراء العمليات
              </label>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eIsActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {eIsActive ? 'نشط' : 'معطل'}
            </span>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all"
            >
              {editingEmpId ? 'حفظ التعديلات' : 'إضافة الموظف'}
            </button>

            {editingEmpId && (
              !isConfirmingDeleteEmp ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDeleteEmp(true)}
                  className="px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الموظف
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteEmployee}
                  className="px-4 bg-rose-500 hover:bg-rose-600 text-white border border-rose-600 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  تأكيد حذف الحساب؟
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => {
                setIsNewEmployeeModalOpen(false);
                setEditingEmpId(null);
                setIsConfirmingDeleteEmp(false);
              }}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
