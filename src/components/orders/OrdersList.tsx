/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Orders List with Multi-Criteria Filtering & Operational Actions
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ServiceOrder } from '../../types';
import {
  Search,
  Filter,
  Layers,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  Eye,
  DollarSign,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';
import { OrderDetailsModal } from './OrderDetailsModal';
import { CollectPaymentModal } from './CollectPaymentModal';
import { ModalSelect } from '../common/ModalSelect';
import { formatSpeedLabel } from '../../lib/formatters';

export const OrdersList: React.FC = () => {
  const {
    orders,
    branches,
    services,
    distributors,
    activeBranch,
    setActiveTab,
    selectedOrderIdForModal,
    setSelectedOrderIdForModal,
  } = useApp();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all'); // all | unpaid | fully_paid
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  // Quick Action Modal states
  const [collectPaymentOrder, setCollectPaymentOrder] = useState<ServiceOrder | null>(null);

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Text Search across fields
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          order.order_number.toLowerCase().includes(query) ||
          order.customer_name.toLowerCase().includes(query) ||
          order.customer_phone.includes(query) ||
          (order.customer_national_id && order.customer_national_id.includes(query)) ||
          (order.form_barcode && order.form_barcode.toLowerCase().includes(query)) ||
          (order.notes && order.notes.toLowerCase().includes(query));

        if (!matchesQuery) return false;
      }

      // 2. Branch Filter
      if (branchFilter !== 'all') {
        if (order.current_branch_id !== branchFilter && order.creation_branch_id !== branchFilter) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'all') {
        if (order.status !== statusFilter) return false;
      }

      // 4. Payment Filter
      if (paymentFilter === 'unpaid' && order.remaining <= 0) return false;
      if (paymentFilter === 'fully_paid' && order.remaining > 0) return false;

      // 5. Service Filter
      if (serviceFilter !== 'all' && order.service_id !== serviceFilter) return false;

      return true;
    });
  }, [orders, searchTerm, branchFilter, statusFilter, paymentFilter, serviceFilter]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const getStatusBadge = (status: ServiceOrder['status']) => {
    const map = {
      pending: { label: 'قيد الانتظار', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      in_progress: { label: 'قيد التنفيذ', class: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
      completed: { label: 'جاهز للاستلام', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      delivered: { label: 'تم التسليم', class: 'bg-slate-700/40 text-slate-300 border-slate-700' },
      cancelled: { label: 'ملغي', class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${s.class}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div id="orders-list-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Controls Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
              <span>سجل العمليات</span>
            </h2>
          </div>

          <div className="w-full md:w-[400px] relative shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="orders-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="بحث بالاسم، الهاتف، الرقم القومي، الباركود، رقم المعاملة..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Multi-Filters Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Branch Filter */}
          <div>
            <ModalSelect
              modalTitle="تصفية حسب الفرع"
              modalSubtitle="اختر الفرع لعرض معاملاته فقط"
              value={branchFilter}
              onChange={(val) => setBranchFilter(val)}
              options={[
                { value: 'all', label: 'جميع الفروع' },
                ...branches.map(b => ({
                  value: b.id,
                  label: b.name,
                  badge: b.code,
                  icon: Building,
                })),
              ]}
              buttonClassName="!py-2.5"
            />
          </div>

          {/* Status Filter */}
          <div>
            <ModalSelect
              modalTitle="تصفية حسب حالة المعاملة"
              modalSubtitle="اختر الحالة الإجرائية المطلوبة"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'جميع الحالات' },
                { value: 'pending', label: 'قيد الانتظار' },
                { value: 'in_progress', label: 'قيد التنفيذ' },
                { value: 'completed', label: 'جاهز للاستلام' },
                { value: 'delivered', label: 'تم التسليم' },
                { value: 'cancelled', label: 'ملغي' },
              ]}
              buttonClassName="!py-2.5"
            />
          </div>

          {/* Payment Status Filter */}
          <div>
            <ModalSelect
              modalTitle="تصفية حسب حالة التحصيل المالي"
              modalSubtitle="اختر حالة السداد والمتبقي المالي"
              value={paymentFilter}
              onChange={(val) => setPaymentFilter(val)}
              options={[
                { value: 'all', label: 'جميع حالات التحصيل' },
                { value: 'unpaid', label: 'بها متبقي مالي (دفع جزئي)' },
                { value: 'fully_paid', label: 'مسددة بالكامل' },
              ]}
              buttonClassName="!py-2.5"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">رقم المعاملة</th>
                <th className="py-3 px-4 font-semibold">العميل</th>
                <th className="py-3 px-4 font-semibold">الخدمة والسرعة</th>
                <th className="py-3 px-4 font-semibold">الفرع الحالي</th>
                <th className="py-3 px-4 font-semibold">سعر الخدمة</th>
                <th className="py-3 px-4 font-semibold">المدفوع</th>
                <th className="py-3 px-4 font-semibold">المتبقي</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
                <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500">
                    لا توجد معاملات مطابقة لمعايير البحث والفلترة.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const currBranch = branches.find(b => b.id === order.current_branch_id);
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-400">{order.order_number}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(order.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{order.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{order.customer_phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-semibold">{order.service_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatSpeedLabel(order.speed)} {order.form_barcode && `• #${order.form_barcode}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 font-medium">{currBranch?.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {formatCurrency(order.price)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {formatCurrency(order.total_paid)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {order.remaining > 0 ? (
                          <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            {formatCurrency(order.remaining)}
                          </span>
                        ) : (
                          <span className="text-slate-500">خالص</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderIdForModal(order.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[11px] transition-colors"
                            title="عرض تفاصيل وسجل التتبع"
                          >
                            تفاصيل
                          </button>

                          {order.remaining > 0 && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setCollectPaymentOrder(order)}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold rounded-lg text-[11px] transition-colors"
                              title="تحصيل الدفعة المتبقية"
                            >
                              سداد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details & Audit Modal */}
      <OrderDetailsModal
        orderId={selectedOrderIdForModal}
        isOpen={Boolean(selectedOrderIdForModal)}
        onClose={() => setSelectedOrderIdForModal(null)}
      />

      {/* Quick Collect Payment Modal */}
      <CollectPaymentModal
        order={collectPaymentOrder}
        isOpen={Boolean(collectPaymentOrder)}
        onClose={() => setCollectPaymentOrder(null)}
      />
    </div>
  );
};
