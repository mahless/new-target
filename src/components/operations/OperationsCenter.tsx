/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fast Real-time Operations Center (مركز العمليات السريع)
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Receipt,
  Wallet,
  Users,
  Building,
  QrCode,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  User,
  Building2,
} from 'lucide-react';
import { ServiceOrder } from '../../types';
import { formatSpeedLabel } from '../../lib/formatters';
import { OrderDetailsModal } from '../orders/OrderDetailsModal';
import { CollectPaymentModal } from '../orders/CollectPaymentModal';
import { matchIds } from '../../lib/storage';

export const OperationsCenter: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    orders,
    stats,
    drawerBalance,
    employeeDrawerBalance,
    branchDrawerBalance,
    financialViewScope,
    setFinancialViewScope,
    setActiveTab,
    selectedOrderIdForModal,
    setSelectedOrderIdForModal,
    services,
  } = useApp();

  const [collectPaymentOrder, setCollectPaymentOrder] = useState<ServiceOrder | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Enforce scope lock: Non-managers can ONLY see their own employee custody
  useEffect(() => {
    if (activeEmployee?.role !== 'manager' && financialViewScope !== 'employee') {
      setFinancialViewScope('employee');
    }
  }, [activeEmployee, financialViewScope, setFinancialViewScope]);

  // Filter current branch orders using matchIds for resilient matching
  const branchOrders = orders.filter(o => {
    const isBranchMatch = matchIds(o.current_branch_id, activeBranch?.id) || matchIds(o.creation_branch_id, activeBranch?.id) || !activeBranch;
    if (financialViewScope === 'employee' && activeEmployee?.id) {
      return isBranchMatch && matchIds(o.created_by_employee_id, activeEmployee.id);
    }
    return isBranchMatch;
  });

  // Fast search filter (debounced to avoid heavy recalculation on every keystroke)
  const filteredQuickOrders = debouncedSearchQuery.trim()
    ? orders.filter(
        o =>
          o.order_number.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          o.customer_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          o.customer_phone.includes(debouncedSearchQuery) ||
          (o.customer_national_id && o.customer_national_id.includes(debouncedSearchQuery)) ||
          (o.form_barcode && o.form_barcode.includes(debouncedSearchQuery))
      )
    : [];

  // Urgent pending deliveries
  const pendingDeliveries = branchOrders.filter(
    o => o.status === 'in_progress' || o.status === 'completed'
  ).slice(0, 5);

  // Orders with remaining unpaid money
  const unpaidOrders = branchOrders.filter(
    o => o.remaining > 0 && o.status !== 'cancelled'
  ).slice(0, 5);

  // Today's orders for the selected scope & branch (resets daily)
  const localToday = new Date().toLocaleDateString('en-CA');
  const todayBranchOrders = branchOrders.filter(o => {
    try {
      return new Date(o.created_at).toLocaleDateString('en-CA') === localToday;
    } catch {
      return (o.created_at || '').startsWith(localToday);
    }
  });

  // Recent today's orders
  const recentOrders = todayBranchOrders;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
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
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.class}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div id="operations-center-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Financial Scope Header Indicator & Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
            financialViewScope === 'employee'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {financialViewScope === 'employee' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                {financialViewScope === 'employee'
                  ? `عهدة الموظف: ${activeEmployee?.name || 'الموظف الحالي'}`
                  : `إجمالي خزينة فرع: ${activeBranch?.name || 'الفرع الحالي'}`}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {financialViewScope === 'employee' ? 'حساب شخصي مستقل' : 'إجمالي مجمع'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {financialViewScope === 'employee'
                ? 'تعرض الأرقام المقبوضات والمصروفات ورصيد الكاش المحصل بيدك فقط'
                : 'تعرض الأرقام إجمالي كافة عمليات وموظفي الفرع مجتمعة'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl w-full sm:w-auto justify-center">
          <button
            id="scope-toggle-employee-btn"
            onClick={() => setFinancialViewScope('employee')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              financialViewScope === 'employee'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>عهدتي الشخصية</span>
          </button>

          {activeEmployee?.role === 'manager' ? (
            <button
              id="scope-toggle-branch-btn"
              onClick={() => setFinancialViewScope('branch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                financialViewScope === 'branch'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>إجمالي الفرع</span>
            </button>
          ) : (
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 opacity-60 cursor-not-allowed flex items-center gap-1.5"
              title="خاص بمدير الفرع فقط"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>إجمالي الفرع (مدير)</span>
            </div>
          )}
        </div>
      </div>

      {/* Non-traditional High-Density Operational Summary Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{financialViewScope === 'employee' ? 'صافي كاش عهدتي اليوم' : 'صافي كاش الفرع اليوم'}</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono tracking-tight ${
              (stats.todayNetCash ?? (stats.todayCashIn - stats.todayCashOut)) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatCurrency(stats.todayNetCash ?? (stats.todayCashIn - stats.todayCashOut))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {financialViewScope === 'employee' ? 'صافي النقدية بعهدتك لليوم (تتصفر يومياً)' : 'صافي النقدية الحاضرة لليوم (تتصفر يومياً)'}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{financialViewScope === 'employee' ? 'تحصيلاتي اليوم' : 'تحصيلات الفرع اليوم'}</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {formatCurrency(stats.todayCashIn + stats.todayElectronic)}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
              <span className="text-emerald-400">كاش: {formatCurrency(stats.todayCashIn)}</span>
              <span>•</span>
              <span className="text-sky-400">إلكتروني: {formatCurrency(stats.todayElectronic)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{financialViewScope === 'employee' ? 'مصروفاتي اليوم' : 'مصروفات الفرع اليوم'}</span>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-400 font-mono tracking-tight">
              {formatCurrency(stats.todayCashOut)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {financialViewScope === 'employee' ? 'تم خصمها من عهدتك اليومية' : 'تم خصمها آلياً من نقدية اليوم'}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>{financialViewScope === 'employee' ? 'معاملاتي اليوم' : 'معاملات الفرع اليوم'}</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-sky-400 font-mono tracking-tight">
              {(stats.todayOrdersCount ?? 0)} معاملة
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              إجمالي الطلبات المسجلة اليوم (تتصفر يومياً)
            </p>
          </div>
        </div>
      </div>

      {/* Two High-Priority Operational Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue 1: Deliveries & Ready for Pickup */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black text-slate-100">التسليم والمتابعة بالفرع</h3>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {pendingDeliveries.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                لا توجد استلامات معلقة في هذا الفرع حالياً.
              </div>
            ) : (
              pendingDeliveries.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-400">{order.order_number}</span>
                      <span className="text-xs font-bold text-slate-200">{order.customer_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {order.service_name} • <span className="text-slate-300">{order.customer_phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.status)}
                    <button
                      onClick={() => setSelectedOrderIdForModal(order.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors"
                    >
                      تفاصيل
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Queue 2: Uncollected Remaining Balances */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-black text-slate-100">تحصيلات متبقية مستحقة على العملاء</h3>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              إجمالي: {formatCurrency(stats.unpaidRemainingTotal)}
            </span>
          </div>

          <div className="space-y-2.5">
            {unpaidOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                جميع المعاملات في هذا الفرع مدفوعة بالكامل.
              </div>
            ) : (
              unpaidOrders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-400">{order.order_number}</span>
                      <span className="text-xs font-bold text-slate-200">{order.customer_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      سعر الخدمة: {formatCurrency(order.price)} • سُدّد: {formatCurrency(order.total_paid)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      متبقي: {formatCurrency(order.remaining)}
                    </span>
                    <button
                      onClick={() => setCollectPaymentOrder(order)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg shadow-sm transition-colors"
                    >
                      تحصيل
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>



      {/* Recent Activity Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-100">
              {financialViewScope === 'employee' ? 'معاملاتي المسجلة اليوم' : 'معاملات اليوم المسجلة بالفرع'}
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
              {recentOrders.length} معاملة اليوم
            </span>
          </div>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
          >
            <span>عرض سجل العمليات بالكامل</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80 pb-2">
                <th className="py-2.5 px-3 font-semibold">رقم العملية</th>
                <th className="py-2.5 px-3 font-semibold">العميل</th>
                <th className="py-2.5 px-3 font-semibold">الخدمة والسرعة</th>
                <th className="py-2.5 px-3 font-semibold">سعر الخدمة</th>
                <th className="py-2.5 px-3 font-semibold">المدفوع</th>
                <th className="py-2.5 px-3 font-semibold">المتبقي</th>
                <th className="py-2.5 px-3 font-semibold">الحالة</th>
                <th className="py-2.5 px-3 font-semibold">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-500">
                    لا توجد معاملات مسجلة اليوم حتى الآن. ابدأ بتسجيل معاملة جديدة.
                  </td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">{order.order_number}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-200">{order.customer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.customer_phone}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-medium">{order.service_name}</div>
                      <div className="text-[10px] text-slate-400">السرعة: {formatSpeedLabel(order.speed)}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {formatCurrency(order.price)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                      {formatCurrency(order.total_paid)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {order.remaining > 0 ? (
                        <span className="text-rose-400">{formatCurrency(order.remaining)}</span>
                      ) : (
                        <span className="text-slate-400">خالص</span>
                      )}
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(order.status)}</td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedOrderIdForModal(order.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-md text-[11px] transition-colors"
                      >
                        معاينة
                      </button>
                    </td>
                  </tr>
                ))
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
