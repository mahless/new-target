/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Comprehensive Order Details & Audit Timeline Modal
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { ServiceOrder } from '../../types';
import { Modal } from '../common/Modal';
import {
  User,
  Phone,
  CreditCard,
  Barcode,
  Calendar,
  Building,
  Users2,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  ArrowRightLeft,
  DollarSign,
  FileCheck,
} from 'lucide-react';
import { CollectPaymentModal } from './CollectPaymentModal';
import { TransferBranchModal } from './TransferBranchModal';

interface OrderDetailsModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  orderId,
  isOpen,
  onClose,
}) => {
  const {
    orders,
    branches,
    employees,
    payments,
    distributors,
    externalOffices,
    auditLogs,
    refreshData,
    showToast,
    activeEmployee,
  } = useApp();

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [statusChangeNote, setStatusChangeNote] = useState('');

  if (!orderId || !isOpen) return null;

  const order = orders.find(o => o.id === orderId || o.order_number === orderId);
  if (!order) return null;

  const orderPayments = payments.filter(p => p.order_id === order.id);
  const creationBranch = branches.find(b => b.id === order.creation_branch_id);
  const currentBranch = branches.find(b => b.id === order.current_branch_id);
  const deliveryBranch = branches.find(b => b.id === order.delivery_branch_id);
  const createdByEmp = employees.find(e => e.id === order.created_by_employee_id);
  const distributor = distributors.find(d => d.id === order.distributor_id);
  const externalOffice = externalOffices.find(o => o.id === order.external_office_id);

  // Relevant Audit logs
  const orderAuditLogs = auditLogs.filter(
    l => l.entity_id === order.id || l.metadata?.orderNumber === order.order_number
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleStatusChange = (newStatus: ServiceOrder['status']) => {
    try {
      storage.updateOrderStatus(order.id, newStatus, statusChangeNote, activeEmployee?.id);
      refreshData();
      showToast('success', 'تم تحديث حالة المعاملة', `تم تغيير الحالة إلى: ${newStatus}`);
      setStatusChangeNote('');
    } catch (err: any) {
      showToast('error', 'فشل التحديث', err.message);
    }
  };

  const getStatusBadge = (status: ServiceOrder['status']) => {
    const map = {
      pending: { label: 'قيد الانتظار', class: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
      in_progress: { label: 'قيد التنفيذ', class: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
      completed: { label: 'جاهز للاستلام', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
      delivered: { label: 'تم التسليم للعميل', class: 'bg-slate-700/50 text-slate-300 border-slate-700' },
      cancelled: { label: 'ملغي ومسترجع', class: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${s.class}`}>
        {s.label}
      </span>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`معاملة رقم: ${order.order_number}`}
        subtitle={`بتاريخ: ${new Date(order.created_at).toLocaleDateString('ar-EG-u-nu-latn')} • ${new Date(order.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}`}
        maxWidth="3xl"
      >
        <div className="space-y-6">
          {/* Top Actions & Status Banner */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">الحالة التشغيلية:</span>
              {getStatusBadge(order.status)}
            </div>

            <div className="flex items-center gap-2">
              {order.remaining > 0 && order.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-sm transition-all"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>تحصيل متبقي ({formatCurrency(order.remaining)})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>تحويل لفرع آخر</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
              </button>
            </div>
          </div>

          {/* Customer & Service Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>بيانات العميل</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الاسم:</span>
                <span className="font-bold text-slate-100">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الهاتف:</span>
                <span className="font-mono font-bold text-slate-200">{order.customer_phone}</span>
              </div>
              {order.customer_national_id && (
                <div className="flex justify-between">
                  <span className="text-slate-400">الرقم القومي:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {order.customer_national_id}
                  </span>
                </div>
              )}
            </div>

            {/* Service Specs Box */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                <span>تفاصيل الخدمة والفرع</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">نوع الخدمة:</span>
                <span className="font-bold text-slate-100">{order.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">سرعة التنفيذ:</span>
                <span className="font-bold text-amber-400">{order.speed}</span>
              </div>
              {order.form_barcode && (
                <div className="flex justify-between">
                  <span className="text-slate-400">رقم الباركود / الاستمارة:</span>
                  <span className="font-mono font-bold text-slate-200">{order.form_barcode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">فرع الإنشاء:</span>
                <span className="text-slate-300 font-bold">{creationBranch?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">فرع التسليم الحالي:</span>
                <span className="text-emerald-400 font-bold">{deliveryBranch?.name || currentBranch?.name}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>الحسابات والدفعات المسجلة للعملية</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">سعر الخدمة</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {formatCurrency(order.price)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">إجمالي المسدد</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {formatCurrency(order.total_paid)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">المتبقي</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    order.remaining > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {formatCurrency(order.remaining)}
                </span>
              </div>
            </div>

            {/* Individual Payments Ledger for this order */}
            {orderPayments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 mb-2">
                  سجل الدفعات المستقلة (Transactions):
                </div>
                <div className="space-y-1.5">
                  {orderPayments.map((pmt, idx) => {
                    const pmtBranch = branches.find(b => b.id === pmt.branch_id);
                    const pmtEmp = employees.find(e => e.id === pmt.employee_id);
                    return (
                      <div
                        key={pmt.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200">
                            {formatCurrency(pmt.amount)}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            (كاش: {pmt.cash_amount} • إلكتروني: {pmt.electronic_amount})
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] font-mono">
                          {pmtBranch?.name} • الموظف: {pmtEmp?.name} •{' '}
                          {new Date(pmt.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* External Office / Distributor info if attached */}
          {(distributor || externalOffice) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {distributor && (
                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/20 text-xs space-y-1">
                  <div className="font-bold text-sky-400">الموزع التابع للعملية:</div>
                  <div className="text-slate-200 font-bold">{distributor.name}</div>
                  <div className="text-slate-400 text-[11px]">
                    قيدت قيمة الخدمة ({formatCurrency(order.price)}) على حساب الموزع.
                  </div>
                </div>
              )}

              {externalOffice && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs space-y-1">
                  <div className="font-bold text-amber-400">المكتب الخارجي المنفذ:</div>
                  <div className="text-slate-200 font-bold">{externalOffice.name}</div>
                  <div className="text-slate-400 text-[11px]">
                    تكلفة المكتب: {formatCurrency(order.external_office_cost)} • هامش ربحنا:{' '}
                    <span className="text-emerald-400 font-bold">
                      {formatCurrency(order.office_margin)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Quick Controller Buttons */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300">تحديث حالة المعاملة:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('in_progress')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  order.status === 'in_progress'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                قيد التنفيذ
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  order.status === 'completed'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                جاهز للاستلام
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('delivered')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  order.status === 'delivered'
                    ? 'bg-slate-600 text-white border-slate-500 font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                تم التسليم للعميل
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('cancelled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  order.status === 'cancelled'
                    ? 'bg-rose-500 text-white border-rose-400 font-black'
                    : 'bg-slate-900 text-rose-400 border-slate-700 hover:border-rose-900'
                }`}
              >
                إلغاء المعاملة
              </button>
            </div>
          </div>

          {/* Deep Audit Timeline (Who performed each step, in which branch and when) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>سجل التتبع والموظفين (Audit Timeline):</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {orderAuditLogs.length === 0 ? (
                <div className="p-3 bg-slate-950 rounded-xl text-xs text-slate-400">
                  تم تسجيل المعاملة بواسطة {createdByEmp?.name || 'الموظف'} في فرع{' '}
                  {creationBranch?.name} بتاريخ{' '}
                  {new Date(order.created_at).toLocaleDateString('ar-EG-u-nu-latn')}.
                </div>
              ) : (
                orderAuditLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-start justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{log.action}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        الموظف: <span className="text-amber-400 font-semibold">{log.employee_name}</span> •{' '}
                        {branches.find(b => b.id === log.branch_id)?.name || 'الفرع'}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleDateString('ar-EG-u-nu-latn')}{' '}
                      {new Date(log.created_at).toLocaleTimeString('ar-EG-u-nu-latn')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Collect Remaining Payment Modal */}
      <CollectPaymentModal
        order={order}
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
      />

      {/* Transfer Branch Modal */}
      <TransferBranchModal
        order={order}
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </>
  );
};
