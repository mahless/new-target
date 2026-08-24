/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * System Audit & Compliance Logs View (Read-Only)
 * Comprehensive Traceability, Action Audit Trail & Forensic Detail Inspection
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebounce } from '../../hooks/useDebounce';
import { AuditLog } from '../../types';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Calendar,
  Building,
  User,
  Activity,
  Lock,
  Download,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, branches, employees } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLog | null>(null);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (debouncedSearchQuery.trim() !== '') {
        const q = debouncedSearchQuery.toLowerCase();
        const entityText = (log.entity_name || log.entity || '').toLowerCase();
        const matches =
          log.action.toLowerCase().includes(q) ||
          log.employee_name.toLowerCase().includes(q) ||
          entityText.includes(q) ||
          (log.entity_id && log.entity_id.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (branchFilter !== 'all' && log.branch_id !== branchFilter) return false;
      if (actionFilter !== 'all' && !log.action.includes(actionFilter)) return false;

      return true;
    });
  }, [auditLogs, debouncedSearchQuery, branchFilter, actionFilter]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('حذف') || action.includes('إلغاء')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    if (action.includes('تحصيل') || action.includes('تسجيل') || action.includes('إنشاء')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('تحويل') || action.includes('إغلاق')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  };

  return (
    <div id="audit-logs-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-slate-100">
              سجل الرقابة والتتبع الأمني والمالي (Audit Log)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            سجل توثيق رقابي ثابت وغير قابل للتعديل أو الحذف (Read-only) يرصد كافة الإجراءات بدقة زمنية.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>حماية مشددة • لا يمكن تفريغ السجلات</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="بحث في السجل: اسم الموظف، نوع الإجراء، معرف المعاملة..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <ModalSelect
              modalTitle="تصفية السجل حسب الفرع"
              modalSubtitle="اختر الفرع لعرض عملياته وسجلاته"
              value={branchFilter}
              onChange={(val) => setBranchFilter(val)}
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
          </div>

          <div className="md:col-span-3">
            <ModalSelect
              modalTitle="تصفية حسب نوع العملية"
              modalSubtitle="اختر نوع العملية المسجلة في السجل الرقابي"
              value={actionFilter}
              onChange={(val) => setActionFilter(val)}
              options={[
                { value: 'all', label: 'جميع أنواع العمليات' },
                { value: 'تسجيل', label: 'تسجيل معاملة' },
                { value: 'تحصيل', label: 'تحصيل مالي' },
                { value: 'مصروف', label: 'صرف مصروف' },
                { value: 'تحويل', label: 'تحويل بين فروع' },
                { value: 'إغلاق', label: 'إغلاق يومي' },
                { value: 'تحديث', label: 'تحديث حالة' },
              ]}
              buttonClassName="!py-2 !text-xs"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">التاريخ والتوقيت</th>
                <th className="py-3 px-4 font-semibold">الفرع</th>
                <th className="py-3 px-4 font-semibold">الموظف القائم بالإجراء</th>
                <th className="py-3 px-4 font-semibold">نوع الإجراء والحدث</th>
                <th className="py-3 px-4 font-semibold">الكيان المعني</th>
                <th className="py-3 px-4 font-semibold text-center">التفاصيل الفنية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    لا توجد سجلات رقابة مطابقة للفلتر.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const b = branches.find(item => item.id === log.branch_id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        <div>{new Date(log.created_at).toLocaleDateString('ar-EG-u-nu-latn')}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-300">{b?.name || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{log.employee_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {log.employee_id ? log.employee_id.slice(0, 8) : 'System'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {log.entity_name} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedLogForDetail(log)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition-colors"
                        >
                          معاينة
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

      {/* Detail JSON Modal */}
      <Modal
        isOpen={Boolean(selectedLogForDetail)}
        onClose={() => setSelectedLogForDetail(null)}
        title="تفاصيل القيد الرقابي والأدلة الفنية"
        subtitle={`الإجراء: ${selectedLogForDetail?.action} • التاريخ: ${
          selectedLogForDetail ? new Date(selectedLogForDetail.created_at).toLocaleString('ar-EG-u-nu-latn') : ''
        }`}
        maxWidth="lg"
      >
        {selectedLogForDetail && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">معرف القيد (Audit ID):</span>
                <span className="font-mono text-slate-200">{selectedLogForDetail.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الموظف:</span>
                <span className="font-bold text-slate-100">{selectedLogForDetail.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الفرع:</span>
                <span className="font-bold text-slate-100">
                  {branches.find(b => b.id === selectedLogForDetail.branch_id)?.name || 'غير محدد'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الكيان المتأثر:</span>
                <span className="font-mono text-amber-400">{selectedLogForDetail.entity_name}</span>
              </div>
            </div>

            {/* Metadata Payload Box */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-1.5">بيانات وحمولة الحدث (Payload):</div>
              <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto max-h-56">
                {JSON.stringify(
                  {
                    changes: selectedLogForDetail.changes,
                    metadata: selectedLogForDetail.metadata,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
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
