/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Transfer Order Execution/Delivery Branch Modal
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../lib/storage';
import { ServiceOrder } from '../../types';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';
import { Building2, ArrowRightLeft, Save } from 'lucide-react';

interface TransferBranchModalProps {
  order: ServiceOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransferBranchModal: React.FC<TransferBranchModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { branches, refreshData, showToast } = useApp();
  const [targetBranchId, setTargetBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order) return null;

  const currentBranch = branches.find(b => b.id === order.current_branch_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      showToast('error', 'اختر الفرع', 'يرجى اختيار الفرع المستهدف لنقل المعاملة إليه.');
      return;
    }
    if (targetBranchId === order.current_branch_id) {
      showToast('warning', 'نفس الفرع', 'المعاملة موجودة بالفعل في هذا الفرع.');
      return;
    }

    try {
      setIsSubmitting(true);
      storage.transferOrderExecutionBranch(order.id, targetBranchId, notes);
      refreshData();
      const targetBranch = branches.find(b => b.id === targetBranchId);
      showToast(
        'success',
        'تم نقل مسار المعاملة',
        `تم تحويل المعاملة ${order.order_number} بنجاح إلى فرع ${targetBranch?.name}.`
      );
      onClose();
    } catch (err: any) {
      showToast('error', 'فشل التحويل', err.message || 'حدث خطأ أثناء نقل المعاملة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحويل مسار المعاملة إلى فرع آخر"
      subtitle={`المعاملة: ${order.order_number} • العميل: ${order.customer_name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
          <div className="text-slate-400">الفرع الحالي للمعاملة:</div>
          <div className="font-bold text-amber-400 text-sm">{currentBranch?.name}</div>
        </div>

        <div>
          <ModalSelect
            label="اختر الفرع الجديد للمتابعة والتسليم:"
            required
            modalTitle="تحديد الفرع المستهدف"
            modalSubtitle="اختر الفرع الجديد لنقل ومتابعة المعاملة"
            value={targetBranchId}
            onChange={(val) => setTargetBranchId(val)}
            options={branches
              .filter(b => b.is_active && b.id !== order.current_branch_id)
              .map(b => ({
                value: b.id,
                label: b.name,
                badge: b.code,
                icon: Building2,
              }))}
            placeholder="-- انقر لاختيار فرع الاستلام الجديد --"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">سبب التحويل أو ملاحظات:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
            placeholder="مثال: رغبة العميل في الاستلام قرب مقر عمله"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all shadow-md"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>تأكيد النقل للفرع</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
};
