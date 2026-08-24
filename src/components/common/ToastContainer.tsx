/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modern Floating Toast Notification Container
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-notification-container"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-md pointer-events-none"
      dir="rtl"
    >
      {toasts.map(toast => {
        const iconMap = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
        };

        const borderMap = {
          success: 'border-amber-500/50 bg-amber-500/25 text-slate-100 shadow-amber-500/10',
          error: 'border-amber-500/50 bg-amber-500/25 text-slate-100 shadow-amber-500/10',
          warning: 'border-amber-500/50 bg-amber-500/25 text-slate-100 shadow-amber-500/10',
          info: 'border-amber-500/50 bg-amber-500/25 text-slate-100 shadow-amber-500/10',
        };

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in zoom-in-95 ${borderMap[toast.type]}`}
          >
            <div className="mt-0.5">{iconMap[toast.type]}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
